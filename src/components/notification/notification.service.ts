import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NotificationChannel,
  NotificationJobStatus,
} from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { encryptSecret } from '../../libs/crypto/secrets';
import { NotificationSettingsResponseDto } from '../../libs/dto/notification/notification-settings-response.dto';
import { UpdateNotificationSettingsDto } from '../../libs/dto/notification/update-notification-settings.dto';

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

  async getSettings(organizationId: string): Promise<NotificationSettingsResponseDto> {
    const org = await this.database.organization.findUnique({
      where: { id: organizationId },
      select: {
        telegram_enabled: true,
        telegram_chat_id: true,
        telegram_bot_token: true,
        whatsapp_enabled: true,
        whatsapp_target: true,
        whatsapp_cloud_token: true,
        whatsapp_phone_number_id: true,
        whatsapp_api_version: true,
        whatsapp_cloud_base_url: true,
      },
    });
    if (!org) throw new BadRequestException('Organization not found');

    return {
      telegram: {
        enabled: org.telegram_enabled,
        chatId: org.telegram_chat_id ?? null,
        tokenSet: !!(org.telegram_bot_token && org.telegram_bot_token.trim().length > 0),
      },
      whatsapp: {
        enabled: org.whatsapp_enabled,
        target: org.whatsapp_target ?? null,
        phoneNumberId: org.whatsapp_phone_number_id ?? null,
        apiVersion: org.whatsapp_api_version ?? null,
        cloudBaseUrl: org.whatsapp_cloud_base_url ?? null,
        tokenSet: !!(org.whatsapp_cloud_token && org.whatsapp_cloud_token.trim().length > 0),
      },
    };
  }

  async updateSettings(
    organizationId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsResponseDto> {
    const org = await this.database.organization.findUnique({
      where: { id: organizationId },
      select: {
        telegram_enabled: true,
        telegram_chat_id: true,
        telegram_bot_token: true,
        whatsapp_enabled: true,
        whatsapp_target: true,
        whatsapp_cloud_token: true,
        whatsapp_phone_number_id: true,
        whatsapp_api_version: true,
        whatsapp_cloud_base_url: true,
      },
    });
    if (!org) throw new BadRequestException('Organization not found');

    const next = {
      telegram_enabled: dto.telegram_enabled ?? org.telegram_enabled,
      telegram_chat_id:
        dto.telegram_chat_id === '' ? null : dto.telegram_chat_id ?? org.telegram_chat_id,
      telegram_bot_token:
        dto.telegram_bot_token === ''
          ? null
          : dto.telegram_bot_token
            ? encryptSecret(dto.telegram_bot_token)
            : org.telegram_bot_token,

      whatsapp_enabled: dto.whatsapp_enabled ?? org.whatsapp_enabled,
      whatsapp_target:
        dto.whatsapp_target === '' ? null : dto.whatsapp_target ?? org.whatsapp_target,
      whatsapp_cloud_token:
        dto.whatsapp_cloud_token === ''
          ? null
          : dto.whatsapp_cloud_token
            ? encryptSecret(dto.whatsapp_cloud_token)
            : org.whatsapp_cloud_token,
      whatsapp_phone_number_id:
        dto.whatsapp_phone_number_id === ''
          ? null
          : dto.whatsapp_phone_number_id ?? org.whatsapp_phone_number_id,
      whatsapp_api_version:
        dto.whatsapp_api_version === ''
          ? null
          : dto.whatsapp_api_version ?? org.whatsapp_api_version,
      whatsapp_cloud_base_url:
        dto.whatsapp_cloud_base_url === ''
          ? null
          : dto.whatsapp_cloud_base_url ?? org.whatsapp_cloud_base_url,
    };

    // Production guardrails: if a channel is enabled, it must be fully configured.
    if (next.telegram_enabled) {
      const hasToken = !!(next.telegram_bot_token && next.telegram_bot_token.trim().length > 0);
      if (!hasToken) {
        throw new BadRequestException('telegram_bot_token is required when telegram_enabled=true');
      }
      if (!next.telegram_chat_id) {
        throw new BadRequestException('telegram_chat_id is required when telegram_enabled=true');
      }
    }

    if (next.whatsapp_enabled) {
      const hasToken = !!(next.whatsapp_cloud_token && next.whatsapp_cloud_token.trim().length > 0);
      if (!hasToken) {
        throw new BadRequestException(
          'whatsapp_cloud_token is required when whatsapp_enabled=true',
        );
      }
      if (!next.whatsapp_phone_number_id) {
        throw new BadRequestException(
          'whatsapp_phone_number_id is required when whatsapp_enabled=true',
        );
      }
    }

    await this.database.organization.update({
      where: { id: organizationId },
      data: next,
    });

    return this.getSettings(organizationId);
  }

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
      select: {
        telegram_enabled: true,
        telegram_chat_id: true,
        whatsapp_enabled: true,
      },
    });

    const telegramTarget = org?.telegram_enabled
      ? org?.telegram_chat_id ?? process.env.TELEGRAM_CHAT_ID ?? null
      : null;
    const whatsappEnabled = !!org?.whatsapp_enabled;

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
      if (whatsappEnabled) {
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
        message: 'No notification channels enabled/configured',
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
    const org = await this.database.organization.findUnique({
      where: { id: organizationId },
      select: { whatsapp_enabled: true },
    });
    if (!org?.whatsapp_enabled) {
      return { message: 'WhatsApp notifications are disabled for this organization', queued: 0 };
    }

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
