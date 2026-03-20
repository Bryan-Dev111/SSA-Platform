-- Add optional auditor free-text field to Audit.
ALTER TABLE "Audit"
  ADD COLUMN IF NOT EXISTS "auditor" TEXT;
