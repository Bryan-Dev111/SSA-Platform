-- Sentinel Supplier Assurance Internal Management — calendar events (subject + date).

CREATE TABLE "InternalManagementCalendarEvent" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "InternalManagementCalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InternalManagementCalendarEvent_eventDate_idx" ON "InternalManagementCalendarEvent"("eventDate");

ALTER TABLE "InternalManagementCalendarEvent" ADD CONSTRAINT "InternalManagementCalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
