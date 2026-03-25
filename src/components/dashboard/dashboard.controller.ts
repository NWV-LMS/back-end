import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { QueryDashboardDto } from '../../libs/dto/dashboard/query-dashboard.dto';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from '../../libs/dto/dashboard/dashboard-summary.dto';
import {
  PaymentsByMethodDto,
  StatusCountDto,
} from '../../libs/dto/dashboard/dashboard-analytics.dto';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get('summary')
  summary(
    @OrganizationId() organizationId: string,
    @Query() query: QueryDashboardDto,
  ): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary(organizationId, query);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get('analytics/leads-by-status')
  leadsByStatus(
    @OrganizationId() organizationId: string,
    @Query() query: QueryDashboardDto,
  ): Promise<StatusCountDto[]> {
    return this.dashboardService.leadsByStatus(organizationId, query);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get('analytics/payments-by-method')
  paymentsByMethod(
    @OrganizationId() organizationId: string,
    @Query() query: QueryDashboardDto,
  ): Promise<PaymentsByMethodDto[]> {
    return this.dashboardService.paymentsByMethod(organizationId, query);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get('analytics/payments-by-day')
  paymentsByDay(
    @OrganizationId() organizationId: string,
    @Query() query: QueryDashboardDto,
  ): Promise<{ day: string; count: number; totalAmount: string }[]> {
    return this.dashboardService.paymentsByDay(organizationId, query);
  }
}
