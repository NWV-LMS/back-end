import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  IsIn,
} from 'class-validator';
import { TeacherSubject } from '../../enums/teacher-subjects.enum';

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(TeacherSubject, { each: true })
  subjects?: TeacherSubject[];

  @IsOptional()
  @IsNumber()
  hourly_rate?: number;

  @IsOptional()
  @IsString()
  qualifications?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ON_LEAVE'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
}