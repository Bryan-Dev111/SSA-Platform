ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "inspector" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Shipment_code_key" ON "Shipment"("code");
