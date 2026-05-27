import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1,
  // Stay silent when DSN is absent (local dev / envs without Sentry configured).
  enabled: !!process.env.SENTRY_DSN,
});
