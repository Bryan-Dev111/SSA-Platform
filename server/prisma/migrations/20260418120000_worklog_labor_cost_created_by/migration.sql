-- Attribution for work logs / labor costs (who entered the row); enables "my history" filtering.
ALTER TABLE "WorkLog" ADD COLUMN "createdById" TEXT;

CREATE INDEX "WorkLog_createdById_idx" ON "WorkLog"("createdById");

ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LaborCost" ADD COLUMN "createdById" TEXT;

CREATE INDEX "LaborCost_createdById_idx" ON "LaborCost"("createdById");

ALTER TABLE "LaborCost" ADD CONSTRAINT "LaborCost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
