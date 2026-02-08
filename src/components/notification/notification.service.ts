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
}
