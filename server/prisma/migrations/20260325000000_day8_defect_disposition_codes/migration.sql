-- Day 8: reference codes for Admin + Findings/CARs

CREATE TABLE "DefectCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefectCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DefectCode_code_key" ON "DefectCode"("code");

CREATE TABLE "DispositionCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispositionCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispositionCode_code_key" ON "DispositionCode"("code");

ALTER TABLE "Finding" ADD COLUMN "dispositionCode" TEXT;
