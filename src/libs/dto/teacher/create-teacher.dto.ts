import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { TeacherSubject } from '../../enums/teacher-subjects.enum';
import { SalaryType } from '@prisma/client';

export class CreateTeacherDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  // Populated by controller from JWT — never from client
  organization_id: string;

  @IsArray()
  @IsEnum(TeacherSubject, { each: true })
  subjects: TeacherSubject[];

  @IsOptional()
  @IsNumber()
  hourly_rate?: number;

  @IsOptional()
  @IsEnum(SalaryType)
  salary_type?: SalaryType;

  @IsOptional()
  @IsString()
  qualifications?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsNumber()
  fixed_salary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percent_rate?: number;
}