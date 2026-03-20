-- Add approval/rejection log entries for CAR workflow.
CREATE TABLE IF NOT EXISTS "CarApprovalLog" (
  "id" TEXT NOT NULL,
  "carId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarApprovalLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CarApprovalLog_carId_createdAt_idx" ON "CarApprovalLog"("carId", "createdAt");

ALTER TABLE "CarApprovalLog"
  ADD CONSTRAINT "CarApprovalLog_carId_fkey"
  FOREIGN KEY ("carId") REFERENCES "CorrectiveAction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarApprovalLog"
  ADD CONSTRAINT "CarApprovalLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
