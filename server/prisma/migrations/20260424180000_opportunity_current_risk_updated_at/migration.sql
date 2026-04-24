-- Track when register "current" risk level / risk row last changed (chart + Updated column).
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "currentRiskUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
