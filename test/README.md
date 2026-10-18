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

Payment/invoice consistency regressions can be run separately:

```sh
npm run test:e2e -- --runInBand --runTestsByPath test/payment-invoice-consistency.e2e-spec.ts
```

These tests use real PostgreSQL transactions and multiple connections to check
status and amount changes, deletion, tenant isolation, decimal totals, and
concurrent billing/payment requests. They also deliberately exceed the invoice
decimal capacity to verify that a failed invoice write rolls back the payment
change; that case expects an HTTP 500 and a database overflow log.

Linked payment mutations lock the invoice before the payment and reconcile
`amount_paid` from its `COMPLETED` payments inside the same transaction. `VOID`
invoices retain their status. This repairs cached totals on affected invoices;
it does not run a historical reconciliation of untouched invoices.

Teacher salary concurrency regressions can be run separately:

```sh
npm run test:e2e -- --runInBand --runTestsByPath test/teacher-salary-concurrency.e2e-spec.ts
```

These tests send concurrent HTTP requests for both new and pending salary
periods: one request must succeed, the others must return `409`, and exactly one
salary expense must remain. They also check tenant and role boundaries, rollback
and retry after failed writes, and salary calculations with a single database
connection. Deliberately failed writes produce expected error logs.

Salary payment takes a transaction-scoped PostgreSQL advisory lock for the
teacher UUID and period before checking `PAID`. Calculation, expense creation,
and the salary snapshot use the same transaction connection. The lock applies
across application instances, and unrelated teachers or periods have separate
keys. Any future salary writer must follow the same locking rule. This does not
normalize month input or repair previously duplicated expenses.

`npm run test:integration` also exercises the exported Vercel handler, including
its cold start, middleware, warm requests, readiness and authentication guards.
Only its database provider is replaced, so this check needs no PostgreSQL.
