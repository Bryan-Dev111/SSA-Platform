-- Day 8: reference codes for Admin + Findings/CARs
-- Idempotent: safe when tables/column already exist (e.g. Supabase created via db push).

CREATE TABLE IF NOT EXISTS "DefectCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefectCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DefectCode_code_key" ON "DefectCode"("code");

CREATE TABLE IF NOT EXISTS "DispositionCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispositionCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DispositionCode_code_key" ON "DispositionCode"("code");

ALTER TABLE "Finding" ADD COLUMN IF NOT EXISTS "dispositionCode" TEXT;
