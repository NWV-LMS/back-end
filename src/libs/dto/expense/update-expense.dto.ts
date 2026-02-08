import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ExpenseCategory } from '@prisma/client';

export class UpdateExpenseDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
