-- Global Vendors: add missing columns without data loss.
-- This migration is designed to be safe on an existing Supabase database.

-- 1) Samples: add buyerEmail (nullable)
ALTER TABLE "Sample"
  ADD COLUMN IF NOT EXISTS "buyerEmail" TEXT;

-- 2) Purchase Orders: add order/logistics fields (all nullable)
ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "orderDate" DATE,
  ADD COLUMN IF NOT EXISTS "estimatedFarmerDeliveryDate" DATE,
  ADD COLUMN IF NOT EXISTS "estimatedArrivalAtBuyer" DATE,
  ADD COLUMN IF NOT EXISTS "destinationCountry" TEXT,
  ADD COLUMN IF NOT EXISTS "portOfDischarge" TEXT;

-- 3) Expenses: add EXP code column safely and backfill existing rows.
-- We cannot add it as NOT NULL immediately because existing rows would fail.
ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "code" TEXT;

-- Backfill code for any existing expense rows that don't have one.
-- Uses sequential EXP-00001 ordering by createdAt/id.
WITH ranked AS (
  SELECT
    e.id,
    ROW_NUMBER() OVER (ORDER BY e."createdAt" ASC, e.id ASC) AS rn
  FROM "Expense" e
  WHERE e.code IS NULL OR btrim(e.code) = ''
),
max_existing AS (
  SELECT COALESCE(MAX((substring(code from 'EXP-([0-9]+)'))::int), 0) AS mx
  FROM "Expense"
  WHERE code ~ '^EXP-[0-9]+$'
)
UPDATE "Expense" e
SET code = 'EXP-' || lpad(((SELECT mx FROM max_existing) + r.rn)::text, 5, '0')
FROM ranked r
WHERE e.id = r.id;

-- Ensure the IdSequence prefix EXP exists and is at least the max code value.
INSERT INTO "IdSequence" (prefix, "lastValue")
VALUES ('EXP', 0)
ON CONFLICT (prefix) DO NOTHING;

UPDATE "IdSequence"
SET "lastValue" = GREATEST(
  "IdSequence"."lastValue",
  COALESCE(
    (SELECT MAX((substring(code from 'EXP-([0-9]+)'))::int) FROM "Expense" WHERE code ~ '^EXP-[0-9]+$'),
    0
  )
)
WHERE prefix = 'EXP';

-- Enforce NOT NULL + unique once populated.
ALTER TABLE "Expense"
  ALTER COLUMN "code" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Expense_code_key'
  ) THEN
    CREATE UNIQUE INDEX "Expense_code_key" ON "Expense"("code");
  END IF;
END
$$;

