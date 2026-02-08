import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DispatchPaymentRemindersDto {
  // YYYY-MM. Default: current month.
  @IsOptional()
  @IsString()
  month?: string;

  // Remind invoices due within N days (default 3). Overdue invoices are included regardless.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  daysAhead?: number = 3;
}

