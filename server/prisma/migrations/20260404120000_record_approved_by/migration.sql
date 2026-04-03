-- Record: track which user approved the record (User.name = full name in UI).
ALTER TABLE "Record" ADD COLUMN "approvedById" TEXT;

ALTER TABLE "Record" ADD CONSTRAINT "Record_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Record_approvedById_idx" ON "Record"("approvedById");
