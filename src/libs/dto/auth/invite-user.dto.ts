import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from 'generated/prisma/enums';

export class InviteUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole; // TEACHER | ADMIN (validated in service)
}
