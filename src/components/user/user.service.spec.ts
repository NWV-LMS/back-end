import { Test } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { DatabaseService } from '../../database/database.service';
import { AuthService } from '../auth/auth.service';

/**
 * Security regression tests for the login account-enumeration hardening (H-1).
 * Fully mocked — no database connection.
 */
describe('UserService.login — account enumeration hardening', () => {
  let service: UserService;
  let db: { user: { findUnique: jest.Mock } };
  let compareSpy: jest.SpyInstance;

  const realUser = {
    id: 'u1',
    phone: '+998901112233',
    password: '$2b$10$realhashplaceholderrealhashplaceholderrealhash',
    role: 'ADMIN',
    organization_id: 'o1',
    full_name: 'Test User',
    email: 'test@example.com',
    created_at: new Date(),
    updated_at: new Date(),
    organization: { status: 'ACTIVE' },
  };

  beforeEach(async () => {
    db = { user: { findUnique: jest.fn() } };
    const authService = {
      generateTokens: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
      storeRefreshToken: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: DatabaseService, useValue: db },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = moduleRef.get(UserService);
    compareSpy = jest.spyOn(bcrypt, 'compare');
  });

  afterEach(() => jest.restoreAllMocks());

  it('runs a bcrypt comparison even when the phone is not registered (no timing leak)', async () => {
    db.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ phone: '+000', password: 'whatever' } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // The dummy-hash comparison must still run so response time does not differ
    // between an unknown phone and a real account.
    expect(compareSpy).toHaveBeenCalledTimes(1);
  });

  it('returns an identical error for an unknown phone and for a wrong password', async () => {
    db.user.findUnique.mockResolvedValueOnce(null);
    const unknownPhoneErr = await service
      .login({ phone: '+000', password: 'whatever' } as never)
      .catch((e) => e);

    db.user.findUnique.mockResolvedValueOnce(realUser);
    compareSpy.mockResolvedValueOnce(false as never);
    const wrongPasswordErr = await service
      .login({ phone: realUser.phone, password: 'wrong' } as never)
      .catch((e) => e);

    expect(unknownPhoneErr).toBeInstanceOf(UnauthorizedException);
    expect(wrongPasswordErr).toBeInstanceOf(UnauthorizedException);
    expect(unknownPhoneErr.message).toBe(wrongPasswordErr.message);
    expect(unknownPhoneErr.getStatus()).toBe(wrongPasswordErr.getStatus());
  });

  it('only reveals "Organization is inactive" AFTER the password is verified', async () => {
    db.user.findUnique.mockResolvedValue({
      ...realUser,
      organization: { status: 'INACTIVE' },
    });

    // Wrong password on an inactive org → generic credentials error, NOT the
    // org-status error (which would leak that the phone is registered).
    compareSpy.mockResolvedValueOnce(false as never);
    const wrongPwd = await service
      .login({ phone: realUser.phone, password: 'wrong' } as never)
      .catch((e) => e);
    expect(wrongPwd).toBeInstanceOf(UnauthorizedException);

    // Correct password on an inactive org → now the org-status error is allowed.
    compareSpy.mockResolvedValueOnce(true as never);
    const rightPwd = await service
      .login({ phone: realUser.phone, password: 'right' } as never)
      .catch((e) => e);
    expect(rightPwd).toBeInstanceOf(ForbiddenException);
  });

  it('succeeds with valid credentials on an active organization', async () => {
    db.user.findUnique.mockResolvedValue(realUser);
    compareSpy.mockResolvedValue(true as never);

    const res = await service.login({
      phone: realUser.phone,
      password: 'right',
    } as never);

    expect(res.accessToken).toBe('access');
    expect(res.refreshToken).toBe('refresh');
  });
});
