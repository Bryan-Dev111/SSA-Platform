-- Sentinel Supplier Assurance expense types (separate catalog from GlobalSupplyExpenseType).
CREATE TABLE "SupplierAssuranceExpenseType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierAssuranceExpenseType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierAssuranceExpenseType_name_key" ON "SupplierAssuranceExpenseType"("name");

INSERT INTO "SupplierAssuranceExpenseType" ("id", "name", "createdAt", "updatedAt")
VALUES
  ('ssa-expense-type-freight', 'Freight', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ssa-expense-type-payroll', 'Payroll', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ssa-expense-type-labor', 'Labor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ssa-expense-type-samples', 'Samples', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ssa-expense-type-travel', 'Travel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ssa-expense-type-other', 'Other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ssa-expense-type-training', 'Training', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ssa-expense-type-equipment', 'Equipment', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ssa-expense-type-audit-support', 'Audit support', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ssa-expense-type-professional', 'Professional services', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
