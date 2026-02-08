import 'dotenv/config';
import { NotificationChannel, NotificationJobStatus } from '@prisma/client';
import { DatabaseService } from './database/database.service';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function sendTelegram(message: string, chatId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram send failed: ${res.status} ${body}`);
  }
}

async function sendWhatsapp(_message: string, _target: string) {
  // Provider is not configured yet.
  // When you pick a provider (Meta WhatsApp Cloud API / Twilio), implement here.
  return;
}

async function processJob(db: DatabaseService, job: any) {
  if (job.type === 'INVOICE_REMINDER') {
    const invoiceId = job.payload?.invoiceId;
    if (!invoiceId) throw new Error('Missing payload.invoiceId');

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, organization_id: job.organization_id },
      include: { student: { select: { name: true, phone: true } } },
    });
    if (!invoice) throw new Error('Invoice not found');

    const debt = invoice.amount_due.sub(invoice.amount_paid);
    if (debt.lessThanOrEqualTo(0)) return; // nothing to remind

    const month = invoice.month.toISOString().slice(0, 7);
    const due = invoice.due_date.toISOString().slice(0, 10);
    const msg = `Payment reminder\\nStudent: ${invoice.student.name} (${invoice.student.phone})\\nMonth: ${month}\\nDue: ${due}\\nDebt: ${debt.toString()}`;

    const org = await db.organization.findUnique({
      where: { id: job.organization_id },
      select: { telegram_chat_id: true, whatsapp_target: true },
    });
    const telegramTarget = org?.telegram_chat_id ?? process.env.TELEGRAM_CHAT_ID ?? null;
    const whatsappTarget = org?.whatsapp_target ?? process.env.WHATSAPP_TARGET ?? null;

    if (job.channel === NotificationChannel.TELEGRAM) {
      if (!telegramTarget) throw new Error('No telegram_chat_id configured');
      await sendTelegram(msg, telegramTarget);
      return;
    }
    if (job.channel === NotificationChannel.WHATSAPP) {
      if (!whatsappTarget) throw new Error('No whatsapp_target configured');
      await sendWhatsapp(msg, whatsappTarget);
      return;
    }
  }

  throw new Error(`Unsupported job type/channel: ${job.type}/${job.channel}`);
}

async function run() {
  const db = new DatabaseService();
  await db.$connect();

  const batchSize = Number(process.env.NOTIFICATION_WORKER_BATCH ?? '20');
  const pollMs = Number(process.env.NOTIFICATION_WORKER_POLL_MS ?? '2000');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = new Date();
    const pending = await db.notificationJob.findMany({
      where: {
        status: NotificationJobStatus.PENDING,
        next_run_at: { lte: now },
      },
      orderBy: { next_run_at: 'asc' },
      take: batchSize,
    });

    for (const j of pending) {
      // Lock job (best-effort) to avoid double processing.
      const locked = await db.notificationJob.updateMany({
        where: { id: j.id, status: NotificationJobStatus.PENDING },
        data: {
          status: NotificationJobStatus.PROCESSING,
          attempts: { increment: 1 },
          last_error: null,
        },
      });
      if (locked.count !== 1) continue;

      try {
        const job = await db.notificationJob.findUnique({ where: { id: j.id } });
        await processJob(db, job);
        await db.notificationJob.update({
          where: { id: j.id },
          data: { status: NotificationJobStatus.SENT, sent_at: new Date() },
        });
      } catch (e: any) {
        const attempts = (j.attempts ?? 0) + 1;
        const backoffMs = Math.min(attempts * 60_000, 10 * 60_000);
        await db.notificationJob.update({
          where: { id: j.id },
          data: {
            status:
              attempts >= 5 ? NotificationJobStatus.FAILED : NotificationJobStatus.PENDING,
            next_run_at: new Date(Date.now() + backoffMs),
            last_error: String(e?.message ?? e),
          },
        });
      }
    }

    await sleep(pollMs);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

