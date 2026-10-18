import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { after, digest } from './account.security';
import { JwtStrategy } from '../strategies/jwt.strategy';

describe('Account-backed tenant JWTs', () => {
  const config = new ConfigService({
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  });
  const payload: any = {
    sub: 'user',
    id: 'user',
    role: 'ADMIN',
    email: 'a@example.com',
    name: 'Alice',
    phone: '+998901234567',
    organization_id: 'org',
    session_id: 'tenant',
  };
  let service: AuthService, db: any, session: any;
  beforeEach(() => {
    session = {
      id: 'tenant',
      user_id: 'user',
      revoked_at: null,
      expires_at: after(600),
      user: {
        id: 'user',
        organization_id: 'org',
        account_id: 'account',
        role: 'STUDENT',
        organization: { status: 'ACTIVE' },
      },
      accountSession: {
        account_id: 'account',
        expires_at: after(600),
        auth_version: 1,
        account: { auth_version: 1, email_verified_at: new Date() },
      },
    };
    db = {
      tenantSession: {
        findUnique: jest.fn(async () => session),
        updateMany: jest.fn(async ({ where, data }) => {
          if (where.refresh_hash !== session.refresh_hash) return { count: 0 };
          session.refresh_hash = data.refresh_hash;
          return { count: 1 };
        }),
      },
    };
    service = new AuthService(db, new JwtService(), config);
  });
  it('uses current membership role instead of stale JWT privileges', async () => {
    const strategy = new JwtStrategy(config, service, {
      validateOrganization: jest.fn(),
    } as any);
    expect(
      (await strategy.validate({ ...payload, token_use: 'access' })).role,
    ).toBe('STUDENT');
  });
  it.each([
    'revoked',
    'version',
    'tenant',
    'membership',
    'superadmin',
    'inactive',
  ])('rejects invalid session %s', async (reason) => {
    if (reason === 'revoked') session.accountSession.revoked_at = new Date();
    if (reason === 'version') session.accountSession.account.auth_version++;
    if (reason === 'tenant') session.user.organization_id = 'other';
    if (reason === 'membership') session.user.account_id = 'other';
    if (reason === 'superadmin') session.user.role = 'SUPER_ADMIN';
    if (reason === 'inactive') session.user.organization.status = 'INACTIVE';
    await expect(service.validateTenant(payload)).rejects.toThrow();
  });
  it('rotates each refresh token once without touching legacy refresh storage', async () => {
    const tokens = await service.generateTokens(payload);
    session.refresh_hash = digest(tokens.refreshToken);
    const rotated = await service.refresh({
      refreshToken: tokens.refreshToken,
    });
    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);
    await expect(
      service.refresh({ refreshToken: tokens.refreshToken }),
    ).rejects.toThrow();
  });
});
