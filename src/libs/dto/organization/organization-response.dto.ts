import { OrganizationStatus, UserRole } from 'generated/prisma/enums';

// src/libs/dto/organization/admin-info.dto.ts
// export class AdminInfo {
//   id: string;
//   email: string;
//   full_name: string;
//   phone?: string; // ixtiyoriy
// }
// //Bu responseda keladigon datalar 
// export class Organ {
//   organization_id: string;
//   name: string;
//   email: string;
//   phone: string;
//   status: OrganizationStatus
//   created_at: Date;
// }

import { IsString, IsEmail, IsEnum, IsDate, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminInfo {
  @IsString()
  id: string;

  @IsEmail()
  email: string;

  @IsString()
  full_name: string;
}

export class Organ {
  @IsString()
  organization_id: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsEnum(OrganizationStatus)
  status: OrganizationStatus;

  @ValidateNested()
  @Type(() => AdminInfo)
  admin: AdminInfo;

  @IsDate()
  created_at: Date;
}
