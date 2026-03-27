-- Add Realized to Opportunity / risk-register lifecycle (opportunities + risks)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'RiskStatus' AND e.enumlabel = 'Realized'
  ) THEN
    ALTER TYPE "RiskStatus" ADD VALUE 'Realized';
  END IF;
END $$;
