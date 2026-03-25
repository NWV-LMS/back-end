import { IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class DashboardFilterDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
