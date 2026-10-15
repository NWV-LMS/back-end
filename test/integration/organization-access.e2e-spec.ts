import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { OrganizationStatus, UserRole } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

describe('Organization access with verified JWTs (integration)', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const user = {
    id: 'access-user',
    organization_id: 'access-org',
    full_name: 'Access Test',
    email: 'access@example.com',
    phone: '+996559000003',
    role: UserRole.ADMIN,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const dbMock = {
    user: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  function token(overrides: Record<string, unknown> = {}, secret?: string) {
    return jwt.sign(
      {
        sub: user.id,
        role: user.role,
        organization_id: user.organization_id,
        ...overrides,
      },
      { secret: secret ?? process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }

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
    dbMock.user.findUnique.mockResolvedValue(user);
    dbMock.organization.findUnique.mockResolvedValue({
      status: OrganizationStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows an active organization with a correctly signed token', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(dbMock.organization.findUnique).toHaveBeenCalledWith({
      where: { id: user.organization_id },
      select: { status: true },
    });
    expect(dbMock.user.findUnique).toHaveBeenCalled();
  });

  it('blocks the same valid token after the organization is deactivated', async () => {
    const accessToken = token();
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(accessToken, { type: 'bearer' })
      .expect(200);

    dbMock.organization.findUnique.mockResolvedValue({
      status: OrganizationStatus.INACTIVE,
    });
    dbMock.user.findUnique.mockClear();
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(accessToken, { type: 'bearer' })
      .expect(403);

    expect(response.body.message).toBe('Organization is inactive');
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a signed token for a deleted organization', async () => {
    dbMock.organization.findUnique.mockResolvedValue(null);
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token(), { type: 'bearer' })
      .expect(401);
    expect(response.body.message).toBe('Organization not found');
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a signed tenant token without an organization', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token({ organization_id: null }), { type: 'bearer' })
      .expect(401);
    expect(response.body.message).toBe('Organization ID is missing in token');
    expect(dbMock.organization.findUnique).not.toHaveBeenCalled();
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows the platform owner without an organization status lookup', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token({ role: UserRole.SUPER_ADMIN, organization_id: null }), {
        type: 'bearer',
      })
      .expect(200);
    expect(dbMock.organization.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token signed by another key before querying the database', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token({}, 'invalid-signing-key'), { type: 'bearer' })
      .expect(401);
    expect(dbMock.organization.findUnique).not.toHaveBeenCalled();
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated protected requests before querying the database', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(dbMock.organization.findUnique).not.toHaveBeenCalled();
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });
});
