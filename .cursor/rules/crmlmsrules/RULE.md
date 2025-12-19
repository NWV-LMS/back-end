# Project Rules – CRM + LMS (Education Center, SaaS-ready)

## 1. Project Context

* This project is a **CRM + LMS system for an education center**
* Currently **single organization**, but must be **SaaS-ready**
* Backend: **NestJS**
* Database: **PostgreSQL**
* ORM: **Prisma**
* API: **REST or GraphQL**
* Frontend: **Dashboard-based (admin, teacher, student)**

---

## 2. Multi-Tenancy Rules

* Use **soft multi-tenancy**
* Every core table MUST include:

  * `organization_id`
* All queries MUST be scoped by:

  ```
  WHERE organization_id = currentOrganizationId
  ```
* Never return data from another organization

---

## 3. Core Business Flow (IMPORTANT)

1. Person enters system as **Lead**
2. Lead status flow:

   * new → contacted → interested → converted / lost
3. When Lead is **converted**:

   * Create `users` record
   * Create `students` record
   * Link student to organization
4. Student is enrolled into a **Group**
5. Payments, attendance, and progress are tracked

---

## 4. Roles & Access Control

Roles:

* super_admin (platform level)
* admin (organization owner)
* teacher
* student

Rules:

* Admin can manage everything inside own organization
* Teacher can access only assigned groups
* Student can access only own data
* RBAC must always check `organization_id`

---

## 5. Database Rules

* Use **UUID** as primary keys
* Every table must include:

  * `id`
  * `organization_id`
  * `created_at`
  * `updated_at`
* Use **foreign keys** explicitly
* Prefer **soft delete** (`deleted_at`) where applicable

---

## 6. Dashboard & Reporting Rules

Dashboards must support:

* Week / Month / Year filters
* Aggregated queries (`COUNT`, `SUM`)
* Fast response time (< 1s for dashboards)

Key metrics:

* Total students
* New leads
* Conversion rate
* Income
* Expenses
* Profit

---

## 7. Finance Rules

* Income comes only from `payments`
* Expenses stored separately in `expenses`
* Profit = income − expenses
* All finance queries must be time-based

---

## 8. Code Style & Structure

* Use **clear naming** (no abbreviations)
* One service = one responsibility
* No business logic in controllers
* Validation required for all inputs
* Use transactions for:

  * lead → student conversion
  * enrollment + payment creation

---

## 9. API Design Rules

* No endpoint should return unscoped data
* Pagination required for list endpoints
* Dashboard endpoints return **aggregated data only**
* Never expose internal IDs unnecessarily

---

## 10. Future SaaS Considerations

* System must allow:

  * Multiple organizations
  * Custom branding per organization
  * Subscription plans (future)
* Avoid hardcoding organization logic

---

## 11. What NOT to do

* Do NOT skip `organization_id`
* Do NOT mix Lead and Student concepts
* Do NOT write raw SQL unless required
* Do NOT assume single organization in logic

---

## Goal for Cursor AI

* Generate **safe, scalable, SaaS-ready code**
* Always respect organization boundaries
* Prefer clarity over cleverness

---
alwaysApply: true
---
