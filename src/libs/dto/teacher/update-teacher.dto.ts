import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { SalaryType } from '@prisma/client';

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

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
  @IsIn(['ACTIVE', 'INACTIVE', 'ON_LEAVE'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

  @IsOptional()
  @IsNumber()
  fixed_salary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percent_rate?: number;
}
