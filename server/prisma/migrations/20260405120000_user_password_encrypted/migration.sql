-- Encrypted copy of the original password so Admin can view it in the Users table.
-- Only used for Admin UI; stored encrypted at rest.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordEncrypted" TEXT;

