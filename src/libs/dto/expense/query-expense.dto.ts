import { IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ExpenseCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { DateRangeQueryDto } from '../common/date-range-query.dto';

export class QueryExpenseDto extends DateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;
}
