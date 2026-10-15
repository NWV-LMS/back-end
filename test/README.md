The unit and mocked integration suites do not need PostgreSQL:

```sh
npm test -- --runInBand
npm run test:integration -- --runInBand
```

The HTTP E2E suite uses the real Nest application, Prisma client, and PostgreSQL.
Create a **disposable test database**, apply migrations to it, and explicitly set
`TEST_DATABASE_URL`. Do not point this variable at the development or production
database.

```sh
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm run test:e2e -- --runInBand
```

The E2E configuration supplies test-only JWT keys. Each authenticated suite
creates its own organization, admin account, and student, logs in through
`/api/auth/login`, and removes its fixtures afterward. No pre-existing users,
seed passwords, or production credentials are needed. Mocked integration tests
run with their separate Jest configuration and are excluded from the real
database E2E suite.
