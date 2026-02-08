/*
  Warnings:

  - A unique constraint covering the columns `[enrollment_id,lesson_id]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[student_id,group_id]` on the table `Enrollment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,phone]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,phone]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `method` on the `Payment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SALARY', 'RENT', 'UTILITIES', 'SUPPLIES', 'MARKETING', 'OTHER');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
DROP COLUMN "method",
ADD COLUMN     "method" "PaymentMethod" NOT NULL;

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_organization_id_idx" ON "Expense"("organization_id");

-- CreateIndex
CREATE INDEX "Expense_organization_id_category_idx" ON "Expense"("organization_id", "category");

-- CreateIndex
CREATE INDEX "Attendance_organization_id_idx" ON "Attendance"("organization_id");

-- CreateIndex
CREATE INDEX "Attendance_lesson_id_idx" ON "Attendance"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_enrollment_id_lesson_id_key" ON "Attendance"("enrollment_id", "lesson_id");

-- CreateIndex
CREATE INDEX "Course_organization_id_idx" ON "Course"("organization_id");

-- CreateIndex
CREATE INDEX "Course_organization_id_status_idx" ON "Course"("organization_id", "status");

-- CreateIndex
CREATE INDEX "Enrollment_organization_id_idx" ON "Enrollment"("organization_id");

-- CreateIndex
CREATE INDEX "Enrollment_student_id_idx" ON "Enrollment"("student_id");

-- CreateIndex
CREATE INDEX "Enrollment_group_id_idx" ON "Enrollment"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_student_id_group_id_key" ON "Enrollment"("student_id", "group_id");

-- CreateIndex
CREATE INDEX "Group_organization_id_idx" ON "Group"("organization_id");

-- CreateIndex
CREATE INDEX "Group_course_id_idx" ON "Group"("course_id");

-- CreateIndex
CREATE INDEX "Group_teacher_id_idx" ON "Group"("teacher_id");

-- CreateIndex
CREATE INDEX "Lead_organization_id_status_idx" ON "Lead"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organization_id_phone_key" ON "Lead"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Payment_organization_id_idx" ON "Payment"("organization_id");

-- CreateIndex
CREATE INDEX "Payment_organization_id_status_idx" ON "Payment"("organization_id", "status");

-- CreateIndex
CREATE INDEX "Payment_student_id_idx" ON "Payment"("student_id");

-- CreateIndex
CREATE INDEX "Progress_organization_id_idx" ON "Progress"("organization_id");

-- CreateIndex
CREATE INDEX "Progress_enrollment_id_idx" ON "Progress"("enrollment_id");

-- CreateIndex
CREATE INDEX "Progress_lesson_id_idx" ON "Progress"("lesson_id");

-- CreateIndex
CREATE INDEX "Student_organization_id_status_idx" ON "Student"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Student_organization_id_phone_key" ON "Student"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "User_organization_id_role_idx" ON "User"("organization_id", "role");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
