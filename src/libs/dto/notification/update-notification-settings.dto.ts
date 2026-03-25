import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateNotificationSettingsDto {
  // Telegram
  @IsOptional()
  @IsBoolean()
  telegram_enabled?: boolean;

  // Telegram bot token (do NOT commit to git). Send empty string to clear.
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.telegram_bot_token !== '')
  @MinLength(10)
  telegram_bot_token?: string;

  // Where to send messages (group/channel/user chat id). Send empty string to clear.
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.telegram_chat_id !== '')
  @MinLength(1)
  telegram_chat_id?: string;

  // WhatsApp Cloud
  @IsOptional()
  @IsBoolean()
  whatsapp_enabled?: boolean;

  // Meta Cloud API token. Send empty string to clear.
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.whatsapp_cloud_token !== '')
  @MinLength(10)
  whatsapp_cloud_token?: string;

  // Phone Number ID from Meta. Send empty string to clear.
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.whatsapp_phone_number_id !== '')
  @MinLength(1)
  whatsapp_phone_number_id?: string;

  // Optional override; default is 'v18.0'. Send empty string to clear (fallback to default).
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.whatsapp_api_version !== '')
  @MinLength(1)
  whatsapp_api_version?: string;

  // Optional override; default is 'https://graph.facebook.com'. Send empty string to clear (fallback to default).
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.whatsapp_cloud_base_url !== '')
  @MinLength(1)
  whatsapp_cloud_base_url?: string;

  // Default WhatsApp recipient for org-wide reminders (e.g. payment reminders). Send empty string to clear.
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.whatsapp_target !== '')
  @MinLength(1)
  whatsapp_target?: string;
}
