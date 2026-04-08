-- Expense: user-selected date of the expense (distinct from record createdAt).
ALTER TABLE "Expense" ADD COLUMN "expenseDate" DATE;

UPDATE "Expense"
SET "expenseDate" = ("createdAt" AT TIME ZONE 'UTC')::date
WHERE "expenseDate" IS NULL;

ALTER TABLE "Expense" ALTER COLUMN "expenseDate" SET NOT NULL;

CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
