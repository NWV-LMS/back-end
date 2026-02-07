import { IsUUID, IsBoolean, IsString, IsNotEmpty } from 'class-validator';

export class CreateProgressDto {
  @IsUUID()
  @IsNotEmpty()
  enrollment_id: string;

  @IsUUID()
  @IsNotEmpty()
  lesson_id: string;

  @IsBoolean()
  completed: boolean;

  @IsString()
  @IsNotEmpty()
  title: string;
}
