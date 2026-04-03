-- Add 'Realized' to RiskStatus after the type exists (see 20260330000000_day11_risk_workflow_model).
-- Original attempt was in 20260327140000, which runs before RiskStatus is created.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskStatus') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'RiskStatus' AND e.enumlabel = 'Realized'
    ) THEN
      ALTER TYPE "RiskStatus" ADD VALUE 'Realized';
    END IF;
  END IF;
END $$;
