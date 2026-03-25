CREATE TABLE IF NOT EXISTS "QualityManagerQe" (
  "qualityManagerId" TEXT NOT NULL,
  "qualityEngineerId" TEXT NOT NULL,
  CONSTRAINT "QualityManagerQe_pkey" PRIMARY KEY ("qualityManagerId","qualityEngineerId"),
  CONSTRAINT "QualityManagerQe_qualityManagerId_fkey" FOREIGN KEY ("qualityManagerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QualityManagerQe_qualityEngineerId_fkey" FOREIGN KEY ("qualityEngineerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
