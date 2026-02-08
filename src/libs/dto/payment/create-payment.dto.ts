import { IsUUID, IsNumber, IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  student_id: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  description?: string;
}
