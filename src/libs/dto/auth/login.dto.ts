import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { UserRole } from 'generated/prisma/enums';

export class LoginDto {
  @IsNotEmpty()
  phone:string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}

export class LoginResponseDto {
  accessToken: string;
  refreshToken?: string;
  user: {
    full_name: string;
    id: string;
    email: string;
    role: UserRole;
    organization_id: string | null;
    phone: string;
    created_at: Date;
  };
}
