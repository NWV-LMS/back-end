import { OrganizationStatus } from '@prisma/client';

/** Public organization settings. Provider credentials are never returned. */
export class OrganizationSettingsResponseDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: OrganizationStatus;
  created_at: Date;
  updated_at: Date;
  logo_url: string | null;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  whatsapp_enabled: boolean;
  whatsapp_phone_number_id: string | null;
  whatsapp_api_version: string | null;
  whatsapp_cloud_base_url: string | null;
  whatsapp_target: string | null;
}
