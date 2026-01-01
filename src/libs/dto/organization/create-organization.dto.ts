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

export class CreateExpenseDto {
  title: string;
  amount: number;
  category?: string; // rent, salary, ads
}

//paymant
export class CreatePaymentDto {
  student_id: string;
  amount: number;
  method?: string; // cash, card
}

export class DashboardFilterDto {
  from?: Date;
  to?: Date;
}

