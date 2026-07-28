import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';
import { PrismaExceptionFilter } from '../src/database/prisma-exception.filter';

// Throwaway controller that throws Prisma errors exactly as the Prisma client
// would at runtime. The global PrismaExceptionFilter is the same instance
// registered in main.ts, so this exercises the real HTTP pipeline:
// RouterProxy -> ExceptionsHandler -> PrismaExceptionFilter.
@Controller('boom')
class BoomController {
  @Get('ok')
  ok() {
    return { ok: true };
  }

  @Get('known')
  known() {
    throw new Prisma.PrismaClientKnownRequestError('simulated', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
  }

  @Get('validation')
  validation() {
    throw new Prisma.PrismaClientValidationError('simulated', {
      clientVersion: '5.22.0',
    });
  }
}

describe('PrismaExceptionFilter (e2e, real HTTP pipeline)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BoomController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns a clean 409 for a known request error (no crash, no hang)', async () => {
    const res = await request(app.getHttpServer()).get('/boom/known');
    expect(res.status).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 409,
        message: 'Unique constraint violation',
      }),
    );
  });

  it('returns a clean 400 for a validation error', async () => {
    const res = await request(app.getHttpServer()).get('/boom/validation');
    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        message: 'Database validation error',
      }),
    );
  });

  it('server stays alive: a request AFTER a Prisma error still succeeds', async () => {
    // With the old (throwing) filter this would have produced an
    // unhandledRejection on the first error and the server would be dead.
    await request(app.getHttpServer()).get('/boom/known').expect(409);
    const res = await request(app.getHttpServer()).get('/boom/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
