/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  // rootDir points to repo root (one level up from test/integration/)
  rootDir: '../..',
  testEnvironment: 'node',
  // Only match files inside test/integration/ to avoid picking up the
  // existing setup-e2e.ts-backed specs that require a live database.
  testMatch: ['<rootDir>/test/integration/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^generated/(.*)$': '<rootDir>/generated/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  // Inject required env vars before any test module is imported.
  setupFiles: ['<rootDir>/test/integration/jest.env.ts'],
};
