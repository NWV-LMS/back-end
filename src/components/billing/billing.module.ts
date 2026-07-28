import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { BillingController } from './billing.controller';
import { BillingCronController } from './billing.cron.controller';
import { BillingScheduler } from './billing.scheduler';
import { BillingService } from './billing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BillingController, BillingCronController],
  providers: [BillingService, BillingScheduler],
})
export class BillingModule {}
