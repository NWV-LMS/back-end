# Backend Audit Report

> Bilim Nuru CRM + LMS — Production readiness audit  
> Sana: 2026-05-15

## Prisma Schema Audit — ✅ BAJARILDI (commit `c75dfb5`)

Migration: `20260514184116_prisma_audit_fixes`

| # | O'zgarish | Status |
|---|---|---|
| 1 | `generator client_custom` o'chirildi | ✅ |
| 2 | `Lesson.organization_id` qo'shildi (nullable) | ✅ |
| 3 | `InvoiceItem.organization_id` qo'shildi (nullable) | ✅ |
| 4 | `onDelete` cascade/restrict 15+ relationga qo'shildi | ✅ |
| 5 | `Archive` model qayta tuzildi (org_id, user_id, entity, action enum) | ✅ |
| 6 | `Note.updated_at` qo'shildi | ✅ |
| 7 | `Note.user_id` nullable + `SetNull` | ✅ |
| 8 | `Decimal @db.Decimal(12,2)` barcha money fieldlarga | ✅ |
| 9 | `Exam`, `Test`, `Lesson` indexlari | ✅ |
| 10 | `Student.deleted_at`, `TeacherProfile.deleted_at` indexi | ✅ |

### Qoldi (breaking change risk)
- `Course.price String → Decimal` — eski stringlar tekshirilishi kerak

---

## NestJS Pattern Audit — ⏳ KEYINGA QOLDIRILDI

### 🔴 Kritik (production'ga chiqishdan oldin hal qilish)

1. **`any` tipi 44 joyda (19 faylda)** — User rule'ga zid
   - `src/libs/types/common.ts` `T` interface = yashirin any
   - `current-user.decorator.ts` returns any
   - Service'larda `where: any`
   - `lesson.service.ts:151` `as any`

2. **Refresh token single-device** — bitta foydalanuvchi parallel device'larda login bo'lolmaydi
   - Fix: `RefreshToken` modeli, har bir device uchun alohida token

3. **`JwtPayload.sub` va `.id` dublikat** — faqat `sub` qoldirish

4. **Login endpoint noto'g'ri joyda** — `POST /user/login` → `POST /auth/login` ga ko'chirish (BREAKING)

5. **`organization_id!` non-null assertion** controllerlarda 20+ joy
   - `OrganizationIdGuard` `request.organizationId` o'rnatadi, lekin ishlatilmaydi
   - Custom `@OrgId()` decorator yaratish va `!` ni olib tashlash

6. **N+1 risk**: Lesson va InvoiceItem hali ham `where: { course: { organization_id }}` JOIN orqali
   - Yangi qo'shilgan `organization_id` field'ni ishlatish kerak

### 🟡 Muhim

7. **Parol `MinLength(6)`** zaif — 8+ kompleksiya
8. **`worker.ts`** alohida Prisma client yaratadi (DI emas)
9. **`console.log` + `Logger` aralash** `main.ts`'da
10. **Swagger** setup bor, lekin endpointlarda `@ApiOperation` yo'q
11. **`LoggingInterceptor`** error'larni log qilmaydi (`catchError` yo'q)
12. **Bcrypt timing attack** — `user not found` darrov qaytariladi

### 🟢 Kichik

13. POST endpointlarda `@HttpCode(200)` yo'q (default 201)
14. `forwardRef` Organization↔User module — circular dep
15. Express body limit explicit emas
16. `request: any` rate-limit guard'da
17. Mapper funksiyalarda Prisma type'lar ishlatilmagan
18. `as T` Prisma `UncheckedUpdateInput` bilan almashtirish
19. `forbidNonWhitelisted: true` global pipe'ga qo'shish

---

## Reja keyingi sessiya uchun

1. Hozir: **Deploy production'ga** (MVP qo'shtoq)
2. Keyin: NestJS kritik fixes (1-6)
3. Oxirida: Muhim fixes (7-12) + Swagger docs
