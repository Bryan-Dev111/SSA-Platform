-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "purchaseOrderId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_purchaseOrderId_idx" ON "Expense"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
