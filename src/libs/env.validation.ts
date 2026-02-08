type EnvCheckResult = {
  ok: boolean;
  errors: string[];
};

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

  if (errors.length > 0) {
    // Keep error text readable in container logs.
    const message = ['Invalid environment configuration:', ...errors.map((e) => `- ${e}`)].join(
      '\n',
    );
    throw new Error(message);
  }
}

