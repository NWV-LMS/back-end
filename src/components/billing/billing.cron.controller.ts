import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingService } from './billing.service';

@Controller('billing/cron')
export class BillingCronController {
  private readonly logger = new Logger(BillingCronController.name);

  constructor(private readonly billingService: BillingService) {}

  // Vercel Cron hits this with `Authorization: Bearer ${CRON_SECRET}`.
  // No JWT guard - secured by shared secret instead.
  @Get('generate-month')
  async runScheduled(
    @Headers('authorization') authHeader: string | undefined,
    @Query('month') month?: string,
  ) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new ForbiddenException('CRON_SECRET not configured');
    }
    const expected = `Bearer ${secret}`;
    if (authHeader !== expected) {
      throw new ForbiddenException('Invalid cron token');
    }
    this.logger.log(`Cron generate-month started (month=${month ?? 'current'})`);
    const result = await this.billingService.generateForAllOrgs(month);
    this.logger.log(
      `Cron generate-month done: month=${result.month} orgs=${result.organizations} ok=${result.succeeded} fail=${result.failed} created=${result.totals.created} updated=${result.totals.updated}`,
    );
    return result;
  }

  // Admin-only manual trigger for dev/ops.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('run-now')
  runNow(@Query('month') month?: string) {
    return this.billingService.generateForAllOrgs(month);
  }
}
