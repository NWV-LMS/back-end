import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateLessonDto {
  @IsUUID()
  @IsNotEmpty()
  course_id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  desc?: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  start_date: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  end_date: Date;
}
