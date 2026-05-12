-- AlterEnum
ALTER TYPE "TeacherStatus" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "deleted_at" TIMESTAMP(3);
