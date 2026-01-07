import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateGroupDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsUUID()
  course_id: string;

  @IsNotEmpty()
  @IsUUID()
  teacher_id: string;

  @IsNotEmpty()
  @IsDateString()
  start_date: string;

  @IsNotEmpty()
  @IsDateString()
  end_date: string;
}
