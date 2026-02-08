import { IsNumber, IsEnum, IsString, Min } from 'class-validator';
import { ExpenseCategory } from 'generated/prisma/enums';

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  description: string;
}
