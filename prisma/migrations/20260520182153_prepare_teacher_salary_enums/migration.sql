-- Commit new SalaryType values in a separate migration before they are used
-- as column defaults by 20260520182154_add_group_time_fields.
ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'HOURLY';
ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'FIXED';
ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'GROUP_PERCENT';

-- TeacherSalary uses this enum in the following migration.
DO $$ BEGIN
    CREATE TYPE "SalaryStatus" AS ENUM ('PENDING', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
