-- Link audits / shipments to Client History projects; optional PO+part keys on projects for shipment matching.
ALTER TABLE "Audit" ADD COLUMN "projectHistoryId" TEXT;
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_projectHistoryId_fkey" FOREIGN KEY ("projectHistoryId") REFERENCES "ClientHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Audit_projectHistoryId_idx" ON "Audit"("projectHistoryId");

ALTER TABLE "Shipment" ADD COLUMN "projectHistoryId" TEXT;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_projectHistoryId_fkey" FOREIGN KEY ("projectHistoryId") REFERENCES "ClientHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Shipment_projectHistoryId_idx" ON "Shipment"("projectHistoryId");

ALTER TABLE "ClientHistory" ADD COLUMN "shipmentMatchPurchaseOrder" TEXT;
ALTER TABLE "ClientHistory" ADD COLUMN "shipmentMatchPartNumber" TEXT;
