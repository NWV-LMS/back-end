// Use test-only signing keys; never load credentials from the developer's .env.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-for-local-tests-only';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-for-local-tests-only';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.LOG_LEVEL = 'silent';

// A real database is required only by createTestApp. Integration tests have
// their own mocks and run separately with the integration Jest configuration.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
