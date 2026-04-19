-- AlterTable
ALTER TABLE "InternalDoc" ADD COLUMN "buyerId" TEXT,
ADD COLUMN "employeeUserId" TEXT;

-- CreateIndex
CREATE INDEX "InternalDoc_buyerId_idx" ON "InternalDoc"("buyerId");

-- CreateIndex
CREATE INDEX "InternalDoc_employeeUserId_idx" ON "InternalDoc"("employeeUserId");

-- AddForeignKey
ALTER TABLE "InternalDoc" ADD CONSTRAINT "InternalDoc_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalDoc" ADD CONSTRAINT "InternalDoc_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
