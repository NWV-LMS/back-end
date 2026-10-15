import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OrganizationStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import * as request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { decryptSecret, encryptSecret } from '../src/libs/crypto/secrets';
import { encryptLegacyProviderSecrets } from '../src/libs/crypto/migrate-provider-secrets';
import {
  closeTestApp,
  createTestApp,
  getAuthToken,
  getDatabase,
  getTestOrganizationId,
} from './setup-e2e';

describe('Organization settings credential security (real PostgreSQL)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let organizationId: string;
  let adminToken: string;
  let managerToken: string;
  let platformToken: string;
  const originalKey = process.env.APP_ENCRYPTION_KEY;
  const encryptionKey = randomBytes(32).toString('base64');
  const telegramToken = 'fake-telegram-provider-token-for-security-tests';
  const whatsappToken = 'fake-whatsapp-provider-token-for-security-tests';

  function settings(method: 'get' | 'patch', token = adminToken) {
    return request(app.getHttpServer())
      [method]('/api/organizations/settings')
      .auth(token, { type: 'bearer' });
  }

  function notifications(method: 'get' | 'patch', token = adminToken) {
    return request(app.getHttpServer())
      [method]('/api/notifications/settings')
      .auth(token, { type: 'bearer' });
  }

  function expectNoCredentials(body: unknown) {
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(telegramToken);
    expect(serialized).not.toContain(whatsappToken);
    expect(serialized).not.toContain('telegram_bot_token');
    expect(serialized).not.toContain('whatsapp_cloud_token');
    expect(serialized).not.toContain('enc:v1:');
  }

  beforeAll(async () => {
    process.env.APP_ENCRYPTION_KEY = encryptionKey;
    app = await createTestApp();
    database = getDatabase();
    adminToken = await getAuthToken();
    organizationId = getTestOrganizationId();
    const jwt = new JwtService();
    for (const role of [UserRole.MANAGER, UserRole.SUPER_ADMIN]) {
      const suffix = randomUUID();
      const user = await database.user.create({
        data: {
          organization_id: organizationId,
          role,
          full_name: 'Settings Security Fixture',
          email: `${suffix}@example.test`,
          phone: `settings-${suffix}`,
          password: 'fixture-not-used-for-login',
        },
      });
      const token = jwt.sign(
        {
          sub: user.id,
          role,
          organization_id: organizationId,
          token_use: 'access',
        },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
      );
      if (role === UserRole.MANAGER) managerToken = token;
      else platformToken = token;
    }
  });

  beforeEach(async () => {
    process.env.APP_ENCRYPTION_KEY = encryptionKey;
    await database.organization.update({
      where: { id: organizationId },
      data: {
        status: OrganizationStatus.ACTIVE,
        telegram_enabled: false,
        telegram_bot_token: null,
        telegram_chat_id: 'test-chat',
        whatsapp_enabled: false,
        whatsapp_cloud_token: null,
        whatsapp_phone_number_id: 'test-phone-id',
        whatsapp_target: 'test-recipient',
      },
    });
  });

  afterAll(async () => {
    try {
      await closeTestApp();
    } finally {
      if (originalKey === undefined) delete process.env.APP_ENCRYPTION_KEY;
      else process.env.APP_ENCRYPTION_KEY = originalKey;
    }
  });

  it('encrypts generic writes in the database and returns useful public settings to managers', async () => {
    const updated = await settings('patch')
      .send({
        telegram_bot_token: telegramToken,
        whatsapp_cloud_token: whatsappToken,
      })
      .expect(200);
    expectNoCredentials(updated.body);
    const stored = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(stored.telegram_bot_token).toMatch(/^enc:v1:/);
    expect(stored.whatsapp_cloud_token).toMatch(/^enc:v1:/);
    expect(decryptSecret(stored.telegram_bot_token)).toBe(telegramToken);
    expect(decryptSecret(stored.whatsapp_cloud_token)).toBe(whatsappToken);

    const response = await settings('get', managerToken).expect(200);
    expect(response.body).toMatchObject({
      id: organizationId,
      name: stored.name,
      email: stored.email,
      phone: stored.phone,
      telegram_chat_id: 'test-chat',
      whatsapp_phone_number_id: 'test-phone-id',
      whatsapp_target: 'test-recipient',
    });
    expectNoCredentials(response.body);
    await notifications('get', managerToken).expect(403);
  });

  it('keeps legacy plaintext and ciphertext out of both manager and admin settings responses', async () => {
    await database.organization.update({
      where: { id: organizationId },
      data: {
        telegram_bot_token: telegramToken,
        whatsapp_cloud_token: encryptSecret(whatsappToken),
      },
    });
    for (const token of [managerToken, adminToken]) {
      const response = await settings('get', token).expect(200);
      expectNoCredentials(response.body);
    }
  });

  it('preserves dedicated encrypted updates, presence flags and unchanged ciphertext on metadata edits', async () => {
    const response = await notifications('patch')
      .send({
        telegram_enabled: true,
        telegram_bot_token: telegramToken,
        whatsapp_enabled: true,
        whatsapp_cloud_token: whatsappToken,
      })
      .expect(200);
    expect(response.body.telegram).toMatchObject({
      enabled: true,
      tokenSet: true,
    });
    expect(response.body.whatsapp).toMatchObject({
      enabled: true,
      tokenSet: true,
    });
    expectNoCredentials(response.body);
    const before = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(decryptSecret(before.telegram_bot_token)).toBe(telegramToken);
    expect(decryptSecret(before.whatsapp_cloud_token)).toBe(whatsappToken);

    await settings('patch')
      .send({ telegram_chat_id: 'updated-chat' })
      .expect(200);
    await notifications('patch')
      .send({ whatsapp_target: 'updated-recipient' })
      .expect(200);
    const after = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(after.telegram_bot_token).toBe(before.telegram_bot_token);
    expect(after.whatsapp_cloud_token).toBe(before.whatsapp_cloud_token);
  });

  it('rejects credential writes without a key atomically while allowing metadata and reads', async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    const before = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    await settings('patch')
      .send({ phone: 'must-not-save', telegram_bot_token: telegramToken })
      .expect(503);
    await notifications('patch')
      .send({
        telegram_chat_id: 'must-not-save',
        telegram_bot_token: telegramToken,
      })
      .expect(503);
    const after = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(after.phone).toBe(before.phone);
    expect(after.telegram_chat_id).toBe(before.telegram_chat_id);
    expect(after.telegram_bot_token).toBeNull();
    await settings('patch')
      .send({ telegram_chat_id: 'metadata-without-key' })
      .expect(200);
    const response = await settings('get', managerToken).expect(200);
    expect(response.body.telegram_chat_id).toBe('metadata-without-key');
    expectNoCredentials(response.body);
  });

  it('clears disabled tokens with either path without an encryption key', async () => {
    await settings('patch')
      .send({
        telegram_bot_token: telegramToken,
        whatsapp_cloud_token: whatsappToken,
      })
      .expect(200);
    delete process.env.APP_ENCRYPTION_KEY;
    await notifications('patch').send({ telegram_bot_token: '' }).expect(200);
    await settings('patch').send({ whatsapp_cloud_token: '' }).expect(200);
    const stored = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(stored.telegram_bot_token).toBeNull();
    expect(stored.whatsapp_cloud_token).toBeNull();
    const response = await notifications('get').expect(200);
    expect(response.body.telegram.tokenSet).toBe(false);
    expect(response.body.whatsapp.tokenSet).toBe(false);
  });

  it('rejects client ciphertext instead of double encrypting it or persisting partial metadata', async () => {
    const ciphertext = encryptSecret(telegramToken);
    await settings('patch')
      .send({ telegram_bot_token: ciphertext, telegram_chat_id: 'not-saved' })
      .expect(400);
    await notifications('patch')
      .send({ telegram_bot_token: ciphertext })
      .expect(400);
    const stored = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(stored.telegram_bot_token).toBeNull();
    expect(stored.telegram_chat_id).toBe('test-chat');
  });

  it('preserves platform update authorization and encrypts its provider credentials too', async () => {
    await request(app.getHttpServer())
      .patch(`/api/platform/${organizationId}`)
      .auth(platformToken, { type: 'bearer' })
      .send({
        status: OrganizationStatus.ACTIVE,
        whatsapp_cloud_token: whatsappToken,
      })
      .expect(200);
    const stored = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(stored.status).toBe(OrganizationStatus.ACTIVE);
    expect(stored.whatsapp_cloud_token).toMatch(/^enc:v1:/);
    expect(decryptSecret(stored.whatsapp_cloud_token)).toBe(whatsappToken);
  });

  it('migrates legacy credentials in PostgreSQL without encrypting ciphertext again on a repeat run', async () => {
    await database.organization.update({
      where: { id: organizationId },
      data: {
        telegram_bot_token: telegramToken,
        whatsapp_cloud_token: whatsappToken,
      },
    });
    // Restrict the migration to this suite's organization, even in a shared
    // disposable test database. Actual reads and conditional writes use Prisma.
    const scopedDatabase = {
      organization: {
        findMany: (args: Prisma.OrganizationFindManyArgs) =>
          database.organization.findMany({
            ...args,
            where: { id: organizationId },
          }),
        updateMany: (args: Prisma.OrganizationUpdateManyArgs) =>
          database.organization.updateMany({
            ...args,
            where: { ...args.where, id: organizationId },
          }),
      },
    } as unknown as Pick<PrismaClient, 'organization'>;
    await expect(encryptLegacyProviderSecrets(scopedDatabase)).resolves.toEqual(
      {
        scanned: 1,
        encrypted: 2,
        changedConcurrently: 0,
      },
    );
    const migrated = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(migrated.telegram_bot_token).toMatch(/^enc:v1:/);
    expect(migrated.whatsapp_cloud_token).toMatch(/^enc:v1:/);
    expect(decryptSecret(migrated.telegram_bot_token)).toBe(telegramToken);
    expect(decryptSecret(migrated.whatsapp_cloud_token)).toBe(whatsappToken);
    await expect(encryptLegacyProviderSecrets(scopedDatabase)).resolves.toEqual(
      {
        scanned: 1,
        encrypted: 0,
        changedConcurrently: 0,
      },
    );
    const repeated = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(repeated.telegram_bot_token).toBe(migrated.telegram_bot_token);
    expect(repeated.whatsapp_cloud_token).toBe(migrated.whatsapp_cloud_token);
  });
});
