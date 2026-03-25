DO $$ BEGIN
  CREATE TYPE "WorkType" AS ENUM ('Audit', 'Inspection', 'Travel', 'Admin', 'Other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "WorkLog" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "hoursWorked" DOUBLE PRECISION NOT NULL,
  "workType" "WorkType" NOT NULL,
  "supplierId" TEXT,
  "auditId" TEXT,
  "shipmentId" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkLog_code_key" ON "WorkLog"("code");
CREATE INDEX IF NOT EXISTS "WorkLog_workDate_idx" ON "WorkLog"("workDate");

DO $$ BEGIN
  ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
