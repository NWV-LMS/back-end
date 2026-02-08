import 'dotenv/config';
import { NotificationChannel, NotificationJobStatus } from '@prisma/client';
import { DatabaseService } from './database/database.service';
import { WhatsAppTemplates, WhatsAppLanguageCode } from './libs/notification/whatsapp-templates';
import { decryptSecret } from './libs/crypto/secrets';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function sendTelegram(message: string, chatId: string, token: string) {
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

type WhatsAppTemplateMessage = {
  templateName: string;
  languageCode: string;
  // Optional template components.
  components?: any[];
};

type WhatsAppCloudConfig = {
  token: string;
  phoneNumberId: string;
  version: string;
  baseUrl: string;
};

async function sendWhatsappText(
  message: string,
  targetRaw: string,
  cfg: WhatsAppCloudConfig,
) {
  const target = normalizeWhatsAppTarget(targetRaw);
  if (!target) throw new Error('Invalid WhatsApp target');

  const url = `${cfg.baseUrl}/${cfg.version}/${cfg.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cfg.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: target,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }),
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`WhatsApp send failed: ${res.status} ${text}`);
  }
}

async function sendWhatsappTemplate(
  msg: WhatsAppTemplateMessage,
  targetRaw: string,
  cfg: WhatsAppCloudConfig,
) {
  const target = normalizeWhatsAppTarget(targetRaw);
  if (!target) throw new Error('Invalid WhatsApp target');

  const url = `${cfg.baseUrl}/${cfg.version}/${cfg.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cfg.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: target,
      type: 'template',
      template: {
        name: msg.templateName,
        language: { code: msg.languageCode },
        ...(msg.components ? { components: msg.components } : {}),
      },
    }),
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`WhatsApp template send failed: ${res.status} ${text}`);
  }
}

type OrgNotificationConfig = {
  telegram: {
    enabled: boolean;
    botToken: string | null;
    chatId: string | null;
  };
  whatsapp: {
    enabled: boolean;
    cloudToken: string | null;
    phoneNumberId: string | null;
    apiVersion: string | null;
    cloudBaseUrl: string | null;
    target: string | null;
  };
};

const orgConfigCache = new Map<string, { expiresAt: number; cfg: OrgNotificationConfig }>();

async function getOrgConfig(db: DatabaseService, organizationId: string): Promise<OrgNotificationConfig> {
  const cached = orgConfigCache.get(organizationId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.cfg;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      telegram_enabled: true,
      telegram_bot_token: true,
      telegram_chat_id: true,
      whatsapp_enabled: true,
      whatsapp_cloud_token: true,
      whatsapp_phone_number_id: true,
      whatsapp_api_version: true,
      whatsapp_cloud_base_url: true,
      whatsapp_target: true,
    },
  });

  const telegramToken = org?.telegram_bot_token
    ? decryptSecret(org.telegram_bot_token)
    : process.env.TELEGRAM_BOT_TOKEN ?? null;
  const whatsappToken = org?.whatsapp_cloud_token
    ? decryptSecret(org.whatsapp_cloud_token)
    : process.env.WHATSAPP_CLOUD_TOKEN ?? null;

  const cfg: OrgNotificationConfig = {
    telegram: {
      enabled: !!org?.telegram_enabled,
      botToken: telegramToken ?? null,
      chatId: org?.telegram_chat_id ?? process.env.TELEGRAM_CHAT_ID ?? null,
    },
    whatsapp: {
      enabled: !!org?.whatsapp_enabled,
      cloudToken: whatsappToken ?? null,
      phoneNumberId: org?.whatsapp_phone_number_id ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      apiVersion: org?.whatsapp_api_version ?? process.env.WHATSAPP_API_VERSION ?? 'v18.0',
      cloudBaseUrl:
        org?.whatsapp_cloud_base_url ??
        process.env.WHATSAPP_CLOUD_BASE_URL ??
        'https://graph.facebook.com',
      target: org?.whatsapp_target ?? process.env.WHATSAPP_TARGET ?? null,
    },
  };

  // Cache for a short time (tokens rarely change, reduces DB reads).
  orgConfigCache.set(organizationId, { cfg, expiresAt: now + 60_000 });
  return cfg;
}

function requireWhatsAppConfig(orgCfg: OrgNotificationConfig): WhatsAppCloudConfig {
  const token = orgCfg.whatsapp.cloudToken;
  const phoneNumberId = orgCfg.whatsapp.phoneNumberId;
  if (!token) throw new Error('CONFIG: WhatsApp token is not configured');
  if (!phoneNumberId) throw new Error('CONFIG: WhatsApp phone_number_id is not configured');
  return {
    token,
    phoneNumberId,
    version: orgCfg.whatsapp.apiVersion ?? 'v18.0',
    baseUrl: orgCfg.whatsapp.cloudBaseUrl ?? 'https://graph.facebook.com',
  };
}

