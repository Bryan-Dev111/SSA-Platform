-- Staff roster fields for Global Supply → Internal Management → Employee Assignments

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employmentResponsibilities" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employmentNotes" TEXT;
