import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

/**
 * Minimal DatabaseService mock — enough for the app to boot and for
 * HealthController's PrismaHealthIndicator.pingCheck to succeed.
 * The mock exposes `$queryRaw` (used by AppService.healthCheck) and a
 * `$runCommandRaw` no-op that Terminus's PrismaHealthIndicator calls
 * internally for the ping check.
 */
const dbMock = {
  // AppService.healthCheck uses $queryRaw`SELECT 1`
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  // PrismaHealthIndicator.pingCheck calls $runCommandRaw({ ping: 1 })
  $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }),
  // Stub lifecycle hooks so Nest doesn't throw on init/destroy
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  // OrganizationActiveGuard.canActivate reads organization — not called for
  // unauthenticated health requests, but provide a safe stub anyway.
  organization: { findUnique: jest.fn().mockResolvedValue(null) },
};

describe('HealthController (integration)', () => {
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

  describe('GET /api/health', () => {
    it('responds 200 with status ok and required fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api/health/db', () => {
    it('responds 200 with database status up when DB mock succeeds', async () => {
      // Ensure the mock reports success
      (dbMock.$runCommandRaw as jest.Mock).mockResolvedValueOnce({ ok: 1 });

      const res = await request(app.getHttpServer())
        .get('/api/health/db')
        .expect(200);

      // @nestjs/terminus shape: { status: 'ok', info: { database: { status: 'up' } }, ... }
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('info');
      expect(res.body.info).toHaveProperty('database');
      expect(res.body.info.database).toHaveProperty('status', 'up');
    });
  });
});
