-- CreateTable
CREATE TABLE "FindingApprovalLog" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingApprovalLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FindingApprovalLog" ADD CONSTRAINT "FindingApprovalLog_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingApprovalLog" ADD CONSTRAINT "FindingApprovalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
