/*
  This migration adds the missing tables/columns introduced in the Prisma schema:
  - Per-organization notification settings (WhatsApp/Telegram)
  - Group schedules
  - Invoices + invoice items (monthly billing, partial payments)
  - Notification outbox jobs (DB-backed queue)
*/

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM', 'WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN     "telegram_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegram_bot_token" TEXT,
ADD COLUMN     "telegram_chat_id" TEXT,
ADD COLUMN     "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_cloud_token" TEXT,
ADD COLUMN     "whatsapp_phone_number_id" TEXT,
ADD COLUMN     "whatsapp_api_version" TEXT DEFAULT 'v18.0',
ADD COLUMN     "whatsapp_cloud_base_url" TEXT DEFAULT 'https://graph.facebook.com',
ADD COLUMN     "whatsapp_target" TEXT;

-- AlterTable
ALTER TABLE "Enrollment"
ADD COLUMN     "monthly_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "billing_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GroupSchedule" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 120,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "amount_due" DECIMAL(65,30) NOT NULL,
    "amount_paid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN     "invoice_id" UUID,
ADD COLUMN     "receipt_number" TEXT,
ADD COLUMN     "cashier_user_id" UUID;

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupSchedule_group_id_day_of_week_start_minute_key" ON "GroupSchedule"("group_id", "day_of_week", "start_minute");

-- CreateIndex
CREATE INDEX "GroupSchedule_organization_id_day_of_week_idx" ON "GroupSchedule"("organization_id", "day_of_week");

-- CreateIndex
CREATE INDEX "GroupSchedule_group_id_idx" ON "GroupSchedule"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organization_id_student_id_month_key" ON "Invoice"("organization_id", "student_id", "month");

-- CreateIndex
CREATE INDEX "Invoice_organization_id_idx" ON "Invoice"("organization_id");

-- CreateIndex
CREATE INDEX "Invoice_organization_id_status_idx" ON "Invoice"("organization_id", "status");

-- CreateIndex
CREATE INDEX "Invoice_student_id_idx" ON "Invoice"("student_id");

-- CreateIndex
CREATE INDEX "Invoice_month_idx" ON "Invoice"("month");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItem_invoice_id_enrollment_id_key" ON "InvoiceItem"("invoice_id", "enrollment_id");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoice_id_idx" ON "InvoiceItem"("invoice_id");

-- CreateIndex
CREATE INDEX "InvoiceItem_enrollment_id_idx" ON "InvoiceItem"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organization_id_receipt_number_key" ON "Payment"("organization_id", "receipt_number");

-- CreateIndex
CREATE INDEX "Payment_invoice_id_idx" ON "Payment"("invoice_id");

-- CreateIndex
CREATE INDEX "Payment_cashier_user_id_idx" ON "Payment"("cashier_user_id");

-- CreateIndex
CREATE INDEX "NotificationJob_organization_id_idx" ON "NotificationJob"("organization_id");

-- CreateIndex
CREATE INDEX "NotificationJob_status_next_run_at_idx" ON "NotificationJob"("status", "next_run_at");

-- AddForeignKey
ALTER TABLE "GroupSchedule" ADD CONSTRAINT "GroupSchedule_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSchedule" ADD CONSTRAINT "GroupSchedule_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashier_user_id_fkey" FOREIGN KEY ("cashier_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
