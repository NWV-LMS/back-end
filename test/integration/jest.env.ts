/**
 * Minimal env shim for integration tests.
 * Runs before any module is imported so ConfigService / JwtService never see
 * undefined secrets. The values are fake — no real DB or token is used.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-long!';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
