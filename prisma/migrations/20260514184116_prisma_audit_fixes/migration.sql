/*
  Warnings:

  - You are about to drop the column `status` on the `Archive` table. All the data in the column will be lost.
  - You are about to alter the column `monthly_fee` on the `Enrollment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `Expense` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `amount_due` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `amount_paid` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `InvoiceItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - Added the required column `action` to the `Archive` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entity_type` to the `Archive` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ArchiveAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED', 'ROLE_CHANGED');

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_enrollment_id_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_group_id_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_student_id_fkey";

-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "GroupSchedule" DROP CONSTRAINT "GroupSchedule_group_id_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_group_id_fkey";

-- DropForeignKey
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_student_id_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_course_id_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Progress" DROP CONSTRAINT "Progress_enrollment_id_fkey";

-- DropForeignKey
ALTER TABLE "Progress" DROP CONSTRAINT "Progress_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "Test" DROP CONSTRAINT "Test_exams_id_fkey";

-- AlterTable
ALTER TABLE "Archive" DROP COLUMN "status",
ADD COLUMN     "action" "ArchiveAction" NOT NULL,
ADD COLUMN     "entity_id" UUID,
ADD COLUMN     "entity_type" TEXT NOT NULL,
ADD COLUMN     "organization_id" UUID,
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "Enrollment" ALTER COLUMN "monthly_fee" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "amount_due" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "amount_paid" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "organization_id" UUID,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "Archive_organization_id_idx" ON "Archive"("organization_id");

-- CreateIndex
CREATE INDEX "Archive_entity_type_entity_id_idx" ON "Archive"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "Exam_organization_id_idx" ON "Exam"("organization_id");

-- CreateIndex
CREATE INDEX "Exam_lesson_id_idx" ON "Exam"("lesson_id");

-- CreateIndex
CREATE INDEX "InvoiceItem_organization_id_idx" ON "InvoiceItem"("organization_id");

-- CreateIndex
CREATE INDEX "Lesson_organization_id_idx" ON "Lesson"("organization_id");

-- CreateIndex
CREATE INDEX "Lesson_course_id_idx" ON "Lesson"("course_id");

-- CreateIndex
CREATE INDEX "Note_organization_id_lead_id_idx" ON "Note"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "Student_organization_id_deleted_at_idx" ON "Student"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "TeacherProfile_deleted_at_idx" ON "TeacherProfile"("deleted_at");

-- CreateIndex
CREATE INDEX "Test_organization_id_idx" ON "Test"("organization_id");

-- CreateIndex
CREATE INDEX "Test_exams_id_idx" ON "Test"("exams_id");

-- AddForeignKey
ALTER TABLE "GroupSchedule" ADD CONSTRAINT "GroupSchedule_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_exams_id_fkey" FOREIGN KEY ("exams_id") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
