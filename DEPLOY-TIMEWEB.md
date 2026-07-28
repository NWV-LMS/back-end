# Timeweb Cloud'ga Migratsiya — Bilim Nuru CRM+LMS (VPS + Docker Compose)

Vercel (front) + Railway (back) + Prisma Postgres (DB) → **bitta Timeweb Cloud Server** (VPS).
Hamma narsa `docker compose` bilan bitta serverda: **nginx + api + front + db**.

> Lokal-dev uchun `docker-compose.yml` ishlatiladi. **Production = `compose.yaml`** (shu hujjat).

---

## 0. Arxitektura

```
                      ┌─────────────── VPS (Ubuntu, 4GB) ───────────────┐
  bilimnuru.com ──┐   │  nginx:80                                        │
                  ├──▶│   ├─ bilimnuru.com      → front:3000 (Next.js)   │
  api.bilimnuru ──┘   │   └─ api.bilimnuru.com  → api:3001  (NestJS)     │
                      │  api ─┐                                          │
                      │       └─▶ db:5432 (postgres:17, volume db-data)  │
                      │  uploads → volume uploads-data                   │
                      └──────────────────────────────────────────────────┘
```

- DB konteynerda, **`db-data`** volume'da → redeploy'da saqlanadi.
- Uploads **`uploads-data`** volume'da (logo hozir DB base64, lekin volume baribir bor).
- Front backendga **ichki** `http://api:3001` orqali ulanadi (server-side proxy). Browser faqat `bilimnuru.com` bilan gaplashadi.
- `JWT_ACCESS_SECRET` front va api uchun **bitta** `.env.production.local`'dan → avtomatik mos.

---

## 1. Timeweb'da server yaratish

Panel → `crm` proyekti → **Облачный сервер**:

