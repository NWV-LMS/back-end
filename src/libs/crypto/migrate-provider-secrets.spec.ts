import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { encryptLegacyProviderSecrets } from './migrate-provider-secrets';
import { decryptSecret, encryptSecret } from './secrets';

describe('Legacy provider credential migration', () => {
  const originalKey = process.env.APP_ENCRYPTION_KEY;
  const organization = {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  };
  const database = { organization } as unknown as Pick<
    PrismaClient,
    'organization'
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    organization.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts only legacy tokens in bounded pages and preserves stored ciphertext', async () => {
    const existing = encryptSecret('already-encrypted-fake-token');
    organization.findMany
      .mockResolvedValueOnce([
        {
          id: 'a',
          telegram_bot_token: 'legacy-telegram',
          whatsapp_cloud_token: existing,
        },
        {
          id: 'b',
          telegram_bot_token: null,
          whatsapp_cloud_token: 'legacy-whatsapp',
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(encryptLegacyProviderSecrets(database)).resolves.toEqual({
      scanned: 2,
      encrypted: 2,
      changedConcurrently: 0,
    });
    expect(organization.findMany.mock.calls[0][0].take).toBe(100);
    expect(organization.findMany.mock.calls[1][0].cursor).toEqual({ id: 'b' });
    expect(organization.updateMany).toHaveBeenCalledTimes(2);
    const [telegram, whatsapp] = organization.updateMany.mock.calls.map(
      ([call]) => call,
    );
    expect(telegram.where).toEqual({
      id: 'a',
      telegram_bot_token: 'legacy-telegram',
    });
    expect(decryptSecret(telegram.data.telegram_bot_token)).toBe(
      'legacy-telegram',
    );
    expect(whatsapp.where).toEqual({
      id: 'b',
      whatsapp_cloud_token: 'legacy-whatsapp',
    });
    expect(decryptSecret(whatsapp.data.whatsapp_cloud_token)).toBe(
      'legacy-whatsapp',
    );
  });

  it('does not overwrite a concurrently replaced credential', async () => {
    organization.findMany
      .mockResolvedValueOnce([
        {
          id: 'a',
          telegram_bot_token: 'old-token',
          whatsapp_cloud_token: null,
        },
      ])
      .mockResolvedValueOnce([]);
    organization.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(encryptLegacyProviderSecrets(database)).resolves.toEqual({
      scanned: 1,
      encrypted: 0,
      changedConcurrently: 1,
    });
    expect(organization.updateMany.mock.calls[0][0].where).toEqual({
      id: 'a',
      telegram_bot_token: 'old-token',
    });
  });

  it('fails before reading the database when encryption is unconfigured', async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    await expect(encryptLegacyProviderSecrets(database)).rejects.toThrow(
      'Provider credential encryption is not configured',
    );
    expect(organization.findMany).not.toHaveBeenCalled();
    expect(organization.updateMany).not.toHaveBeenCalled();
  });
});
