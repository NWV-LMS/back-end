import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { GenerateInvoicesDto } from '../../libs/dto/billing/generate-invoices.dto';
import { QueryInvoiceDto } from '../../libs/dto/billing/query-invoice.dto';
import {
  InvoiceResponseDto,
  PaginatedInvoiceResponseDto,
} from '../../libs/dto/billing/invoice-response.dto';
import { PayInvoiceDto } from '../../libs/dto/billing/pay-invoice.dto';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('invoices/generate')
  generateInvoices(
    @OrganizationId() organizationId: string,
    @Body() dto: GenerateInvoicesDto,
  ): Promise<{ message: string; created: number; updated: number }> {
    return this.billingService.generateInvoices(organizationId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get('invoices')
  listInvoices(
    @OrganizationId() organizationId: string,
    @Query() query: QueryInvoiceDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    return this.billingService.listInvoices(organizationId, query);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get('invoices/:id')
  getInvoice(
    @OrganizationId() organizationId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<InvoiceResponseDto> {
    return this.billingService.getInvoice(organizationId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('invoices/:id/pay')
  payInvoice(
    @OrganizationId() organizationId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('sub') cashierUserId: string,
    @Body() dto: PayInvoiceDto,
  ): Promise<{ message: string; invoice: InvoiceResponseDto }> {
    return this.billingService.payInvoice(
      organizationId,
      id,
      cashierUserId,
      dto,
    );
  }
}
