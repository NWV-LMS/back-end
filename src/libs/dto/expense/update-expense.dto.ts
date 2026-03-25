import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory } from '@prisma/client';

export class UpdateExpenseDto {
  @ApiPropertyOptional({
    enum: ExpenseCategory,
    description: 'Expense category',
  })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiPropertyOptional({ description: 'Expense amount', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Expense description' })
  @IsOptional()
  @IsString()
  description?: string;
}
