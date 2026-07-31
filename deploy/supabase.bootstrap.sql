-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE OR REPLACE FUNCTION public.medilab_create_type_if_not_exists(
    p_type_name TEXT,
    p_ddl TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type type_info
        JOIN pg_namespace namespace_info ON namespace_info.oid = type_info.typnamespace
        WHERE type_info.typname = p_type_name
          AND namespace_info.nspname = 'public'
    ) THEN
        EXECUTE p_ddl;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.medilab_add_constraint_if_not_exists(
    p_table_name TEXT,
    p_constraint_name TEXT,
    p_ddl TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_info
        JOIN pg_class table_info ON table_info.oid = constraint_info.conrelid
        JOIN pg_namespace namespace_info ON namespace_info.oid = table_info.relnamespace
        WHERE constraint_info.conname = p_constraint_name
          AND table_info.relname = p_table_name
          AND namespace_info.nspname = 'public'
    ) THEN
        EXECUTE p_ddl;
    END IF;
END
$$;

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('CatalogKind', 'CREATE TYPE "CatalogKind" AS ENUM (''TEST'', ''IMAGING'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('Department', 'CREATE TYPE "Department" AS ENUM (''LAB'', ''IMAGING'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('OrderStatus', 'CREATE TYPE "OrderStatus" AS ENUM (''DRAFT'', ''REGISTERED'', ''COLLECTED'', ''IN_PROGRESS'', ''READY_FOR_REVIEW'', ''VERIFIED'', ''RELEASED'', ''REJECTED'', ''CANCELLED'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('Priority', 'CREATE TYPE "Priority" AS ENUM (''ROUTINE'', ''URGENT'', ''STAT'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('SampleStatus', 'CREATE TYPE "SampleStatus" AS ENUM (''PENDING'', ''COLLECTED'', ''RECEIVED'', ''PROCESSING'', ''STORED'', ''REJECTED'', ''DISPOSED'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('AppointmentStatus', 'CREATE TYPE "AppointmentStatus" AS ENUM (''SCHEDULED'', ''ARRIVED'', ''SCANNING'', ''REPORTED'', ''COMPLETED'', ''CANCELLED'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('ReportStatus', 'CREATE TYPE "ReportStatus" AS ENUM (''DRAFT'', ''IN_REVIEW'', ''APPROVED'', ''RELEASED'', ''AMENDED'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('InvoiceStatus', 'CREATE TYPE "InvoiceStatus" AS ENUM (''DRAFT'', ''OPEN'', ''PARTIAL'', ''PAID'', ''VOID'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('SyncStatus', 'CREATE TYPE "SyncStatus" AS ENUM (''LOCAL_ONLY'', ''PENDING_SYNC'', ''SYNCED'', ''CONFLICT'', ''FAILED'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('InventoryTxnType', 'CREATE TYPE "InventoryTxnType" AS ENUM (''RECEIPT'', ''ISSUE'', ''ADJUSTMENT'', ''EXPIRY'', ''RETURN'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('PaymentMethod', 'CREATE TYPE "PaymentMethod" AS ENUM (''CASH'', ''MOBILE_MONEY_MTN'', ''MOBILE_MONEY_VODAFONE'', ''CARD'', ''NHIS'', ''BANK_TRANSFER'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('PaymentResponsibility', 'CREATE TYPE "PaymentResponsibility" AS ENUM (''PATIENT'', ''PAYER'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('PayerType', 'CREATE TYPE "PayerType" AS ENUM (''SELF_PAY'', ''NHIS'', ''INSURANCE'', ''CORPORATE'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('ClaimStatus', 'CREATE TYPE "ClaimStatus" AS ENUM (''NOT_APPLICABLE'', ''PENDING'', ''SUBMITTED'', ''PARTIAL'', ''SETTLED'', ''REJECTED'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('NotificationChannel', 'CREATE TYPE "NotificationChannel" AS ENUM (''SMS'', ''EMAIL'', ''WHATSAPP'', ''INTERNAL'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('NotificationStatus', 'CREATE TYPE "NotificationStatus" AS ENUM (''QUEUED'', ''SENT'', ''FAILED'', ''CANCELLED'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('UserRole', 'CREATE TYPE "UserRole" AS ENUM (''RECEPTION'', ''PHLEBOTOMIST'', ''SONOGRAPHER'', ''DOCTOR'', ''LAB_TECH'', ''RADIOLOGIST'', ''MANAGER'', ''FINANCE'', ''QA'', ''ADMIN'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('MaintenanceStatus', 'CREATE TYPE "MaintenanceStatus" AS ENUM (''SCHEDULED'', ''DUE'', ''COMPLETED'', ''OVERDUE'')');

-- CreateEnum
SELECT public.medilab_create_type_if_not_exists('InstrumentCategory', 'CREATE TYPE "InstrumentCategory" AS ENUM (''ANALYZER'', ''ULTRASOUND'', ''PRINTER'', ''SERVER'')');

-- CreateTable
CREATE TABLE IF NOT EXISTS "Facility" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "logoDataUrl" TEXT NOT NULL DEFAULT '',
    "footerMessage" TEXT NOT NULL DEFAULT '',
    "printFontSize" TEXT NOT NULL DEFAULT 'MEDIUM',
    "traceSequence" INTEGER NOT NULL DEFAULT 1200,
    "cloudMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ExpenseRecord" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReferralDoctor" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "commissionPercent" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppUser" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "pinSalt" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "pinChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Patient" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "referralDoctorId" TEXT,
    "referralName" TEXT,
    "referralCommissionPercent" INTEGER,
    "traceCode" TEXT NOT NULL,
    "traceSequence" INTEGER NOT NULL,
    "initials" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT NOT NULL,
    "location" TEXT,
    "nhisId" TEXT,
    "allergies" TEXT,
    "medicalHistory" TEXT,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "photoPath" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'LOCAL_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CatalogItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CatalogKind" NOT NULL,
    "department" "Department" NOT NULL,
    "specimenType" TEXT,
    "modality" TEXT,
    "priceCents" INTEGER NOT NULL,
    "tatMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rulesJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DiagnosticOrder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'REGISTERED',
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "orderedBy" TEXT NOT NULL,
    "payerType" "PayerType" NOT NULL DEFAULT 'SELF_PAY',
    "payerName" TEXT,
    "payerCoveragePercent" INTEGER NOT NULL DEFAULT 0,
    "payerMemberId" TEXT,
    "payerAuthorizationCode" TEXT,
    "referringClinic" TEXT,
    "insuranceProvider" TEXT,
    "insuranceAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "totalAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'REGISTERED',
    "instructions" TEXT,
    "criticalFinding" BOOLEAN NOT NULL DEFAULT false,
    "resultText" TEXT,
    "resultJson" TEXT,
    "performedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "reviewerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Sample" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "traceLabel" TEXT NOT NULL,
    "specimenType" TEXT NOT NULL,
    "status" "SampleStatus" NOT NULL DEFAULT 'PENDING',
    "collectedBy" TEXT,
    "collectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "chainOfCustodyJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImagingStudy" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "appointmentStatus" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "sonographerName" TEXT,
    "radiologistName" TEXT,
    "dicomPath" TEXT,
    "annotationsJson" TEXT NOT NULL DEFAULT '[]',
    "priorStudyReference" TEXT,
    "criticalFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagingStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "medicalHistory" TEXT,
    "summary" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "impression" TEXT NOT NULL,
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "imagePathsJson" TEXT NOT NULL DEFAULT '[]',
    "criticalFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReportTemplate" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateKind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "medicalHistory" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "impression" TEXT NOT NULL,
    "assistJson" TEXT NOT NULL DEFAULT '{}',
    "createdByName" TEXT NOT NULL,
    "createdByRole" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "payerType" "PayerType" NOT NULL DEFAULT 'SELF_PAY',
    "payerName" TEXT,
    "payerCoveragePercent" INTEGER NOT NULL DEFAULT 0,
    "payerMemberId" TEXT,
    "payerAuthorizationCode" TEXT,
    "payerResponsibilityCents" INTEGER NOT NULL DEFAULT 0,
    "patientResponsibilityCents" INTEGER NOT NULL DEFAULT 0,
    "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "insuranceCoveredCents" INTEGER NOT NULL DEFAULT 0,
    "amountDueCents" INTEGER NOT NULL,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Reagent',
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantityOnHand" DOUBLE PRECISION NOT NULL,
    "reorderLevel" DOUBLE PRECISION NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "preferredVendor" TEXT,
    "storageLocation" TEXT,
    "lastRestockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "InventoryTxnType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QualityControlEvent" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "instrumentName" TEXT NOT NULL,
    "analyte" TEXT NOT NULL,
    "controlLevel" TEXT NOT NULL,
    "lotNumber" TEXT,
    "observedValue" DOUBLE PRECISION NOT NULL,
    "meanValue" DOUBLE PRECISION NOT NULL,
    "standardDeviation" DOUBLE PRECISION NOT NULL,
    "expectedRange" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traceCode" TEXT,
    "westgardViolationsJson" TEXT NOT NULL DEFAULT '[]',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "QualityControlEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SyncEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING_SYNC',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "conflictNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentRecord" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "responsibility" "PaymentResponsibility" NOT NULL DEFAULT 'PATIENT',
    "amountCents" INTEGER NOT NULL,
    "reference" TEXT,
    "receivedBy" TEXT NOT NULL,
    "traceCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Instrument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InstrumentCategory" NOT NULL,
    "serialNumber" TEXT,
    "location" TEXT,
    "integrationType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MaintenanceEvent" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationQueue" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "traceCode" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "traceCode" TEXT,
    "summary" TEXT NOT NULL,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BackupSnapshot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "BackupSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Facility_code_key" ON "Facility"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExpenseRecord_facilityId_incurredAt_idx" ON "ExpenseRecord"("facilityId", "incurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExpenseRecord_category_incurredAt_idx" ON "ExpenseRecord"("category", "incurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReferralDoctor_facilityId_fullName_idx" ON "ReferralDoctor"("facilityId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralDoctor_facilityId_fullName_key" ON "ReferralDoctor"("facilityId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_username_key" ON "AppUser"("username");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppUser_role_isActive_idx" ON "AppUser"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppSession_tokenHash_key" ON "AppSession"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppSession_userId_expiresAt_idx" ON "AppSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_traceCode_key" ON "Patient"("traceCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_nhisId_key" ON "Patient"("nhisId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patient_lastName_firstName_idx" ON "Patient"("lastName", "firstName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patient_phone_idx" ON "Patient"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patient_traceSequence_idx" ON "Patient"("traceSequence");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patient_referralDoctorId_idx" ON "Patient"("referralDoctorId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogItem_code_key" ON "CatalogItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DiagnosticOrder_accessionNumber_key" ON "DiagnosticOrder"("accessionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DiagnosticOrder_patientId_createdAt_idx" ON "DiagnosticOrder"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DiagnosticOrder_status_idx" ON "DiagnosticOrder"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Sample_traceLabel_idx" ON "Sample"("traceLabel");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ImagingStudy_orderItemId_key" ON "ImagingStudy"("orderItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImagingStudy_appointmentStatus_idx" ON "ImagingStudy"("appointmentStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReportTemplate_facilityId_templateKind_idx" ON "ReportTemplate"("facilityId", "templateKind");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReportTemplate_facilityId_name_key" ON "ReportTemplate"("facilityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QualityControlEvent_module_status_idx" ON "QualityControlEvent"("module", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QualityControlEvent_instrumentName_analyte_occurredAt_idx" ON "QualityControlEvent"("instrumentName", "analyte", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncEvent_status_createdAt_idx" ON "SyncEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncEvent_entityType_entityId_idx" ON "SyncEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRecord_method_createdAt_idx" ON "PaymentRecord"("method", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Instrument_name_key" ON "Instrument"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenanceEvent_status_nextDueAt_idx" ON "MaintenanceEvent"("status", "nextDueAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationQueue_status_channel_createdAt_idx" ON "NotificationQueue"("status", "channel", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_traceCode_createdAt_idx" ON "AuditLog"("traceCode", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_actorRole_createdAt_idx" ON "AuditLog"("actorRole", "createdAt");

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('ExpenseRecord', 'ExpenseRecord_facilityId_fkey', 'ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('ReferralDoctor', 'ReferralDoctor_facilityId_fkey', 'ALTER TABLE "ReferralDoctor" ADD CONSTRAINT "ReferralDoctor_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('AppUser', 'AppUser_facilityId_fkey', 'ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('AppSession', 'AppSession_userId_fkey', 'ALTER TABLE "AppSession" ADD CONSTRAINT "AppSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('Patient', 'Patient_facilityId_fkey', 'ALTER TABLE "Patient" ADD CONSTRAINT "Patient_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('Patient', 'Patient_referralDoctorId_fkey', 'ALTER TABLE "Patient" ADD CONSTRAINT "Patient_referralDoctorId_fkey" FOREIGN KEY ("referralDoctorId") REFERENCES "ReferralDoctor"("id") ON DELETE SET NULL ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('DiagnosticOrder', 'DiagnosticOrder_patientId_fkey', 'ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('OrderItem', 'OrderItem_orderId_fkey', 'ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DiagnosticOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('OrderItem', 'OrderItem_catalogItemId_fkey', 'ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('Sample', 'Sample_patientId_fkey', 'ALTER TABLE "Sample" ADD CONSTRAINT "Sample_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('Sample', 'Sample_orderId_fkey', 'ALTER TABLE "Sample" ADD CONSTRAINT "Sample_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DiagnosticOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('ImagingStudy', 'ImagingStudy_orderItemId_fkey', 'ALTER TABLE "ImagingStudy" ADD CONSTRAINT "ImagingStudy_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('Report', 'Report_patientId_fkey', 'ALTER TABLE "Report" ADD CONSTRAINT "Report_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('Report', 'Report_orderId_fkey', 'ALTER TABLE "Report" ADD CONSTRAINT "Report_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DiagnosticOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('ReportTemplate', 'ReportTemplate_facilityId_fkey', 'ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('Invoice', 'Invoice_patientId_fkey', 'ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('Invoice', 'Invoice_orderId_fkey', 'ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DiagnosticOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('InvoiceLine', 'InvoiceLine_invoiceId_fkey', 'ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('InventoryTransaction', 'InventoryTransaction_itemId_fkey', 'ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('PaymentRecord', 'PaymentRecord_invoiceId_fkey', 'ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- AddForeignKey
SELECT public.medilab_add_constraint_if_not_exists('MaintenanceEvent', 'MaintenanceEvent_instrumentId_fkey', 'ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

DROP FUNCTION IF EXISTS public.medilab_add_constraint_if_not_exists(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.medilab_create_type_if_not_exists(TEXT, TEXT);
