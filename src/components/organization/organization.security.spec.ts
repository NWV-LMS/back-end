import { OrganizationStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { decryptSecret, encryptSecret } from '../../libs/crypto/secrets';
import { OrganizationService } from './organization.service';

describe('Organization settings credential safety', () => {
  const originalKey = process.env.APP_ENCRYPTION_KEY;
  const organization = { findUnique: jest.fn(), update: jest.fn() };
  const service = new OrganizationService({
    organization,
  } as unknown as DatabaseService);
  const org = {
    id: 'settings-org',
    name: 'School',
    email: 'school@example.test',
    phone: 'school-phone',
    status: OrganizationStatus.ACTIVE,
    created_at: new Date(),
    updated_at: new Date(),
    logo_url: null,
    telegram_enabled: false,
    telegram_chat_id: 'chat-id',
    whatsapp_enabled: false,
    whatsapp_phone_number_id: 'phone-id',
    whatsapp_api_version: 'v18.0',
    whatsapp_cloud_base_url: 'https://graph.facebook.com',
    whatsapp_target: 'recipient',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    organization.findUnique.mockResolvedValue(org);
    organization.update.mockResolvedValue(org);
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = originalKey;
  });

  it('returns only public fields even if a database adapter provides credentials', async () => {
    organization.findUnique.mockResolvedValue({
      ...org,
      telegram_bot_token: 'legacy-fake-token',
      whatsapp_cloud_token: encryptSecret('fake-whatsapp-token'),
    });
    expect(await service.getOrganization(org.id)).toEqual(org);
    const query = organization.findUnique.mock.calls[0][0];
    expect(query.select).not.toHaveProperty('telegram_bot_token');
    expect(query.select).not.toHaveProperty('whatsapp_cloud_token');
  });

  it('encrypts new credentials on the generic update path', async () => {
    await service.updateOrganization(org.id, {
      telegram_bot_token: 'fake-telegram-token',
      whatsapp_cloud_token: 'fake-whatsapp-token',
    });
    const data = organization.update.mock.calls[0][0].data;
    expect(data.telegram_bot_token).toMatch(/^enc:v1:/);
    expect(data.whatsapp_cloud_token).toMatch(/^enc:v1:/);
    expect(decryptSecret(data.telegram_bot_token)).toBe('fake-telegram-token');
    expect(decryptSecret(data.whatsapp_cloud_token)).toBe(
      'fake-whatsapp-token',
    );
  });

  it('keeps omitted credentials unchanged and clears explicitly empty credentials without a key', async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    await service.updateOrganization(org.id, { name: 'Updated school' });
    expect(
      organization.update.mock.calls[0][0].data.telegram_bot_token,
    ).toBeUndefined();
    expect(
      organization.update.mock.calls[0][0].data.whatsapp_cloud_token,
    ).toBeUndefined();
    await service.updateOrganization(org.id, {
      telegram_bot_token: '',
      whatsapp_cloud_token: '',
    });
    expect(
      organization.update.mock.calls[1][0].data.telegram_bot_token,
    ).toBeNull();
    expect(
      organization.update.mock.calls[1][0].data.whatsapp_cloud_token,
    ).toBeNull();
  });

  it('does not write any changes if credential encryption is unavailable', async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    await expect(
      service.updateOrganization(org.id, {
        name: 'Must not persist',
        telegram_bot_token: 'fake-token',
      }),
    ).rejects.toThrow('Provider credential encryption is not configured');
    expect(organization.update).not.toHaveBeenCalled();
  });
});
