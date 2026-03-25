import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class RescheduleLessonDto {
  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  // If true, delete all attendance records for this lesson in the organization.
  @IsOptional()
  @IsBoolean()
  resetAttendance?: boolean = false;
}
