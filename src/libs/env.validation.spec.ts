import { validateEnvOrThrow } from './env.validation';

describe('startup environment validation', () => {
  const original = process.env;
  beforeEach(() => {
    process.env = {
      ...original,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://fixture@127.0.0.1/fixture',
      JWT_ACCESS_SECRET: 'local-test-access-secret-at-least-32-characters',
      JWT_REFRESH_SECRET: 'local-test-refresh-secret-at-least-32-characters',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
  });
  afterEach(() => {
    process.env = original;
  });

  it.each(['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'])(
    'rejects missing or weak %s instead of using a fallback',
    (name) => {
      delete process.env[name];
      expect(validateEnvOrThrow).toThrow(`${name} is required`);
      process.env[name] = 'weak';
      expect(validateEnvOrThrow).toThrow(`${name} is required`);
    },
  );

  it('requires encryption and explicit origins for production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ENCRYPTION_KEY;
    delete process.env.ALLOWED_ORIGINS;
    expect(validateEnvOrThrow).toThrow('APP_ENCRYPTION_KEY is required');
    expect(validateEnvOrThrow).toThrow('ALLOWED_ORIGINS is required');
    process.env.APP_ENCRYPTION_KEY =
      'local-test-encryption-key-at-least-32-characters';
    process.env.ALLOWED_ORIGINS = '*';
    expect(validateEnvOrThrow).toThrow('must not include');
    process.env.ALLOWED_ORIGINS = 'https://example.test';
    expect(validateEnvOrThrow).not.toThrow();
  });
});
