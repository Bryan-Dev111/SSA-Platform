-- Records: optional supplier + cloud-safe file fields in DB.
ALTER TABLE "Record"
  ALTER COLUMN "supplierId" DROP NOT NULL;

ALTER TABLE "Record"
  DROP CONSTRAINT IF EXISTS "Record_supplierId_fkey";

ALTER TABLE "Record"
  ADD CONSTRAINT "Record_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Record"
  ADD COLUMN IF NOT EXISTS "fileName" TEXT,
  ADD COLUMN IF NOT EXISTS "fileMime" TEXT,
  ADD COLUMN IF NOT EXISTS "fileData" BYTEA;
