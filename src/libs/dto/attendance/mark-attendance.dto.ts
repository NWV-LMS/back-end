import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class MarkAttendanceDto {
  @IsUUID()
  @IsNotEmpty()
  enrollment_id: string;

  @IsUUID()
  @IsNotEmpty()
  lesson_id: string;

  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;
}
