-- No-op: `RiskStatus` is created later in `20260330000000_day11_risk_workflow_model`.
-- Applying `ALTER TYPE "RiskStatus" ADD VALUE` here breaks shadow DB replay (type does not exist yet).
-- The `Realized` value is added in `20260330000001_risk_status_add_realized_enum_value`.
SELECT 1;
