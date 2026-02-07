import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryEnrollmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit: number = 10;

  @IsOptional()
  @IsUUID('4', { message: 'student_id must be a valid UUID' })
  student_id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'group_id must be a valid UUID' })
  group_id?: string;
}
