import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DispatchPaymentRemindersDto } from '../../libs/dto/notification/dispatch-payment-reminders.dto';
import { NotificationService } from './notification.service';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('dispatch/payment-reminders')
  dispatchPaymentReminders(
    @OrganizationId() organizationId: string,
    @Body() dto: DispatchPaymentRemindersDto,
  ): Promise<{ message: string; queued: number }> {
    return this.notificationService.dispatchPaymentReminders(organizationId, {
      month: dto.month,
      daysAhead: dto.daysAhead ?? 3,
    });
  }
}

