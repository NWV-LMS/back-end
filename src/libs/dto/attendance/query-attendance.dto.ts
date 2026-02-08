import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { PaginationDto } from '../common/pagination.dto';

export class QueryAttendanceDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  enrollment_id?: string;

  @IsUUID()
  @IsOptional()
  lesson_id?: string;

  @IsUUID()
  @IsOptional()
  group_id?: string;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;
}
