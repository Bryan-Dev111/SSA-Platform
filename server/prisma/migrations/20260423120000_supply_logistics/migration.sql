-- CreateTable
CREATE TABLE "SupplyLogistics" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "siteType" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyLogistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplyLogistics_code_key" ON "SupplyLogistics"("code");

-- CreateIndex
CREATE INDEX "SupplyLogistics_code_idx" ON "SupplyLogistics"("code");

-- CreateIndex
CREATE INDEX "SupplyLogistics_siteType_idx" ON "SupplyLogistics"("siteType");
