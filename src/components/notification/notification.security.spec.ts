import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { decryptSecret, encryptSecret } from '../../libs/crypto/secrets';
import { NotificationService } from './notification.service';

describe('Dedicated notification settings credential safety', () => {
  const originalKey = process.env.APP_ENCRYPTION_KEY;
  const organization = { findUnique: jest.fn(), update: jest.fn() };
  const service = new NotificationService({
    organization,
  } as unknown as DatabaseService);
  const disabled = {
    telegram_enabled: false,
    telegram_chat_id: null,
    telegram_bot_token: null,
    whatsapp_enabled: false,
    whatsapp_target: null,
    whatsapp_cloud_token: null,
    whatsapp_phone_number_id: null,
    whatsapp_api_version: 'v18.0',
    whatsapp_cloud_base_url: 'https://graph.facebook.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    organization.findUnique.mockResolvedValue(disabled);
    organization.update.mockImplementation(async ({ data }) => {
      organization.findUnique.mockResolvedValue(data);
      return data;
    });
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts configured channels and returns presence flags without credentials', async () => {
    const response = await service.updateSettings('org', {
      telegram_enabled: true,
      telegram_chat_id: 'chat-id',
      telegram_bot_token: 'fake-telegram-token',
      whatsapp_enabled: true,
      whatsapp_phone_number_id: 'phone-id',
      whatsapp_cloud_token: 'fake-whatsapp-token',
    });
    const data = organization.update.mock.calls[0][0].data;
    expect(decryptSecret(data.telegram_bot_token)).toBe('fake-telegram-token');
    expect(decryptSecret(data.whatsapp_cloud_token)).toBe(
      'fake-whatsapp-token',
    );
    expect(response.telegram).toEqual({
      enabled: true,
      chatId: 'chat-id',
      tokenSet: true,
    });
    expect(response.whatsapp.tokenSet).toBe(true);
    expect(JSON.stringify(response)).not.toContain('fake-');
    expect(JSON.stringify(response)).not.toContain('enc:v1:');
  });

  it('does not encrypt an existing ciphertext again during metadata updates', async () => {
    const ciphertext = encryptSecret('fake-telegram-token');
    organization.findUnique.mockResolvedValue({
      ...disabled,
      telegram_bot_token: ciphertext,
    });
    await service.updateSettings('org', { telegram_chat_id: 'new-chat' });
    expect(organization.update.mock.calls[0][0].data.telegram_bot_token).toBe(
      ciphertext,
    );
  });

  it('can clear disabled credentials without a key while enabled channels still require a token', async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    await service.updateSettings('org', {
      telegram_bot_token: '',
      whatsapp_cloud_token: '',
    });
    expect(
      organization.update.mock.calls[0][0].data.telegram_bot_token,
    ).toBeNull();
    expect(
      organization.update.mock.calls[0][0].data.whatsapp_cloud_token,
    ).toBeNull();
    organization.update.mockClear();
    await expect(
      service.updateSettings('org', {
        telegram_enabled: true,
        telegram_chat_id: 'chat-id',
        telegram_bot_token: '',
      }),
    ).rejects.toThrow('telegram_bot_token is required');
    expect(organization.update).not.toHaveBeenCalled();
  });

  it('fails before writing token or metadata changes when encryption is unavailable', async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    await expect(
      service.updateSettings('org', {
        telegram_chat_id: 'not-saved',
        telegram_bot_token: 'fake-provider-token',
      }),
    ).rejects.toThrow('Provider credential encryption is not configured');
    expect(organization.update).not.toHaveBeenCalled();
  });
});
