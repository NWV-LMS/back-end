import { ConfigService } from '@nestjs/config';
import { GoogleAccountService } from './google-account.service';
import { after, digest, randomToken } from './account.security';
import { encryptSecret } from '../../../libs/crypto/secrets';
const getToken = jest.fn(),
  verifyIdToken = jest.fn(),
  generateAuthUrl: jest.Mock = jest.fn(
    () => 'https://accounts.google.com/authorize',
  );
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest
    .fn()
    .mockImplementation(() => ({ getToken, verifyIdToken, generateAuthUrl })),
}));

describe('Google account authentication', () => {
  let db: any, accounts: any, service: GoogleAccountService, attempt: any;
  const binding = randomToken(),
    state = randomToken();
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_ENCRYPTION_KEY =
      'test-encryption-key-at-least-32-characters';
    attempt = {
      id: 'attempt',
      state_hash: digest(state),
      binding_hash: digest(binding),
      nonce: 'nonce',
      verifier_encrypted: encryptSecret('verifier'),
      expires_at: after(600),
    };
    db = {
      googleAuthAttempt: {
        findUnique: jest.fn().mockResolvedValue(attempt),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      authIdentity: { findUnique: jest.fn(), create: jest.fn() },
      account: { create: jest.fn() },
      accountSession: { findUnique: jest.fn() },
    };
    accounts = {
      openSession: jest.fn().mockResolvedValue({ ok: true }),
      assertSession: jest.fn(),
    };
    service = new GoogleAccountService(
      db,
      new ConfigService({
        GOOGLE_CLIENT_ID: 'client',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_REDIRECT_URI: 'https://app.example.com/callback',
      }),
      accounts,
    );
    getToken.mockResolvedValue({ tokens: { id_token: 'signed-token' } });
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-id',
        email: 'user@example.com',
        email_verified: true,
        nonce: 'nonce',
      }),
    });
  });
  afterAll(() => {
    delete process.env.APP_ENCRYPTION_KEY;
  });
  it('starts with PKCE, nonce and hashed browser/state secrets', async () => {
    await service.start(binding);
    expect(generateAuthUrl.mock.calls[0][0]).toMatchObject({
      code_challenge_method: 'S256',
      scope: ['openid', 'email', 'profile'],
    });
    const data = db.googleAuthAttempt.create.mock.calls[0][0].data;
    expect(data.binding_hash).toBe(digest(binding));
    expect(data.verifier_encrypted).toMatch(/^enc:v1:/);
    expect(data.state_hash).toHaveLength(64);
  });
  it('rejects browser mismatch before exchanging the code', async () => {
    await expect(
      service.callback({ state, browser_binding: randomToken(), code: 'code' }),
    ).rejects.toThrow();
    expect(getToken).not.toHaveBeenCalled();
  });
  it('rejects concurrent callback replay', async () => {
    db.googleAuthAttempt.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.callback({ state, browser_binding: binding, code: 'code' }),
    ).rejects.toThrow();
    expect(getToken).not.toHaveBeenCalled();
  });
  it.each([
    { nonce: 'wrong', email_verified: true },
    { nonce: 'nonce', email_verified: false },
  ])('rejects invalid provider identity %o', async (override) => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-id',
        email: 'user@example.com',
        ...override,
      }),
    });
    await expect(
      service.callback({ state, browser_binding: binding, code: 'code' }),
    ).rejects.toThrow();
    expect(accounts.openSession).not.toHaveBeenCalled();
  });
  it('uses provider subject for returning users', async () => {
    const account = { id: 'existing' };
    db.authIdentity.findUnique.mockResolvedValue({ account });
    await service.callback({ state, browser_binding: binding, code: 'code' });
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'signed-token',
      audience: 'client',
    });
    expect(accounts.openSession).toHaveBeenCalledWith(account);
    expect(db.account.create).not.toHaveBeenCalled();
  });
  it('does not merge an existing email on unique conflict', async () => {
    db.account.create.mockRejectedValue(new Error('Unique email'));
    await expect(
      service.callback({ state, browser_binding: binding, code: 'code' }),
    ).rejects.toThrow('Sign in to your existing account');
    expect(accounts.openSession).not.toHaveBeenCalled();
  });
  it('revalidates the original account session before linking Google', async () => {
    attempt.link_session_id = 'revoked-session';
    accounts.assertSession.mockImplementation(() => {
      throw new Error('Revoked');
    });
    await expect(
      service.callback({ state, browser_binding: binding, code: 'code' }),
    ).rejects.toThrow('Revoked');
    expect(db.authIdentity.create).not.toHaveBeenCalled();
  });
});
