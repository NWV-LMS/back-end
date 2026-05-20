import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'start_time must be in HH:mm format' })
  start_time?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'end_time must be in HH:mm format' })
  end_time?: string;
}
