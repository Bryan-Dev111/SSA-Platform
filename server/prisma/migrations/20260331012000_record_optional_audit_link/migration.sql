-- Link records to audits (optional)
ALTER TABLE "Record" ADD COLUMN "auditId" TEXT;

ALTER TABLE "Record"
ADD CONSTRAINT "Record_auditId_fkey"
FOREIGN KEY ("auditId") REFERENCES "Audit"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Record_auditId_idx" ON "Record"("auditId");
