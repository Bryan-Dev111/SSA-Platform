-- CAR root cause codes (admin-managed) + optional selection on CorrectiveAction.
CREATE TABLE IF NOT EXISTS "CarRootCauseCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarRootCauseCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CarRootCauseCode_code_key" ON "CarRootCauseCode"("code");

ALTER TABLE "CorrectiveAction" ADD COLUMN IF NOT EXISTS "rootCauseCode" TEXT;
