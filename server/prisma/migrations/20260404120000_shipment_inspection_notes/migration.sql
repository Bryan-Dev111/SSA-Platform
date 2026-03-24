-- Optional review / rejection notes on shipment inspection requests.

ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
