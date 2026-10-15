# Dependency security review

Audit date: 2026-10-16. Runtime used for validation: Node.js 24.

## Scope and current production result

The dependency changes preserve NestJS 10, Express 4, Prisma 5.22, Jest 29,
and the application dependency APIs. No framework major upgrade or
`npm audit fix --force` was applied.

`npm audit --omit=dev --package-lock-only` reports **0 critical, 0 high,
30 moderate, and 0 low** vulnerable package entries, compared with
**3 critical, 5 high, 32 moderate, and 1 low** before this change.
Counts include parent packages affected by the same underlying advisory;
30 entries do not mean 30 independently exploitable bugs. Audit databases
change; rerun the commands below when reviewing or deploying.

## Applied changes

- Upgrade compression to 1.8.2, which fixes leaked compression streams on
  premature response close (GHSA-vc2v-76pw-4v95).
- Keep NestJS 10 and override its pinned Express adapter dependencies to
  compatible patched releases: Express 4.22.3, body-parser 1.20.8, and
  Multer 2.4.0. This addresses multipart cleanup, malformed field-name,
  resource exhaustion, and asynchronous file-filter advisories.
- Require qs 6.16.1 and proxy-addr 2.0.8 throughout the tree. The latter fixes
  IPv4-mapped IPv6 trust-subnet spoofing (GHSA-jqcg-44mw-7w3h).
- Override Swagger's pinned lodash and js-yaml to patched releases in their
  current major versions. Patch the scheduler's pinned uuid within major 11.
- Remove unused hbs and Prisma 7 PostgreSQL/SQLite adapters. There are no
  source, seed, or configuration references to these adapters or a template
  view engine. The application uses the standard Prisma 5.22 client.
  Remaining development-only Handlebars is updated to 4.7.10.
- Apply compatible lockfile updates for brace-expansion, form-data,
  browserslist, Babel, fflate, YAML parsing, and fast-copy. Scope overrides
  for pinned development tools to Nest CLI (glob/webpack) and Angular DevKit
  (ajv/picomatch); do not replace APIs with incompatible major versions.
- Upgrade pinned Inquirer within its current major versions (8.2.7 for
  Nest CLI, 9.3.8 for the schematics CLI). Both use maintained
  @inquirer/external-editor, removing vulnerable external-editor/tmp without
  forcing an incompatible pre-1.0 tmp dependency into old consumers.

The overrides are explicit security constraints for dependencies pinned by
upstream NestJS packages. Reassess and remove them when the framework and
tooling move to versions that already depend on patched releases.

## Remaining production advisories

| Dependency family | Advisory and applicability | Required follow-up |
| --- | --- | --- |
| NestJS core 10 | GHSA-36xv-jgw5-4q75, downstream output injection; the installed core is in the advisory range. This review does not claim the framework advisory is resolved by application fixes. | Plan and validate a coordinated supported NestJS major upgrade; do not override core independently of its adapters and peers. |
| file-type 20.4.1 via Nest common | GHSA-5v7r-6r5c-r473 and GHSA-j47w-4g3g-c36v, malformed ASF / ZIP parsing DoS. Application source currently does not use Nest FileTypeValidator or call file-type; the logo upload checks the MIME header without this parser. | Move to a framework release with patched file-type before enabling that validator; a transitive major upgrade was deliberately not forced. |
| Sentry 8 / OpenTelemetry | GHSA-8988-4f7v-96qf, unbounded W3C baggage allocation, and GHSA-qqmp-wf37-98f9, database usernames included in telemetry attributes. Sentry is initialized in `src/instrument.ts` and enabled when SENTRY_DSN is configured. No external Sentry delivery was tested. | Upgrade Sentry and its OpenTelemetry integrations together and validate instrumentation. Do not force OpenTelemetry 2 into an SDK that expects version 1. |

## Development dependency advisories

Development packages are also audited; a production-only result must not be
presented as a clean full-tree audit. The final full-tree audit reports
**0 critical, 44 high, 36 moderate, and 0 low** package entries. Most high
entries are parent-tool reports of the same development dependency.
Unpatched braces 3.0.3 remains in Jest,
file-watching, linting, and build-tool glob handling (GHSA-vfj7-8cjw-p6xm).
This package is used in build/development paths, not exposed API routes.
Avoid processing untrusted patterns until upstream tooling is updated.
Development-only sprintf-js also remains affected by unbounded
precision-specifier DoS (GHSA-hp3w-g68c-fv3c), inherited through YAML tooling.
No patched compatible version was available for that dependency. The full
audit below remains nonzero.

## Reproduction and validation

```bash
npm ci --ignore-scripts
npx prisma generate
npm run build
npm test -- --runInBand
npm run test:integration -- --runInBand
npm run test:e2e -- --runInBand
npm audit --omit=dev --package-lock-only
npm audit --package-lock-only
```

`--ignore-scripts` prevents the repository postinstall from seeding a database
as part of dependency installation. Generate Prisma explicitly and use a
dedicated test database for integration/e2e checks. Package signatures,
lockfile integrity hashes, and TLS verification remain enabled. Build and
application test outcomes are recorded with the security-change commits;
this document describes the dependency scope and does not assert a clean
full audit or externally verified production telemetry.

After the frozen install, a local compatibility smoke check passed for
normal multipart upload, file-size enforcement, malformed multipart rejection,
gzip responses, cleanup of all gzip streams after 10 aborted responses, and
server health after those requests.
