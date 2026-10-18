import * as request from 'supertest';
import { createTestApp, closeTestApp, getApp } from './setup-e2e';

describe('AppController (e2e)', () => {
  beforeAll(async () => {
    await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('GET /api', () => {
    it('should return API info', () => {
      return request(getApp().getHttpServer())
        .get('/api')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('name');
          expect(res.body).toHaveProperty('version');
          expect(res.body.environment).toBe('test');
        });
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', () => {
      return request(getApp().getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('GET /api/health/db', () => {
    it('verifies readiness against the real PostgreSQL database', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/health/db')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.info.database.status).toBe('up');
    });
  });
});
