/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Organization_email_key";

-- DropIndex
DROP INDEX "Organization_phone_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_organization_id_email_key" ON "User"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_organization_id_phone_key" ON "User"("organization_id", "phone");
