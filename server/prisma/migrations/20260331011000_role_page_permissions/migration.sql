CREATE TABLE IF NOT EXISTS "RolePagePermission" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "pageKey" TEXT NOT NULL,
  "canAccess" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RolePagePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RolePagePermission_roleId_pageKey_key"
  ON "RolePagePermission"("roleId", "pageKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'RolePagePermission_roleId_fkey'
      AND table_name = 'RolePagePermission'
  ) THEN
    ALTER TABLE "RolePagePermission"
      ADD CONSTRAINT "RolePagePermission_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
