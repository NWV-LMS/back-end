import { OrganizationStatus, UserRole } from 'generated/prisma/enums';

import { IsDate, IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class Organ {
  @IsString()
  id: string;

  @IsString()
  organization_id: string;

  @IsString()
  Org_name: string;

  @IsEmail()
  Org_email: string;

  @IsEnum(OrganizationStatus)
  Org_status: OrganizationStatus;

  @IsEmail()
  adminEmail: string;

  @IsString()
  adminName: string;
  
  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsString()
  adminRole: UserRole;

  @IsDate()
  created_at: Date;
}
