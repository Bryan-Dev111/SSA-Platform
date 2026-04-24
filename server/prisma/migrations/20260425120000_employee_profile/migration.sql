-- Employee Profile (rich content + images) for Global Supply / Internal Management roster.

CREATE TABLE "EmployeeProfile" (
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "EmployeeProfileImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filePath" TEXT,
    "fileName" TEXT,
    "fileMime" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeProfileImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeProfileImage_userId_idx" ON "EmployeeProfileImage"("userId");

ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeProfileImage" ADD CONSTRAINT "EmployeeProfileImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
