-- CreateTable
CREATE TABLE "ClientHistory" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientMobile" TEXT,
    "industry" TEXT,
    "country" TEXT,
    "projectDescription" TEXT,
    "periodOfPerformance" TEXT,
    "revenue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientHistory_pkey" PRIMARY KEY ("id")
);
