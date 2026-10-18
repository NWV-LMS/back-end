import { IsDateString, IsOptional, Matches } from 'class-validator';

const dateOrTimestampPattern =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export class DateRangeQueryDto {
  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  @Matches(dateOrTimestampPattern, {
    message: 'from must be a date (YYYY-MM-DD) or an ISO timestamp',
  })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  @Matches(dateOrTimestampPattern, {
    message: 'to must be a date (YYYY-MM-DD) or an ISO timestamp',
  })
  to?: string;
}
