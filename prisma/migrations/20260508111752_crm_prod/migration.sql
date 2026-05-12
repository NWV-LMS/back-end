-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "StudentLevel" AS ENUM ('BEGINNER', 'ELEMENTARY', 'PRE_INTERMEDIATE', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED', 'PROFICIENT');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emergency_phone" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "internal_notes" TEXT,
ADD COLUMN     "level" "StudentLevel",
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "school_or_work" TEXT,
ADD COLUMN     "telegram_handle" TEXT;
