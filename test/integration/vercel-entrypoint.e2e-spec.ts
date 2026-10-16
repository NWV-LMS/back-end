import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { createServer, Server } from 'http';
import * as request from 'supertest';
import handler from '../../api';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

describe('Vercel entrypoint (integration)', () => {
  let app: INestApplication;
  let server: Server;
  let createApp: jest.SpyInstance;
  const startupFailures: unknown[] = [];
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOrigins = process.env.ALLOWED_ORIGINS;
  const originalEncryptionKey = process.env.APP_ENCRYPTION_KEY;
  const origin = 'https://frontend.example.test';
  const dbMock = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = origin;
    process.env.APP_ENCRYPTION_KEY = 'integration-only-encryption-key-32-chars';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(dbMock)
      .compile();
    app = module.createNestApplication();
    // Keep the real entrypoint, middleware and controllers. Only substitute the
    // application factory so this integration suite needs no live database.
    createApp = jest.spyOn(NestFactory, 'create').mockResolvedValue(app);
    server = createServer((req, res) => {
      void handler(req, res).catch((error: unknown) => {
        startupFailures.push(error);
        res.statusCode = 500;
        res.end('Serverless bootstrap failed');
      });
    });
  });

  afterAll(async () => {
    createApp?.mockRestore();
    await app?.close();
    for (const [key, value] of Object.entries({
      NODE_ENV: originalNodeEnv,
      ALLOWED_ORIGINS: originalOrigins,
      APP_ENCRYPTION_KEY: originalEncryptionKey,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('boots the serverless handler with working security and compression middleware', async () => {
    const response = await request(server)
      .get('/api/health')
      .set('Origin', origin)
      .expect(200);

    expect(startupFailures).toEqual([]);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('reuses the initialized application on warm requests and checks readiness', async () => {
    const response = await request(server).get('/api/health/db').expect(200);

    expect(response.body.info.database.status).toBe('up');
    expect(createApp).toHaveBeenCalledTimes(1);
    expect(startupFailures).toEqual([]);
  });

  it('retains authentication guards through the serverless entrypoint', async () => {
    await request(server).get('/api/payment').expect(401);
    expect(createApp).toHaveBeenCalledTimes(1);
  });
});
