import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreatePlatformOrganizationDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  adminEmail: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  adminPassword: string;
}
