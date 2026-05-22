-- Add discount_amount to Enrollment (absolute som per month).
ALTER TABLE "Enrollment"
  ADD COLUMN "discount_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0;
