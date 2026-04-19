-- AlterTable
ALTER TABLE "Sample" ADD COLUMN "sentDate" DATE;

-- Existing rows: use creation date as sent date so the list stays meaningful
UPDATE "Sample" SET "sentDate" = ("createdAt" AT TIME ZONE 'UTC')::date WHERE "sentDate" IS NULL;

-- CreateIndex
CREATE INDEX "Sample_sentDate_idx" ON "Sample"("sentDate");
