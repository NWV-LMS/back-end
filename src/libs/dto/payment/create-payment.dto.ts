import { IsUUID, IsNumber, IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Student UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  student_id: string;

  @ApiProperty({ description: 'Payment amount', example: 500000, minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method', example: 'CASH' })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus, description: 'Payment status', example: 'COMPLETED' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Payment description', example: 'Monthly fee for February' })
  @IsOptional()
  @IsString()
  description?: string;
}
