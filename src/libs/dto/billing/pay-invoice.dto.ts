import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class PayInvoiceDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  description?: string;

  // Default: COMPLETED (count as revenue). You may send PENDING for bank transfer flows.
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
