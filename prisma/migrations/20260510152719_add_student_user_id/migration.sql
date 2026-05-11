/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "user_id" UUID,
ALTER COLUMN "address" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Student_user_id_key" ON "Student"("user_id");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
