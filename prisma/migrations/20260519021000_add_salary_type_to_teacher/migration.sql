-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('MONTHLY', 'DAILY');

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN "salary_type" "SalaryType" NOT NULL DEFAULT 'MONTHLY';
