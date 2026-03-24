ALTER TABLE "Opportunity"
ADD COLUMN IF NOT EXISTS "code" TEXT;

WITH numbered AS (
  SELECT
    id,
    type,
    ROW_NUMBER() OVER (PARTITION BY type ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Opportunity"
)
UPDATE "Opportunity" o
SET "code" = CASE
  WHEN n.type = 'risk' THEN 'RISK-' || LPAD(n.rn::text, 4, '0')
  ELSE 'OPP-' || LPAD(n.rn::text, 4, '0')
END
FROM numbered n
WHERE o.id = n.id
  AND o."code" IS NULL;

ALTER TABLE "Opportunity"
ALTER COLUMN "code" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Opportunity_code_key'
  ) THEN
    CREATE UNIQUE INDEX "Opportunity_code_key" ON "Opportunity"("code");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskActionStatus') THEN
    CREATE TYPE "RiskActionStatus" AS ENUM ('Open', 'InProgress', 'Mitigated');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "RiskAction" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "supplierId" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "owner" TEXT,
  "dueDate" DATE,
  "status" "RiskActionStatus" NOT NULL DEFAULT 'Open',
  "residualLikelihood" "RiskLikelihood",
  "residualSeverity" "RiskSeverity",
  "residualRiskLevel" "RiskLevel",
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RiskAction_supplierId_fkey') THEN
    ALTER TABLE "RiskAction"
    ADD CONSTRAINT "RiskAction_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RiskAction_riskId_fkey') THEN
    ALTER TABLE "RiskAction"
    ADD CONSTRAINT "RiskAction_riskId_fkey"
    FOREIGN KEY ("riskId") REFERENCES "Opportunity"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RiskAction_createdById_fkey') THEN
    ALTER TABLE "RiskAction"
    ADD CONSTRAINT "RiskAction_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
