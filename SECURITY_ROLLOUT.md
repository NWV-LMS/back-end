# Security rollout

This change hardens the current backend. It does not deploy changes or modify
production data. The dependency audit and remaining advisories are recorded in
[SECURITY_AUDIT.md](SECURITY_AUDIT.md).

## Sessions

Access and refresh JWTs now have distinct `token_use` claims, unique `jti`
values, and HS256 signatures. Refresh sessions store a digest of the entire
signed token and rotate with an atomic compare-and-swap. Existing untyped JWTs
and bcrypt refresh-session records are rejected: users must log in again after
deployment. The login and refresh response fields remain unchanged.

Logout and password changes immediately revoke refresh sessions, including
in-flight refresh requests. Already issued access JWTs remain valid until their
configured expiry; keep `JWT_ACCESS_EXPIRES_IN` short, such as 15 minutes.

## Provider credentials

Set a stable `APP_ENCRYPTION_KEY` for both the API and notification worker before
writing provider credentials. Use 32 random bytes encoded as base64 and store
the key in deployment secret settings. Preserve an existing key: replacing it
does not re-encrypt stored credentials.

Organization responses expose public settings only. New credential writes are
encrypted and fail without a usable key. Explicitly migrate historical
plaintext using [scripts/README.md](scripts/README.md), then rotate real
Telegram/WhatsApp credentials that may have been exposed by earlier responses.
The migration logs counts only and is idempotent. It is not run automatically.

## Tenant and assignment boundaries

Enrollment, journal, lesson, progress, attendance, student views, teacher
profiles/salaries, and invoice reads validate the tenant of related objects.
Teachers see their assigned students/groups and their own teacher profile;
students see their own records. Teacher invoice access requires every item to
belong to their assigned groups; mixed invoices remain available to authorized
organization staff.

Lessons are shared at course level in the existing schema. A teacher assigned
to a course can edit its lessons; rescheduling clears attendance only within
that teacher's groups. Separate per-group lessons would require a schema and
product change.

Legacy inconsistent tenant links are hidden by guarded queries. The patch does
not rewrite those historical rows or add composite database foreign keys. Audit
and repair existing inconsistent production data separately, preserving valid
records and their history.

## Reverse proxies and logs

The API now ignores forwarding headers by default. When deployed behind a
trusted reverse proxy, configure `TRUST_PROXY` with its actual IP/CIDR addresses
or a verified fixed hop count. For a same-host proxy this may be `loopback`.
Use `TRUST_PROXY=1` only with exactly one trusted hop and no direct client route
to the API. A public backend port with arbitrary forwarding headers must not be
trusted. Apply the same setting to the regular and Vercel entrypoints.

HTTP logs retain method, path, status, request ID, and timing. They omit query
values, request/response bodies and headers that can contain credentials.

## Validation

Use Node.js 24 and the committed lockfile:

```sh
npm ci --ignore-scripts
npx prisma generate
npm run build
npx eslint '{src,apps,libs,test}/**/*.ts' api/index.ts 'scripts/**/*.ts' --max-warnings=0
npm test -- --runInBand
npm run test:integration -- --runInBand
npm run test:e2e -- --runInBand
npm audit --omit=dev --audit-level=high
```

The real database E2E suite requires an explicit disposable `TEST_DATABASE_URL`;
see [test/README.md](test/README.md). Security regressions cover denied access
with unchanged database state, legitimate authorized paths, legacy corrupt
relations, concurrent password changes and refresh rotations, credential
encryption/migration, and credential-free HTTP logging.

Final verification on the installed dependency tree passed the build and
ESLint, **152 unit tests, 23 integration tests, and 130 PostgreSQL E2E tests**
(305 tests total). The restarted development API, database readiness, invalid
login behavior, and generated Swagger document were also verified. Production
dependency audit exits zero at the high threshold; remaining moderate and
development advisories are explicitly documented in SECURITY_AUDIT.md.
