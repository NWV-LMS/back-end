import { ConfigService } from '@nestjs/config';
import { AccountBffGuard } from './account.guards';
import { AccountService } from './account.service';
import {
  after,
  checkPassword,
  digest,
  hashPassword,
  randomToken,
} from './account.security';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvitationDto, RegisterAccountDto } from './account.dto';

describe('Account authentication boundaries', () => {
  const account = {
    id: 'account',
    email: 'a@example.com',
    full_name: 'Alice',
    email_verified_at: new Date(),
    disabled_at: null,
    auth_version: 2,
  };
  const session = {
    id: 'session',
    account_id: account.id,
    account,
    auth_version: 2,
    expires_at: after(600),
    revoked_at: null,
  };
  let db: any, mail: any, service: AccountService;
  beforeEach(() => {
    db = {
      account: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      accountToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      accountSession: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { findFirst: jest.fn() },
      accountInvitation: { findUnique: jest.fn() },
      $transaction: jest.fn((fn) => fn(db)),
    };
    mail = { assertConfigured: jest.fn(), send: jest.fn() };
    service = new AccountService(db, {} as any, mail);
  });
  it('hashes bytes beyond bcrypt truncation and uses unique salts', async () => {
    const password = 'x'.repeat(80) + 'a';
    const hash = await hashPassword(password);
    expect(await checkPassword(password, hash)).toBe(true);
    expect(await checkPassword('x'.repeat(80) + 'b', hash)).toBe(false);
    expect(await hashPassword(password)).not.toBe(hash);
    expect(await checkPassword(password, null)).toBe(false);
  });
  it.each([
    { revoked_at: new Date() },
    { expires_at: new Date(0) },
    { auth_version: 1 },
    { account: { ...account, disabled_at: new Date() } },
  ])('rejects revoked, expired and obsolete sessions: %o', (patch) => {
    expect(() =>
      service.assertSession({ ...session, ...patch } as any),
    ).toThrow();
  });
  it('accepts current verified sessions', () =>
    expect(service.assertSession(session as any)).toEqual(session));
  it('stores only opaque session digests', async () => {
    db.accountSession.create.mockResolvedValue({ expires_at: after(600) });
    const result = await service.openSession(account as any);
    expect(result.accountSessionToken).toMatch(/^[\w-]{43}$/);
    expect(db.accountSession.create.mock.calls[0][0].data.token_hash).toBe(
      digest(result.accountSessionToken),
    );
    expect(result.account).not.toHaveProperty('auth_version');
  });
  it('never installs an unverified registration password', async () => {
    db.account.upsert.mockResolvedValue({
      ...account,
      email_verified_at: null,
    });
    await service.register({
      email: account.email,
      full_name: 'Alice',
      password: 'long-password',
      browser_binding: randomToken(),
    });
    expect(
      db.account.upsert.mock.calls[0][0].create.password_hash,
    ).toBeUndefined();
    const data = db.accountToken.create.mock.calls[0][0].data;
    expect(data.pending_password_hash).toMatch(/^scrypt:/);
    expect(data.token_hash).toHaveLength(64);
    expect(mail.send).toHaveBeenCalled();
  });
  it('rejects email verification from a different browser', async () => {
    db.accountToken.findUnique.mockResolvedValue({
      purpose: 'verify',
      expires_at: after(600),
      pending_password_hash: 'hash',
      binding_hash: digest('original'),
    });
    await expect(
      service.verifyEmail({
        token: randomToken(),
        browser_binding: randomToken(),
      }),
    ).rejects.toThrow();
    expect(db.account.updateMany).not.toHaveBeenCalled();
  });
  it('rejects replay when another request consumes the reset', async () => {
    db.accountToken.findUnique.mockResolvedValue({
      id: 'token',
      purpose: 'reset',
      expires_at: after(600),
    });
    db.accountToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.resetPassword({
        token: randomToken(),
        password: 'new-long-password',
      }),
    ).rejects.toThrow();
    expect(db.account.updateMany).not.toHaveBeenCalled();
  });
  it('increments account version and revokes sessions on password reset', async () => {
    db.accountToken.findUnique.mockResolvedValue({
      id: 'token',
      account_id: account.id,
      auth_version: 2,
      purpose: 'reset',
      expires_at: after(600),
    });
    db.accountToken.updateMany.mockResolvedValue({ count: 1 });
    db.account.updateMany.mockResolvedValue({ count: 1 });
    await service.resetPassword({
      token: randomToken(),
      password: 'new-long-password',
    });
    expect(db.account.updateMany.mock.calls[0][0]).toMatchObject({
      where: { auth_version: 2 },
      data: { auth_version: { increment: 1 } },
    });
    expect(db.accountSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { account_id: account.id, revoked_at: null },
      }),
    );
  });
  it('rejects an invitation for a different verified email', async () => {
    db.accountInvitation.findUnique.mockResolvedValue({
      email: 'other@example.com',
    });
    await expect(
      service.acceptInvitation(session as any, {
        token: randomToken(),
        phone: '+998901234567',
      }),
    ).rejects.toThrow();
  });
  it('does not select a tenant without membership', async () => {
    db.user.findFirst.mockResolvedValue(null);
    await expect(
      service.selectOrganization(session as any, 'other-org'),
    ).rejects.toThrow();
  });
  it('rejects privileged role injection and whitespace-only names', async () => {
    expect(
      await validate(
        plainToInstance(CreateInvitationDto, {
          email: account.email,
          role: 'SUPER_ADMIN',
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(RegisterAccountDto, {
          email: account.email,
          full_name: '   ',
          password: 'long-password',
          browser_binding: randomToken(),
        }),
      ),
    ).not.toHaveLength(0);
  });
  it('requires both the feature flag and a server secret', () => {
    const config = new ConfigService({
      ACCOUNT_AUTH_ENABLED: 'true',
      AUTH_BFF_SECRET: 'x'.repeat(32),
    });
    const guard = new AccountBffGuard(config);
    const context = (secret: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-auth-bff-secret': secret } }),
        }),
      }) as any;
    expect(() => guard.canActivate(context('wrong'))).toThrow();
    expect(guard.canActivate(context('x'.repeat(32)))).toBe(true);
    expect(() =>
      new AccountBffGuard(new ConfigService()).canActivate(
        context('x'.repeat(32)),
      ),
    ).toThrow();
  });
});
