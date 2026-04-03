-- AlterTable
ALTER TABLE "ClientHistory" ADD COLUMN "projectCode" TEXT;
ALTER TABLE "ClientHistory" ADD COLUMN "revenueAmount" DOUBLE PRECISION;

-- Backfill project codes for existing rows
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "ClientHistory"
)
UPDATE "ClientHistory" c
SET "projectCode" = 'PROJ-' || LPAD(numbered.rn::text, 5, '0')
FROM numbered
WHERE c."id" = numbered."id" AND c."projectCode" IS NULL;

-- Ensure non-null + unique
ALTER TABLE "ClientHistory" ALTER COLUMN "projectCode" SET NOT NULL;
CREATE UNIQUE INDEX "ClientHistory_projectCode_key" ON "ClientHistory"("projectCode");

-- CreateTable
CREATE TABLE "EmployeeSupplierAssignment" (
    "employeeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,

    CONSTRAINT "EmployeeSupplierAssignment_pkey" PRIMARY KEY ("employeeId","supplierId")
);

-- WorkLog / LaborCost projectHistoryId: applied in a later migration (20260412140000)
-- after those tables are created (shadow DB replay failed when this ran before WorkLog existed).

-- AddForeignKey
ALTER TABLE "EmployeeSupplierAssignment" ADD CONSTRAINT "EmployeeSupplierAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSupplierAssignment" ADD CONSTRAINT "EmployeeSupplierAssignment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
