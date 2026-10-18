import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { UserUpdateDto } from '../../libs/dto/auth/userUpdate.dto';
import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';

describe('UserService.updateUser security', () => {
  let service: UserService;
  let database: {
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    user: { updateMany: jest.Mock; findUniqueOrThrow: jest.Mock };
  };
  let compare: jest.SpyInstance;
  let hash: jest.SpyInstance;

  const safeUser = {
    id: 'self',
    email: 'self@example.test',
    role: UserRole.STUDENT,
    organization_id: 'org',
    full_name: 'Self',
    phone: '+998900000001',
    created_at: new Date(),
    updated_at: new Date(),
  };
  const profile = {
    phone: safeUser.phone,
    full_name: 'Changed profile',
  };
  const changePassword = {
    ...profile,
    password: 'current-password',
    new_password: 'replacement-password',
    confirm_new_password: 'replacement-password',
  };

  beforeEach(() => {
    tx = {
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(safeUser),
      },
    };
    database = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ password: 'old-hash' }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    service = new UserService(
      database as unknown as DatabaseService,
      {} as AuthService,
    );
    compare = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    hash = jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash' as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['missing current password', { password: undefined }],
    ['mismatched confirmation', { confirm_new_password: 'different-password' }],
    ['missing confirmation', { confirm_new_password: undefined }],
  ])('does not write any profile fields on %s', async (_name, changes) => {
    await expect(
      service.updateUser('self', { ...changePassword, ...changes }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(database.$transaction).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('does not write any profile fields when the current password is wrong', async () => {
    compare.mockResolvedValue(false);

    await expect(
      service.updateUser('self', changePassword),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(database.$transaction).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('atomically changes the password and profile and revokes the refresh session', async () => {
    const response = await service.updateUser('self', changePassword);

    expect(compare).toHaveBeenCalledWith('current-password', 'old-hash');
    expect(hash).toHaveBeenCalledWith('replacement-password', 10);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'self', password: 'old-hash' },
      data: {
        ...profile,
        email: undefined,
        password: 'new-hash',
        refresh_token: null,
      },
    });
    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('refresh_token');
    expect(tx.user.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ password: true }),
      }),
    );
  });

  it('rejects a stale password change after another request changed the stored hash', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateUser('self', changePassword),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'self', password: 'old-hash' },
      }),
    );
    expect(tx.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('allows only explicit profile fields and preserves password/session for a normal update', async () => {
    await service.updateUser('self', {
      ...profile,
      id: 'victim',
      role: UserRole.SUPER_ADMIN,
      organization_id: 'other-org',
      password: 'unhashed-password-attempt',
      refresh_token: 'attacker-session',
      token: 'attacker-token',
    } as UserUpdateDto);

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'self' },
      data: { ...profile, email: undefined },
    });
    expect(compare).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('rejects a password change for a missing account before opening a transaction', async () => {
    database.user.findUnique.mockResolvedValue(null);

    await expect(
      service.updateUser('missing', changePassword),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a normal profile update for a missing account', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.updateUser('missing', profile)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tx.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
