# Production Deployment Guide — Bilim Nuru CRM+LMS

## Talablar

- Ubuntu 22.04 server (minimum 2 CPU, 2GB RAM)
- Docker + Docker Compose v2
- Domain yoki IP manzil

---

## 1. Server tayyorlash (bir marta)

```bash
# Docker o'rnatish
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Loyiha papkasini yaratish
mkdir -p /opt/crm-lms && cd /opt/crm-lms
```

---

## 2. Deploy fayllarini serverga ko'chirish

```bash
# Local mashinadan server ga:
scp compose.yaml user@SERVER_IP:/opt/crm-lms/
scp -r docker/ user@SERVER_IP:/opt/crm-lms/

# Yoki git clone (agar server internet'ga ulangan bo'lsa):
git clone https://github.com/NWV-LMS/back-end.git .
```

---

## 3. Environment sozlash

```bash
cd /opt/crm-lms

# Template'dan nusxa oling
cp .env.production.local.example .env.production.local

# Qiymatlarni to'ldiring
nano .env.production.local
```

**To'ldirish kerak bo'lgan qiymatlar:**

| Variable | Qanday olish |
|---|---|
| `POSTGRES_PASSWORD` | Kuchli parol o'ylab yozing |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 64` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `ALLOWED_ORIGINS` | Frontend URL (masalan: `http://SERVER_IP`) |

---

## 4. Birinchi deploy (seed bilan)

```bash
cd /opt/crm-lms

# FAQAT birinchi marta — super admin seed uchun
RUN_SEED=true docker compose up -d

# Loglarni kuzating
docker compose logs -f api
```

Muvaffaqiyatli bo'lgandan so'ng:
```bash
# Seed'ni o'chirib qo'ying
# .env.production.local da: RUN_SEED=false
docker compose up -d api
```

---

## 5. Keyingi deploylar (yangilanishlar)

```bash
cd /opt/crm-lms

# Yangi image yuklash
docker pull abduvalileo/crm-lms-api:latest

# Qayta ishga tushirish (migration avtomatik ishga tushadi)
docker compose up -d --no-deps api

# Status tekshirish
docker compose ps
```

---

## 6. Healthcheck tekshirish

```bash
curl http://SERVER_IP/api/health
# {"status":"ok","db":"up",...}
```

---

## 7. Loglarni ko'rish

```bash
# API loglari
docker compose logs -f api

# Nginx loglari
docker compose logs -f nginx

# DB loglari
docker compose logs -f db
```

---

## 8. Backup (haftalik)

```bash
# DB backup skripti
docker exec crm-lms-db_prod pg_dump -U leo crm_prod > backup_$(date +%Y%m%d).sql

# Backup'ni xavfsiz joyga saqlang (S3, external disk va h.k.)
```

---

## 9. SSL qo'shish (keyinroq)

Domain bor bo'lsa Certbot + Nginx bilan:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Keyin `docker/nginx/conf.d/default.conf` ni HTTPS uchun yangilang.

---

## Muhim URL'lar

| Maqsad | URL |
|---|---|
| Health check | `GET /api/health` |
| Login | `POST /api/auth/login` |
| Refresh token | `POST /api/auth/refresh` |
| Swagger docs (faqat dev) | `GET /api-docs` |

---

## Muammolar

**Container ishga tushmasa:**
```bash
docker compose logs api
docker compose down && docker compose up -d
```

**Migration xatosi:**
```bash
docker exec crm-lms-api_prod npx prisma migrate status
```

**DB ulanmasa:**
```bash
docker compose exec db psql -U leo -d crm_prod -c "SELECT 1"
```
