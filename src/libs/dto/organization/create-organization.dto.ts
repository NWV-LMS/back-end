import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { OrganizationStatus, UserRole } from 'generated/prisma/enums';

export class CreateOrganizationDto {
  @IsNotEmpty()
  @IsString()
  Org_name: string;

  @IsNotEmpty()
  @IsEmail()
  Org_email: string;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  Org_status?: OrganizationStatus;

  @IsNotEmpty()
  @IsEmail()
  adminEmail: string;

  @IsNotEmpty()
  @IsString()
  adminName: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  adminRole: UserRole;
}
