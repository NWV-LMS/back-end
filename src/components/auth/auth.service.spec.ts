import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrganizationStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { DatabaseService } from '../../database/database.service';
import { JwtPayload } from '../../libs/types/auth';

describe('AuthService refresh session security', () => {
  const payload: JwtPayload = {
    sub: 'refresh-user',
    id: 'refresh-user',
    email: 'refresh@example.test',
    phone: '+998900000001',
    name: 'Refresh Test',
    role: UserRole.ADMIN,
    organization_id: 'refresh-org',
  };
  const settings: Record<string, string> = {
    JWT_ACCESS_SECRET: 'access-secret-for-security-tests-only',
    JWT_REFRESH_SECRET: 'refresh-secret-for-security-tests-only',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };
  const jwt = new JwtService();
  let service: AuthService;
  let storedToken: string | null;
  let organizationStatus: OrganizationStatus;
  let db: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    storedToken = null;
    organizationStatus = OrganizationStatus.ACTIVE;
    db = {
      user: {
        findUnique: jest.fn(async () => ({
          id: payload.sub,
          role: payload.role,
          email: payload.email,
          phone: payload.phone,
          full_name: payload.name,
          organization_id: payload.organization_id,
          refresh_token: storedToken,
          organization: { status: organizationStatus },
        })),
        update: jest.fn(async ({ data }) => {
          storedToken = data.refresh_token;
          return {};
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          if (storedToken !== where.refresh_token) return { count: 0 };
          storedToken = data.refresh_token;
          return { count: 1 };
        }),
      },
    };
    service = new AuthService(db as unknown as DatabaseService, jwt, {
      get: (name: string) => settings[name],
    } as ConfigService);
  });

  afterEach(() => jest.restoreAllMocks());

  async function beginSession() {
    const tokens = await service.generateTokens(payload);
    await service.storeRefreshToken(payload.sub, tokens.refreshToken);
    return tokens;
  }

  it('issues unique tokens in the same second and separates their purposes', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const first = await service.generateTokens(payload);
    const second = await service.generateTokens(payload);

    expect(first.accessToken).not.toBe(second.accessToken);
    expect(first.refreshToken).not.toBe(second.refreshToken);
    const access = jwt.decode(first.accessToken);
    const refresh = jwt.decode(first.refreshToken);
    expect(access.iat).toBe(refresh.iat);
    expect(access.token_use).toBe('access');
    expect(refresh.token_use).toBe('refresh');
    expect(access.jti).not.toBe(refresh.jti);
  });

  it('rejects an old, valid JWT that shares the first 72 bytes with the new one', async () => {
    const first = await beginSession();
    const rotated = await service.refresh({ refreshToken: first.refreshToken });

    expect(first.refreshToken.slice(0, 72)).toBe(
      rotated.refreshToken.slice(0, 72),
    );
    expect(first.refreshToken).not.toBe(rotated.refreshToken);
    expect(storedToken).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(rotated.user).not.toHaveProperty('refresh_token');
    await expect(
      service.refresh({ refreshToken: first.refreshToken }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.refresh({ refreshToken: rotated.refreshToken }),
    ).resolves.toHaveProperty('refreshToken');
  });

  it('allows exactly one concurrent consumer of a refresh token', async () => {
    const { refreshToken } = await beginSession();
    const results = await Promise.allSettled([
      service.refresh({ refreshToken }),
      service.refresh({ refreshToken }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(db.user.updateMany).toHaveBeenCalledTimes(2);
  });

  it('does not resurrect a session revoked while tokens are being signed', async () => {
    const { refreshToken } = await beginSession();
    const generateTokens = service.generateTokens.bind(service);
    jest
      .spyOn(service, 'generateTokens')
      .mockImplementationOnce(async (input) => {
        storedToken = null; // logout/password-change committed after the read
        return generateTokens(input);
      });

    await expect(service.refresh({ refreshToken })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(storedToken).toBeNull();
  });

  it('invalidates legacy bcrypt sessions instead of accepting a truncated match', async () => {
    const { refreshToken } = await beginSession();
    storedToken = await bcrypt.hash(refreshToken, 4);

    await expect(service.refresh({ refreshToken })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it.each(['access', undefined])(
    'rejects a correctly signed JWT with token_use=%s',
    async (tokenUse) => {
      const token = jwt.sign(
        { ...payload, token_use: tokenUse },
        { secret: settings.JWT_REFRESH_SECRET, expiresIn: '7d' },
      );
      await service.storeRefreshToken(payload.sub, token);

      await expect(
        service.refresh({ refreshToken: token }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(db.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it.each([
    { secret: 'another-signing-key', expiresIn: '7d' },
    { secret: settings.JWT_REFRESH_SECRET, expiresIn: -1 },
    { secret: settings.JWT_REFRESH_SECRET, algorithm: 'HS384' as const },
  ])('rejects an invalid/expired/unsupported JWT (%j)', async (options) => {
    const token = jwt.sign({ ...payload, token_use: 'refresh' }, options);
    await service.storeRefreshToken(payload.sub, token);

    await expect(
      service.refresh({ refreshToken: token }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a revoked session or an inactive organization', async () => {
    const { refreshToken } = await beginSession();
    organizationStatus = OrganizationStatus.INACTIVE;
    await expect(service.refresh({ refreshToken })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    organizationStatus = OrganizationStatus.ACTIVE;
    storedToken = null;
    await expect(service.refresh({ refreshToken })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});
