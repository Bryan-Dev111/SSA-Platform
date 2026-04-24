-- Global Supply: assign employees/contractors to users with the SourcingDirector role.

CREATE TABLE IF NOT EXISTS "SourcingDirectorStaff" (
    "sourcingDirectorId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,

    CONSTRAINT "SourcingDirectorStaff_pkey" PRIMARY KEY ("sourcingDirectorId","staffUserId")
);

ALTER TABLE "SourcingDirectorStaff" DROP CONSTRAINT IF EXISTS "SourcingDirectorStaff_sourcingDirectorId_fkey";
ALTER TABLE "SourcingDirectorStaff" ADD CONSTRAINT "SourcingDirectorStaff_sourcingDirectorId_fkey"
  FOREIGN KEY ("sourcingDirectorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SourcingDirectorStaff" DROP CONSTRAINT IF EXISTS "SourcingDirectorStaff_staffUserId_fkey";
ALTER TABLE "SourcingDirectorStaff" ADD CONSTRAINT "SourcingDirectorStaff_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Role" ("id", "name")
SELECT gen_random_uuid()::text, 'SourcingDirector'
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE "name" = 'SourcingDirector');
