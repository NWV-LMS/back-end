# Account authentication backend

Status: backend implementation, disabled by default. No live database migration,
SMTP delivery, Google credentials, frontend cookie routes or deployment are included.
Frontend design PR: https://github.com/abduvalee95/front-end/pull/3.

## Data and compatibility

Account is the globally unique, lowercase email identity. AuthIdentity identifies
Google users by provider + subject. A tenant User remains the authoritative
membership and keeps its original ID, phone, password and domain relationships.
No email-based backfill or automatic account merge occurs. Existing phone login,
legacy refresh rotation and super-admin flows continue unchanged.

AccountSession stores a SHA-256 digest of an opaque 256-bit token (30-day absolute
lifetime). Selecting an organization creates a TenantSession (at most seven days,
bounded by the parent expiry), and ordinary access/refresh JWTs with session_id.
Access checks re-read membership, role, organization status, account verification,
account version, and both session lifetimes/revocation. Refresh rotates atomically.
Account logout revokes its child access implicitly; password reset increments the
account version and revokes every parent session. Tenant logout revokes one tenant
session. These are independent of legacy phone sessions.

New organizations assign ADMIN on the server. Invitations only allow TEACHER,
MANAGER or STUDENT, revalidate the inviter's live ADMIN privilege, and require the
verified invitee email. Teacher/student profiles are created transactionally.
Existing student records must use the existing invitation/user provisioning flow
and credential-based membership linking; phone/email collisions are never merged.
The existing global unique User.phone constraint remains: a second membership
needs a distinct phone, or an existing membership can be linked with its credentials.

## Next.js BFF contract

All routes below are relative to /api/auth/accounts, accept JSON, and require
X-Auth-BFF-Secret. This secret is server-only; never expose it with NEXT_PUBLIC_.
Use a Next.js Route Handler/server layer, not direct browser-to-backend calls.

| Method/path | Body | Authentication/result |
| --- | --- | --- |
| POST /register | email, full_name, password, browser_binding | Generic email response |
| POST /verify-email | token, browser_binding | verified: true; login separately |
| POST /login | email, password | account, accountSessionToken, expiresAt |
| POST /forgot-password | email | Generic email response |
| POST /reset-password | token, password | success: true |
| POST /google/start | browser_binding | authorizationUrl |
| POST /google/callback | code, state, browser_binding | Session response, or linked: true |
| POST /google/link | browser_binding | Account bearer; authorizationUrl |
| GET /me | — | Account bearer; account, memberships, onboardingRequired |
| POST /logout | — | Account bearer; success: true |
| POST /centers | name, phone | Account bearer; organization_id |
| POST /link-legacy | phone, password | Account bearer; linked: true |
| POST /select-organization | organization_id | Account bearer; accessToken, refreshToken, user |
| POST /invitations | email, role | Tenant JWT bearer; invitation_id, expires_at |
| POST /accept-invitation | token, phone | Account bearer; organization_id |

Account bearer means Authorization: Bearer <accountSessionToken>, not a tenant JWT.
Existing POST /api/auth/refresh accepts {refreshToken}; /api/auth/me and /logout
accept tenant access JWTs. Account tokens cannot authenticate tenant APIs.
Use safe DTO responses only; password hashes and database sessions never leave API.
Validation rejects extra fields when the application's global validation pipe does.

The BFF must store account/access/refresh credentials in Secure, HttpOnly,
SameSite=Lax cookies, with bounded Max-Age and no localStorage. Require trusted
Origin + CSRF protection on browser mutation routes, including login and linking;
clear all associated cookies on logout. Treat token responses as Cache-Control:
no-store. Never return the BFF secret or raw bearer credentials to browser JS.

Before registration or Google start, generate a random 32-byte base64url browser
binding in an HttpOnly cookie; pass that value server-side. Keep it for email
verification. Verification links must open in the same browser; if unavailable,
restart registration there. This prevents an attacker pre-registering someone
else's email with an attacker-known password. Registration stores the password
only on a bound, single-use verification attempt, and installs it after proof.
Multiple pending attempts are allowed; only the first verified version can win.

