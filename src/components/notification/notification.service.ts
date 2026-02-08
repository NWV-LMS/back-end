import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NotificationChannel,
  NotificationJobStatus,
} from '@prisma/client';
import { DatabaseService } from '../../database/database.service';

function parseMonth(month?: string): Date {
  if (!month) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const m = month.trim();
  if (!/^\d{4}-\d{2}$/.test(m)) {
    throw new BadRequestException('month must be in YYYY-MM format');
  }
  const [yStr, moStr] = m.split('-');
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = new Date(Date.UTC(y, mo - 1, 1));
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid month');
  return d;
}

@Injectable()
export class NotificationService {
  constructor(private readonly database: DatabaseService) {}

  async dispatchPaymentReminders(
    organizationId: string,
    opts: { month?: string; daysAhead: number; lang?: string },
  ): Promise<{ message: string; queued: number }> {
    const monthDate = parseMonth(opts.month);
    const daysAhead = opts.daysAhead ?? 3;

    // Select invoice IDs with outstanding debt and due soon/overdue.
    // Using SQL because Prisma can't compare amount_paid < amount_due directly.
    const rows = await this.database.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT i.id
      FROM "Invoice" i
      WHERE i.organization_id = ${organizationId}::uuid
        AND i.month = ${monthDate}::date
        AND i.status IN ('OPEN', 'OVERDUE')
        AND i.amount_paid < i.amount_due
        AND (
          i.due_date < now()::date
          OR i.due_date <= (now()::date + (${daysAhead} || ' days')::interval)::date
        )
      ORDER BY i.due_date ASC
      LIMIT 500
    `);

    if (rows.length === 0) {
      return { message: 'No invoices to remind', queued: 0 };
    }

    const org = await this.database.organization.findUnique({
      where: { id: organizationId },
      select: { telegram_chat_id: true, whatsapp_target: true },
    });

    const telegramTarget = org?.telegram_chat_id ?? process.env.TELEGRAM_CHAT_ID ?? null;
    const whatsappTarget = org?.whatsapp_target ?? process.env.WHATSAPP_TARGET ?? null;

    const jobs: Prisma.NotificationJobCreateManyInput[] = [];
    for (const r of rows) {
      const payload = {
        invoiceId: r.id,
        lang: opts.lang ?? process.env.WHATSAPP_DEFAULT_LANG ?? 'uz',
      };
      if (telegramTarget) {
        jobs.push({
          organization_id: organizationId,
          channel: NotificationChannel.TELEGRAM,
          type: 'PAYMENT_REMINDER',
          payload,
          status: NotificationJobStatus.PENDING,
          next_run_at: new Date(),
        });
      }
      if (whatsappTarget) {
        jobs.push({
          organization_id: organizationId,
          channel: NotificationChannel.WHATSAPP,
          type: 'PAYMENT_REMINDER',
          payload,
          status: NotificationJobStatus.PENDING,
          next_run_at: new Date(),
        });
      }
    }

    if (jobs.length === 0) {
      return {
        message:
          'No notification targets configured (telegram_chat_id/whatsapp_target)',
        queued: 0,
      };
    }

    await this.database.notificationJob.createMany({ data: jobs });

    return { message: 'Notification jobs queued', queued: jobs.length };
  }

  async dispatchLessonReminders(
    organizationId: string,
    opts: { minutesAhead: number; lang?: string },
  ): Promise<{ message: string; queued: number }> {
    const minutesAhead = opts.minutesAhead ?? 180;
    const now = new Date();
    const to = new Date(now.getTime() + minutesAhead * 60_000);

    // Get groups with schedules and active date range overlapping the window.
    const groups = await this.database.group.findMany({
      where: {
        organization_id: organizationId,
        start_date: { lte: to },
        end_date: { gte: now },
      },
      select: {
        id: true,
        name: true,
        start_date: true,
        end_date: true,
        course: { select: { title: true } },
        schedules: { select: { day_of_week: true, start_minute: true, duration_minutes: true } },
      },
    });

    if (groups.length === 0) {
      return { message: 'No groups with schedules found', queued: 0 };
    }

    // Generate occurrences within [now..to].
    const occurrences: { group_id: string; start_at: Date }[] = [];
    for (const g of groups) {
      for (const s of g.schedules) {
        // Walk days in range (cheap for small windows).
        // We evaluate UTC day-of-week; keep it consistent with CalendarService.
        for (
          let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
          d <= to;
          d.setUTCDate(d.getUTCDate() + 1)
        ) {
          const jsDow = d.getUTCDay(); // 0..6
          const isoDow = jsDow === 0 ? 7 : jsDow;
          if (isoDow !== s.day_of_week) continue;

          const startAt = new Date(d);
          startAt.setUTCHours(0, 0, 0, 0);
          startAt.setUTCMinutes(s.start_minute);
          if (startAt < now || startAt > to) continue;
          if (startAt < g.start_date || startAt > g.end_date) continue;

          occurrences.push({ group_id: g.id, start_at: startAt });
        }
      }
    }

    if (occurrences.length === 0) {
      return { message: 'No upcoming sessions in the window', queued: 0 };
    }

    // Fetch enrollments & student phones for the affected groups.
    const groupIds = [...new Set(occurrences.map((o) => o.group_id))];
    const enrollments = await this.database.enrollment.findMany({
      where: { organization_id: organizationId, group_id: { in: groupIds } },
      select: {
        group_id: true,
        student: { select: { id: true, name: true, phone: true } },
        group: { select: { course: { select: { title: true } } } },
      },
    });

    const byGroup = new Map<
      string,
      { student_id: string; name: string; phone: string; course_title: string }[]
    >();
    for (const e of enrollments) {
      if (!byGroup.has(e.group_id)) byGroup.set(e.group_id, []);
      byGroup.get(e.group_id)!.push({
        student_id: e.student.id,
        name: e.student.name,
        phone: e.student.phone,
        course_title: e.group.course.title,
      });
    }

    const lang = opts.lang ?? process.env.WHATSAPP_DEFAULT_LANG ?? 'uz';

    const jobs: Prisma.NotificationJobCreateManyInput[] = [];
    for (const occ of occurrences) {
      const members = byGroup.get(occ.group_id) ?? [];
      for (const m of members) {
        jobs.push({
          organization_id: organizationId,
          channel: NotificationChannel.WHATSAPP,
          type: 'LESSON_REMINDER',
          payload: {
            to: m.phone,
            lang,
            studentName: m.name,
            courseTitle: m.course_title,
            startAt: occ.start_at.toISOString(),
          } as any,
          status: NotificationJobStatus.PENDING,
          next_run_at: new Date(),
        });
      }
    }

    if (jobs.length === 0) {
      return { message: 'No students to notify', queued: 0 };
    }

    await this.database.notificationJob.createMany({ data: jobs });
    return { message: 'Lesson reminder jobs queued', queued: jobs.length };
  }
}
