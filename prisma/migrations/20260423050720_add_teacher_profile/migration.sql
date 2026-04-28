-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_invoice_id_fkey";

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subjects" TEXT[],
    "hourly_rate" DECIMAL(12,2),
    "qualifications" TEXT,
    "bio" TEXT,
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_user_id_key" ON "TeacherProfile"("user_id");

-- CreateIndex
CREATE INDEX "TeacherProfile_status_idx" ON "TeacherProfile"("status");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
