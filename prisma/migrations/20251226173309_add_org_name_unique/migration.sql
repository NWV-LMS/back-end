/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `Organization` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_email_key" ON "Organization"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_phone_key" ON "Organization"("phone");
