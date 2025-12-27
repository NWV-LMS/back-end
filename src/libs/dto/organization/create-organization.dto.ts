import { Or } from '@prisma/client/runtime/client'
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { OrganizationStatus, UserRole } from 'generated/prisma/enums';

export class CreateOrganizationDto {

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  status?:OrganizationStatus;

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;
}
