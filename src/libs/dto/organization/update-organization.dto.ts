import { OrganizationStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

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

  // Notification settings
  @IsOptional()
  @IsBoolean()
  telegram_enabled?: boolean;

  @IsOptional()
  @IsString()
  telegram_bot_token?: string;

  @IsOptional()
  @IsString()
  telegram_chat_id?: string;

  @IsOptional()
  @IsBoolean()
  whatsapp_enabled?: boolean;

  @IsOptional()
  @IsString()
  whatsapp_cloud_token?: string;

  @IsOptional()
  @IsString()
  whatsapp_phone_number_id?: string;

  @IsOptional()
  @IsString()
  whatsapp_api_version?: string;

  @IsOptional()
  @IsString()
  whatsapp_cloud_base_url?: string;

  @IsOptional()
  @IsString()
  whatsapp_target?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;
}
