import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class QueryInvoiceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // YYYY-MM (e.g., 2026-02)
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  student_id?: string;

  // search by student name/phone
  @IsOptional()
  @IsString()
  search?: string;
}

