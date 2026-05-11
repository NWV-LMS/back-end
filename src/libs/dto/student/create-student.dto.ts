import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  parent?: string;

  @IsEnum(StudentStatus)
  @IsOptional()
  status?: StudentStatus;

  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;
}
