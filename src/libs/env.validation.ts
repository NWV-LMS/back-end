const isNonEmpty = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

const parseAllowedOrigins = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function validateEnvOrThrow(): void {
  const errors: string[] = [];

  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (!isNonEmpty(process.env.DATABASE_URL)) {
    errors.push('DATABASE_URL is required');
  }

  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!isNonEmpty(accessSecret) || accessSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET is required (min 32 chars)');
  }
  if (!isNonEmpty(refreshSecret) || refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET is required (min 32 chars)');
  }

  if (!isNonEmpty(process.env.JWT_ACCESS_EXPIRES_IN)) {
    errors.push('JWT_ACCESS_EXPIRES_IN is required');
  }
  if (!isNonEmpty(process.env.JWT_REFRESH_EXPIRES_IN)) {
    errors.push('JWT_REFRESH_EXPIRES_IN is required');
  }

  // CORS should never be effectively "allow all" in production.
  if (nodeEnv === 'production') {
    const rawOrigins = process.env.ALLOWED_ORIGINS;
    if (!isNonEmpty(rawOrigins)) {
      errors.push('ALLOWED_ORIGINS is required in production');
    } else {
      const origins = parseAllowedOrigins(rawOrigins);
      if (origins.length === 0) {
        errors.push('ALLOWED_ORIGINS must contain at least 1 origin');
      }
      if (origins.includes('*')) {
        errors.push('ALLOWED_ORIGINS must not include "*" in production');
      }
    }
  }

  // If you store provider tokens in the DB (per-organization WhatsApp/Telegram),
  // encrypt them at rest. This key is required in production.
  if (nodeEnv === 'production') {
    const k = process.env.APP_ENCRYPTION_KEY;
    if (!isNonEmpty(k) || k.trim().length < 32) {
      errors.push(
        'APP_ENCRYPTION_KEY is required in production (min 32 chars or base64 32 bytes)',
      );
    }
  }

  if (process.env.ACCOUNT_AUTH_ENABLED === 'true') {
    for (const key of ['AUTH_BFF_SECRET', 'APP_ENCRYPTION_KEY']) {
      if (!isNonEmpty(process.env[key]) || process.env[key]!.length < 32)
        errors.push(`${key} is required for account auth (min 32 chars)`);
    }
    for (const key of [
      'AUTH_APP_URL',
      'AUTH_SMTP_HOST',
      'AUTH_SMTP_USER',
      'AUTH_SMTP_PASSWORD',
      'AUTH_MAIL_FROM',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
    ]) {
      if (!isNonEmpty(process.env[key]))
        errors.push(`${key} is required for account auth`);
    }
    for (const key of ['AUTH_APP_URL', 'GOOGLE_REDIRECT_URI']) {
      try {
        const url = new URL(process.env[key]!);
        if (
          url.username ||
          url.password ||
          url.hash ||
          (url.protocol !== 'https:' &&
            !(
              nodeEnv !== 'production' &&
              url.protocol === 'http:' &&
              ['localhost', '127.0.0.1'].includes(url.hostname)
            ))
        )
          errors.push(`${key} must be an HTTPS URL`);
      } catch {
        errors.push(`${key} must be a valid URL`);
      }
    }
    const port = Number(process.env.AUTH_SMTP_PORT ?? 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      errors.push('AUTH_SMTP_PORT must be a valid port');
  }

  if (errors.length > 0) {
    // Keep error text readable in container logs.
    const message = [
      'Invalid environment configuration:',
      ...errors.map((e) => `- ${e}`),
    ].join('\n');
    throw new Error(message);
  }
}
