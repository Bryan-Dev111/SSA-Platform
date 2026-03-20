-- Finalize Finding "New" status after enum value exists in a committed migration.
ALTER TABLE "Finding"
  ALTER COLUMN "status" SET DEFAULT 'New';

-- Normalize legacy DRAFT rows into New.
UPDATE "Finding"
SET "status" = 'New'
WHERE "status" = 'DRAFT';
