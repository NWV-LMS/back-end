import {
  IsEmail,
  IsEnum,
  isNotEmpty,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from 'generated/prisma/enums';

export class InviteUserDto {

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  full_name: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\+996\d{9}$/, {
    message: 'Phone must be in format +996XXXXXXXXX',
  })
  phone: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  title?: string; // ixtiyoriy, teacher uchun qo‘shimcha ma’lumot
}
