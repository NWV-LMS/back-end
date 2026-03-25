# Environment Configuration Guide

## Environment Files Priority (Highest to Lowest)

```
1. .env.production.local  ← Highest priority (production + local overrides)
2. .env.local             ← Local overrides (all environments)
3. .env.production        ← Production defaults
4. .env                   ← Base defaults (committed to git)
```

## Scripts and Environment

| Command                | NODE_ENV      | Files Loaded                                                       |
| ---------------------- | ------------- | ------------------------------------------------------------------ |
| `npm run start:dev`    | `development` | `.env`, `.env.development`, `.env.local`, `.env.development.local` |
| `npm run start:prod`   | `production`  | `.env`, `.env.production`, `.env.local`, `.env.production.local`   |
| `npm run start:debug`  | `development` | Same as dev                                                        |
| `npm run start:worker` | `production`  | Same as prod                                                       |

## File Usage

### `.env` (Committed)

Base configuration for all environments. Safe defaults only.

```env
# EXAMPLE - safe defaults only
NODE_ENV=development
PORT=3000
WHATSAPP_API_VERSION=v18.0
NOTIFICATION_WORKER_BATCH=20
```

### `.env.production.local` (NOT Committed) ✅

Your production secrets. **NEVER commit this file.**

```env
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://user:pass@host:5432/db"
JWT_ACCESS_SECRET="32+ chars secret"
JWT_REFRESH_SECRET="32+ chars secret"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGINS="https://yourdomain.com"
APP_ENCRYPTION_KEY="32+ chars key"
```

### `.env.local` (NOT Committed)

Local overrides for all environments (optional).

## How It Works

1. **`package.json` scripts** set `NODE_ENV`
2. **`main.ts`** loads env files in order:
   ```typescript
   // Loads: .env → .env.{NODE_ENV} → .env.local → .env.{NODE_ENV}.local
   // Later files override earlier with { override: true }
   ```
3. **`ConfigModule`** in `app.module.ts` also supports this (backup)

## Testing Your Setup

```bash
# Development
npm run start:dev
# Should use .env + .env.development.local

# Production
npm run build
npm run start:prod
# Should use .env + .env.production.local
```

## Verify Environment Loading

Add to `main.ts` temporarily:

```typescript
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log(
  'DATABASE_URL:',
  process.env.DATABASE_URL?.substring(0, 30) + '...',
);
```

## Git Safety

`.gitignore` already excludes:

- `.env.local`
- `.env.development.local`
- `.env.production.local`
- `.env` (base file)

✅ **Commit**: `.env.example` only
❌ **NEVER commit**: Any `.env*` with secrets
