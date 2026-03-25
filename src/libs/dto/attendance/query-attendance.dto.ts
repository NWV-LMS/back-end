import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { PaginationDto } from '../common/pagination.dto';
import { Type } from 'class-transformer';

export class QueryAttendanceDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
  
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
    
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
