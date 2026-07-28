import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service';

/**
 * In-process replacement for the Vercel cron (`0 0 1 * *`).
 *
 * On Vercel, monthly invoice generation was triggered by an external cron
 * hitting `GET /api/billing/cron/generate-month`. Timeweb App Platform has no
 * built-in scheduler, so the same job runs in-process here.
 *
 * IMPORTANT: `@Cron` fires once per running instance. App Platform must run a
 * SINGLE instance for this app, otherwise billing would be generated multiple
 * times in parallel. If the app is ever scaled out, replace this with a
 * distributed lock (e.g. an advisory lock in Postgres) or an external trigger.
 *
 * The HTTP endpoint in `BillingCronController` is intentionally kept for manual
 * / external triggering and is unaffected by this scheduler.
 */
@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);
  private running = false;

  constructor(private readonly billingService: BillingService) {}

  @Cron('0 0 1 * *', { name: 'billing-generate-month', timeZone: 'UTC' })
  async handleMonthlyBilling(): Promise<void> {
    // Parity with the old Vercel-only cron: do not auto-run outside production
    // (prevents dev machines from generating real invoices).
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    if (this.running) {
      this.logger.warn('Monthly billing already running; skipping this tick.');
      return;
    }
    this.running = true;
    try {
      this.logger.log('Scheduled billing generate-month started');
      const result = await this.billingService.generateForAllOrgs();
      this.logger.log(
        `Scheduled billing done: month=${result.month} orgs=${result.organizations} ok=${result.succeeded} fail=${result.failed} created=${result.totals.created} updated=${result.totals.updated}`,
      );
    } catch (err) {
      this.logger.error('Scheduled billing failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
