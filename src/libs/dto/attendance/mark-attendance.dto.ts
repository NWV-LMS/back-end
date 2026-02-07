import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { AttendanceStatus } from 'generated/prisma/enums';

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
