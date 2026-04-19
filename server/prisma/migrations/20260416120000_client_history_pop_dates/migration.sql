-- Period of Performance: calendar dates + derived status (replaces free-text periodOfPerformance).

ALTER TABLE "ClientHistory" ADD COLUMN "popStart" DATE;
ALTER TABLE "ClientHistory" ADD COLUMN "popEnd" DATE;

ALTER TABLE "ClientHistory" DROP COLUMN "periodOfPerformance";

ALTER TABLE "ClientHistory" ALTER COLUMN "status" SET DEFAULT 'Inactive';

UPDATE "ClientHistory"
SET "status" = 'Inactive';
