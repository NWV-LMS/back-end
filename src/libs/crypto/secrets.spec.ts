import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { decryptSecret, encryptSecret, encryptSecretUpdate } from './secrets';

describe('Provider credential encryption', () => {
  const originalKey = process.env.APP_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = originalKey;
  });

  it('uses authenticated, randomized ciphertext and restores the original token', () => {
    const token = 'fake-provider-token-for-encryption-test';
    const first = encryptSecret(token);
    const second = encryptSecret(token);
    expect(first).toMatch(/^enc:v1:/);
    expect(first).not.toBe(token);
    expect(second).not.toBe(first);
    expect(decryptSecret(first)).toBe(token);
    expect(decryptSecret(second)).toBe(token);
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(decryptSecret(first)).toBeNull();
  });

  it.each([undefined, '', 'too-short'])(
    'rejects credential writes with an unusable key',
    (key) => {
      if (key === undefined) delete process.env.APP_ENCRYPTION_KEY;
      else process.env.APP_ENCRYPTION_KEY = key;
      expect(() => encryptSecret('fake-provider-token')).toThrow(
        ServiceUnavailableException,
      );
      expect(encryptSecretUpdate(undefined)).toBeUndefined();
      expect(encryptSecretUpdate(null)).toBeUndefined();
      expect(encryptSecretUpdate('')).toBeNull();
    },
  );

  it('rejects ciphertext as a new credential instead of double encrypting it', () => {
    expect(() => encryptSecret(encryptSecret('fake-provider-token'))).toThrow(
      BadRequestException,
    );
  });

  it('keeps legacy plaintext readable while rejecting malformed encrypted records', () => {
    expect(decryptSecret('legacy-fake-provider-token')).toBe(
      'legacy-fake-provider-token',
    );
    expect(decryptSecret('enc:v1:invalid')).toBeNull();
    expect(decryptSecret('enc:v2:unknown-format')).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });
});
