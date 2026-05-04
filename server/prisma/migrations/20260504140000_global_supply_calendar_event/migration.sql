-- Global Supply Internal Management — calendar events (subject + date).

CREATE TABLE "GlobalSupplyCalendarEvent" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "GlobalSupplyCalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GlobalSupplyCalendarEvent_eventDate_idx" ON "GlobalSupplyCalendarEvent"("eventDate");

ALTER TABLE "GlobalSupplyCalendarEvent" ADD CONSTRAINT "GlobalSupplyCalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
