-- Employee roster: optional commodity assignment (Admin → Employees).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commodityTypeId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_commodityTypeId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_commodityTypeId_fkey"
      FOREIGN KEY ("commodityTypeId") REFERENCES "CommodityType"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
