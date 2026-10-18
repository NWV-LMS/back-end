import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

describe('Liveness and readiness probes (integration)', () => {
  let app: INestApplication;
  const dbMock = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $runCommandRaw: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(dbMock)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dbMock.$queryRaw.mockRejectedValue(new Error('Database unavailable'));
    dbMock.$queryRawUnsafe.mockRejectedValue(new Error('Database unavailable'));
    dbMock.$runCommandRaw.mockRejectedValue(new Error('Database unavailable'));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers exactly one GET handler for /api/health', () => {
    const routes = app.getHttpAdapter().getInstance()._router.stack;
    const matchingRoutes = routes.filter(
      (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
        layer.route?.path === '/api/health' && layer.route.methods.get,
    );
    expect(matchingRoutes).toHaveLength(1);
  });

  it('keeps liveness available without database I/O when the database is down', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(dbMock.$queryRaw).not.toHaveBeenCalled();
    expect(dbMock.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(dbMock.$runCommandRaw).not.toHaveBeenCalled();
  });

  it('returns 503 from readiness when the database cannot be reached', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/db')
      .expect(503);
    expect(response.body.status).toBe('error');
    expect(response.body.error.database.status).toBe('down');
  });

  it('checks the PostgreSQL connection before reporting readiness', async () => {
    // Terminus tries MongoDB first, then falls back to SELECT 1 for SQL clients.
    dbMock.$runCommandRaw.mockRejectedValue(
      new Error('Use the mongodb provider to run this command'),
    );
    dbMock.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
    const response = await request(app.getHttpServer())
      .get('/api/health/db')
      .expect(200);
    expect(response.body.info.database.status).toBe('up');
    expect(dbMock.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
  });
});
