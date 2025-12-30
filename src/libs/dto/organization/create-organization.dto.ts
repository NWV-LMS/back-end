import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { OrganizationStatus, UserRole } from 'generated/prisma/enums';

export class CreateOrganizationDto {
  @IsNotEmpty()
  @IsString()
  Org_name: string;

  @IsNotEmpty()
  @IsEmail()
  Org_email: string;

  Org_status?: OrganizationStatus;

  @IsEmail()
  adminEmail: string;

  @IsString()
  adminName: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  adminRole: UserRole;
}
