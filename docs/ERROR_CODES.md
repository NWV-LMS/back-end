# API Error Codes Documentation

Этот файл содержит все ошибки и HTTP коды, возвращаемые API.

## HTTP Status Codes Summary

| Code  | Name                  | Description                                       |
| ----- | --------------------- | ------------------------------------------------- |
| `400` | Bad Request           | Неверный запрос, ошибка валидации                 |
| `401` | Unauthorized          | Требуется аутентификация или токен недействителен |
| `403` | Forbidden             | Доступ запрещён                                   |
| `404` | Not Found             | Ресурс не найден                                  |
| `409` | Conflict              | Нарушение уникального ограничения (дубликат)      |
| `500` | Internal Server Error | Ошибка сервера                                    |

---

## 1. Auth Module (`/user`, `/auth`)

### Login (`POST /user/login`)

| HTTP Code | Message                    | Description                 |
| --------- | -------------------------- | --------------------------- |
| `401`     | `Invalid credentials`      | Неверный телефон или пароль |
| `403`     | `Organization is inactive` | Организация неактивна       |

### Get Me (`GET /user/me`)

| HTTP Code | Message        | Description                        |
| --------- | -------------- | ---------------------------------- |
| `401`     | `Unauthorized` | Токен недействителен или просрочен |

### Update User (`POST /user/update`)

| HTTP Code | Message                                                                     | Description                           |
| --------- | --------------------------------------------------------------------------- | ------------------------------------- |
| `400`     | `new_password and confirm_new_password are required when changing password` | Оба поля обязательны для смены пароля |
| `400`     | `Current password is incorrect`                                             | Текущий пароль неверен                |
| `400`     | `Passwords do not match`                                                    | Новые пароли не совпадают             |
| `401`     | `Unauthorized`                                                              | Пользователь не найден                |

### Refresh Token (`POST /auth/refresh`)

| HTTP Code | Message        | Description                  |
| --------- | -------------- | ---------------------------- |
| `401`     | `Unauthorized` | Refresh token недействителен |

---

## 2. Organization Module (`/platform`, `/organizations`)

### Register Organization (`POST /platform/register`)

| HTTP Code | Message                       | Description                               |
| --------- | ----------------------------- | ----------------------------------------- |
| `400`     | `Organization already exists` | Организация с таким именем уже существует |
| `400`     | `Admin email already exists`  | Email администратора уже используется     |
| `500`     | `Create failed`               | Системная ошибка                          |

### Update Organization (`PATCH /platform/:id`)

| HTTP Code | Message                  | Description            |
| --------- | ------------------------ | ---------------------- |
| `400`     | `Organization not found` | Организация не найдена |

### Invite User (`POST /organizations/users`)

| HTTP Code | Message                                                    | Description                             |
| --------- | ---------------------------------------------------------- | --------------------------------------- |
| `400`     | `User with this phone already exists`                      | Этот номер телефона занят               |
| `400`     | `User with this email already exists in your organization` | Этот email уже существует в организации |
| `403`     | `Cannot create SUPER_ADMIN from organization scope`        | Создание SUPER_ADMIN запрещено          |

---

## 3. Student Module (`/student`)

### Create Student (`POST /student`)

| HTTP Code | Message                                                       | Description               |
| --------- | ------------------------------------------------------------- | ------------------------- |
| `400`     | `Student with this phone already exists in this organization` | Этот номер телефона занят |

### Get/Update/Delete Student (`GET/PATCH/DELETE /student/:id`)

| HTTP Code | Message             | Description       |
| --------- | ------------------- | ----------------- |
| `404`     | `Student not found` | Студент не найден |

### Enroll Student (`POST /student/:id/enroll`)

| HTTP Code | Message                                     | Description         |
| --------- | ------------------------------------------- | ------------------- |
| `404`     | `Group not found in this organization`      | Группа не найдена   |
| `400`     | `Student is already enrolled in this group` | Студент уже записан |

---

## 4. Lead Module (`/lead`)

### Create Lead (`POST /lead`)

| HTTP Code | Message                               | Description                        |
| --------- | ------------------------------------- | ---------------------------------- |
| `400`     | `User with this phone already exists` | Этот номер уже есть у пользователя |
| `400`     | `Lead with this phone already exists` | Этот номер уже есть у лида         |

### Get/Update/Delete Lead (`GET/PATCH/DELETE /lead/:id`)

| HTTP Code | Message          | Description   |
| --------- | ---------------- | ------------- |
| `404`     | `Lead not found` | Лид не найден |

### Convert Lead (`POST /lead/:id/convert`)

