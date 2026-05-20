-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'HOURLY';
ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'FIXED';
ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'GROUP_PERCENT';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "end_time" TEXT,
ADD COLUMN     "start_time" TEXT;

-- AlterTable
ALTER TABLE "Subject" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "fixed_salary" DECIMAL(12,2),
ADD COLUMN     "percent_rate" DECIMAL(5,2);

-- Set DEFAULT after enum values are committed
ALTER TABLE "TeacherProfile" ALTER COLUMN "salary_type" SET DEFAULT 'FIXED';

-- CreateTable
CREATE TABLE "TeacherSalary" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "salary_type" "SalaryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "status" "SalaryStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "expense_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSalary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSalary_expense_id_key" ON "TeacherSalary"("expense_id");

-- CreateIndex
CREATE INDEX "TeacherSalary_organization_id_idx" ON "TeacherSalary"("organization_id");

-- CreateIndex
CREATE INDEX "TeacherSalary_teacher_id_idx" ON "TeacherSalary"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSalary_teacher_id_period_key" ON "TeacherSalary"("teacher_id", "period");

-- AddForeignKey
ALTER TABLE "TeacherSalary" ADD CONSTRAINT "TeacherSalary_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSalary" ADD CONSTRAINT "TeacherSalary_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "TeacherProfile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSalary" ADD CONSTRAINT "TeacherSalary_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
