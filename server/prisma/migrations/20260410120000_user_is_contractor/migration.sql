-- Contractor employment flag for Admin UI (three-state Employee dropdown).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isContractor" BOOLEAN NOT NULL DEFAULT false;

