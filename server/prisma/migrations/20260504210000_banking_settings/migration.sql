-- Internal Management → Banking: singleton org credentials (encrypted in app layer).
CREATE TABLE "BankingSettings" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'custom',
    "institutionLabel" TEXT,
    "apiKeyEncrypted" TEXT,
    "apiSecretEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankingSettings_pkey" PRIMARY KEY ("id")
);