| HTTP Code | Message                                  | Description                        |
| --------- | ---------------------------------------- | ---------------------------------- |
| `400`     | `Lead is already converted`              | Лид уже конвертирован              |
| `400`     | `Student already exists with this phone` | Студент с таким номером существует |

---

## 5. Course Module (`/courses`)

### Get/Update/Delete Course (`GET/PATCH/DELETE /courses/:id`)

| HTTP Code | Message            | Description    |
| --------- | ------------------ | -------------- |
| `404`     | `Course not found` | Курс не найден |

### Delete Course

| HTTP Code | Message                                   | Description                |
| --------- | ----------------------------------------- | -------------------------- |
| `400`     | `Course has active groups, cannot delete` | Курс имеет активные группы |

---

## 6. Group Module (`/groups`)

### Create Group (`POST /groups`)

| HTTP Code | Message                        | Description             |
| --------- | ------------------------------ | ----------------------- |
| `404`     | `Course not found or invalid`  | Курс не найден          |
| `404`     | `Teacher not found or invalid` | Преподаватель не найден |

### Get/Update/Delete Group (`GET/PATCH/DELETE /groups/:id`)

| HTTP Code | Message             | Description                            |
| --------- | ------------------- | -------------------------------------- |
| `404`     | `Group not found`   | Группа не найдена                      |
| `404`     | `Course not found`  | Курс не найден при обновлении          |
| `404`     | `Teacher not found` | Преподаватель не найден при обновлении |

### Set Schedule (`PUT /groups/:id/schedule`)

| HTTP Code | Message                              | Description                    |
| --------- | ------------------------------------ | ------------------------------ |
| `400`     | `Duplicate schedule entry for day X` | Дублирующее расписание на день |

---

## 7. Enrollment Module (`/enrollment`)

### Create Enrollment (`POST /enrollment`)

| HTTP Code | Message                                          | Description         |
| --------- | ------------------------------------------------ | ------------------- |
| `404`     | `Student not found`                              | Студент не найден   |
| `404`     | `Group not found`                                | Группа не найдена   |
| `400`     | `This student is already enrolled in this group` | Студент уже записан |

### Get/Update/Delete Enrollment (`GET/PATCH/DELETE /enrollment/:id`)

| HTTP Code | Message                | Description       |
| --------- | ---------------------- | ----------------- |
| `404`     | `Enrollment not found` | Запись не найдена |

---

## 8. Lesson Module (`/lessons`)

### Create Lesson (`POST /lessons`)

| HTTP Code | Message            | Description    |
| --------- | ------------------ | -------------- |
| `404`     | `Course not found` | Курс не найден |

### Get/Update/Delete Lesson (`GET/PATCH/DELETE /lessons/:id`)

| HTTP Code | Message            | Description    |
| --------- | ------------------ | -------------- |
| `404`     | `Lesson not found` | Урок не найден |

### Reschedule (`PATCH /lessons/:id/reschedule`)

| HTTP Code | Message                          | Description |
| --------- | -------------------------------- | ----------- |
| `400`     | `start_date must be <= end_date` | Ошибка даты |

---

## 9. Attendance Module (`/attendance`)

### Mark Attendance (`POST /attendance`)

| HTTP Code | Message                | Description       |
| --------- | ---------------------- | ----------------- |
| `404`     | `Enrollment not found` | Запись не найдена |
| `404`     | `Lesson not found`     | Урок не найден    |

---

## 10. Progress Module (`/progress`)

### Create Progress (`POST /progress`)

| HTTP Code | Message                | Description       |
| --------- | ---------------------- | ----------------- |
| `404`     | `Enrollment not found` | Запись не найдена |
| `404`     | `Lesson not found`     | Урок не найден    |

### Get/Update/Delete Progress (`GET/PATCH/DELETE /progress/:id`)

| HTTP Code | Message              | Description        |
| --------- | -------------------- | ------------------ |
| `404`     | `Progress not found` | Прогресс не найден |

---

## 11. Payment Module (`/payment`)

### Create Payment (`POST /payment`)

| HTTP Code | Message                                  | Description       |
| --------- | ---------------------------------------- | ----------------- |
| `400`     | `Student not found in this organization` | Студент не найден |

### Get/Update/Delete Payment (`GET/PATCH/DELETE /payment/:id`)

| HTTP Code | Message             | Description      |
| --------- | ------------------- | ---------------- |
| `404`     | `Payment not found` | Платёж не найден |

---

## 12. Expense Module (`/expense`)

### Get/Update/Delete Expense (`GET/PATCH/DELETE /expense/:id`)

