import { IsOptional, IsString } from 'class-validator';

export class FinanceQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
