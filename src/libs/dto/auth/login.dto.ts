import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}

export class LoginResponseDto {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    full_name: string;
    phone: string;
    email: string;
    role: UserRole;
    organization_id: string | null;
    created_at: Date;
  };
}
