-- Admin-managed Global Supply expense type list for Expenses dropdowns.
CREATE TABLE "GlobalSupplyExpenseType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSupplyExpenseType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GlobalSupplyExpenseType_name_key" ON "GlobalSupplyExpenseType"("name");

INSERT INTO "GlobalSupplyExpenseType" ("id", "name", "createdAt", "updatedAt")
VALUES
  ('seed-expense-type-freight', 'Freight', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-expense-type-payroll', 'Payroll', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-expense-type-labor', 'Labor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-expense-type-samples', 'Samples', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-expense-type-travel', 'Travel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-expense-type-other', 'Other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
