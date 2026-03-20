-- Add "New" status for findings.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'FindingStatus' AND e.enumlabel = 'New'
  ) THEN
    ALTER TYPE "FindingStatus" ADD VALUE 'New';
  END IF;
END $$;
