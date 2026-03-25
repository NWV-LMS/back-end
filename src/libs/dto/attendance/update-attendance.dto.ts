import { PartialType } from '@nestjs/mapped-types';
import { MarkAttendanceDto } from './mark-attendance.dto';
import { IsUUID } from 'class-validator';

export class UpdateAttendanceDto extends PartialType(MarkAttendanceDto) {
  @IsUUID()
  id: string;
}
