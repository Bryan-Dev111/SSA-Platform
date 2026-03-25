DO $$ BEGIN
  CREATE TYPE "PaidStatus" AS ENUM ('Pending', 'Paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "LaborCost" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "workLogId" TEXT,
  "fullName" TEXT NOT NULL,
  "hours" DOUBLE PRECISION NOT NULL,
  "rate" DOUBLE PRECISION NOT NULL,
  "totalCost" DOUBLE PRECISION NOT NULL,
  "paidStatus" "PaidStatus" NOT NULL DEFAULT 'Pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaborCost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LaborCost_code_key" ON "LaborCost"("code");
CREATE INDEX IF NOT EXISTS "LaborCost_createdAt_idx" ON "LaborCost"("createdAt");

DO $$ BEGIN
  ALTER TABLE "LaborCost" ADD CONSTRAINT "LaborCost_workLogId_fkey" FOREIGN KEY ("workLogId") REFERENCES "WorkLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
