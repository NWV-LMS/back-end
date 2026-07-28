/**
 * bcrypt must be mocked before any module imports.
 */
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(false), // always bad password → 401
  hash: jest.fn().mockResolvedValue('hashed'),
}));

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { UserRole, OrganizationStatus } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

const FAKE_USER = {
  id: 'user-throttle-001',
  phone: '+996559000002',
  email: 'throttle@example.com',
  full_name: 'Throttle User',
  password: '$2b$10$placeholder',
  role: UserRole.ADMIN,
  organization_id: 'org-throttle-001',
  refresh_token: null,
  created_at: new Date(),
  organization: { status: OrganizationStatus.ACTIVE },
};

const dbMock = {
  // Return a valid user so throttling triggers before "user not found" 401s
  user: {
    findUnique: jest.fn().mockResolvedValue(FAKE_USER),
    update: jest.fn().mockResolvedValue({}),
  },
  $queryRaw: jest.fn().mockResolvedValue([]),
  $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }),
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  organization: { findUnique: jest.fn().mockResolvedValue(null) },
};

describe('ThrottlerGuard on POST /api/auth/login (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(dbMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects with 429 after exceeding the 5-request-per-minute limit', async () => {
    /**
     * The login endpoint has @Throttle({ default: { limit: 5, ttl: 60_000 } }).
     * Requests 1–5 from the same IP return 401 (bad password, bcrypt mock returns false).
     * Request 6 (or 7) must return 429 Too Many Requests.
     *
     * supertest always connects from 127.0.0.1, so all requests share the same
     * throttler bucket as long as we use a single agent (stable connection).
     * Each Test.createTestingModule gives us a fresh in-memory throttler store.
     */
    const agent = request.agent(app.getHttpServer());
    // password must be ≥6 chars (LoginDto MinLength(6)) to pass ValidationPipe
    const payload = { phone: FAKE_USER.phone, password: 'wrong_password' };

    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await agent.post('/api/auth/login').send(payload);
      statuses.push(res.status);
    }

    // First 5 should be 401 (bad creds, not rate limited yet)
    for (let i = 0; i < 5; i++) {
      expect(statuses[i]).toBe(401);
    }

    // At least one of the remaining requests must be 429
    const hasThrottle = statuses.slice(5).some((s) => s === 429);
    expect(hasThrottle).toBe(true);
  });
});
