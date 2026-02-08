import { AttendanceStatus } from '@prisma/client';

export class AttendanceResponseDto {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  status: AttendanceStatus;
  marked_at: Date;
}
