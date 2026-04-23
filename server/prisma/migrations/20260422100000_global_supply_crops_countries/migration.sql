-- Add admin-managed master lists for Global Supply PO crops and expense countries.
CREATE TABLE "GlobalSupplyCrop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSupplyCrop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GlobalSupplyCrop_name_key" ON "GlobalSupplyCrop"("name");

CREATE TABLE "GlobalSupplyCountry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSupplyCountry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GlobalSupplyCountry_name_key" ON "GlobalSupplyCountry"("name");

ALTER TABLE "Expense" ADD COLUMN "country" TEXT;

CREATE INDEX "Expense_country_idx" ON "Expense"("country");
