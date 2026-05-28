# Backup & Recovery Runbook

## RTO / RPO
- **RTO** (Recovery Time Objective): 1 hour
- **RPO** (Recovery Point Objective): 24 hours max data loss

---

## 1. Database Backups (Prisma Postgres)

Prisma Data Platform (db.prisma.io) takes automatic snapshots of the Postgres database.

**Where to find snapshots:**
1. Log in at https://console.prisma.io
2. Select the project → **Database** tab → **Backups**
3. Available snapshots are listed with timestamp and size

**Retention:** Verify current retention policy in the Prisma Data Platform dashboard (retention period varies by plan).

**How to restore:**
1. In the dashboard, navigate to **Backups** → select the target snapshot
2. Click **Restore** → confirm the target environment
3. Verify restore by running the smoke test checklist below
4. Re-run any migrations that landed after the snapshot: `npx prisma migrate deploy`

---

## 2. Application Code Backups

GitHub is the single source of truth for all application code.

**Repository:** `github.com/<org>/back-end` and `github.com/<org>/front-end`

**Recommended branch protection settings (apply to `main` and `master`):**
- Require pull request review before merging (at least 1 reviewer)
- Require status checks to pass (CI workflow)
- Disable force pushes
- Disable branch deletion
- Restrict who can push directly (admins only if needed)

> Configure at: GitHub repo → **Settings** → **Branches** → **Branch protection rules**

---

## 3. Environment Variables Backup

Vercel stores env vars per project/environment. Export them periodically.

**Export command (run weekly or before any major change):**
```bash
vercel env pull .env.prod-backup --environment=production --yes
```

**Secure storage:**
- Store `.env.prod-backup` in **1Password** (or equivalent vault) under a shared team vault
- **Never commit this file to the repository** — add to `.gitignore`
- Rotate secrets in both Vercel and the vault after any suspected exposure

---

## 4. Disaster Recovery Runbook

### a) Database corruption
1. Go to Prisma Data Platform → **Backups** → select most recent clean snapshot
2. Click **Restore** and confirm
3. Run `npx prisma migrate deploy` to re-apply any migrations newer than the snapshot
4. Validate with smoke tests

### b) Vercel deployment broken (bad deploy)
1. `vercel rollback` — rolls back to the previous successful deployment
2. Or: Vercel dashboard → **Deployments** → select last known-good → **Promote to Production**
3. Verify rollback with smoke tests

### c) Code lost / repo corrupted
1. Re-clone from GitHub: `git clone git@github.com:<org>/<repo>.git`
2. Install deps: `npm ci`
3. Restore `.env` from secure backup (see section 3)
4. Deploy: `vercel --prod`

### d) Env vars lost
- **Option A:** Pull from Vercel (if project still exists): `vercel env pull .env.prod-backup --environment=production --yes`
- **Option B:** Restore from secure backup in 1Password vault
- Re-add any missing vars: `vercel env add <KEY> production`

### e) Total loss (full rebuild order)
1. **Env vars** — restore from 1Password vault; add to Vercel via `vercel env add`
2. **Database** — restore from Prisma snapshot; run `npx prisma migrate deploy`
3. **Backend deploy** — `git clone` → `npm ci` → `vercel --prod`
4. **Frontend deploy** — `git clone` → `npm ci` → `vercel --prod`
5. **Smoke test** — run checklist below; confirm all green before marking incident resolved

---

## 5. Smoke Test Checklist

Run after any restore or deployment:

```bash
# Health checks
curl -sf https://<backend-url>/api/health
curl -sf https://<backend-url>/api/health/db

# Auth flow
TOKEN=$(curl -s -X POST https://<backend-url>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+996559147444","password":"StrongPassword123"}' \
  | jq -r '.accessToken')
echo "Token acquired: ${TOKEN:0:20}..."

# Authenticated request
curl -sf -H "Authorization: Bearer $TOKEN" \
  https://<backend-url>/api/organizations

# Frontend
curl -sf https://<frontend-url>/ | grep -q "html"
```

- [ ] `/api/health` returns 200
- [ ] `/api/health/db` returns 200 (Prisma connected)
- [ ] Login returns a valid JWT
- [ ] Authenticated API call returns data (not 401/500)
- [ ] Frontend home page loads without error