| Sozlama | Qiymat |
|---|---|
| Образ | **Ubuntu** 24.04 (yoki 22.04) |
| Регион | Москва (yoki yaqinrog'i) |
| Конфигурация | **2 CPU / 4 GB / 50 GB** (1 000 ₽/oy) — build uchun qulay |
| Публичный IP | **Ha** (+180 ₽/oy) |
| Бэкапы | ixtiyoriy (haftalik `pg_dump` ham bor, §12) |
| SSH-ключ | **o'z public key'ingizni qo'shing** (parol emas) |

> SSH key yo'q bo'lsa: `ssh-keygen -t ed25519 -C "you@mail"` → `~/.ssh/id_ed25519.pub` ichini panelga qo'ying.

`Заказать` → server IP'sini oling (masalan `185.x.x.x`).

---

## 2. Server tayyorlash (bir marta)

```bash
ssh root@SERVER_IP

# Docker
curl -fsSL https://get.docker.com | sh

# Swap (4GB) — Next build xotirani ko'p yeydi, OOM bo'lmasligi uchun
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Firewall
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

---

## 3. Kodni serverga olish (ikkala repo SIBLING bo'lishi shart)

`compose.yaml` front'ni `../front-end` dan quradi — shuning uchun ikkala repo yonma-yon turishi kerak:

```bash
mkdir -p /opt/bilimnuru && cd /opt/bilimnuru

# Backend (master)
git clone https://github.com/NWV-LMS/back-end.git
# Frontend (yangi kod main'ga merge qilindi):
git clone https://github.com/abduvalee95/front-end.git
```

Natija:
```
/opt/bilimnuru/back-end/compose.yaml   ← bu yerdan compose ishga tushadi
/opt/bilimnuru/front-end/              ← ../front-end shu
```

> ⚠️ **Front branch:** yangi kod (token signature verify + reports filtrlar) `security/h1-h3-h4-hardening` dan `main`'ga merge qilindi. Deploy `main`'dan.

---

## 4. Maxfiy ma'lumotlar — `.env.production.local`

```bash
cd /opt/bilimnuru/back-end
cp .env.production.local.example .env.production.local
nano .env.production.local
```

Yangi secret'lar (Railway/Vercel'nikini qayta ishlatmang):
```bash
openssl rand -base64 64   # JWT_ACCESS_SECRET
openssl rand -base64 64   # JWT_REFRESH_SECRET
openssl rand -base64 32   # APP_ENCRYPTION_KEY
```

To'ldirilishi shart (aks holda api boot bo'lmaydi):
`POSTGRES_PASSWORD`, `DATABASE_URL` (xuddi shu parol bilan), `DATABASE_CONNECTION_LIMIT=10`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`,
`APP_ENCRYPTION_KEY`, `ALLOWED_ORIGINS=https://bilimnuru.com`, `NODE_ENV=production`.

> Bu fayl `db`, `api`, `front` — uchalasiga ham yuklanadi. Bitta joy.

---

## 5. Image'larni build qilish

```bash
cd /opt/bilimnuru/back-end
docker compose build          # api + front image'lari
```

> Front build sekin bo'lsa normal (Next standalone). Swap (§2) OOM'dan saqlaydi.

---

## 6. DB ko'chirish (dump → restore → verify)

> Tartib muhim: avval **db**, keyin **restore**, keyin api. Shunda api'ning `prisma migrate deploy` no-op bo'ladi (dump'da `_prisma_migrations` bor).

```bash
# 6.1) Faqat db'ni ko'tarish
docker compose up -d db

# 6.2) Prisma Postgres'dan YANGI dump (lokal mashinangizda yoki serverda)
pg_dump "postgres://USER:PASS@db.prisma.io:5432/postgres?sslmode=require" \
  --no-owner --no-acl -Fc -f fresh.dump
# fresh.dump ni serverga ko'chiring: scp fresh.dump root@SERVER_IP:/opt/bilimnuru/back-end/

# 6.3) Timeweb db konteynerga restore
docker compose exec -T db pg_restore --no-owner --no-acl --clean --if-exists \
  -U leo -d crm_prod < fresh.dump

# 6.4) ⚠️ MAJBURIY — failed migration qatorlarini tozalash
# Prisma Postgres dump'i `_prisma_migrations` da fail bo'lgan urinish-qatorlarni
# olib keladi (masalan 20260520182154). Tozalamasangiz api `prisma migrate deploy`
# P3009 beradi va CRASH-LOOP ga tushadi. Quyidagi DELETE faqat tugallanmagan
# (finished_at NULL) qatorlarni o'chiradi — muvaffaqiyatli qatorlar qoladi, schema o'zgarmaydi.
docker compose exec -T db psql -U leo -d crm_prod -c \
  "DELETE FROM \"_prisma_migrations\" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;"

# 6.5) Verify — qator sonlari + migration holati (0 ta failed bo'lishi kerak)
docker compose exec db psql -U leo -d crm_prod -c "SELECT count(*) FROM \"User\";"
docker compose exec db psql -U leo -d crm_prod -c "SELECT count(*) FROM \"Organization\";"
docker compose exec db psql -U leo -d crm_prod -c \
  "SELECT count(*) AS failed FROM \"_prisma_migrations\" WHERE finished_at IS NULL;"
```

> Eski `backup_20260529.sql` (plain SQL) bilan: `docker compose exec -T db psql -U leo -d crm_prod < backup_20260529.sql`. Lekin cutover'da **yangi** dump oling.
>
> 💡 Bu loyiha smoke-test'da tekshirildi: toza pg17'ga dump restore → 6.4 cleanup → `migrate deploy` no-op → api `/api/health` = ok.

---

## 7. To'liq stack'ni ishga tushirish

```bash
docker compose up -d
docker compose ps                       # hammasi healthy/up
curl http://localhost/api/... # (api.bilimnuru.com hali DNS yo'q)
docker compose exec api wget -qO- http://localhost:3001/api/health
# {"status":"ok","db":"up",...}
```

---

## 8. Domen + DNS

`.com` Timeweb'da sotib olinadi (panel → **Домены**) yoki boshqa registrator.

Registrator/DNS panelida (server IP = VPS IP):

| Type | Name | Value |
|---|---|---|
| A | `@` (bilimnuru.com) | SERVER_IP |
| A | `www` | SERVER_IP |
| A | `api` | SERVER_IP |

DNS tarqalgandan (15 min – 1 soat) keyin `http://bilimnuru.com` ochilishi kerak.

---

## 9. SSL (HTTPS) — certbot webroot

```bash
cd /opt/bilimnuru/back-end
mkdir -p docker/nginx/certbot-www

# compose.yaml → nginx service'da quyidagilarni oching (uncomment):
#   ports: - "443:443"
#   volumes:
#     - /etc/letsencrypt:/etc/letsencrypt:ro
#     - ./docker/nginx/certbot-www:/var/www/certbot:ro
docker compose up -d nginx

# Sertifikat olish (webroot, nginx ishlab turibdi)
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /opt/bilimnuru/back-end/docker/nginx/certbot-www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d bilimnuru.com -d www.bilimnuru.com -d api.bilimnuru.com \
  --email you@mail.com --agree-tos --no-eff-email
```

Keyin `docker/nginx/conf.d/default.conf` ga 443 server-block(lar)ini qo'shing
(`ssl_certificate /etc/letsencrypt/live/bilimnuru.com/fullchain.pem;` ...) va 80→443 redirect.
`docker compose restart nginx`.

> Avto-yangilash: `certbot renew` ni haftalik cron'ga qo'ying + `docker compose restart nginx`.

---

## 10. Cutover (Vercel/Railway → Timeweb)

1. DNS TTL'ni oldindan pasaytiring (300s).
2. Yangi `pg_dump` → restore (§6).
3. `docker compose up -d`, health OK, login sinab ko'ring.
4. DNS'ni VPS IP'ga o'tkazing (§8).
5. SSL (§9).
6. 24–48 soat eski Railway/Vercel'ni saqlang (rollback), keyin o'chiring.

⚠️ Eski Prisma Accelerate `api_key` terminal'da ko'ringan edi — Prisma'dan chiqqach **rotatsiya/o'chirish**.

---

## 11. Yangilash — qo'lda yoki avtomatik (CI/CD)

**Qo'lda** (serverda):
```bash
cd /opt/bilimnuru/back-end && bash deploy.sh
```
`deploy.sh`: ikkala repo'ni pull qiladi (back `master` + front branch) → `docker compose up -d --build` → eski image'larni tozalaydi → status.

### Avtomatik — GitHub Actions (push → auto pull + build + run)

Har ikkala repo'da `.github/workflows/deploy.yml` bor. Push bo'lganda Action SSH orqali VPS'ga kirib `deploy.sh` ni ishga tushiradi:
- `back-end` → `master`'ga push → deploy
- `front-end` → `security/h1-h3-h4-hardening` (yoki `main`)'ga push → deploy

**Sozlash (bir marta):**

1. Deploy SSH kalitini yarating:
   ```bash
   ssh-keygen -t ed25519 -f deploy_key -N "" -C "gha-deploy"
   ```
2. Public key'ni VPS'ga qo'shing (serverda `~/.ssh/authorized_keys` ga):
   ```bash
   ssh-copy-id -i deploy_key.pub root@SERVER_IP
   ```
3. GitHub Secrets — **har ikkala repo'da** (Settings → Secrets and variables → Actions):

   | Secret | Qiymat |
   |---|---|
   | `SSH_HOST` | VPS IP |
   | `SSH_USER` | `root` (yoki deploy user) |
   | `SSH_PRIVATE_KEY` | `deploy_key` (PRIVATE) fayl ichi to'liq |
   | `SSH_PORT` | ixtiyoriy (default 22) |

4. Test: `git push` yoki Actions tab → "Deploy to VPS" → Run workflow.

> Action faqat **yangilanish**ni avtomatlashtiradi. Birinchi o'rnatish qo'lda (§1–§9): repo'lar `/opt/bilimnuru` da, `.env.production.local` to'ldirilgan, DB restore qilingan bo'lishi kerak.

> ⚠️ `deploy.sh` `git reset --hard` qiladi — serverdagi qo'lda tahrirlar yo'qoladi (`.env.production.local` gitignore'da, saqlanadi). Server = deploy target, unda kod tahrirlamang.

> 🔒 Private key faqat GitHub Secrets'da. Repo'ga commit qilmang. Maxsus deploy-only kalit ishlating (shaxsiy SSH kalitingiz emas).

---

## 12. Backup (haftalik)

```bash
docker compose exec -T db pg_dump -U leo -Fc crm_prod > backup_$(date +%Y%m%d).dump
# Xavfsiz joyga (S3/external) ko'chiring.
```

---

## 13. Rollback

- DNS'ni eski Railway/Vercel'ga qaytaring (TTL past bo'lsa tez).
- Yoki oldingi image'ga: `git checkout <prev>` → `docker compose up -d --build`.

---

## 14. Muammolar

```bash
docker compose logs -f api          # api loglari (env xatosi shu yerda ko'rinadi)
docker compose logs -f front
docker compose logs -f nginx
docker compose exec api npx prisma migrate status
docker compose exec db psql -U leo -d crm_prod -c "SELECT 1"
```

- **api boot bo'lmasa** → log'da "Invalid environment configuration" → `.env.production.local` to'ldirilmagan.
- **front 502** → `docker compose ps` da front up'mi; `API_URL=http://api:3001` to'g'rimi.
- **login ishlamasa** → front va api `JWT_ACCESS_SECRET` bir xil bo'lishi shart (bitta fayl, shuning uchun mos).

---

## Cron / Worker

- **Oylik billing cron**: api ichida `@nestjs/schedule` (`billing.scheduler.ts`, `0 0 1 * *` UTC). Faqat **1 instance** ishlatiladi (VPS = 1 instance ✓).
- **Worker** (Telegram/WhatsApp reminders): hozir **o'chiq** (`compose.yaml` da izohda). Kerak bo'lsa `worker` service'ini oching.
