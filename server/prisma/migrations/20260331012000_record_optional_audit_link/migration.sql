-- Link records to audits (optional)
ALTER TABLE "Record" ADD COLUMN IF NOT EXISTS "auditId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Record"
    ADD CONSTRAINT "Record_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Record_auditId_idx" ON "Record"("auditId");
