export class NotificationSettingsResponseDto {
  telegram!: {
    enabled: boolean;
    chatId: string | null;
    // We never return raw tokens from the API; frontend can show "Configured" using this flag.
    tokenSet: boolean;
  };

  whatsapp!: {
    enabled: boolean;
    target: string | null;
    phoneNumberId: string | null;
    apiVersion: string | null;
    cloudBaseUrl: string | null;
    tokenSet: boolean;
  };
}

