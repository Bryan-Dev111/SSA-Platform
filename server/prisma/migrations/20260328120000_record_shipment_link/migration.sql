-- Link internal records to shipment inspection requests (same pattern as auditId)

ALTER TABLE "Record" ADD COLUMN IF NOT EXISTS "shipmentId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Record_shipmentId_fkey'
  ) THEN
    ALTER TABLE "Record"
      ADD CONSTRAINT "Record_shipmentId_fkey"
      FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Record_shipmentId_idx" ON "Record"("shipmentId");
