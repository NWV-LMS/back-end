import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class InviteUserDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  full_name: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?\d{9,15}$/, {
    message: 'Phone must be 9-15 digits, optional + prefix',
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
