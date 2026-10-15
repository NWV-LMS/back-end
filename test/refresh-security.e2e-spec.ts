import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/components/auth/auth.service';
import { UserService } from '../src/components/user/user.service';
import {
  closeTestApp,
  createTestApp,
  getAuthToken,
  getDatabase,
  getTestAdminId,
} from './setup-e2e';
import { JwtPayload } from '../src/libs/types/auth';

describe('Refresh-token security with PostgreSQL (e2e)', () => {
  let auth: AuthService;
  let users: UserService;
  let payload: JwtPayload;

  beforeAll(async () => {
    const app = await createTestApp();
    await getAuthToken();
    auth = app.get(AuthService);
    users = app.get(UserService);
    const user = await getDatabase().user.findUniqueOrThrow({
      where: { id: getTestAdminId() },
    });
    payload = {
      sub: user.id,
      id: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      name: user.full_name,
      organization_id: user.organization_id,
    };
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => closeTestApp());

  async function beginSession() {
    const tokens = await auth.generateTokens(payload);
    await auth.storeRefreshToken(payload.sub, tokens.refreshToken);
    return tokens;
  }

  it('consumes the whole JWT once and preserves the rotated session', async () => {
    const initial = await beginSession();
    const rotated = await auth.refresh({ refreshToken: initial.refreshToken });

    expect(rotated.refreshToken).not.toBe(initial.refreshToken);
    expect(rotated.refreshToken.slice(0, 72)).toBe(
      initial.refreshToken.slice(0, 72),
    );
    await expect(
      auth.refresh({ refreshToken: initial.refreshToken }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.refresh({ refreshToken: rotated.refreshToken }),
    ).resolves.toHaveProperty('accessToken');
    const user = await getDatabase().user.findUniqueOrThrow({
      where: { id: payload.sub },
    });
    expect(user.refresh_token).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('allows exactly one concurrent rotation against the actual database', async () => {
    const { refreshToken } = await beginSession();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => auth.refresh({ refreshToken })),
    );
    const successful = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<AuthService['refresh']>>
      > => result.status === 'fulfilled',
    );

    expect(successful).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(7);
    await expect(
      auth.refresh({ refreshToken: successful[0].value.refreshToken }),
    ).resolves.toHaveProperty('refreshToken');
  });

  it('rejects a refresh token after logout', async () => {
    const { refreshToken } = await beginSession();
    await users.logout(payload.sub);

    await expect(auth.refresh({ refreshToken })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token after a successful password change', async () => {
    const { refreshToken } = await beginSession();
    await users.updateUser(payload.sub, {
      phone: payload.phone,
      password: 'e2e-fixture-password',
      new_password: 'e2e-new-security-password',
      confirm_new_password: 'e2e-new-security-password',
    });

    await expect(auth.refresh({ refreshToken })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const user = await getDatabase().user.findUniqueOrThrow({
      where: { id: payload.sub },
    });
    expect(user.refresh_token).toBeNull();
  });

  it.each(['logout', 'password change'])(
    'cannot restore a session if %s commits before its rotation',
    async (revocation) => {
      const { refreshToken } = await beginSession();
      const generateTokens = auth.generateTokens.bind(auth);
      jest
        .spyOn(auth, 'generateTokens')
        .mockImplementationOnce(async (input) => {
          if (revocation === 'logout') {
            await users.logout(payload.sub);
          } else {
            await users.updateUser(payload.sub, {
              phone: payload.phone,
              password: 'e2e-new-security-password',
              new_password: 'e2e-final-security-password',
              confirm_new_password: 'e2e-final-security-password',
            });
          }
          return generateTokens(input);
        });

      await expect(auth.refresh({ refreshToken })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      const user = await getDatabase().user.findUniqueOrThrow({
        where: { id: payload.sub },
      });
      expect(user.refresh_token).toBeNull();
    },
  );
});