Configure Google redirect to the BFF callback. BFF receives code/state from Google,
reads the binding cookie, and POSTs /google/callback; it never trusts a binding
supplied by browser JSON. Backend checks state, binding, PKCE, signed ID-token
audience/issuer/expiry, nonce and verified email. Attempts expire after 10 minutes
and are consumed before exchange. No Google access/refresh token is persisted.
An existing email without a linked Google subject gets 409: authenticate that
account first, then use /google/link. Even an unverified existing registration
is not automatically merged; finish registration or password recovery as applicable.

Email links point to /verify-email, /reset-password or /accept-invitation on
AUTH_APP_URL with #token=... fragments. The frontend must read and immediately
remove the fragment from history, and POST after explicit user action. Verification
and reset tokens expire after 30 minutes; invitations after seven days. Do not
consume on GET (mail scanners). Never log codes, token fragments, request bodies,
Authorization, SMTP secrets or BFF headers. Disable callback query logging at proxies.

Errors: 400 invalid/expired input or token; 401 missing/invalid authentication;
403 membership/privilege failure; 404 feature disabled; 409 identity/membership
conflict; 429 rate limit; 503 unavailable provider configuration. Registration and
forgot-password intentionally do not reveal delivery/account existence. Monitor
SMTP delivery separately without message contents or tokens.

## Configuration and staged rollout

Copy .env.account-auth.example into the deployment secret store; do not commit
real values. Keep ACCOUNT_AUTH_ENABLED=false until BFF and providers are ready.
Required when enabled: AUTH_BFF_SECRET (32+ characters), APP_ENCRYPTION_KEY,
AUTH_APP_URL, AUTH_SMTP_HOST/USER/PASSWORD, AUTH_MAIL_FROM, GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI. HTTPS is mandatory except loopback in
development. SMTP requires TLS; AUTH_SMTP_PORT defaults to 587 (465 uses TLS).
Use distinct generated BFF/JWT/encryption secrets. Keep the encryption key stable.

1. Back up the database and test the additive migration on a staging clone.
2. Install with npm ci --ignore-scripts, then npx prisma generate. The repository's
   existing postinstall seeds the database, so do not run it implicitly.
3. Review and run npx prisma migrate deploy with the intended staging DATABASE_URL.
4. Configure Google Web OAuth client with the exact BFF redirect, configure SMTP,
   and implement the BFF contract. Configure a shared rate limiter at the trusted
   edge/BFF: the current Nest limiter is per-process and sees the BFF address.
   Do not trust arbitrary forwarded IP headers to bypass rate limits.
5. Enable account auth in staging; test real email verification/reset, Google
   callback/linking, logout/revocation, old phone login, invitation and tenant switching.
6. Promote only after those live flows pass. This PR does not perform these steps.

Disable ACCOUNT_AUTH_ENABLED to stop new account API calls. Existing tenant JWTs
continue to use database session validation. To terminate them, revoke AccountSession
rows. Keep the new session-aware JWT code deployed; rolling back to old validators
could ignore session_id and revocation. Do not drop new tables or undo membership
links as an operational rollback. Legacy JWT signing-key rotation affects legacy
users too and must be planned separately.

Periodically purge expired/consumed GoogleAuthAttempt and AccountToken rows, expired
invitations and expired/revoked sessions after the desired audit retention. Pending
verification rows contain password hashes; minimize their retention. Account emails
are application-normalized; any direct administrative DB writes must normalize too.

## Verification performed

- Nest production build and targeted ESLint.
- Unit suite: password byte coverage, browser binding, verification/reset replay,
  account-version revocation, tenant isolation/current roles, refresh rotation,
  Google PKCE/state/nonce/unverified-email rejection, identity collision and linking.
- HTTP integration tests use real Nest guards/DTO validation with mocked services;
  existing phone-login and organization-access regression suites also pass.
- Generated migration executed against a PostgreSQL-compatible PGlite baseline
  with an existing User: preserved legacy credentials and identity, enforced unique
  account+organization membership, retained User on Account deletion.
- No live external PostgreSQL/Google/SMTP end-to-end test was performed. Staging
  end-to-end verification is a release gate, not implied by the mock tests.
