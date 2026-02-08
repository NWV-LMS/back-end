import { IsNumber, IsEnum, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExpenseCategory } from '@prisma/client';

export class CreateExpenseDto {
  @ApiProperty({ enum: ExpenseCategory, description: 'Expense category', example: 'SALARY' })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({ description: 'Expense amount', example: 1000000, minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Expense description', example: 'Teacher salaries for February' })
  @IsString()
  description: string;
}
