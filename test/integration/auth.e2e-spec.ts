/**
 * bcrypt must be mocked before any module imports to prevent the real
 * compare() from running (avoids async hash work and removes prod-DB coupling).
 */
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-token'),
}));

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { OrganizationStatus, UserRole } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

const FAKE_USER = {
  id: 'user-test-001',
  phone: '+996559000001',
  email: 'test@example.com',
  full_name: 'Test Admin',
  password: '$2b$10$hashed_password_placeholder',
  role: UserRole.ADMIN,
  organization_id: 'org-test-001',
  refresh_token: null,
  created_at: new Date(),
  organization: { status: OrganizationStatus.ACTIVE },
};

async function buildApp(): Promise<{
  app: INestApplication;
  dbMock: Record<string, any>;
}> {
  const dbMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    organization: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(DatabaseService)
    .useValue(dbMock)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, dbMock };
}

describe('AuthController /api/auth/login (integration)', () => {
  /**
   * Each describe block boots a fresh Nest test module so the in-memory
   * throttler store starts at zero — prevents earlier requests from
   * exhausting the 5-req/min limit shared across describe groups.
   */

  describe('valid credentials', () => {
    let app: INestApplication;
    let dbMock: Record<string, any>;

    beforeAll(async () => {
      ({ app, dbMock } = await buildApp());
    });
    afterAll(async () => {
      await app.close();
    });

    it('returns 201 with accessToken and user data', async () => {
      (dbMock.user.findUnique as jest.Mock).mockResolvedValue(FAKE_USER);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: FAKE_USER.phone, password: 'ValidPass123' })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id', FAKE_USER.id);
    });
  });

  describe('invalid password', () => {
    let app: INestApplication;
    let dbMock: Record<string, any>;

    beforeAll(async () => {
      ({ app, dbMock } = await buildApp());
    });
    afterAll(async () => {
      await app.close();
    });

    it('returns 401 Unauthorized', async () => {
      (dbMock.user.findUnique as jest.Mock).mockResolvedValue(FAKE_USER);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: FAKE_USER.phone, password: 'WrongPassword' })
        .expect(401);
    });
  });

  describe('user not found', () => {
    let app: INestApplication;
    let dbMock: Record<string, any>;

    beforeAll(async () => {
      ({ app, dbMock } = await buildApp());
    });
    afterAll(async () => {
      await app.close();
    });

    it('returns 401 Unauthorized when phone does not exist', async () => {
      (dbMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '+996000000000', password: 'AnyPass123' })
        .expect(401);
    });
  });

  describe('missing required fields', () => {
    let app: INestApplication;

    beforeAll(async () => {
      ({ app } = await buildApp());
    });
    afterAll(async () => {
      await app.close();
    });

    it('returns 400 when phone is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ password: 'SomePass' })
        .expect(400);
    });

    it('returns 400 when password is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '+996559000001' })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(400);
    });
  });
});
