-- Multiple countries per staff user (employee/contractor roster).
CREATE TABLE "UserAssignedCountry" (
    "userId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAssignedCountry_pkey" PRIMARY KEY ("userId","country")
);

CREATE INDEX "UserAssignedCountry_userId_idx" ON "UserAssignedCountry"("userId");

ALTER TABLE "UserAssignedCountry" ADD CONSTRAINT "UserAssignedCountry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed from legacy single country column where set.
INSERT INTO "UserAssignedCountry" ("userId", "country", "createdAt")
SELECT "id", TRIM("country"), CURRENT_TIMESTAMP
FROM "User"
WHERE "country" IS NOT NULL AND TRIM("country") <> ''
ON CONFLICT DO NOTHING;