| HTTP Code | Message             | Description      |
| --------- | ------------------- | ---------------- |
| `404`     | `Expense not found` | Расход не найден |

---

## 13. Billing Module (`/billing`)

### Generate Invoices (`POST /billing/invoices/generate`)

| HTTP Code | Message                           | Description            |
| --------- | --------------------------------- | ---------------------- |
| `400`     | `month must be in YYYY-MM format` | Неверный формат месяца |
| `400`     | `Invalid month`                   | Недействительный месяц |

### Get Invoice (`GET /billing/invoices/:id`)

| HTTP Code | Message             | Description    |
| --------- | ------------------- | -------------- |
| `404`     | `Invoice not found` | Счёт не найден |

### Pay Invoice (`POST /billing/invoices/:id/pay`)

| HTTP Code | Message             | Description      |
| --------- | ------------------- | ---------------- |
| `404`     | `Invoice not found` | Счёт не найден   |
| `400`     | `Invoice is void`   | Счёт аннулирован |

---

## 14. Notification Module (`/notifications`)

### Get/Update Settings (`GET/PATCH /notifications/settings`)

| HTTP Code | Message                                                           | Description              |
| --------- | ----------------------------------------------------------------- | ------------------------ |
| `400`     | `Organization not found`                                          | Организация не найдена   |
| `400`     | `telegram_bot_token is required when telegram_enabled=true`       | Требуется токен бота     |
| `400`     | `telegram_chat_id is required when telegram_enabled=true`         | Требуется Chat ID        |
| `400`     | `whatsapp_cloud_token is required when whatsapp_enabled=true`     | Требуется токен WhatsApp |
| `400`     | `whatsapp_phone_number_id is required when whatsapp_enabled=true` | Требуется Phone ID       |

---

## 15. Guards & Global Errors

### OrganizationIdGuard

| HTTP Code | Message                               | Description                          |
| --------- | ------------------------------------- | ------------------------------------ |
| `401`     | `Organization ID is missing in token` | В токене отсутствует organization_id |

### OrganizationActiveGuard

| HTTP Code | Message                      | Description           |
| --------- | ---------------------------- | --------------------- |
| `403`     | `Organization is not active` | Организация неактивна |

### RolesGuard

| HTTP Code | Message              | Description              |
| --------- | -------------------- | ------------------------ |
| `403`     | `Forbidden resource` | Доступ запрещён для роли |

### Prisma Exception Filter

| HTTP Code | Message                       | Description                       |
| --------- | ----------------------------- | --------------------------------- |
| `409`     | `Unique constraint violation` | Нарушение уникального ограничения |
| `404`     | `Record not found`            | Запись не найдена                 |
| `400`     | `Database request error`      | Ошибка запроса к БД               |
| `400`     | `Database validation error`   | Ошибка валидации                  |
| `500`     | `Database error`              | Ошибка базы данных                |

---

## Frontend Error Handling Example (TypeScript)

```typescript
interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

function handleApiError(error: ApiError): string {
  const { statusCode, message } = error;

  switch (statusCode) {
    case 400:
      return `Ошибка валидации: ${Array.isArray(message) ? message.join(', ') : message}`;
    case 401:
      return 'Пожалуйста, войдите в систему заново';
    case 403:
      return 'У вас нет прав для выполнения этого действия';
    case 404:
      return 'Данные не найдены';
    case 409:
      return 'Такие данные уже существуют';
    case 500:
      return 'Произошла ошибка сервера';
    default:
      return 'Неизвестная ошибка';
  }
}
```

---

## Validation Errors (DTO)

При ошибках валидации DTO ответ будет таким:

```json
{
  "statusCode": 400,
  "message": [
    "phone must be in format +996XXXXXXXXX",
    "email must be an email"
  ],
  "error": "Bad Request"
}
```

**Примечание:** `message` может быть массивом!

---

## Enums (Для Frontend)

### UserRole

```typescript
enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}
```

### StudentStatus

```typescript
enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
```

### LeadStatus

```typescript
enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}
```

### PaymentMethod

```typescript
enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
}
```

### PaymentStatus

```typescript
enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}
```

### ExpenseCategory

```typescript
enum ExpenseCategory {
  SALARY = 'SALARY',
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  SUPPLIES = 'SUPPLIES',
  MARKETING = 'MARKETING',
  OTHER = 'OTHER',
}
```

### InvoiceStatus

```typescript
enum InvoiceStatus {
  OPEN = 'OPEN',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
}
```

### AttendanceStatus

```typescript
enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
}
```

### CourseStatus

```typescript
enum CourseStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
```

### OrganizationStatus

```typescript
enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
```
