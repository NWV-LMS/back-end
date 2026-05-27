# Security Audit — Remaining Vulnerabilities

Last audit: 2026-05-27

## Status

| Severity | Before | After safe fix |
| -------- | ------ | -------------- |
| Critical | 1      | 0              |
| High     | 15     | 7              |
| Moderate | 20     | 16             |
| Low      | 4      | 3              |
| **Total**| **40** | **26**         |

What landed without `--force`:
- Critical `handlebars` (8 CVEs, prototype pollution + JS injection) — resolved.
- Removed accidental top-level `npm` and `install` dependencies (unused in source).
- Patched many transitive packages via lockfile-only updates.

## Remaining vulnerabilities require a major version bump

All 26 open advisories collapse into **7 direct-dependency major upgrades**. Once these are bumped, the transitive vulnerabilities they pull (multer, qs, lodash, js-yaml, ajv, picomatch, file-type, glob, tmp, webpack, etc.) resolve automatically.

### 1. `@nestjs/core` 10 → 11

- Current: `^10.0.0` (installed 10.4.22)
- Target: `^11.1.24`
- Severity (direct): moderate — [GHSA-36xv-jgw5-4q75](https://github.com/advisories/GHSA-36xv-jgw5-4q75)
- Breaking: yes. NestJS 11 raises minimum Node to 20 LTS, swaps Express 4 → 5 path-to-regexp behavior, and changes some lifecycle hook ordering. See the NestJS 11 migration guide.

### 2. `@nestjs/platform-express` 10 → 11 ⚠️ highest impact

- Current: `^10.0.0` (installed 10.4.22)
- Target: `^11.1.24`
- Severity (direct): high
- Cascades fixes for:
  - **`multer` <= 2.1.0** — high — 3 DoS CVEs ([GHSA-xf7r-hgr6-v32p](https://github.com/advisories/GHSA-xf7r-hgr6-v32p), [GHSA-v52c-386h-88mc](https://github.com/advisories/GHSA-v52c-386h-88mc), [GHSA-5528-5vmv-3xc2](https://github.com/advisories/GHSA-5528-5vmv-3xc2))
  - **`qs` 6.7.0 – 6.15.1** — moderate ([GHSA-w7fw-mjwx-w883](https://github.com/advisories/GHSA-w7fw-mjwx-w883), [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26))
  - **`body-parser` 1.20.3 – 1.20.4** — moderate (transitive via qs)
  - **`express` 4.21.0 – 4.22.1** — moderate (transitive via qs)
- Breaking: yes. Express 5 changes async error propagation and route parsing; `multer.diskStorage` API is unchanged but body parsing semantics differ. Any custom Express middleware needs review.
- File-upload code in this repo uses `@nestjs/platform-express` — verify `MulterModule` config still compiles.

### 3. `@nestjs/swagger` 7 → 11 ⚠️ 4-major jump

- Current: `^7.4.2` (installed 7.4.2)
- Target: `^11.4.4`
- Severity (direct): moderate
- Cascades fixes for:
  - **`lodash` <= 4.17.23** — high — 3 CVEs (prototype pollution + code injection via `_.template` / `_.unset` / `_.omit`)
  - **`js-yaml` 4.0.0 – 4.1.0** — moderate (prototype pollution in merge)
- Breaking: yes, biggest delta. Decorator signatures and `SwaggerModule.setup` options changed between v7 and v11. Schema generation for inheritance + `PartialType` / `OmitType` mostly preserved; spot-check generated OpenAPI output.

### 4. `@nestjs/terminus` 10 → 11

- Current: `^10.3.0` (installed 10.3.0)
- Target: `^11.1.1`
- Severity (direct): moderate
- Breaking: yes (must move in lockstep with `@nestjs/core` 11). Health-check indicator interfaces unchanged in practice.

### 5. `@sentry/nestjs` 8 → 10

- Current: `^8.55.2` (installed 8.55.2)
- Target: `^10.54.0`
- Severity (direct): moderate
- Breaking: yes. v9 + v10 reworked transaction APIs and the integration init signature. The `SentryModule.forRoot()` call site will likely need adjustment, and `Sentry.captureException` usage is preserved.

### 6. `@nestjs/cli` 10 → 11 (dev)

- Current: `^10.0.0` (installed 10.4.9)
- Target: `^11.0.17+`
- Severity (direct): high
- Cascades fixes for:
  - **`webpack` 5.49.0 – 5.104.0** — low (HttpUriPlugin SSRF)
  - **`glob`, `tmp`, `inquirer`, `external-editor`** — low/high (build-time only)
- Breaking: yes, but dev-only. `nest build` config schema mostly compatible; verify `nest-cli.json` still parses.

### 7. `@nestjs/schematics` 10 → 11 (dev) + `@nestjs/testing` 10 → 11 (dev)

- Current: `^10.0.0` each
- Severity (direct): moderate
- Cascades fixes for:
  - **`ajv` <8.18.0** — moderate (ReDoS via `$data`)
  - **`picomatch` <=2.3.1 || 4.0.0 – 4.0.3** — high (method injection in POSIX char classes + ReDoS via extglob)
  - **`@angular-devkit/core`, `@angular-devkit/schematics`, `@angular-devkit/schematics-cli`** — moderate (transitive)
- Breaking: yes, but dev-only. Required to keep test toolchain on the same major as runtime NestJS.

---

## Recommended path forward

Do these as **one coordinated NestJS-10-to-11 upgrade PR** rather than piecemeal — the `@nestjs/*` packages must move together to avoid peer-dependency conflicts:

```bash
npm install \
  @nestjs/common@^11 \
  @nestjs/core@^11 \
  @nestjs/platform-express@^11 \
  @nestjs/swagger@^11 \
  @nestjs/terminus@^11 \
  @nestjs/jwt@^11 \
  @nestjs/mapped-types@^2 \
  @nestjs/passport@^11 \
  @nestjs/config@^4 \
  @sentry/nestjs@^10

npm install --save-dev \
  @nestjs/cli@^11 \
  @nestjs/schematics@^11 \
  @nestjs/testing@^11
```

Then:

1. Run `npm audit` — should drop to 0.
2. Run `npm run build && npm test` — fix typing breakages.
3. Manual smoke test:
   - File upload endpoint (`/uploads`) — multer config + serverless routing in `api/index.ts`.
   - Swagger UI at `/api` — confirm OpenAPI doc renders.
   - Health endpoint (`@nestjs/terminus`).
   - Sentry capture — trigger a thrown exception in dev.
4. Deploy to Vercel preview, run the test creds from `CLAUDE.md` against `/api/auth/login`.
5. Promote to production only after preview smoke passes.

## What was NOT applied automatically

`npm audit fix --force` would attempt the entire NestJS 10 → 11 jump unattended. Not safe without the manual smoke test above, so it was left for the user to decide.
