import { IsNotEmpty, IsUUID } from 'class-validator';

export class EnrollStudentDto {
  @IsUUID()
  @IsNotEmpty()
  group_id: string;
}
