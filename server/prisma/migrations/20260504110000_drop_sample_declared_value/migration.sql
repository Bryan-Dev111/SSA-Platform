-- Samples totals use linked Expense rows (type Sample); drop unused column.
ALTER TABLE "Sample" DROP COLUMN IF EXISTS "declaredValue";
