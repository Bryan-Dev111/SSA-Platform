-- Make CAR finding link optional for "None / N/A" flow.
ALTER TABLE "CorrectiveAction"
  ALTER COLUMN "findingId" DROP NOT NULL;

-- Replace FK to allow NULL and preserve CAR rows if finding is removed.
ALTER TABLE "CorrectiveAction"
  DROP CONSTRAINT IF EXISTS "CorrectiveAction_findingId_fkey";

ALTER TABLE "CorrectiveAction"
  ADD CONSTRAINT "CorrectiveAction_findingId_fkey"
  FOREIGN KEY ("findingId") REFERENCES "Finding"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
