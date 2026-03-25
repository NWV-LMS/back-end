import { Type } from 'class-transformer';
import { IsDateString, IsOptional } from 'class-validator';

export class QueryCalendarDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
