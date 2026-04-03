-- Link WorkLog and LaborCost to ClientHistory (moved from 20260325213000 so migrations
-- apply after WorkLog / LaborCost tables exist).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkLog' AND column_name = 'projectHistoryId'
  ) THEN
    ALTER TABLE "WorkLog" ADD COLUMN "projectHistoryId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'LaborCost' AND column_name = 'projectHistoryId'
  ) THEN
    ALTER TABLE "LaborCost" ADD COLUMN "projectHistoryId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_projectHistoryId_fkey" FOREIGN KEY ("projectHistoryId") REFERENCES "ClientHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LaborCost" ADD CONSTRAINT "LaborCost_projectHistoryId_fkey" FOREIGN KEY ("projectHistoryId") REFERENCES "ClientHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
