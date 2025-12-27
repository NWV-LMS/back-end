/*
  Warnings:

  - The values [LATE] on the enum `AttendanceStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `status` on the `Course` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `phone` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
BEGIN;
CREATE TYPE "AttendanceStatus_new" AS ENUM ('PRESENT', 'ABSENT');
ALTER TABLE "Attendance" ALTER COLUMN "status" TYPE "AttendanceStatus_new" USING ("status"::text::"AttendanceStatus_new");
ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";
ALTER TYPE "AttendanceStatus_new" RENAME TO "AttendanceStatus";
DROP TYPE "public"."AttendanceStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "status",
ADD COLUMN     "status" "CourseStatus" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "refresh_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
