import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DispatchPaymentRemindersDto } from '../../libs/dto/notification/dispatch-payment-reminders.dto';
import { DispatchLessonRemindersDto } from '../../libs/dto/notification/dispatch-lesson-reminders.dto';
import { NotificationSettingsResponseDto } from '../../libs/dto/notification/notification-settings-response.dto';
import { UpdateNotificationSettingsDto } from '../../libs/dto/notification/update-notification-settings.dto';
import { NotificationService } from './notification.service';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // Per-organization provider config (tokens are never returned).
  @Roles(UserRole.ADMIN)
  @Get('settings')
  getSettings(
    @OrganizationId() organizationId: string,
  ): Promise<NotificationSettingsResponseDto> {
    return this.notificationService.getSettings(organizationId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('settings')
  updateSettings(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsResponseDto> {
    return this.notificationService.updateSettings(organizationId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('dispatch/payment-reminders')
  dispatchPaymentReminders(
    @OrganizationId() organizationId: string,
    @Body() dto: DispatchPaymentRemindersDto,
  ): Promise<{ message: string; queued: number }> {
    return this.notificationService.dispatchPaymentReminders(organizationId, {
      month: dto.month,
      daysAhead: dto.daysAhead ?? 3,
      lang: dto.lang,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('dispatch/lesson-reminders')
  dispatchLessonReminders(
    @OrganizationId() organizationId: string,
    @Body() dto: DispatchLessonRemindersDto,
  ): Promise<{ message: string; queued: number }> {
    return this.notificationService.dispatchLessonReminders(organizationId, {
      minutesAhead: dto.minutesAhead ?? 180,
      lang: dto.lang,
    });
  }
}