function requireTelegramConfig(orgCfg: OrgNotificationConfig): { token: string; chatId: string } {
  const token = orgCfg.telegram.botToken;
  const chatId = orgCfg.telegram.chatId;
  if (!token) throw new Error('CONFIG: Telegram bot token is not configured');
  if (!chatId) throw new Error('CONFIG: Telegram chat_id is not configured');
  return { token, chatId };
}

async function processJob(db: DatabaseService, job: any) {
  const orgCfg = await getOrgConfig(db, job.organization_id);

  if (job.type === 'PAYMENT_REMINDER') {
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
    const msg = `Payment reminder\nStudent: ${invoice.student.name} (${invoice.student.phone})\nMonth: ${month}\nDue: ${due}\nDebt: ${debt.toString()}`;

    const whatsappTarget =
      job.payload?.to ?? invoice.student.phone ?? orgCfg.whatsapp.target ?? null;
    const lang = (job.payload?.lang ??
      process.env.WHATSAPP_DEFAULT_LANG ??
      'uz') as WhatsAppLanguageCode;

    if (job.channel === NotificationChannel.TELEGRAM) {
      if (!orgCfg.telegram.enabled) return; // org disabled after job was queued
      const t = requireTelegramConfig(orgCfg);
      await sendTelegram(msg, t.chatId, t.token);
      return;
    }
    if (job.channel === NotificationChannel.WHATSAPP) {
      if (!orgCfg.whatsapp.enabled) return; // org disabled after job was queued
      if (!whatsappTarget) throw new Error('CONFIG: No WhatsApp recipient is configured');
      const waCfg = requireWhatsAppConfig(orgCfg);
      const tpl = WhatsAppTemplates.PAYMENT_REMINDER;
      const languageCode = tpl.languages[lang] ?? tpl.languages.uz;
      // Optional: pass body parameters if your template uses variables.
      // Adjust parameter ordering to match your template definition.
      const components = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: invoice.student.name },
            { type: 'text', text: month },
            { type: 'text', text: due },
            { type: 'text', text: debt.toString() },
          ],
        },
      ];
      await sendWhatsappTemplate(
        { templateName: tpl.name, languageCode, components },
        whatsappTarget,
        waCfg,
      );
      return;
    }
  }

  if (job.type === 'LESSON_REMINDER') {
    if (job.channel !== NotificationChannel.WHATSAPP) {
      throw new Error('LESSON_REMINDER supports only WhatsApp for now');
    }

    const to = job.payload?.to;
    const studentName = job.payload?.studentName;
    const courseTitle = job.payload?.courseTitle;
    const startAtIso = job.payload?.startAt;
    if (!to || !studentName || !courseTitle || !startAtIso) {
      throw new Error('Missing lesson reminder payload fields');
    }

    const lang = (job.payload?.lang ??
      process.env.WHATSAPP_DEFAULT_LANG ??
      'uz') as WhatsAppLanguageCode;

    // Template placeholders (provided by you):
    // {{1}} = student name
    // {{2}} = course title
    // {{3}} = start time/date-time
    const startAt = new Date(startAtIso);
    const startText = Number.isNaN(startAt.getTime())
      ? String(startAtIso)
      : `${startAt.toISOString().slice(0, 10)} ${startAt.toISOString().slice(11, 16)}`;

    const tpl = WhatsAppTemplates.LESSON_REMINDER;
    const languageCode = tpl.languages[lang] ?? tpl.languages.uz;
    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: String(studentName) },
          { type: 'text', text: String(courseTitle) },
          { type: 'text', text: startText },
        ],
      },
    ];

    if (!orgCfg.whatsapp.enabled) return;
    const waCfg = requireWhatsAppConfig(orgCfg);
    await sendWhatsappTemplate(
      { templateName: tpl.name, languageCode, components },
      String(to),
      waCfg,
    );
    return;
  }

  throw new Error(`Unsupported job type/channel: ${job.type}/${job.channel}`);
}

function normalizeWhatsAppTarget(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const digits = s.startsWith('+') ? s.slice(1) : s;
  return digits.replace(/\D/g, '');
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
        const msg = String(e?.message ?? e);
        await db.notificationJob.update({
          where: { id: j.id },
          data: {
            status:
              msg.startsWith('CONFIG:')
                ? NotificationJobStatus.FAILED
                : attempts >= 5
                  ? NotificationJobStatus.FAILED
                  : NotificationJobStatus.PENDING,
            next_run_at: new Date(Date.now() + backoffMs),
            last_error: msg,
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
