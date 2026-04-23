-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Open';

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");
