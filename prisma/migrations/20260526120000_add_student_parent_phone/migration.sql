-- Add nullable parent_phone to Student (supports siblings sharing a parent contact).
ALTER TABLE "Student" ADD COLUMN "parent_phone" TEXT;
