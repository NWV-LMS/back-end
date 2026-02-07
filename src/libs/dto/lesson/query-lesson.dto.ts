import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../common/pagination.dto';

export class QueryLessonDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  course_id?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  from_date?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  to_date?: Date;
}
