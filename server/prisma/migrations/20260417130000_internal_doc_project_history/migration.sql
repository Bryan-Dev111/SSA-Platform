-- Link internal contract documents to Project History (ClientHistory).
ALTER TABLE "InternalDoc" ADD COLUMN "projectHistoryId" TEXT;

CREATE INDEX "InternalDoc_projectHistoryId_idx" ON "InternalDoc"("projectHistoryId");

ALTER TABLE "InternalDoc" ADD CONSTRAINT "InternalDoc_projectHistoryId_fkey" FOREIGN KEY ("projectHistoryId") REFERENCES "ClientHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
