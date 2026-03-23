CREATE TABLE IF NOT EXISTS "QeSupplier" (
  "qualityEngineerId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  CONSTRAINT "QeSupplier_pkey" PRIMARY KEY ("qualityEngineerId", "supplierId"),
  CONSTRAINT "QeSupplier_qualityEngineerId_fkey" FOREIGN KEY ("qualityEngineerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QeSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
