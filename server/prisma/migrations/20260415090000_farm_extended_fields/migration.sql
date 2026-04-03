-- Add agronomy, processing, contact, and relationship fields to Farm.
-- All columns are nullable so this is safe for existing data.

ALTER TABLE "Farm"
  ADD COLUMN "totalFarmSizeHa" DOUBLE PRECISION,
  ADD COLUMN "mainCropAreaHa" DOUBLE PRECISION,
  ADD COLUMN "mainCropAnnualOutputKg" DOUBLE PRECISION,
  ADD COLUMN "secondaryCrop" TEXT,
  ADD COLUMN "secondaryCropAreaHa" DOUBLE PRECISION,
  ADD COLUMN "secondaryCropAnnualOutputKg" DOUBLE PRECISION,
  ADD COLUMN "mainVarieties" TEXT,
  ADD COLUMN "secondaryVarieties" TEXT,
  ADD COLUMN "harvestStartMonth" TEXT,
  ADD COLUMN "harvestEndMonth" TEXT,
  ADD COLUMN "secondaryHarvestStartMonth" TEXT,
  ADD COLUMN "secondaryHarvestEndMonth" TEXT,
  ADD COLUMN "mainProcessingMethods" TEXT,
  ADD COLUMN "mainFermentationDays" INTEGER,
  ADD COLUMN "mainDryingMethod" TEXT,
  ADD COLUMN "mainBeanSize" TEXT,
  ADD COLUMN "mainQualityScore" DOUBLE PRECISION,
  ADD COLUMN "secondaryProcessingMethods" TEXT,
  ADD COLUMN "secondaryFermentationDays" INTEGER,
  ADD COLUMN "secondaryDryingMethod" TEXT,
  ADD COLUMN "secondaryBeanSize" TEXT,
  ADD COLUMN "secondaryQualityScore" DOUBLE PRECISION,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "samplesOk" BOOLEAN,
  ADD COLUMN "farmerEmail" TEXT,
  ADD COLUMN "farmerMobile" TEXT,
  ADD COLUMN "notes" TEXT;

