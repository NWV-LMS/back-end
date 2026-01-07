import { OrganizationStatus } from 'generated/prisma/enums';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}
