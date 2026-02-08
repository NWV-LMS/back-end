import { IsEnum, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ExpenseCategory } from 'generated/prisma/enums';
import { Type } from 'class-transformer';

export class QueryExpenseDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
