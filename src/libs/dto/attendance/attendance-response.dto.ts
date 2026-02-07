import { AttendanceStatus } from 'generated/prisma/enums';

export class AttendanceResponseDto {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  status: AttendanceStatus;
  marked_at: Date;
}
