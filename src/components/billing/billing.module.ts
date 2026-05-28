import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { BillingController } from './billing.controller';
import { BillingCronController } from './billing.cron.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BillingController, BillingCronController],
  providers: [BillingService],
})
export class BillingModule {}
