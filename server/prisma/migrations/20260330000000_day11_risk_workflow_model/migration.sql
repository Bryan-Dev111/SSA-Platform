-- Day 11 risk workflow model migration

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskItemType') THEN
    CREATE TYPE "RiskItemType" AS ENUM ('risk', 'opportunity');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskStatus') THEN
    CREATE TYPE "RiskStatus" AS ENUM ('Open', 'Mitigated', 'Closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskLikelihood') THEN
    CREATE TYPE "RiskLikelihood" AS ENUM ('VeryUnlikely', 'Unlikely', 'Possible', 'Likely', 'VeryLikely');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskSeverity') THEN
    CREATE TYPE "RiskSeverity" AS ENUM ('Negligible', 'Minor', 'Moderate', 'Significant', 'Severe');
  END IF;
END $$;

ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "likelihood" "RiskLikelihood",
  ADD COLUMN IF NOT EXISTS "severity" "RiskSeverity",
  ADD COLUMN IF NOT EXISTS "riskLevel" "RiskLevel",
  ADD COLUMN IF NOT EXISTS "status" "RiskStatus" NOT NULL DEFAULT 'Open';

ALTER TABLE "Opportunity" ALTER COLUMN "description" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='Opportunity' AND column_name='type' AND udt_name='text'
  ) THEN
    ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "type_new" "RiskItemType";

    UPDATE "Opportunity"
    SET "type_new" = CASE
      WHEN LOWER("type") = 'opportunity' THEN 'opportunity'::"RiskItemType"
      ELSE 'risk'::"RiskItemType"
    END;

    UPDATE "Opportunity"
    SET "status" = 'Mitigated'
    WHERE LOWER("type") = 'mitigated';

    ALTER TABLE "Opportunity" DROP COLUMN "type";
    ALTER TABLE "Opportunity" RENAME COLUMN "type_new" TO "type";
    ALTER TABLE "Opportunity" ALTER COLUMN "type" SET NOT NULL;
  END IF;
END $$;
