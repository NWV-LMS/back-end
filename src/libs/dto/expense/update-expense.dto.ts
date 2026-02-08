import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ExpenseCategory } from 'generated/prisma/enums';

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
