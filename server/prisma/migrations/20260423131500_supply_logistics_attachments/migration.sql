-- CreateTable
CREATE TABLE "SupplyLogisticsAttachment" (
    "id" TEXT NOT NULL,
    "supplyLogisticsId" TEXT NOT NULL,
    "filePath" TEXT,
    "fileName" TEXT,
    "fileMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyLogisticsAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplyLogisticsAttachment_supplyLogisticsId_idx" ON "SupplyLogisticsAttachment"("supplyLogisticsId");

-- AddForeignKey
ALTER TABLE "SupplyLogisticsAttachment" ADD CONSTRAINT "SupplyLogisticsAttachment_supplyLogisticsId_fkey" FOREIGN KEY ("supplyLogisticsId") REFERENCES "SupplyLogistics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
