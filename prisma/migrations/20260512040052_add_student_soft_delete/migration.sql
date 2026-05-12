-- AlterEnum
ALTER TYPE "StudentStatus" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "deleted_at" TIMESTAMP(3);
