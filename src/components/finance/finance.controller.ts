import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceQueryDto } from '../../libs/dto/finance/finance-query.dto';
import {
  FinanceSummaryDto,
  FinanceReportDto,
} from '../../libs/dto/finance/finance-summary.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'generated/prisma/enums';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  getSummary(
    @OrganizationId() organizationId: string,
    @Query() query: FinanceQueryDto,
  ): Promise<FinanceSummaryDto> {
    return this.financeService.getSummary(organizationId, query);
  }

  @Get('report')
  getReport(
    @OrganizationId() organizationId: string,
    @Query() query: FinanceQueryDto,
  ): Promise<FinanceReportDto> {
    return this.financeService.getReport(organizationId, query);
  }
}
