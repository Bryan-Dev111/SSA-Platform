-- Make Finding.audit optional for "None / N/A" workflow.
ALTER TABLE "Finding"
  ALTER COLUMN "auditId" DROP NOT NULL;

ALTER TABLE "Finding"
  DROP CONSTRAINT IF EXISTS "Finding_auditId_fkey";

ALTER TABLE "Finding"
  ADD CONSTRAINT "Finding_auditId_fkey"
  FOREIGN KEY ("auditId") REFERENCES "Audit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
