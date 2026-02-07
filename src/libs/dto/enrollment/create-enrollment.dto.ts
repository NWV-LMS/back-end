import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID('4', { message: 'student_id must be a valid UUID' })
  @IsNotEmpty({ message: 'student_id cannot be empty' })
  student_id: string;

  @IsUUID('4', { message: 'group_id must be a valid UUID' })
  @IsNotEmpty({ message: 'group_id cannot be empty' })
  group_id: string;
}
