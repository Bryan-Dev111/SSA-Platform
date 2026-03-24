-- Optional notes on quality records; lot on shipment inspection requests
ALTER TABLE "Record" ADD COLUMN "notes" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "lot" TEXT;
