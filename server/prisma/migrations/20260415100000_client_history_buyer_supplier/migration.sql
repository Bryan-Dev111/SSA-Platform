-- Optional Buyer (User) and Supplier links on project history records.
ALTER TABLE "ClientHistory" ADD COLUMN "buyerId" TEXT;
ALTER TABLE "ClientHistory" ADD COLUMN "supplierId" TEXT;

CREATE INDEX "ClientHistory_buyerId_idx" ON "ClientHistory"("buyerId");
CREATE INDEX "ClientHistory_supplierId_idx" ON "ClientHistory"("supplierId");

ALTER TABLE "ClientHistory" ADD CONSTRAINT "ClientHistory_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientHistory" ADD CONSTRAINT "ClientHistory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
