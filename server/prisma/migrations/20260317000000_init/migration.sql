-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('Passed', 'Failed', 'Cancelled');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('DRAFT', 'WaitingDisposition', 'WaitingApproval', 'Closed');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('Critical', 'Major', 'Minor');

-- CreateEnum
CREATE TYPE "CARStatus" AS ENUM ('DRAFT', 'RCCA', 'WaitingApproval', 'FollowUp', 'Closed');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('WaitingInspection', 'Passed', 'Failed');

-- CreateEnum
CREATE TYPE "ShipmentResult" AS ENUM ('Passed', 'Failed');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('internal', 'supplier');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('PENDING', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('Procedure', 'Policy', 'StandardOperatingProcedure', 'WorkInstruction', 'Form');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "AlertCategory" AS ENUM ('overdueAudit', 'majorCriticalFinding', 'overdueCAR', 'shipmentInspectionRequest', 'rejectedShipmentDocument', 'lateShipment');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "CommodityType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CommodityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "commodityTypeId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerSupplier" (
    "buyerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,

    CONSTRAINT "BuyerSupplier_pkey" PRIMARY KEY ("buyerId","supplierId")
);

-- CreateTable
CREATE TABLE "AuditType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "AuditType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "auditTypeId" TEXT,
    "auditDate" DATE NOT NULL,
    "result" "AuditResult",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'DRAFT',
    "severity" "FindingSeverity" NOT NULL,
    "summary" TEXT NOT NULL,
    "discrepancy" TEXT NOT NULL,
    "defectCode" TEXT,
    "containment" TEXT,
    "occurrenceRootCause" TEXT,
    "escapeRootCause" TEXT,
    "correctiveAction" TEXT,
    "verificationOfEffectiveness" TEXT,
    "closingComments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveAction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "CARStatus" NOT NULL DEFAULT 'DRAFT',
    "severity" "FindingSeverity" NOT NULL,
    "carOwner" TEXT,
    "targetCompletionDate" DATE,
    "summary" TEXT NOT NULL,
    "discrepancy" TEXT NOT NULL,
    "defectCode" TEXT,
    "containment" TEXT,
    "occurrenceRootCause" TEXT,
    "escapeRootCause" TEXT,
    "correctiveAction" TEXT,
    "verificationOfEffectiveness" TEXT,
    "closingComments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrder" TEXT,
    "partNumber" TEXT,
    "qty" INTEGER,
    "inspectionDate" DATE,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'WaitingInspection',
    "result" "ShipmentResult",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentSchedule" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseOrder" TEXT,
    "partNumber" TEXT,
    "qty" INTEGER,
    "scheduledDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalOrSupplier" "RecordSource" NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "filePath" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalDoc" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskWeightConfig" (
    "id" TEXT NOT NULL,
    "qualityPercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "auditPercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "deliveryPercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "carClosurePercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "documentationPercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskWeightConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSnapshot" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "level" "RiskLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "category" "AlertCategory" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "message" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAlertPreference" (
    "userId" TEXT NOT NULL,
    "alertCategory" "AlertCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserAlertPreference_pkey" PRIMARY KEY ("userId","alertCategory")
);

-- CreateTable
CREATE TABLE "IdSequence" (
    "prefix" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IdSequence_pkey" PRIMARY KEY ("prefix")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_userId_key" ON "Supplier"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditType_code_key" ON "AuditType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Audit_code_key" ON "Audit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_code_key" ON "Finding"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectiveAction_code_key" ON "CorrectiveAction"("code");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_commodityTypeId_fkey" FOREIGN KEY ("commodityTypeId") REFERENCES "CommodityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerSupplier" ADD CONSTRAINT "BuyerSupplier_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerSupplier" ADD CONSTRAINT "BuyerSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_auditTypeId_fkey" FOREIGN KEY ("auditTypeId") REFERENCES "AuditType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentSchedule" ADD CONSTRAINT "ShipmentSchedule_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAlertPreference" ADD CONSTRAINT "UserAlertPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
