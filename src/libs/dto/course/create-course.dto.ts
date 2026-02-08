import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CourseStatus } from '@prisma/client';

export class CreateCourseDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  price: string;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus; // Default ACTIVE
}
