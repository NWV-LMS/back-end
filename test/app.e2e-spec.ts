import * as request from 'supertest';
import { createTestApp, closeTestApp, getApp } from './setup-e2e';

describe('AppController (e2e)', () => {
  beforeAll(async () => {
    await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('GET /', () => {
    it('should return API info', () => {
      return request(getApp().getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('name');
          expect(res.body).toHaveProperty('version');
        });
    });
  });

  describe('GET /health', () => {
    it('should return health status', () => {
      return request(getApp().getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });
});
