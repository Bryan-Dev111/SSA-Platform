-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "farmName" TEXT NOT NULL,
    "farmerName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "region" TEXT,
    "farmCategory" TEXT,
    "mainCrop" TEXT,
    "elevationMeters" DOUBLE PRECISION,
    "productionStyle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Farm_code_key" ON "Farm"("code");

-- CreateIndex
CREATE INDEX "Farm_code_idx" ON "Farm"("code");

-- CreateIndex
CREATE INDEX "Farm_country_idx" ON "Farm"("country");
