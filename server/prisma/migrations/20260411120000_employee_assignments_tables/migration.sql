-- Employee assignment relationships:
-- 1) Auditor ↔ Supplier
-- 2) Quality Engineer ↔ Buyer (QE -> buyers; suppliers derived from Buyer -> suppliers)

CREATE TABLE IF NOT EXISTS "AuditorSupplier" (
  "auditorId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  CONSTRAINT "AuditorSupplier_pkey" PRIMARY KEY ("auditorId", "supplierId"),
  CONSTRAINT "AuditorSupplier_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuditorSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "QeBuyer" (
  "qualityEngineerId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  CONSTRAINT "QeBuyer_pkey" PRIMARY KEY ("qualityEngineerId", "buyerId"),
  CONSTRAINT "QeBuyer_qualityEngineerId_fkey" FOREIGN KEY ("qualityEngineerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QeBuyer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

