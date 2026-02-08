import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from '../../libs/dto/payment/create-payment.dto';
import { UpdatePaymentDto } from '../../libs/dto/payment/update-payment.dto';
import { QueryPaymentDto } from '../../libs/dto/payment/query-payment.dto';
import {
  PaymentResponseDto,
  PaginatedPaymentResponseDto,
} from '../../libs/dto/payment/payment-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser('sub') cashierUserId: string,
    @Body() input: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.create(organizationId, input, cashierUserId);
  }

  @Get()
  findAll(
    @OrganizationId() organizationId: string,
    @Query() query: QueryPaymentDto,
  ): Promise<PaginatedPaymentResponseDto> {
    return this.paymentService.findAll(organizationId, query);
  }

  @Get(':id')
  findOne(
    @OrganizationId() organizationId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.findOne(organizationId, id);
  }

  @Patch(':id')
  update(
    @OrganizationId() organizationId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdatePaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.update(organizationId, id, input);
  }

  @Delete(':id')
  remove(
    @OrganizationId() organizationId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.paymentService.remove(organizationId, id);
  }

  @Get('student/:studentId')
  findByStudent(
    @OrganizationId() organizationId: string,
    @Param('studentId', new ParseUUIDPipe({ version: '4' })) studentId: string,
    @Query() query: QueryPaymentDto,
  ): Promise<PaginatedPaymentResponseDto> {
    return this.paymentService.findAll(organizationId, { ...query, student_id: studentId });
  }
}
