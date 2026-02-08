import { OrganizationStatus } from '@prisma/client';
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

  // Notification targets (optional)
  @IsOptional()
  @IsString()
  telegram_chat_id?: string;

  @IsOptional()
  @IsString()
  whatsapp_target?: string;
}
