import "./load-env.js";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import {
  CatalogKind,
  ClaimStatus,
  Department,
  InvoiceStatus,
  PayerType,
  PaymentResponsibility,
  prisma,
} from "@medilab/db";
import {
  adminUserInputSchema,
  attendanceSettingsInputSchema,
  analyticsRangeKeys,
  bulkServiceInputSchema,
  catalogSeed,
  changeOwnPinInputSchema,
  expenseInputSchema,
  facilitySettingsInputSchema,
  imagingStudyUpdateInputSchema,
  importBackupInputSchema,
  initialSetupInputSchema,
  internalAlertInputSchema,
  inventoryTransactionInputSchema,
  loginInputSchema,
  notificationInputSchema,
  ownProfileInputSchema,
  orderInputSchema,
  patientInputSchema,
  patientReferralUpdateInputSchema,
  paymentInputSchema,
  claimStatusUpdateInputSchema,
  qcEventInputSchema,
  referralDoctorInputSchema,
  reportTemplateInputSchema,
  reportStatusUpdateInputSchema,
  rotatePinInputSchema,
  reportInputSchema,
  restoreBackupInputSchema,
  sampleUpdateInputSchema,
  serviceInputSchema,
  userStatusInputSchema,
  type AdminOverviewPayload,
  type AdminUserSummaryPayload,
  type AttendanceWorkspacePayload,
  type BootstrapPayload,
  type Capability,
  type CatalogSeedItem,
  type ExpenseSummaryPayload,
  type ExpenseWorkspacePayload,
  type FacilityProfile,
  type FinanceAnalyticsPayload,
  type ClaimStatusUpdateInput,
  type InitialSetupInput,
  type InternalAlertPayload,
  type ImagingStudyUpdateInput,
  type UserDirectoryEntryPayload,
  type ReferralDoctorSummaryPayload,
  type PrintableAnalyticsPayload,
  type PrintableInvoicePayload,
  type ReportInput,
  type PrintableReportPayload,
  type PrintableReceiptPayload,
  type ReportTemplatePayload,
  type SetupStatusPayload,
  type IntegrationDispatchRunPayload,
  type IntegrationDispatchStatusPayload,
  type NotificationInput,
  type OwnProfilePayload,
  type WorkflowPayload,
} from "@medilab/shared";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { recordAudit } from "./services/audit.js";
import {
  buildAttendanceWorkspace,
  recordAttendanceLogin,
  recordAttendanceLogout,
  saveAttendanceSettings,
} from "./services/attendance.js";
import {
  changeOwnPin,
  createLocalUser,
  deleteLocalUser,
  getSessionFromToken,
  listLocalUsers,
  loginWithPin,
  logoutSession,
  purgeExpiredSessions,
  rotateUserPin,
  setUserActiveState,
  unlockUser,
  updateOwnProfile,
} from "./services/auth.js";
import {
  createEncryptedBackup,
  importEncryptedBackup,
  restoreBackup,
} from "./services/backup.js";
import { buildLeveyJenningsSeries, evaluateWestgard } from "./services/qc.js";
import {
  ensureReportPdf,
  renderPrintableFinanceAnalyticsHtml,
  renderPrintableInvoiceHtml,
  readReportPdf,
  renderDraftPrintableReportHtml,
  renderPrintableReportHtml,
  renderPrintableReceiptHtml,
} from "./services/reports.js";
import {
  getAnonymousActor,
  getRequestSessionToken,
  hasCapability,
  hashPin,
  resolveActorContext,
  type ActorContext,
} from "./services/security.js";
import {
  getIntegrationDispatchStatus,
  runIntegrationDispatchCycle,
} from "./services/sync.js";
import {
  buildAccessionNumber,
  buildSampleLabel,
  resolvePatientTraceCode,
} from "./services/trace-code.js";

declare module "fastify" {
  interface FastifyRequest {
    actor: ActorContext;
  }
}

const configuredOrigins = (process.env.MEDILAB_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === "production";
const trustProxy = ["1", "true", "yes"].includes(
  (process.env.MEDILAB_TRUST_PROXY ?? "").toLowerCase(),
);
const cookieName = process.env.MEDILAB_SESSION_COOKIE_NAME ?? "medilab_session";
const cookieDomain = process.env.MEDILAB_SESSION_COOKIE_DOMAIN?.trim() || null;
const cookieSecure = ["1", "true", "yes"].includes(
  (
    process.env.MEDILAB_SESSION_COOKIE_SECURE ?? String(isProduction)
  ).toLowerCase(),
);
const cookieSameSite =
  process.env.MEDILAB_SESSION_COOKIE_SAMESITE?.trim() || "Lax";
const bundledWebDistEnv = process.env.MEDILAB_WEB_DIST?.trim() || "";
const bundledWebDist = bundledWebDistEnv
  ? isAbsolute(bundledWebDistEnv)
    ? bundledWebDistEnv
    : resolve(process.cwd(), bundledWebDistEnv)
  : "";
const serveBundledWeb = bundledWebDist.length > 0 && existsSync(bundledWebDist);

const app = Fastify({ logger: true, trustProxy });

function serializeSessionCookie(value: string, expiresAt: Date) {
  const parts = [
    `${cookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${cookieSameSite}`,
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))}`,
  ];

  if (cookieSecure) {
    parts.push("Secure");
  }

  if (cookieDomain) {
    parts.push(`Domain=${cookieDomain}`);
  }

  return parts.join("; ");
}

function clearSessionCookie() {
  const parts = [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${cookieSameSite}`,
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
  ];

  if (cookieSecure) {
    parts.push("Secure");
  }

  if (cookieDomain) {
    parts.push(`Domain=${cookieDomain}`);
  }

  return parts.join("; ");
}

await app.register(cors, {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (configuredOrigins.length === 0) {
      callback(null, !isProduction);
      return;
    }

    callback(null, configuredOrigins.includes(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["content-type"],
});

if (serveBundledWeb) {
  await app.register(fastifyStatic, {
    root: bundledWebDist,
    prefix: "/",
    decorateReply: true,
  });
}

app.addHook("onRequest", async (request) => {
  request.actor =
    request.url.startsWith("/api/auth") || request.url === "/health"
      ? getAnonymousActor()
      : await resolveActorContext(prisma, request);
});

function unauthorized(reply: {
  code: (value: number) => { send: (payload: unknown) => unknown };
}) {
  return reply.code(401).send({ message: "Authentication required." });
}

function deny(
  reply: { code: (value: number) => { send: (payload: unknown) => unknown } },
  capability: Capability,
) {
  return reply
    .code(403)
    .send({ message: `This action requires ${capability}.` });
}

function todayStart() {
  return new Date(new Date().setHours(0, 0, 0, 0));
}

function serializeFacility(
  facility:
    | {
        name: string;
        code: string;
        phone: string;
        email: string;
        location: string;
        logoDataUrl: string;
        footerMessage: string;
        printFontSize?: string;
      }
    | null
    | undefined,
): FacilityProfile {
  const printFontSize =
    facility?.printFontSize === "SMALL" ||
    facility?.printFontSize === "LARGE" ||
    facility?.printFontSize === "MEDIUM"
      ? facility.printFontSize
      : "MEDIUM";

  return {
    name: facility?.name ?? "MediLab Nexus Diagnostic Centre",
    code: facility?.code ?? "MLN-ACC",
    phone: facility?.phone ?? "",
    email: facility?.email ?? "",
    location: facility?.location ?? "",
    logoDataUrl: facility?.logoDataUrl ?? "",
    footerMessage:
      facility?.footerMessage ??
      "Thank you for choosing MediLab Nexus. Present your Trace Code whenever you contact the lab.",
    printFontSize,
  };
}

function serializeReportTemplate(template: {
  id: string;
  facilityId: string;
  name: string;
  templateKind: string;
  title: string;
  medicalHistory: string;
  summary: string;
  findings: string;
  impression: string;
  assistJson: string;
  createdByName: string;
  createdByRole: ReportTemplatePayload["createdByRole"];
  createdAt: Date;
  updatedAt: Date;
}): ReportTemplatePayload {
  return {
    id: template.id,
    facilityId: template.facilityId,
    name: template.name,
    templateKind: template.templateKind as ReportTemplatePayload["templateKind"],
    title: template.title,
    medicalHistory: template.medicalHistory,
    summary: template.summary,
    findings: template.findings,
    impression: template.impression,
    assist: reportTemplateInputSchema.shape.assist.parse(
      JSON.parse(template.assistJson || "{}"),
    ),
    createdByName: template.createdByName,
    createdByRole: template.createdByRole,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

async function resolveFacilityRecord(facilityId?: string | null) {
  if (facilityId?.trim()) {
    const actorFacility = await prisma.facility.findUnique({
      where: { id: facilityId },
    });
    if (actorFacility) {
      return actorFacility;
    }
  }

  return prisma.facility.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

function buildSetupStatusPayload(
  userCount: number,
  facility:
    | {
        name: string;
        code: string;
        phone: string;
        email: string;
        location: string;
        logoDataUrl: string;
        footerMessage: string;
        printFontSize?: string;
      }
    | null
    | undefined,
): SetupStatusPayload {
  return {
    requiresSetup: userCount === 0,
    hasUsers: userCount > 0,
    hasFacility: Boolean(facility),
    facility: serializeFacility(facility),
  };
}

async function resolveSetupStatus() {
  const [userCount, facility] = await Promise.all([
    prisma.appUser.count(),
    resolveFacilityRecord(),
  ]);

  return buildSetupStatusPayload(userCount, facility);
}

function buildSessionPayload(session: {
  sessionToken: string;
  expiresAt: Date;
  user: {
    id: string;
    facilityId: string;
    username: string;
    displayName: string;
    role: ActorContext["role"];
    allowedActions: Capability[];
  };
}) {
  return {
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt.toISOString(),
    user: {
      id: session.user.id,
      facilityId: session.user.facilityId,
      username: session.user.username,
      displayName: session.user.displayName,
      role: session.user.role,
      allowedActions: session.user.allowedActions,
    },
  };
}

function buildOwnProfilePayload(user: {
  id: string;
  facilityId: string;
  username: string;
  displayName: string;
  role: ActorContext["role"];
  pinChangedAt: Date;
  lastLoginAt: Date | null;
}): OwnProfilePayload {
  return {
    id: user.id,
    facilityId: user.facilityId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    pinChangedAt: user.pinChangedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

function sendSetupDatabaseUnavailable(reply: FastifyReply) {
  return reply.code(503).send({
    message:
      "Database setup is not ready. Confirm the PostgreSQL connection is valid and run the Prisma schema push for the configured database.",
  });
}

function serializeCatalogItem(service: {
  id: string;
  code: string;
  name: string;
  kind: "TEST" | "IMAGING";
  department: "LAB" | "IMAGING";
  specimenType: string | null;
  modality: string | null;
  priceCents: number;
  tatMinutes: number;
  rulesJson: string;
  isActive: boolean;
}): CatalogSeedItem {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    kind: service.kind,
    department: service.department,
    specimenType: service.specimenType,
    modality: service.modality,
    priceCents: service.priceCents,
    tatMinutes: service.tatMinutes,
    rulesJson: service.rulesJson,
    isActive: service.isActive,
  };
}

function serializeReferralDoctor(doctor: {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  referralAmountCents: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ReferralDoctorSummaryPayload {
  return {
    id: doctor.id,
    fullName: doctor.fullName,
    phone: doctor.phone,
    email: doctor.email,
    referralAmountCents: doctor.referralAmountCents,
    isActive: doctor.isActive,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}

function serializePatient(patient: {
  id: string;
  traceCode: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth?: Date | null;
  gender?: string | null;
  phone: string;
  location?: string | null;
  nhisId?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  consentAccepted?: boolean | null;
  photoPath?: string | null;
  createdAt: Date;
  referralDoctorId: string | null;
  referralName?: string | null;
  referralAmountCents?: number | null;
  referralDoctor?: {
    fullName: string;
    referralAmountCents: number;
  } | null;
}) {
  return {
    id: patient.id,
    traceCode: patient.traceCode,
    firstName: patient.firstName,
    middleName: patient.middleName ?? "",
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth
      ? patient.dateOfBirth.toISOString().slice(0, 10)
      : "",
    gender: patient.gender ?? "",
    phone: patient.phone,
    location: patient.location ?? "",
    nhisId: patient.nhisId ?? "",
    allergies: patient.allergies ?? "",
    medicalHistory: patient.medicalHistory ?? "",
    consentAccepted: patient.consentAccepted ?? false,
    photoPath: patient.photoPath ?? "",
    createdAt: patient.createdAt.toISOString(),
    referralDoctorId: patient.referralDoctorId,
    referralName: patient.referralName ?? "",
    referralDoctorName:
      patient.referralDoctor?.fullName ?? patient.referralName ?? null,
    referralAmountCents:
      patient.referralDoctor?.referralAmountCents ??
      patient.referralAmountCents ??
      null,
  };
}

function resolveReferralAmountCents(invoice: {
  patient: {
    referralDoctor?: { referralAmountCents: number } | null;
    referralAmountCents?: number | null;
  };
}) {
  return (
    invoice.patient.referralDoctor?.referralAmountCents ??
    invoice.patient.referralAmountCents ??
    null
  );
}

function prorateReferralAmountCents(
  referralAmountCents: number | null,
  numeratorCents: number,
  denominatorCents: number,
) {
  if (
    referralAmountCents == null ||
    referralAmountCents <= 0 ||
    denominatorCents <= 0 ||
    numeratorCents <= 0
  ) {
    return 0;
  }

  if (numeratorCents >= denominatorCents) {
    return referralAmountCents;
  }

  return Math.round((referralAmountCents * numeratorCents) / denominatorCents);
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function isUniqueConstraintError(error: unknown, field: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: string;
    meta?: { target?: unknown };
  };
  return (
    candidate.code === "P2002" &&
    Array.isArray(candidate.meta?.target) &&
    candidate.meta.target.includes(field)
  );
}

function serializeExpense(expense: {
  id: string;
  category: string;
  description: string;
  amountCents: number;
  incurredAt: Date;
  recordedBy: string;
  notes: string | null;
  createdAt: Date;
}): ExpenseSummaryPayload {
  return {
    id: expense.id,
    category: expense.category,
    description: expense.description,
    amountCents: expense.amountCents,
    incurredAt: expense.incurredAt.toISOString(),
    recordedBy: expense.recordedBy,
    notes: expense.notes,
    createdAt: expense.createdAt.toISOString(),
  };
}

function parseCustodyTrail(value: string) {
  try {
    const parsed = JSON.parse(value) as Array<{
      at?: string;
      action?: string;
      actor?: string;
      note?: string;
    }>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => typeof entry === "object" && entry !== null)
      .map((entry) => ({
        at: entry.at ?? new Date().toISOString(),
        action: entry.action ?? "UPDATED",
        actor: entry.actor ?? "Unknown",
        note: entry.note ?? "",
      }));
  } catch {
    return [];
  }
}

function serializeSample(sample: {
  id: string;
  patientId: string;
  orderId: string;
  traceLabel: string;
  specimenType: string;
  status: WorkflowPayload["samples"][number]["status"];
  collectedBy: string | null;
  collectedAt: Date | null;
  rejectionReason: string | null;
  chainOfCustodyJson: string;
  createdAt: Date;
  patient: {
    traceCode: string;
    firstName: string;
    lastName: string;
  };
}) {
  return {
    id: sample.id,
    patientId: sample.patientId,
    orderId: sample.orderId,
    patientTraceCode: sample.patient.traceCode,
    patientName: `${sample.patient.firstName} ${sample.patient.lastName}`,
    traceLabel: sample.traceLabel,
    specimenType: sample.specimenType,
    status: sample.status,
    collectedBy: sample.collectedBy,
    collectedAt: sample.collectedAt?.toISOString() ?? null,
    rejectionReason: sample.rejectionReason,
    chainOfCustody: parseCustodyTrail(sample.chainOfCustodyJson),
    createdAt: sample.createdAt.toISOString(),
  } satisfies WorkflowPayload["samples"][number];
}

function resolveOrderStatusFromSamples(
  statuses: string[],
): "REGISTERED" | "COLLECTED" | "IN_PROGRESS" | "REJECTED" {
  if (statuses.length > 0 && statuses.every((status) => status === "REJECTED")) {
    return "REJECTED";
  }

  if (
    statuses.some((status) =>
      ["RECEIVED", "PROCESSING", "STORED", "DISPOSED"].includes(status),
    )
  ) {
    return "IN_PROGRESS";
  }

  if (statuses.some((status) => ["COLLECTED", "RECEIVED"].includes(status))) {
    return "COLLECTED";
  }

  return "REGISTERED";
}

function resolveReportLifecycle(status: ReportInput["status"], signedBy: string) {
  const signableStatuses = new Set(["APPROVED", "RELEASED", "AMENDED"]);
  return {
    status,
    signedBy: signableStatuses.has(status) ? signedBy : null,
    signedAt: signableStatuses.has(status) ? new Date() : null,
    requiresPdf: signableStatuses.has(status),
    orderStatus:
      status === "DRAFT"
        ? ("IN_PROGRESS" as const)
        : status === "IN_REVIEW"
          ? ("READY_FOR_REVIEW" as const)
          : ("VERIFIED" as const),
    auditAction:
      status === "DRAFT"
        ? "REPORT_DRAFTED"
        : status === "IN_REVIEW"
          ? "REPORT_SUBMITTED"
          : status === "RELEASED"
            ? "REPORT_RELEASED"
            : status === "AMENDED"
              ? "REPORT_AMENDED"
              : "REPORT_APPROVED",
  };
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function resolveAnalyticsRange(query: {
  range?: string;
}): (typeof analyticsRangeKeys)[number] {
  const value = query.range?.trim().toUpperCase();
  return analyticsRangeKeys.includes(
    value as (typeof analyticsRangeKeys)[number],
  )
    ? (value as (typeof analyticsRangeKeys)[number])
    : "30D";
}

function resolveAnalyticsWindow(query: {
  range?: string;
  startDate?: string;
  endDate?: string;
}) {
  const range = resolveAnalyticsRange(query);
  const today = new Date();

  if (range === "ALL") {
    return {
      range,
      start: null,
      end: null,
      customStartDate: null,
      customEndDate: null,
    };
  }

  if (range === "TODAY") {
    return {
      range,
      start: startOfDay(today),
      end: endOfDay(today),
      customStartDate: null,
      customEndDate: null,
    };
  }

  if (range === "YESTERDAY") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      range,
      start: startOfDay(yesterday),
      end: endOfDay(yesterday),
      customStartDate: null,
      customEndDate: null,
    };
  }

  if (range === "CUSTOM") {
    const rawStart = normalizeDateInput(query.startDate);
    const rawEnd = normalizeDateInput(query.endDate);
    const start = rawStart ? startOfDay(rawStart) : null;
    const end = rawEnd ? endOfDay(rawEnd) : null;

    return {
      range,
      start,
      end,
      customStartDate: start ? start.toISOString() : null,
      customEndDate: end ? end.toISOString() : null,
    };
  }

  const days = range === "7D" ? 7 : 30;
  const start = startOfDay(
    new Date(Date.now() - 1000 * 60 * 60 * 24 * (days - 1)),
  );

  return {
    range,
    start,
    end: endOfDay(today),
    customStartDate: null,
    customEndDate: null,
  };
}

function normalizeDateInput(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePayerType(
  payerType: string | undefined,
  insuranceAuthorized: boolean,
  insuranceProvider?: string,
) {
  if (payerType === "NHIS") {
    return PayerType.NHIS;
  }
  if (payerType === "INSURANCE") {
    return PayerType.INSURANCE;
  }
  if (payerType === "CORPORATE") {
    return PayerType.CORPORATE;
  }
  if (insuranceAuthorized || insuranceProvider?.trim()) {
    return PayerType.INSURANCE;
  }
  return PayerType.SELF_PAY;
}

function normalizeCoveragePercent(
  payerType: PayerType,
  coveragePercent: number,
  insuranceAuthorized: boolean,
) {
  if (payerType === PayerType.SELF_PAY) {
    return 0;
  }

  const fallback = insuranceAuthorized ? 40 : 0;
  const resolved = Number.isFinite(coveragePercent) ? coveragePercent : fallback;
  return Math.max(0, Math.min(100, Math.round(resolved)));
}

function summarizeInvoiceSettlement(invoice: {
  status: InvoiceStatus;
  patientResponsibilityCents: number;
  payerResponsibilityCents: number;
  subtotalCents?: number;
  discountCents?: number;
  insuranceCoveredCents?: number;
  amountPaidCents?: number;
  payments: Array<{
    amountCents: number;
    responsibility: PaymentResponsibility;
  }>;
}) {
  const patientPaidCents = invoice.payments.reduce(
    (sum, payment) =>
      payment.responsibility === PaymentResponsibility.PATIENT
        ? sum + payment.amountCents
        : sum,
    0,
  );
  const payerPaidCents = invoice.payments.reduce(
    (sum, payment) =>
      payment.responsibility === PaymentResponsibility.PAYER
        ? sum + payment.amountCents
        : sum,
    0,
  );
  const declaredTotalDueCents =
    invoice.patientResponsibilityCents + invoice.payerResponsibilityCents;
  const legacyTotalDueCents = Math.max(
    0,
    (invoice.subtotalCents ?? 0) -
      (invoice.discountCents ?? 0) -
      (invoice.insuranceCoveredCents ?? 0),
  );
  const totalDueCents =
    declaredTotalDueCents > 0 ? declaredTotalDueCents : legacyTotalDueCents;
  const recordedTotalPaidCents = patientPaidCents + payerPaidCents;
  const totalPaidCents = Math.max(
    recordedTotalPaidCents,
    invoice.amountPaidCents ?? 0,
    invoice.status === InvoiceStatus.PAID && totalDueCents > 0 ? totalDueCents : 0,
  );
  const patientBalanceCents = Math.max(
    0,
    invoice.patientResponsibilityCents - patientPaidCents,
  );
  const payerBalanceCents = Math.max(
    0,
    invoice.payerResponsibilityCents - payerPaidCents,
  );
  const totalBalanceCents = Math.max(0, totalDueCents - totalPaidCents);
  const status =
    invoice.status === InvoiceStatus.VOID
      ? InvoiceStatus.VOID
      : totalBalanceCents === 0
        ? InvoiceStatus.PAID
        : totalPaidCents > 0
          ? InvoiceStatus.PARTIAL
          : InvoiceStatus.OPEN;

  return {
    patientPaidCents,
    payerPaidCents,
    totalDueCents,
    totalPaidCents,
    patientBalanceCents,
    payerBalanceCents,
    totalBalanceCents,
    status,
  };
}

function resolveClaimSettlementStatus(
  currentStatus: ClaimStatus,
  payerResponsibilityCents: number,
  payerPaidCents: number,
) {
  if (payerResponsibilityCents === 0) {
    return ClaimStatus.NOT_APPLICABLE;
  }
  if (payerPaidCents >= payerResponsibilityCents) {
    return ClaimStatus.SETTLED;
  }
  if (
    payerPaidCents > 0 &&
    currentStatus !== ClaimStatus.REJECTED &&
    currentStatus !== ClaimStatus.SETTLED
  ) {
    return ClaimStatus.PARTIAL;
  }
  return currentStatus;
}

async function buildExpenseWorkspace(
  actor: { facilityId: string },
  query: {
    range?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<ExpenseWorkspacePayload> {
  const analyticsWindow = resolveAnalyticsWindow(query);
  const { range } = analyticsWindow;
  const selectedCategory = query.category?.trim();
  const startDate = normalizeDateInput(query.startDate);
  const endDate = normalizeDateInput(query.endDate);
  const startBoundary = startDate
    ? startOfDay(startDate)
    : analyticsWindow.start;
  const endBoundary = endDate ? endOfDay(endDate) : analyticsWindow.end;

  const rangeExpenses = await prisma.expenseRecord.findMany({
    where: {
      facilityId: actor.facilityId,
      ...((startBoundary || endBoundary)
        ? {
            incurredAt: {
              ...(startBoundary ? { gte: startBoundary } : {}),
              ...(endBoundary ? { lte: endBoundary } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
  });
  const filteredExpenses = rangeExpenses.filter((expense) => {
    const matchesCategory =
      !selectedCategory || selectedCategory === "ALL"
        ? true
        : expense.category === selectedCategory;
    const matchesStart = !startBoundary || expense.incurredAt >= startBoundary;
    const matchesEnd = !endBoundary || expense.incurredAt <= endBoundary;
    return matchesCategory && matchesStart && matchesEnd;
  });

  const categoryMap = new Map<
    string,
    { category: string; totalCents: number; count: number }
  >();
  filteredExpenses.forEach((expense) => {
    const current = categoryMap.get(expense.category) ?? {
      category: expense.category,
      totalCents: 0,
      count: 0,
    };
    current.totalCents += expense.amountCents;
    current.count += 1;
    categoryMap.set(expense.category, current);
  });

  return {
    generatedAt: new Date().toISOString(),
    range,
    availableCategories: [
      ...new Set(rangeExpenses.map((expense) => expense.category)),
    ].sort((left, right) => left.localeCompare(right)),
    summary: {
      totalCents: filteredExpenses.reduce(
        (sum, expense) => sum + expense.amountCents,
        0,
      ),
      entryCount: filteredExpenses.length,
    },
    categories: [...categoryMap.values()].sort(
      (left, right) => right.totalCents - left.totalCents,
    ),
    expenses: filteredExpenses.slice(0, 100).map(serializeExpense),
  };
}

function buildCatalogItemData(payload: {
  code: string;
  name: string;
  kind: "TEST" | "IMAGING";
  specimenType?: string;
  modality?: string;
  priceCents: number;
  tatMinutes: number;
  isActive: boolean;
}): {
  code: string;
  name: string;
  kind: CatalogKind;
  department: Department;
  specimenType: string | null;
  modality: string | null;
  priceCents: number;
  tatMinutes: number;
  isActive: boolean;
  rulesJson: string;
} {
  const kind =
    payload.kind === "IMAGING" ? CatalogKind.IMAGING : CatalogKind.TEST;
  const department =
    kind === CatalogKind.IMAGING ? Department.IMAGING : Department.LAB;
  return {
    code: payload.code.trim().toUpperCase(),
    name: payload.name.trim(),
    kind,
    department,
    specimenType:
      kind === CatalogKind.TEST ? payload.specimenType || "General" : null,
    modality:
      kind === CatalogKind.IMAGING ? payload.modality || "Ultrasound" : null,
    priceCents: payload.priceCents,
    tatMinutes: payload.tatMinutes,
    isActive: payload.isActive,
    rulesJson:
      kind === CatalogKind.IMAGING
        ? JSON.stringify({
            template: "custom",
            dicom: true,
            measurements: true,
          })
        : JSON.stringify({
            reflex: [],
            deltaCheck: false,
            autoValidate: false,
          }),
  };
}

async function ensureCatalogItemsForOrderSelection(itemIds: string[]) {
  const normalizedItemIds = itemIds.map((itemId) => itemId.trim().toUpperCase());
  let catalogItems = await prisma.catalogItem.findMany({
    where: {
      OR: [{ id: { in: itemIds } }, { code: { in: normalizedItemIds } }],
    },
  });

  const existingKeys = new Set(
    catalogItems.flatMap((item) => [item.id, item.code.trim().toUpperCase()]),
  );
  const missingSeedItems = catalogSeed.filter(
    (item) =>
      normalizedItemIds.includes(item.code.trim().toUpperCase()) &&
      !existingKeys.has(item.code.trim().toUpperCase()),
  );

  if (missingSeedItems.length > 0) {
    await prisma.$transaction(
      missingSeedItems.map((item) =>
        prisma.catalogItem.upsert({
          where: { code: item.code.trim().toUpperCase() },
          update: {
            ...buildCatalogItemData({
              code: item.code,
              name: item.name,
              kind: item.kind,
              specimenType: item.specimenType ?? "",
              modality: item.modality ?? "",
              priceCents: item.priceCents,
              tatMinutes: item.tatMinutes,
              isActive: item.isActive ?? true,
            }),
          },
          create: buildCatalogItemData({
            code: item.code,
            name: item.name,
            kind: item.kind,
            specimenType: item.specimenType ?? "",
            modality: item.modality ?? "",
            priceCents: item.priceCents,
            tatMinutes: item.tatMinutes,
            isActive: item.isActive ?? true,
          }),
        }),
      ),
    );

    catalogItems = await prisma.catalogItem.findMany({
      where: {
        OR: [{ id: { in: itemIds } }, { code: { in: normalizedItemIds } }],
      },
    });
  }

  return catalogItems;
}

async function recordDispatchEvent(
  entityType: string,
  entityId: string,
  payload: unknown,
) {
  await prisma.syncEvent.create({
    data: {
      entityType,
      entityId,
      operation: "UPSERT",
      payload: JSON.stringify(payload),
      status: "PENDING_SYNC",
    },
  });
}

async function recordDeleteDispatchEvent(
  entityType: string,
  entityId: string,
  payload: unknown,
) {
  await prisma.syncEvent.create({
    data: {
      entityType,
      entityId,
      operation: "DELETE",
      payload: JSON.stringify(payload),
      status: "PENDING_SYNC",
    },
  });
}

async function buildAdminOverview(
  actor: ActorContext,
): Promise<AdminOverviewPayload> {
  const start = todayStart();
  const [
    qcTodayCount,
    qcBreaches,
    qcHistory,
    maintenanceEvents,
    inventoryItems,
    notifications,
    backups,
    auditTrail,
    invoices,
    payments,
    pendingDispatches,
  ] = await Promise.all([
    prisma.qualityControlEvent.count({ where: { occurredAt: { gte: start } } }),
    prisma.qualityControlEvent.findMany({
      where: { status: { not: "PASS" } },
      orderBy: { occurredAt: "desc" },
      take: 6,
    }),
    prisma.qualityControlEvent.findMany({
      orderBy: { occurredAt: "asc" },
      take: 10,
    }),
    prisma.maintenanceEvent.findMany({
      include: { instrument: true },
      where: {
        OR: [
          { status: { in: ["DUE", "OVERDUE"] } },
          {
            nextDueAt: { lte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
          },
        ],
      },
      orderBy: { nextDueAt: "asc" },
      take: 6,
    }),
    prisma.inventoryItem.findMany({
      orderBy: [{ quantityOnHand: "asc" }, { expiryDate: "asc" }],
      take: 24,
    }),
    prisma.notificationQueue.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.backupSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.invoice.findMany({
      include: {
        payments: true,
        patient: {
          include: {
            referralDoctor: true,
          },
        },
      },
    }),
    prisma.paymentRecord.findMany({ where: { createdAt: { gte: start } } }),
    prisma.syncEvent.count({
      where: { status: { in: ["PENDING_SYNC", "FAILED", "CONFLICT"] } },
    }),
  ]);

  const lowStock = inventoryItems
    .filter((item) => item.quantityOnHand <= item.reorderLevel)
    .slice(0, 6);
  const expiringSoon = inventoryItems
    .filter(
      (item) =>
        item.expiryDate &&
        item.expiryDate <= new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
    )
    .slice(0, 6);

  const paymentMixMap = new Map<
    string,
    { totalCents: number; count: number }
  >();
  for (const payment of payments) {
    const current = paymentMixMap.get(payment.method) ?? {
      totalCents: 0,
      count: 0,
    };
    current.totalCents += payment.amountCents;
    current.count += 1;
    paymentMixMap.set(payment.method, current);
  }

  const revenueTodayCents = payments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0,
  );
  const outstandingCents = invoices.reduce(
    (sum, invoice) =>
      sum + Math.max(0, invoice.amountDueCents - invoice.amountPaidCents),
    0,
  );
  const referralAmountEarnedCents = invoices.reduce(
    (sum, invoice) =>
      sum +
      prorateReferralAmountCents(
        resolveReferralAmountCents(invoice),
        invoice.amountPaidCents,
        invoice.amountDueCents,
      ),
    0,
  );
  const referralAmountOutstandingCents = invoices.reduce(
    (sum, invoice) =>
      sum +
      prorateReferralAmountCents(
        resolveReferralAmountCents(invoice),
        Math.max(0, invoice.amountDueCents - invoice.amountPaidCents),
        invoice.amountDueCents,
      ),
    0,
  );
  const referralLeaderMap = new Map<
    string,
    {
      doctorName: string;
      defaultReferralAmountCents: number;
      invoicesCount: number;
      revenueCents: number;
      referralDueCents: number;
      referralOutstandingCents: number;
    }
  >();
  for (const invoice of invoices) {
    const doctor = invoice.patient.referralDoctor;
    if (!doctor) {
      continue;
    }

    const referralDueCents = resolveReferralAmountCents(invoice) ?? 0;
    const referralOutstandingForInvoice = prorateReferralAmountCents(
      referralDueCents,
      Math.max(0, invoice.amountDueCents - invoice.amountPaidCents),
      invoice.amountDueCents,
    );
    const current = referralLeaderMap.get(doctor.id) ?? {
      doctorName: doctor.fullName,
      defaultReferralAmountCents: doctor.referralAmountCents,
      invoicesCount: 0,
      revenueCents: 0,
      referralDueCents: 0,
      referralOutstandingCents: 0,
    };
    current.invoicesCount += 1;
    current.revenueCents += invoice.amountPaidCents;
    current.referralDueCents += referralDueCents;
    current.referralOutstandingCents += referralOutstandingForInvoice;
    referralLeaderMap.set(doctor.id, current);
  }
  const pendingReview = qcBreaches.length;

  return {
    actor: {
      displayName: actor.displayName,
      role: actor.role,
      allowedActions: actor.allowedActions,
    },
    qc: {
      todayCount: qcTodayCount,
      pendingReview,
      breaches: qcBreaches.map((event) => ({
        analyte: event.analyte,
        instrumentName: event.instrumentName,
        rules: JSON.parse(event.westgardViolationsJson) as string[],
        observedValue: event.observedValue,
        meanValue: event.meanValue,
        standardDeviation: event.standardDeviation,
        occurredAt: event.occurredAt.toISOString(),
      })),
      leveyJennings: buildLeveyJenningsSeries(
        qcHistory.map((entry) => ({
          observedValue: entry.observedValue,
          meanValue: entry.meanValue,
          standardDeviation: entry.standardDeviation,
          occurredAt: entry.occurredAt,
        })),
      ),
    },
    maintenance: maintenanceEvents.map((event) => ({
      instrumentName: event.instrument.name,
      category: event.instrument.category,
      nextDueAt: event.nextDueAt.toISOString(),
      status: event.status,
      assignedTo: event.assignedTo,
    })),
    inventory: {
      lowStock: lowStock.map((item) => ({
        id: item.id,
        name: item.name,
        quantityOnHand: item.quantityOnHand,
        reorderLevel: item.reorderLevel,
        unit: item.unit,
      })),
      expiringSoon: expiringSoon.map((item) => ({
        id: item.id,
        name: item.name,
        expiryDate: item.expiryDate?.toISOString() ?? new Date().toISOString(),
        quantityOnHand: item.quantityOnHand,
      })),
      reorderSuggestions: lowStock.map((item) => ({
        id: item.id,
        name: item.name,
        recommendedOrder: Math.max(
          item.reorderLevel * 2 - item.quantityOnHand,
          item.reorderLevel,
        ),
        unit: item.unit,
      })),
    },
    finance: {
      revenueTodayCents,
      outstandingCents,
      invoicesOpen: invoices.filter(
        (invoice) => invoice.status !== "PAID" && invoice.status !== "VOID",
      ).length,
      referralAmountEarnedCents,
      referralAmountOutstandingCents,
      paymentMix: [...paymentMixMap.entries()].map(([method, data]) => ({
        method,
        ...data,
      })),
      referralLeaders: [...referralLeaderMap.values()]
        .sort(
          (left, right) => right.referralDueCents - left.referralDueCents,
        )
        .slice(0, 5),
    },
    notifications: {
      queued: notifications.filter((item) => item.status === "QUEUED").length,
      items: notifications.map((item) => ({
        channel: item.channel,
        recipient: item.recipient,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        message: item.message,
      })),
    },
    backups: {
      lastSnapshotAt: backups[0]?.createdAt.toISOString() ?? null,
      snapshotCount: backups.length,
      encrypted: backups.every((item) => item.encrypted),
    },
    auditTrail: auditTrail.map((item) => ({
      action: item.action,
      entityType: item.entityType,
      traceCode: item.traceCode,
      role: item.actorRole,
      createdAt: item.createdAt.toISOString(),
      summary: item.summary,
    })),
    integrations: [
      {
        name: "Analyzer HL7/ASTM Bridge",
        status: "Ready",
        note: "Analyzer interface is ready for HL7 and ASTM result exchange.",
      },
      {
        name: "Ultrasound DICOM Store",
        status: "Ready",
        note: "DICOM retention is available for connected imaging workflows.",
      },
      {
        name: "Finance Export Connector",
        status: "Planned",
        note: "Ledger export connector can dispatch accounting payloads to external finance systems.",
      },
      {
        name: "Notification Gateway",
        status: "Queued",
        note: "WhatsApp, SMS, and email notifications are retained until the gateway confirms dispatch.",
      },
    ],
    aiFlags: [
      ...(pendingReview > 0
        ? [
            {
              title: "QC review required",
              severity: "high" as const,
              note: `${pendingReview} QC run(s) breached Westgard thresholds.`,
            },
          ]
        : []),
      ...(maintenanceEvents.some((event) => event.status === "OVERDUE")
        ? [
            {
              title: "Maintenance overdue",
              severity: "high" as const,
              note: "One or more instruments have overdue calibration or maintenance.",
            },
          ]
        : []),
      ...(pendingDispatches > 5
        ? [
            {
              title: "Dispatch backlog rising",
              severity: "medium" as const,
              note: `${pendingDispatches} outbound records are waiting for integration delivery.`,
            },
          ]
        : []),
      ...(expiringSoon.length > 0
        ? [
            {
              title: "Expiry watchlist",
              severity: "low" as const,
              note: `${expiringSoon.length} stocked item(s) are approaching expiry.`,
            },
          ]
        : []),
    ],
  };
}

async function buildFinanceAnalytics(
  actor: ActorContext,
  query: {
    range?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<FinanceAnalyticsPayload> {
  const analyticsWindow = resolveAnalyticsWindow(query);
  const catalogItems = await prisma.catalogItem.findMany({
    select: {
      name: true,
      department: true,
      kind: true,
    },
  });
  const catalogMetadataByName = new Map(
    catalogItems.map((item) => [
      item.name,
      {
        department: item.department,
        kind: item.kind,
      },
    ]),
  );
  const invoices = await prisma.invoice.findMany({
    where: {
      patient: {
        facilityId: actor.facilityId,
      },
      ...((analyticsWindow.start || analyticsWindow.end)
        ? {
            createdAt: {
              ...(analyticsWindow.start ? { gte: analyticsWindow.start } : {}),
              ...(analyticsWindow.end ? { lte: analyticsWindow.end } : {}),
            },
          }
        : {}),
    },
    include: {
      lines: true,
      payments: true,
      patient: {
        include: {
          referralDoctor: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const expenses = await prisma.expenseRecord.findMany({
    where: {
      facilityId: actor.facilityId,
      ...((analyticsWindow.start || analyticsWindow.end)
        ? {
            incurredAt: {
              ...(analyticsWindow.start ? { gte: analyticsWindow.start } : {}),
              ...(analyticsWindow.end ? { lte: analyticsWindow.end } : {}),
            },
          }
        : {}),
    },
    orderBy: { incurredAt: "desc" },
  });
  const inventoryAudits = await prisma.auditLog.findMany({
    where: {
      action: "INVENTORY_UPDATED",
      ...((analyticsWindow.start || analyticsWindow.end)
        ? {
            createdAt: {
              ...(analyticsWindow.start ? { gte: analyticsWindow.start } : {}),
              ...(analyticsWindow.end ? { lte: analyticsWindow.end } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const payments = invoices.flatMap((invoice) =>
    invoice.payments.filter((payment) =>
      (!analyticsWindow.start || payment.createdAt >= analyticsWindow.start) &&
      (!analyticsWindow.end || payment.createdAt <= analyticsWindow.end),
    ),
  );
  const invoiceSettlementMap = new Map(
    invoices.map((invoice) => [invoice.id, summarizeInvoiceSettlement(invoice)]),
  );
  const grossBilledCents = invoices.reduce(
    (sum, invoice) => sum + invoice.subtotalCents,
    0,
  );
  const netDueCents = invoices.reduce(
    (sum, invoice) =>
      sum + (invoiceSettlementMap.get(invoice.id)?.totalDueCents ?? 0),
    0,
  );
  const collectedCents = payments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0,
  );
  const outstandingCents = invoices.reduce(
    (sum, invoice) =>
      sum + (invoiceSettlementMap.get(invoice.id)?.totalBalanceCents ?? 0),
    0,
  );
  const discountCents = invoices.reduce(
    (sum, invoice) => sum + invoice.discountCents,
    0,
  );
  const insuranceCoveredCents = invoices.reduce(
    (sum, invoice) => sum + invoice.insuranceCoveredCents,
    0,
  );
  const expenseCents = expenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0,
  );
  const netProfitCents = collectedCents - expenseCents;
  const averageInvoiceCents = invoices.length
    ? Math.round(netDueCents / invoices.length)
    : 0;
  const averagePaymentCents = payments.length
    ? Math.round(collectedCents / payments.length)
    : 0;
  const collectionRatePercent = netDueCents
    ? Number(((collectedCents / netDueCents) * 100).toFixed(2))
    : 0;
  const referralAmountDueCents = invoices.reduce((sum, invoice) => {
    const settlement = invoiceSettlementMap.get(invoice.id);
    return (
      sum +
      (resolveReferralAmountCents(invoice) ?? 0) *
        Number(Boolean(settlement && settlement.totalDueCents > 0))
    );
  }, 0);
  const referralAmountOutstandingCents = invoices.reduce((sum, invoice) => {
    const settlement = invoiceSettlementMap.get(invoice.id);
    return (
      sum +
      prorateReferralAmountCents(
        resolveReferralAmountCents(invoice),
        settlement?.totalBalanceCents ?? 0,
        settlement?.totalDueCents ?? 0,
      )
    );
  }, 0);

  const invoiceStatusMap = new Map<
    string,
    {
      status: string;
      count: number;
      totalDueCents: number;
      outstandingCents: number;
    }
  >();
  for (const invoice of invoices) {
    const settlement = invoiceSettlementMap.get(invoice.id);
    const current = invoiceStatusMap.get(invoice.status) ?? {
      status: invoice.status,
      count: 0,
      totalDueCents: 0,
      outstandingCents: 0,
    };
    current.count += 1;
    current.totalDueCents += settlement?.totalDueCents ?? 0;
    current.outstandingCents += settlement?.totalBalanceCents ?? 0;
    invoiceStatusMap.set(invoice.status, current);
  }

  const paymentMixMap = new Map<
    string,
    { method: string; totalCents: number; count: number }
  >();
  const payerMixMap = new Map<
    string,
    FinanceAnalyticsPayload["payerMix"][number]
  >();
  const claimStatusMap = new Map<
    FinanceAnalyticsPayload["claimStatus"][number]["claimStatus"],
    FinanceAnalyticsPayload["claimStatus"][number]
  >();
  for (const payment of payments) {
    const current = paymentMixMap.get(payment.method) ?? {
      method: payment.method,
      totalCents: 0,
      count: 0,
    };
    current.totalCents += payment.amountCents;
    current.count += 1;
    paymentMixMap.set(payment.method, current);
  }

  for (const invoice of invoices) {
    const settlement = invoiceSettlementMap.get(invoice.id);
    const payerKey = `${invoice.payerType}:${invoice.payerName ?? "Unassigned"}`;
    const payerEntry = payerMixMap.get(payerKey) ?? {
      payerType: invoice.payerType,
      payerName: invoice.payerName ?? "Unassigned",
      invoicesCount: 0,
      coveredCents: 0,
      outstandingCents: 0,
    };
    payerEntry.invoicesCount += 1;
    payerEntry.coveredCents += invoice.payerResponsibilityCents;
    payerEntry.outstandingCents += settlement?.payerBalanceCents ?? 0;
    payerMixMap.set(payerKey, payerEntry);

    const claimEntry = claimStatusMap.get(invoice.claimStatus) ?? {
      claimStatus: invoice.claimStatus,
      invoicesCount: 0,
      coveredCents: 0,
      outstandingCents: 0,
    };
    claimEntry.invoicesCount += 1;
    claimEntry.coveredCents += invoice.payerResponsibilityCents;
    claimEntry.outstandingCents += settlement?.payerBalanceCents ?? 0;
    claimStatusMap.set(invoice.claimStatus, claimEntry);
  }

  const agingBuckets = [
    { label: "0-7 days", min: 0, max: 7 },
    { label: "8-30 days", min: 8, max: 30 },
    { label: "31-60 days", min: 31, max: 60 },
    { label: "61-90 days", min: 61, max: 90 },
    { label: "90+ days", min: 91, max: Number.POSITIVE_INFINITY },
  ].map((bucket) => ({
    label: bucket.label,
    invoiceCount: 0,
    balanceCents: 0,
  }));
  for (const invoice of invoices) {
    const balanceCents =
      invoiceSettlementMap.get(invoice.id)?.totalBalanceCents ?? 0;
    if (balanceCents === 0) {
      continue;
    }
    const ageDays = Math.max(
      0,
      Math.floor(
        (Date.now() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    const bucketIndex =
      ageDays <= 7
        ? 0
        : ageDays <= 30
          ? 1
          : ageDays <= 60
            ? 2
            : ageDays <= 90
              ? 3
              : 4;
    const bucket = agingBuckets[bucketIndex];
    if (!bucket) {
      continue;
    }
    bucket.invoiceCount += 1;
    bucket.balanceCents += balanceCents;
  }

  const monthlyCollectionsMap = new Map<
    string,
    {
      label: string;
      billedCents: number;
      collectedCents: number;
      monthOrder: number;
    }
  >();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthlyCollectionsMap.set(key, {
      label: date.toLocaleString("en-US", { month: "short", year: "numeric" }),
      billedCents: 0,
      collectedCents: 0,
      monthOrder: date.getFullYear() * 12 + date.getMonth(),
    });
  }
  for (const invoice of invoices) {
    const key = `${invoice.createdAt.getFullYear()}-${invoice.createdAt.getMonth()}`;
    const month = monthlyCollectionsMap.get(key);
    if (month) {
      month.billedCents += invoiceSettlementMap.get(invoice.id)?.totalDueCents ?? 0;
    }
  }
  for (const payment of payments) {
    const key = `${payment.createdAt.getFullYear()}-${payment.createdAt.getMonth()}`;
    const month = monthlyCollectionsMap.get(key);
    if (month) {
      month.collectedCents += payment.amountCents;
    }
  }

  const serviceMap = new Map<
    string,
    {
      description: string;
      quantity: number;
      revenueCents: number;
      invoicesCount: number;
    }
  >();
  const studyPerformanceMap = new Map<
    string,
    FinanceAnalyticsPayload["studyPerformance"][number] & {
      trendMap: Map<
        string,
        FinanceAnalyticsPayload["studyPerformance"][number]["trend"][number] & {
          monthOrder: number;
        }
      >;
    }
  >();
  const monthTemplates = [...monthlyCollectionsMap.entries()].map(
    ([key, month]) => ({
      key,
      label: month.label,
      monthOrder: month.monthOrder,
    }),
  );
  const ensureStudyPerformance = (description: string) => {
    const existing = studyPerformanceMap.get(description);
    if (existing) {
      return existing;
    }

    const trendMap = new Map<
      string,
      FinanceAnalyticsPayload["studyPerformance"][number]["trend"][number] & {
        monthOrder: number;
      }
    >();
    for (const template of monthTemplates) {
      trendMap.set(template.key, {
        label: template.label,
        quantity: 0,
        billedCents: 0,
        collectedCents: 0,
        outstandingCents: 0,
        invoicesCount: 0,
        monthOrder: template.monthOrder,
      });
    }

    const metadata = catalogMetadataByName.get(description) ?? {
      department: Department.IMAGING,
      kind: CatalogKind.IMAGING,
    };
    const next = {
      description,
      department: metadata.department,
      kind: metadata.kind,
      quantity: 0,
      billedCents: 0,
      collectedCents: 0,
      outstandingCents: 0,
      invoicesCount: 0,
      averageBilledCents: 0,
      growthRatePercent: 0,
      trend: [],
      trendMap,
    };
    studyPerformanceMap.set(description, next);
    return next;
  };
  for (const invoice of invoices) {
    const settlement = invoiceSettlementMap.get(invoice.id);
    const subtotalCents = Math.max(invoice.subtotalCents, 0);
    const amountDueCents = Math.max(settlement?.totalDueCents ?? 0, 0);
    const amountPaidCents = Math.max(settlement?.totalPaidCents ?? 0, 0);
    const invoiceMonthKey = `${invoice.createdAt.getFullYear()}-${invoice.createdAt.getMonth()}`;

    for (const line of invoice.lines) {
      const current = serviceMap.get(line.description) ?? {
        description: line.description,
        quantity: 0,
        revenueCents: 0,
        invoicesCount: 0,
      };
      current.quantity += line.quantity;
      current.revenueCents += line.totalPriceCents;
      current.invoicesCount += 1;
      serviceMap.set(line.description, current);

      const study = ensureStudyPerformance(line.description);
      const lineShare =
        subtotalCents > 0 ? line.totalPriceCents / subtotalCents : 0;
      const lineBilledCents = line.totalPriceCents;
      const lineDueCents = Math.round(amountDueCents * lineShare);
      const lineCollectedCents = Math.min(
        lineDueCents,
        Math.round(amountPaidCents * lineShare),
      );
      const lineOutstandingCents = Math.max(
        0,
        lineDueCents - lineCollectedCents,
      );

      study.quantity += line.quantity;
      study.billedCents += lineBilledCents;
      study.collectedCents += lineCollectedCents;
      study.outstandingCents += lineOutstandingCents;
      study.invoicesCount += 1;

      const studyMonth = study.trendMap.get(invoiceMonthKey);
      if (studyMonth) {
        studyMonth.quantity += line.quantity;
        studyMonth.billedCents += lineBilledCents;
        studyMonth.collectedCents += lineCollectedCents;
        studyMonth.outstandingCents += lineOutstandingCents;
        studyMonth.invoicesCount += 1;
      }
    }
  }
  const studyPerformance = [...studyPerformanceMap.values()]
    .map(({ trendMap, trend, ...study }) => {
      const trendEntries = [...trendMap.values()].sort(
        (left, right) => left.monthOrder - right.monthOrder,
      );
      const midpoint = Math.max(1, Math.floor(trendEntries.length / 2));
      const firstHalfBilledCents = trendEntries
        .slice(0, midpoint)
        .reduce((sum, month) => sum + month.billedCents, 0);
      const secondHalfBilledCents = trendEntries
        .slice(midpoint)
        .reduce((sum, month) => sum + month.billedCents, 0);

      return {
        ...study,
        averageBilledCents: study.invoicesCount
          ? Math.round(study.billedCents / study.invoicesCount)
          : 0,
        growthRatePercent:
          firstHalfBilledCents > 0
            ? Number(
                (
                  ((secondHalfBilledCents - firstHalfBilledCents) /
                    firstHalfBilledCents) *
                  100
                ).toFixed(2),
              )
            : secondHalfBilledCents > 0
              ? 100
              : 0,
        trend: trendEntries.map(({ monthOrder, ...month }) => month),
      };
    })
    .sort((left, right) => {
      if (right.billedCents !== left.billedCents) {
        return right.billedCents - left.billedCents;
      }
      return left.description.localeCompare(right.description);
    });

  const referrerMap = new Map<
    string,
    {
      doctorName: string;
      defaultReferralAmountCents: number;
      invoicesCount: number;
      billedCents: number;
      collectedCents: number;
      outstandingCents: number;
      referralDueCents: number;
    }
  >();
  for (const invoice of invoices) {
    const doctor = invoice.patient.referralDoctor;
    if (!doctor) {
      continue;
    }
    const settlement = invoiceSettlementMap.get(invoice.id);
    const current = referrerMap.get(doctor.id) ?? {
      doctorName: doctor.fullName,
      defaultReferralAmountCents: doctor.referralAmountCents,
      invoicesCount: 0,
      billedCents: 0,
      collectedCents: 0,
      outstandingCents: 0,
      referralDueCents: 0,
    };
    current.invoicesCount += 1;
    current.billedCents += settlement?.totalDueCents ?? 0;
    current.collectedCents += settlement?.totalPaidCents ?? 0;
    current.outstandingCents += settlement?.totalBalanceCents ?? 0;
    current.referralDueCents += resolveReferralAmountCents(invoice) ?? 0;
    referrerMap.set(doctor.id, current);
  }

  const expenseCategoryMap = new Map<
    string,
    { category: string; totalCents: number; count: number }
  >();
  for (const expense of expenses) {
    const current = expenseCategoryMap.get(expense.category) ?? {
      category: expense.category,
      totalCents: 0,
      count: 0,
    };
    current.totalCents += expense.amountCents;
    current.count += 1;
    expenseCategoryMap.set(expense.category, current);
  }

  const userPerformanceMap = new Map<
    string,
    FinanceAnalyticsPayload["userPerformance"][number]
  >();
  const ensureUserPerformance = (actorName: string) => {
    const existing = userPerformanceMap.get(actorName);
    if (existing) {
      return existing;
    }

    const next = {
      actorName,
      generatedCents: 0,
      lossCents: 0,
      netCents: 0,
      paymentsCount: 0,
      expensesCount: 0,
      inventoryActions: 0,
      stockReceivedQuantity: 0,
      stockIssuedQuantity: 0,
      stockExpiredQuantity: 0,
    } satisfies FinanceAnalyticsPayload["userPerformance"][number];
    userPerformanceMap.set(actorName, next);
    return next;
  };

  for (const payment of payments) {
    const actorEntry = ensureUserPerformance(
      payment.receivedBy || "Unknown user",
    );
    actorEntry.generatedCents += payment.amountCents;
    actorEntry.paymentsCount += 1;
  }

  for (const expense of expenses) {
    const actorEntry = ensureUserPerformance(
      expense.recordedBy || "Unknown user",
    );
    actorEntry.lossCents += expense.amountCents;
    actorEntry.expensesCount += 1;
  }

  for (const audit of inventoryAudits) {
    const actorEntry = ensureUserPerformance(audit.actorName || "Unknown user");
    actorEntry.inventoryActions += 1;

    if (!audit.payloadJson) {
      continue;
    }

    try {
      const payload = JSON.parse(audit.payloadJson) as {
        type?: string;
        quantity?: number;
      };
      const quantity = Number(payload.quantity ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      if (payload.type === "RECEIPT" || payload.type === "RETURN") {
        actorEntry.stockReceivedQuantity += quantity;
      } else if (payload.type === "ISSUE" || payload.type === "ADJUSTMENT") {
        actorEntry.stockIssuedQuantity += quantity;
      } else if (payload.type === "EXPIRY") {
        actorEntry.stockExpiredQuantity += quantity;
      }
    } catch {
      // Ignore malformed historical audit payloads and keep the activity count.
    }
  }

  const userPerformance = [...userPerformanceMap.values()]
    .map((entry) => ({
      ...entry,
      netCents: entry.generatedCents - entry.lossCents,
    }))
    .sort((left, right) => {
      if (right.netCents !== left.netCents) {
        return right.netCents - left.netCents;
      }
      if (right.generatedCents !== left.generatedCents) {
        return right.generatedCents - left.generatedCents;
      }
      return left.actorName.localeCompare(right.actorName);
    });

  return {
    generatedAt: new Date().toISOString(),
    range: analyticsWindow.range,
    customStartDate: analyticsWindow.customStartDate,
    customEndDate: analyticsWindow.customEndDate,
    summary: {
      grossBilledCents,
      netDueCents,
      collectedCents,
      outstandingCents,
      discountCents,
      insuranceCoveredCents,
      expenseCents,
      netProfitCents,
      averageInvoiceCents,
      averagePaymentCents,
      collectionRatePercent,
      referralAmountDueCents,
      referralAmountOutstandingCents,
    },
    invoiceStatus: [...invoiceStatusMap.values()].sort(
      (left, right) => right.totalDueCents - left.totalDueCents,
    ),
    paymentMix: [...paymentMixMap.values()].sort(
      (left, right) => right.totalCents - left.totalCents,
    ),
    payerMix: [...payerMixMap.values()].sort(
      (left, right) => right.coveredCents - left.coveredCents,
    ),
    claimStatus: [...claimStatusMap.values()].sort(
      (left, right) => right.coveredCents - left.coveredCents,
    ),
    agingBuckets,
    monthlyCollections: [...monthlyCollectionsMap.values()]
      .sort((left, right) => left.monthOrder - right.monthOrder)
      .map(({ label, billedCents, collectedCents }) => ({
        label,
        billedCents,
        collectedCents,
      })),
    topServices: [...serviceMap.values()]
      .sort((left, right) => right.revenueCents - left.revenueCents)
      .slice(0, 8),
    studyPerformance,
    topReferrers: [...referrerMap.values()]
      .sort((left, right) => right.referralDueCents - left.referralDueCents)
      .slice(0, 6),
    expenseCategories: [...expenseCategoryMap.values()]
      .sort((left, right) => right.totalCents - left.totalCents)
      .slice(0, 8),
    userPerformance,
    recentExpenses: expenses.slice(0, 8).map(serializeExpense),
  };
}

app.get("/health", async () => ({
  status: "ok",
  service: "MediLab Nexus API",
}));

app.get("/ready", async (request, reply) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return {
      status: "ready",
      service: "MediLab Nexus API",
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    request.log.error(error, "Database readiness probe failed");
    return reply.code(503).send({
      status: "not_ready",
      service: "MediLab Nexus API",
      database: "unavailable",
    });
  }
});

app.get("/api/setup/status", async (_request, reply) => {
  try {
    return await resolveSetupStatus();
  } catch {
    return sendSetupDatabaseUnavailable(reply);
  }
});

app.post("/api/setup/initialize", async (request, reply) => {
  let currentStatus: SetupStatusPayload;
  try {
    currentStatus = await resolveSetupStatus();
  } catch {
    return sendSetupDatabaseUnavailable(reply);
  }
  if (!currentStatus.requiresSetup) {
    return reply.code(409).send({
      message: "Initial setup has already been completed.",
    });
  }

  const payload: InitialSetupInput = initialSetupInputSchema.parse(request.body);
  const normalizedUsername = payload.admin.username.trim().toLowerCase();

  const refreshedUserCount = await prisma.appUser.count();
  if (refreshedUserCount > 0) {
    return reply.code(409).send({
      message: "Initial setup has already been completed.",
    });
  }

  const facilityDefaults = serializeFacility(null);
  const facilityRecord = await resolveFacilityRecord();
  const facility = facilityRecord
    ? await prisma.facility.update({
        where: { id: facilityRecord.id },
        data: {
          code: facilityRecord.code || facilityDefaults.code,
          name: facilityRecord.name || facilityDefaults.name,
          phone: facilityRecord.phone || facilityDefaults.phone,
          email: facilityRecord.email || facilityDefaults.email,
          location: facilityRecord.location || facilityDefaults.location,
          logoDataUrl: facilityRecord.logoDataUrl || facilityDefaults.logoDataUrl,
          footerMessage: facilityRecord.footerMessage || facilityDefaults.footerMessage,
          printFontSize: facilityRecord.printFontSize || facilityDefaults.printFontSize,
        },
      })
    : await prisma.facility.create({
        data: {
          code: process.env.MEDILAB_FACILITY_CODE ?? facilityDefaults.code,
          name: process.env.MEDILAB_FACILITY_NAME ?? facilityDefaults.name,
          phone: facilityDefaults.phone,
          email: facilityDefaults.email,
          location: facilityDefaults.location,
          logoDataUrl: facilityDefaults.logoDataUrl,
          footerMessage: facilityDefaults.footerMessage,
          printFontSize: facilityDefaults.printFontSize,
        },
      });

  const { salt, hash } = hashPin(
    payload.admin.pin,
    `${facility.code}-${normalizedUsername}-${Date.now()}`,
  );

  await prisma.appUser.create({
    data: {
      facilityId: facility.id,
      username: normalizedUsername,
      displayName: payload.admin.displayName.trim(),
      role: "ADMIN",
      pinSalt: salt,
      pinHash: hash,
      pinChangedAt: new Date(),
    },
  });

  const session = await loginWithPin(prisma, normalizedUsername, payload.admin.pin);
  if (session.status !== "success") {
    return reply.code(500).send({
      message: "Initial setup completed, but the new admin session could not be created.",
    });
  }

  await recordAudit(prisma, session.user, {
    action: "INITIAL_SETUP_COMPLETED",
    entityType: "Facility",
    entityId: facility.id,
    summary: `${session.user.displayName} completed first-run setup`,
    payload: {
      facilityCode: facility.code,
      facilityName: facility.name,
    },
  });

  reply.header(
    "set-cookie",
    serializeSessionCookie(session.sessionToken, session.expiresAt),
  );

  return reply.code(201).send(buildSessionPayload(session));
});

app.post("/api/auth/login", async (request, reply) => {
  const payload = loginInputSchema.parse(request.body);
  const session = await loginWithPin(prisma, payload.username, payload.pin);

  if (session.status === "locked") {
    return reply.code(423).send({
      message: `${session.displayName} is temporarily locked until ${session.lockedUntil.toISOString()}.`,
    });
  }

  if (session.status === "invalid") {
    return reply.code(401).send({ message: "Invalid username or PIN." });
  }

  await recordAudit(prisma, session.user, {
    action: "LOGIN_SUCCESS",
    entityType: "AppUser",
    entityId: session.user.id,
    summary: `${session.user.displayName} signed in locally`,
  });
  await recordAttendanceLogin(prisma, {
    facilityId: session.user.facilityId,
    userId: session.user.id,
  });

  reply.header(
    "set-cookie",
    serializeSessionCookie(session.sessionToken, session.expiresAt),
  );

  return reply.code(200).send(buildSessionPayload(session));
});

app.get("/api/auth/session", async (request, reply) => {
  const sessionToken = getRequestSessionToken(request);

  if (!sessionToken) {
    return unauthorized(reply);
  }

  const session = await getSessionFromToken(prisma, sessionToken);
  if (!session) {
    return unauthorized(reply);
  }

  return {
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt.toISOString(),
    user: {
      id: session.user.id,
      facilityId: session.user.facilityId,
      username: session.user.username,
      displayName: session.user.displayName,
      role: session.user.role,
      allowedActions: session.user.allowedActions,
    },
  };
});

app.get("/api/auth/profile", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const user = await prisma.appUser.findUniqueOrThrow({
    where: { id: request.actor.id },
  });

  return buildOwnProfilePayload(user);
});

app.patch("/api/auth/profile", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const payload = ownProfileInputSchema.parse(request.body);

  try {
    const user = await updateOwnProfile(prisma, request.actor.id, payload);

    await recordAudit(prisma, request.actor, {
      action: "PROFILE_UPDATED",
      entityType: "AppUser",
      entityId: user.id,
      summary: `${user.username} updated their own profile`,
      payload,
    });

    return reply.code(200).send(buildOwnProfilePayload(user));
  } catch (error) {
    if (error instanceof Error && error.message === "That username is already in use.") {
      return reply.code(400).send({ message: error.message });
    }
    throw error;
  }
});

app.post("/api/auth/logout", async (request, reply) => {
  const sessionToken = getRequestSessionToken(request);

  reply.header("set-cookie", clearSessionCookie());

  if (!sessionToken) {
    return reply.code(204).send();
  }

  const session = await getSessionFromToken(prisma, sessionToken);
  if (session) {
    await recordAudit(prisma, session.user, {
      action: "LOGOUT",
      entityType: "AppUser",
      entityId: session.user.id,
      summary: `${session.user.displayName} signed out locally`,
    });
    await recordAttendanceLogout(prisma, {
      facilityId: session.user.facilityId,
      userId: session.user.id,
    });
  }

  await logoutSession(prisma, sessionToken);
  return reply.code(204).send();
});

app.post("/api/auth/change-pin", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const payload = changeOwnPinInputSchema.parse(request.body);

  try {
    const user = await changeOwnPin(
      prisma,
      request.actor.id,
      payload.currentPin,
      payload.newPin,
    );

    await recordAudit(prisma, request.actor, {
      action: "PIN_CHANGED",
      entityType: "AppUser",
      entityId: user.id,
      summary: `${user.username} changed their own PIN`,
    });

    return reply.code(200).send({
      id: user.id,
      username: user.username,
      pinChangedAt: user.pinChangedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Current PIN is incorrect.") {
      return reply.code(400).send({ message: error.message });
    }
    throw error;
  }
});

app.get("/api/bootstrap", async (request): Promise<BootstrapPayload> => {
  const facility = await resolveFacilityRecord(request.actor.facilityId);
  const [
    patientsToday,
    openOrders,
    pendingReviews,
    pendingDispatches,
    inventoryItems,
    qcAlerts,
    recentPatients,
    catalog,
  ] = await Promise.all([
    prisma.patient.count({ where: { createdAt: { gte: todayStart() } } }),
    prisma.diagnosticOrder.count({
      where: {
        status: {
          in: ["REGISTERED", "COLLECTED", "IN_PROGRESS", "READY_FOR_REVIEW"],
        },
      },
    }),
    prisma.report.count({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } } }),
    prisma.syncEvent.count({
      where: { status: { in: ["PENDING_SYNC", "FAILED", "CONFLICT"] } },
    }),
    prisma.inventoryItem.findMany({
      orderBy: { quantityOnHand: "asc" },
      take: 12,
    }),
    prisma.qualityControlEvent.findMany({
      where: { status: { not: "PASS" } },
      orderBy: { occurredAt: "desc" },
      take: 4,
    }),
    prisma.patient.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        traceCode: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    }),
    prisma.catalogItem.findMany({
      where: { isActive: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        department: true,
        specimenType: true,
        modality: true,
        priceCents: true,
        tatMinutes: true,
        rulesJson: true,
      },
    }),
  ]);

  const lowStock = inventoryItems
    .filter((item) => item.quantityOnHand <= item.reorderLevel)
    .slice(0, 4);

  return {
    facility: serializeFacility(facility),
    catalog,
    metrics: {
      patientsToday,
      openOrders,
      pendingReviews,
      pendingDispatches,
    },
    workflow: [
      {
        label: "Reception",
        count: patientsToday,
        note: "Registrations logged today",
      },
      {
        label: "Phlebotomy",
        count: await prisma.sample.count({ where: { status: "PENDING" } }),
        note: "Samples waiting collection",
      },
      {
        label: "Laboratory",
        count: await prisma.orderItem.count({
          where: { status: "IN_PROGRESS" },
        }),
        note: "Bench work in progress",
      },
      {
        label: "Imaging",
        count: await prisma.imagingStudy.count({
          where: {
            appointmentStatus: { in: ["SCHEDULED", "ARRIVED", "SCANNING"] },
          },
        }),
        note: "Ultrasound worklist",
      },
      {
        label: "Review",
        count: pendingReviews,
        note: "Reports awaiting sign-off",
      },
    ],
    lowStock: lowStock.map((item) => ({
      name: item.name,
      quantityOnHand: item.quantityOnHand,
      reorderLevel: item.reorderLevel,
    })),
    qcAlerts: qcAlerts.map((alert) => ({
      module: alert.module,
      instrumentName: alert.instrumentName,
      status: alert.status,
      occurredAt: alert.occurredAt.toISOString(),
    })),
    recentPatients: recentPatients.map((patient) => ({
      id: patient.id,
      traceCode: patient.traceCode,
      fullName: `${patient.firstName} ${patient.lastName}`,
      phone: patient.phone,
    })),
  };
});

app.get("/api/admin/overview", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "admin:view")) {
    return deny(reply, "admin:view");
  }

  return buildAdminOverview(request.actor);
});

app.get(
  "/api/admin/attendance",
  async (request, reply): Promise<AttendanceWorkspacePayload | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }
    if (!hasCapability(request.actor, "admin:view")) {
      return deny(reply, "admin:view");
    }

    return buildAttendanceWorkspace(
      prisma,
      request.actor.facilityId,
      (request.query as { date?: string }).date,
    );
  },
);

app.put("/api/admin/attendance/settings", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "admin:view")) {
    return deny(reply, "admin:view");
  }
  if (request.actor.role !== "ADMIN") {
    return reply.code(403).send({
      message: "Only administrators can update attendance off days and holidays.",
    });
  }

  const payload = attendanceSettingsInputSchema.parse(request.body);
  const settings = await saveAttendanceSettings(
    prisma,
    request.actor.facilityId,
    payload,
  );

  await recordAudit(prisma, request.actor, {
    action: "ATTENDANCE_SETTINGS_UPDATED",
    entityType: "AttendanceSettings",
    entityId: request.actor.facilityId,
    summary: `${request.actor.displayName} updated attendance off days and holidays`,
    payload: settings,
  });

  return settings;
});

app.get("/api/analytics/finance", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "finance:manage")) {
    return deny(reply, "finance:manage");
  }

  return buildFinanceAnalytics(
    request.actor,
    request.query as { range?: string; startDate?: string; endDate?: string },
  );
});

app.get(
  "/api/analytics/finance/printable",
  async (request, reply): Promise<PrintableAnalyticsPayload | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }
    if (!hasCapability(request.actor, "finance:manage")) {
      return deny(reply, "finance:manage");
    }

    const analytics = await buildFinanceAnalytics(
      request.actor,
      request.query as { range?: string; startDate?: string; endDate?: string },
    );
    return renderPrintableFinanceAnalyticsHtml(
      prisma,
      request.actor,
      analytics,
    );
  },
);

app.get("/api/finance/expenses", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "finance:manage")) {
    return deny(reply, "finance:manage");
  }

  return buildExpenseWorkspace(
    request.actor,
    request.query as {
      range?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
    },
  );
});

app.post("/api/finance/expenses", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "finance:manage")) {
    return deny(reply, "finance:manage");
  }

  const payload = expenseInputSchema.parse(request.body);
  const created = await prisma.expenseRecord.create({
    data: {
      facilityId: request.actor.facilityId,
      category: payload.category.trim(),
      description: payload.description.trim(),
      amountCents: payload.amountCents,
      incurredAt: new Date(payload.incurredAt),
      recordedBy: payload.recordedBy.trim(),
      notes: payload.notes || null,
    },
  });

  await recordAudit(prisma, request.actor, {
    action: "EXPENSE_RECORDED",
    entityType: "ExpenseRecord",
    entityId: created.id,
    summary: `${created.category} expense recorded at ${created.amountCents}`,
    payload,
  });
  await recordDispatchEvent("ExpenseRecord", created.id, created);

  return reply.code(201).send(serializeExpense(created));
});

app.delete("/api/finance/expenses/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "finance:manage")) {
    return deny(reply, "finance:manage");
  }

  const { id } = request.params as { id: string };
  const existing = await prisma.expenseRecord.findFirst({
    where: {
      id,
      facilityId: request.actor.facilityId,
    },
  });

  if (!existing) {
    return reply.code(404).send({ message: "Expense entry not found." });
  }

  await prisma.expenseRecord.delete({ where: { id: existing.id } });
  await recordAudit(prisma, request.actor, {
    action: "EXPENSE_DELETED",
    entityType: "ExpenseRecord",
    entityId: existing.id,
    summary: `${existing.category} expense deleted`,
    payload: serializeExpense(existing),
  });
  await recordDeleteDispatchEvent("ExpenseRecord", existing.id, existing);

  return reply.code(204).send();
});

app.get("/api/admin/facility", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "user:manage")) {
    return deny(reply, "user:manage");
  }

  const facility = await resolveFacilityRecord(request.actor.facilityId);
  return serializeFacility(facility);
});

app.put("/api/admin/facility", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (
    !hasCapability(request.actor, "user:manage") &&
    !hasCapability(request.actor, "report:write")
  ) {
    return deny(reply, "report:write");
  }

  const payload = facilitySettingsInputSchema.parse(request.body);
  const facility = await resolveFacilityRecord(request.actor.facilityId);
  if (!facility) {
    return reply.code(500).send({ message: "Facility not initialized." });
  }

  const canManageFacilityProfile = hasCapability(request.actor, "user:manage");

  const updated = await prisma.facility.update({
    where: { id: facility.id },
    data: {
      ...(canManageFacilityProfile
        ? {
            name: payload.name,
            phone: payload.phone,
            email: payload.email,
            location: payload.location,
            logoDataUrl: payload.logoDataUrl,
            footerMessage: payload.footerMessage,
          }
        : {}),
      printFontSize: payload.printFontSize,
    },
  });

  await recordAudit(prisma, request.actor, {
    action: "FACILITY_UPDATED",
    entityType: "Facility",
    entityId: updated.id,
    summary: canManageFacilityProfile
      ? `Facility profile updated for ${updated.code}`
      : `Printable font size updated for ${updated.code}`,
    payload: {
      ...(canManageFacilityProfile
        ? {
            name: payload.name,
            phone: payload.phone,
            email: payload.email,
            location: payload.location,
            footerMessage: payload.footerMessage,
          }
        : {}),
      printFontSize: payload.printFontSize,
      logoUpdated: canManageFacilityProfile && Boolean(payload.logoDataUrl),
    },
  });

  return serializeFacility(updated);
});

app.get("/api/report-templates", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "report:write")) {
    return deny(reply, "report:write");
  }

  const templates = await prisma.reportTemplate.findMany({
    where: { facilityId: request.actor.facilityId },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });
  return templates.map(serializeReportTemplate);
});

app.post("/api/report-templates", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "report:write")) {
    return deny(reply, "report:write");
  }

  const payload = reportTemplateInputSchema.parse(request.body);
  const saved = await prisma.reportTemplate.upsert({
    where: {
      facilityId_name: {
        facilityId: request.actor.facilityId,
        name: payload.name,
      },
    },
    update: {
      templateKind: payload.templateKind,
      title: payload.title,
      medicalHistory: payload.medicalHistory,
      summary: payload.summary,
      findings: payload.findings,
      impression: payload.impression,
      assistJson: JSON.stringify(payload.assist),
      createdByName: request.actor.displayName,
      createdByRole: request.actor.role,
    },
    create: {
      facilityId: request.actor.facilityId,
      name: payload.name,
      templateKind: payload.templateKind,
      title: payload.title,
      medicalHistory: payload.medicalHistory,
      summary: payload.summary,
      findings: payload.findings,
      impression: payload.impression,
      assistJson: JSON.stringify(payload.assist),
      createdByName: request.actor.displayName,
      createdByRole: request.actor.role,
    },
  });

  await recordAudit(prisma, request.actor, {
    action: "REPORT_TEMPLATE_SAVED",
    entityType: "ReportTemplate",
    entityId: saved.id,
    summary: `Report template ${saved.name} saved`,
    payload,
  });

  return reply.code(201).send(serializeReportTemplate(saved));
});

app.delete("/api/report-templates/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "report:write")) {
    return deny(reply, "report:write");
  }

  const { id } = request.params as { id: string };
  const existing = await prisma.reportTemplate.findFirst({
    where: { id, facilityId: request.actor.facilityId },
  });
  if (!existing) {
    return reply.code(404).send({ message: "Report template not found." });
  }

  await prisma.reportTemplate.delete({ where: { id: existing.id } });
  await recordAudit(prisma, request.actor, {
    action: "REPORT_TEMPLATE_DELETED",
    entityType: "ReportTemplate",
    entityId: existing.id,
    summary: `Report template ${existing.name} deleted`,
    payload: { name: existing.name },
  });

  return reply.code(204).send();
});

app.get(
  "/api/admin/services",
  async (request, reply): Promise<CatalogSeedItem[] | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }
    if (!hasCapability(request.actor, "service:manage")) {
      return deny(reply, "service:manage");
    }

    const services = await prisma.catalogItem.findMany({
      orderBy: [{ department: "asc" }, { name: "asc" }],
    });

    return services.map(serializeCatalogItem);
  },
);

app.get("/api/referral-doctors", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const doctors = await prisma.referralDoctor.findMany({
    where: {
      facilityId: request.actor.facilityId,
      isActive: true,
    },
    orderBy: [{ fullName: "asc" }],
  });

  return doctors.map(serializeReferralDoctor);
});

app.get("/api/admin/referral-doctors", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "service:manage")) {
    return deny(reply, "service:manage");
  }

  const doctors = await prisma.referralDoctor.findMany({
    where: { facilityId: request.actor.facilityId },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });

  return doctors.map(serializeReferralDoctor);
});

app.post("/api/admin/referral-doctors", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "service:manage")) {
    return deny(reply, "service:manage");
  }

  const payload = referralDoctorInputSchema.parse(request.body);
  const created = await prisma.referralDoctor.create({
    data: {
      facilityId: request.actor.facilityId,
      fullName: payload.fullName.trim(),
      phone: payload.phone || null,
      email: payload.email || null,
      referralAmountCents: payload.referralAmountCents,
      isActive: payload.isActive,
    },
  });

  await recordAudit(prisma, request.actor, {
    action: "REFERRAL_DOCTOR_CREATED",
    entityType: "ReferralDoctor",
    entityId: created.id,
    summary: `Referral doctor ${created.fullName} added at GHc ${(created.referralAmountCents / 100).toFixed(2)}`,
    payload,
  });
  await recordDispatchEvent("ReferralDoctor", created.id, created);

  return reply.code(201).send(serializeReferralDoctor(created));
});

app.put("/api/admin/referral-doctors/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "service:manage")) {
    return deny(reply, "service:manage");
  }

  const id = (request.params as { id: string }).id;
  const payload = referralDoctorInputSchema.parse(request.body);
  const existing = await prisma.referralDoctor.findFirst({
    where: {
      id,
      facilityId: request.actor.facilityId,
    },
    select: { id: true },
  });

  if (!existing) {
    return reply.code(404).send({
      message: "Referral doctor not found for this facility.",
    });
  }

  const updated = await prisma.referralDoctor.update({
    where: { id },
    data: {
      fullName: payload.fullName.trim(),
      phone: payload.phone || null,
      email: payload.email || null,
      referralAmountCents: payload.referralAmountCents,
      isActive: payload.isActive,
    },
  });

  await recordAudit(prisma, request.actor, {
    action: "REFERRAL_DOCTOR_UPDATED",
    entityType: "ReferralDoctor",
    entityId: updated.id,
    summary: `Referral doctor ${updated.fullName} updated to GHc ${(updated.referralAmountCents / 100).toFixed(2)}`,
    payload,
  });
  await recordDispatchEvent("ReferralDoctor", updated.id, updated);

  return reply.send(serializeReferralDoctor(updated));
});

app.post("/api/admin/services", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "service:manage")) {
    return deny(reply, "service:manage");
  }

  const payload = serviceInputSchema.parse(request.body);
  const created = await prisma.catalogItem.create({
    data: buildCatalogItemData(payload),
  });

  await recordAudit(prisma, request.actor, {
    action: "SERVICE_CREATED",
    entityType: "CatalogItem",
    entityId: created.id,
    summary: `Service ${created.code} created at ${created.priceCents}`,
    payload,
  });
  await recordDispatchEvent("CatalogItem", created.id, created);

  return reply.code(201).send(serializeCatalogItem(created));
});

app.post("/api/admin/services/bulk", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "service:manage")) {
    return deny(reply, "service:manage");
  }

  const payload = bulkServiceInputSchema.parse(request.body);
  const seenCodes = new Set<string>();
  const skipped: Array<{ code: string; reason: string }> = [];
  const normalizedServices = payload.services.flatMap((service) => {
    const normalizedCode = service.code.trim().toUpperCase();
    if (seenCodes.has(normalizedCode)) {
      skipped.push({
        code: normalizedCode,
        reason: "Duplicate code in the pasted batch",
      });
      return [];
    }

    seenCodes.add(normalizedCode);
    return [
      {
        ...service,
        code: normalizedCode,
        name: service.name.trim(),
      },
    ];
  });

  const existingServices = normalizedServices.length
    ? await prisma.catalogItem.findMany({
        where: {
          code: { in: normalizedServices.map((service) => service.code) },
        },
        select: { code: true },
      })
    : [];
  const existingCodes = new Set(
    existingServices.map((service) => service.code),
  );

  const servicesToCreate = normalizedServices.filter(
    (service) => !existingCodes.has(service.code),
  );
  const servicesToUpdate =
    payload.mode === "OVERWRITE_EXISTING"
      ? normalizedServices.filter((service) => existingCodes.has(service.code))
      : [];

  if (payload.mode === "SKIP_EXISTING") {
    for (const service of normalizedServices) {
      if (existingCodes.has(service.code)) {
        skipped.push({
          code: service.code,
          reason: "A service with this code already exists",
        });
      }
    }
  }

  const created = servicesToCreate.length
    ? await prisma.$transaction(
        servicesToCreate.map((service) =>
          prisma.catalogItem.create({
            data: buildCatalogItemData(service),
          }),
        ),
      )
    : [];
  const updated = servicesToUpdate.length
    ? await prisma.$transaction(
        servicesToUpdate.map((service) =>
          prisma.catalogItem.update({
            where: { code: service.code },
            data: buildCatalogItemData(service),
          }),
        ),
      )
    : [];

  await Promise.all([
    ...created.flatMap((service) => [
      recordAudit(prisma, request.actor, {
        action: "SERVICE_CREATED",
        entityType: "CatalogItem",
        entityId: service.id,
        summary: `Service ${service.code} created at ${service.priceCents} via bulk import`,
        payload: serializeCatalogItem(service),
      }),
      recordDispatchEvent("CatalogItem", service.id, service),
    ]),
    ...updated.flatMap((service) => [
      recordAudit(prisma, request.actor, {
        action: "SERVICE_UPDATED",
        entityType: "CatalogItem",
        entityId: service.id,
        summary: `Service ${service.code} updated to ${service.priceCents} via bulk import`,
        payload: serializeCatalogItem(service),
      }),
      recordDispatchEvent("CatalogItem", service.id, service),
    ]),
  ]);

  return reply.send({
    created: created.map(serializeCatalogItem),
    updated: updated.map(serializeCatalogItem),
    skipped,
    createdCount: created.length,
    updatedCount: updated.length,
    skippedCount: skipped.length,
  });
});

app.put("/api/admin/services/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "service:manage")) {
    return deny(reply, "service:manage");
  }

  const id = (request.params as { id: string }).id;
  const payload = serviceInputSchema.parse(request.body);
  const updated = await prisma.catalogItem.update({
    where: { id },
    data: buildCatalogItemData(payload),
  });

  await recordAudit(prisma, request.actor, {
    action: "SERVICE_UPDATED",
    entityType: "CatalogItem",
    entityId: updated.id,
    summary: `Service ${updated.code} updated to ${updated.priceCents}`,
    payload,
  });
  await recordDispatchEvent("CatalogItem", updated.id, updated);

  return serializeCatalogItem(updated);
});

app.delete("/api/admin/services/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "service:manage")) {
    return deny(reply, "service:manage");
  }

  const { id } = request.params as { id: string };
  const existing = await prisma.catalogItem.findUnique({
    where: { id },
  });

  if (!existing) {
    return reply.code(404).send({ message: "Service not found." });
  }

  const linkedOrderItems = await prisma.orderItem.findMany({
    where: { catalogItemId: existing.id },
    select: { orderId: true },
  });
  const orderIds = [...new Set(linkedOrderItems.map((item) => item.orderId))];
  const orderItemIds = orderIds.length
    ? (
        await prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true },
        })
      ).map((item) => item.id)
    : [];
  const invoiceIds = orderIds.length
    ? (
        await prisma.invoice.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true },
        })
      ).map((invoice) => invoice.id)
    : [];

  await prisma.$transaction(async (tx) => {
    if (invoiceIds.length > 0) {
      await tx.paymentRecord.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
      await tx.invoiceLine.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
      await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }

    if (orderItemIds.length > 0) {
      await tx.imagingStudy.deleteMany({
        where: { orderItemId: { in: orderItemIds } },
      });
    }

    if (orderIds.length > 0) {
      await tx.report.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.sample.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.diagnosticOrder.deleteMany({ where: { id: { in: orderIds } } });
    }

    await tx.catalogItem.delete({ where: { id: existing.id } });
  });

  await recordAudit(prisma, request.actor, {
    action: "SERVICE_DELETED",
    entityType: "CatalogItem",
    entityId: existing.id,
    summary:
      orderIds.length > 0
        ? `Service ${existing.code} deleted and ${orderIds.length} linked order(s) removed`
        : `Service ${existing.code} deleted`,
    payload: {
      ...serializeCatalogItem(existing),
      linkedOrderCount: orderIds.length,
    },
  });
  await recordDeleteDispatchEvent("CatalogItem", existing.id, existing);

  return reply.code(204).send();
});

app.get("/api/patients", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const query = (request.query as { q?: string }).q?.trim();
  const patients = await prisma.patient.findMany({
    where: query
      ? {
          facilityId: request.actor.facilityId,
          OR: [
            { traceCode: { contains: query } },
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { phone: { contains: query } },
            { nhisId: { contains: query } },
            { referralDoctor: { is: { fullName: { contains: query } } } },
          ],
        }
      : { facilityId: request.actor.facilityId },
    include: {
      referralDoctor: {
        select: {
          fullName: true,
          referralAmountCents: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return patients.map(serializePatient);
});

app.put("/api/patients/:id/referral", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "patient:write")) {
    return deny(reply, "patient:write");
  }

  const id = (request.params as { id: string }).id;
  const payload = patientReferralUpdateInputSchema.parse(request.body);
  const patient = await prisma.patient.findFirst({
    where: {
      id,
      facilityId: request.actor.facilityId,
    },
    include: {
      referralDoctor: {
        select: {
          fullName: true,
          referralAmountCents: true,
        },
      },
    },
  });

  if (!patient) {
    return reply.code(404).send({ message: "Patient not found." });
  }

  const referralDoctor = payload.referralDoctorId
    ? await prisma.referralDoctor.findFirst({
        where: {
          id: payload.referralDoctorId,
          facilityId: request.actor.facilityId,
          isActive: true,
        },
      })
    : null;

  if (payload.referralDoctorId && !referralDoctor) {
    return reply.code(400).send({
      message: "The selected referral doctor is not available.",
    });
  }

  const updated = await prisma.patient.update({
    where: { id: patient.id },
    data: {
      referralDoctorId: referralDoctor?.id ?? null,
      referralAmountCents: referralDoctor?.referralAmountCents ?? null,
    },
    include: {
      referralDoctor: {
        select: {
          fullName: true,
          referralAmountCents: true,
        },
      },
    },
  });

  await recordDispatchEvent("Patient", updated.id, updated);
  await recordAudit(prisma, request.actor, {
    action: "PATIENT_REFERRAL_UPDATED",
    entityType: "Patient",
    entityId: updated.id,
    traceCode: updated.traceCode,
    summary: referralDoctor
      ? `Patient ${updated.traceCode} referral doctor changed to ${referralDoctor.fullName}`
      : `Patient ${updated.traceCode} referral doctor cleared`,
    payload,
  });

  return reply.send(serializePatient(updated));
});

app.put("/api/patients/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "patient:write")) {
    return deny(reply, "patient:write");
  }

  const id = (request.params as { id: string }).id;
  const payload = patientInputSchema.parse(request.body);
  const existingPatient = await prisma.patient.findFirst({
    where: {
      id,
      facilityId: request.actor.facilityId,
    },
    include: {
      referralDoctor: {
        select: {
          fullName: true,
          referralAmountCents: true,
        },
      },
    },
  });

  if (!existingPatient) {
    return reply.code(404).send({ message: "Patient not found." });
  }

  const normalizedManualTraceCode = payload.traceCode.trim().toUpperCase();
  const trace =
    normalizedManualTraceCode === existingPatient.traceCode
      ? {
          facilityId: existingPatient.facilityId,
          traceSequence: existingPatient.traceSequence,
          traceCode: existingPatient.traceCode,
          initials: existingPatient.initials,
        }
      : await resolvePatientTraceCode(
          prisma,
          payload,
          payload.traceCode,
          existingPatient.id,
        );

  const referralDoctor = payload.referralDoctorId
    ? await prisma.referralDoctor.findFirst({
        where: {
          id: payload.referralDoctorId,
          facilityId: request.actor.facilityId,
          isActive: true,
        },
      })
    : null;

  if (payload.referralDoctorId && !referralDoctor) {
    return reply.code(400).send({
      message: "The selected referral doctor is not available.",
    });
  }

  let updated;
  try {
    updated = await prisma.patient.update({
      where: { id: existingPatient.id },
      data: {
        referralDoctorId: referralDoctor?.id ?? null,
        referralName: normalizeOptionalString(payload.referralName),
        referralAmountCents:
          payload.referralAmountCents ??
          referralDoctor?.referralAmountCents ??
          null,
        traceCode: trace.traceCode,
        traceSequence: trace.traceSequence,
        initials: trace.initials,
        firstName: payload.firstName,
        middleName: payload.middleName,
        lastName: payload.lastName,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        gender: normalizeOptionalString(payload.gender),
        phone: payload.phone,
        location: normalizeOptionalString(payload.location),
        nhisId: normalizeOptionalString(payload.nhisId),
        allergies: normalizeOptionalString(payload.allergies),
        medicalHistory: normalizeOptionalString(payload.medicalHistory),
        consentAccepted: payload.consentAccepted,
        photoPath: normalizeOptionalString(payload.photoPath),
        syncStatus: "LOCAL_ONLY",
      },
      include: {
        referralDoctor: {
          select: {
            fullName: true,
            referralAmountCents: true,
          },
        },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "nhisId")) {
      return reply.code(400).send({
        message: "That NHIS ID is already assigned to another patient.",
      });
    }
    throw error;
  }

  await recordDispatchEvent("Patient", updated.id, updated);
  await recordAudit(prisma, request.actor, {
    action: "PATIENT_UPDATED",
    entityType: "Patient",
    entityId: updated.id,
    traceCode: updated.traceCode,
    summary: `Patient ${updated.traceCode} record updated`,
    payload,
  });

  return reply.send(serializePatient(updated));
});

app.delete("/api/patients/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "patient:write")) {
    return deny(reply, "patient:write");
  }

  const { id } = request.params as { id: string };
  const existing = await prisma.patient.findFirst({
    where: {
      id,
      facilityId: request.actor.facilityId,
    },
    include: {
      referralDoctor: {
        select: {
          fullName: true,
          referralAmountCents: true,
        },
      },
    },
  });

  if (!existing) {
    return reply.code(404).send({ message: "Patient not found." });
  }

  const patientIds = [existing.id];
  const orderIds = (
    await prisma.diagnosticOrder.findMany({
      where: { patientId: existing.id },
      select: { id: true },
    })
  ).map((order) => order.id);
  const invoiceIds = (
    await prisma.invoice.findMany({
      where: { patientId: existing.id },
      select: { id: true },
    })
  ).map((invoice) => invoice.id);
  const orderItemIds = orderIds.length
    ? (
        await prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true },
        })
      ).map((orderItem) => orderItem.id)
    : [];

  await prisma.$transaction(async (tx) => {
    if (invoiceIds.length > 0) {
      await tx.paymentRecord.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
      await tx.invoiceLine.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
    }

    if (orderItemIds.length > 0) {
      await tx.imagingStudy.deleteMany({
        where: { orderItemId: { in: orderItemIds } },
      });
    }

    await tx.report.deleteMany({ where: { patientId: { in: patientIds } } });
    await tx.sample.deleteMany({ where: { patientId: { in: patientIds } } });
    await tx.notificationQueue.deleteMany({
      where: { patientId: { in: patientIds } },
    });

    if (invoiceIds.length > 0) {
      await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }

    if (orderIds.length > 0) {
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.diagnosticOrder.deleteMany({
        where: { id: { in: orderIds } },
      });
    }

    await tx.patient.delete({ where: { id: existing.id } });
  });

  await recordAudit(prisma, request.actor, {
    action: "PATIENT_DELETED",
    entityType: "Patient",
    entityId: existing.id,
    traceCode: existing.traceCode,
    summary: `Patient ${existing.traceCode} deleted with linked workflow records removed`,
    payload: {
      ...serializePatient(existing),
      deletedOrderCount: orderIds.length,
      deletedInvoiceCount: invoiceIds.length,
    },
  });
  await recordDeleteDispatchEvent("Patient", existing.id, existing);

  return reply.code(204).send();
});

app.delete("/api/patients", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "patient:write")) {
    return deny(reply, "patient:write");
  }

  const patientsToDelete = await prisma.patient.findMany({
    where: { facilityId: request.actor.facilityId },
    select: {
      id: true,
      traceCode: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phone: true,
      gender: true,
      location: true,
      dateOfBirth: true,
      nhisId: true,
      allergies: true,
      medicalHistory: true,
      consentAccepted: true,
      referralName: true,
      referralAmountCents: true,
      photoPath: true,
      syncStatus: true,
      traceSequence: true,
      initials: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (patientsToDelete.length === 0) {
    return reply.code(200).send({ deletedPatients: 0 });
  }

  const patientIds = patientsToDelete.map((patient) => patient.id);
  const orderIds = (
    await prisma.diagnosticOrder.findMany({
      where: { patientId: { in: patientIds } },
      select: { id: true },
    })
  ).map((order) => order.id);
  const invoiceIds = (
    await prisma.invoice.findMany({
      where: { patientId: { in: patientIds } },
      select: { id: true },
    })
  ).map((invoice) => invoice.id);
  const orderItemIds = orderIds.length
    ? (
        await prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true },
        })
      ).map((orderItem) => orderItem.id)
    : [];

  await prisma.$transaction(async (tx) => {
    if (invoiceIds.length > 0) {
      await tx.paymentRecord.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
      await tx.invoiceLine.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
    }

    if (orderItemIds.length > 0) {
      await tx.imagingStudy.deleteMany({
        where: { orderItemId: { in: orderItemIds } },
      });
    }

    await tx.report.deleteMany({ where: { patientId: { in: patientIds } } });
    await tx.sample.deleteMany({ where: { patientId: { in: patientIds } } });
    await tx.notificationQueue.deleteMany({
      where: { patientId: { in: patientIds } },
    });

    if (invoiceIds.length > 0) {
      await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }

    if (orderIds.length > 0) {
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.diagnosticOrder.deleteMany({
        where: { id: { in: orderIds } },
      });
    }

    await tx.patient.deleteMany({ where: { id: { in: patientIds } } });
  });

  await recordAudit(prisma, request.actor, {
    action: "PATIENTS_PURGED",
    entityType: "Patient",
    entityId: request.actor.facilityId,
    summary: `Deleted ${patientsToDelete.length} patient record(s) from the facility workspace`,
    payload: { traceCodes: patientsToDelete.map((patient) => patient.traceCode) },
  });

  await Promise.all(
    patientsToDelete.map((patient) =>
      recordDeleteDispatchEvent("Patient", patient.id, patient),
    ),
  );

  return reply.code(200).send({ deletedPatients: patientsToDelete.length });
});

app.post("/api/patients", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "patient:write")) {
    return deny(reply, "patient:write");
  }

  const payload = patientInputSchema.parse(request.body);
  let trace;
  try {
    trace = await resolvePatientTraceCode(prisma, payload, payload.traceCode);
  } catch (error) {
    return reply.code(400).send({
      message:
        error instanceof Error
          ? error.message
          : "Trace code could not be assigned.",
    });
  }
  const referralDoctor = payload.referralDoctorId
    ? await prisma.referralDoctor.findFirst({
        where: {
          id: payload.referralDoctorId,
          facilityId: trace.facilityId,
          isActive: true,
        },
      })
    : null;

  if (payload.referralDoctorId && !referralDoctor) {
    return reply.code(400).send({
      message: "The selected referral doctor is not available.",
    });
  }

  let patient;
  try {
    patient = await prisma.patient.create({
      data: {
        facilityId: trace.facilityId,
        referralDoctorId: referralDoctor?.id ?? null,
        referralName: normalizeOptionalString(payload.referralName),
        referralAmountCents:
          payload.referralAmountCents ??
          referralDoctor?.referralAmountCents ??
          null,
        traceCode: trace.traceCode,
        traceSequence: trace.traceSequence,
        initials: trace.initials,
        firstName: payload.firstName,
        middleName: payload.middleName,
        lastName: payload.lastName,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        gender: normalizeOptionalString(payload.gender),
        phone: payload.phone,
        location: normalizeOptionalString(payload.location),
        nhisId: normalizeOptionalString(payload.nhisId),
        allergies: normalizeOptionalString(payload.allergies),
        medicalHistory: normalizeOptionalString(payload.medicalHistory),
        consentAccepted: payload.consentAccepted,
        photoPath: normalizeOptionalString(payload.photoPath),
        syncStatus: "LOCAL_ONLY",
      },
      include: {
        referralDoctor: {
          select: {
            fullName: true,
            referralAmountCents: true,
          },
        },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "nhisId")) {
      return reply.code(400).send({
        message: "That NHIS ID is already assigned to another patient.",
      });
    }
    throw error;
  }

  await recordDispatchEvent("Patient", patient.id, patient);
  await recordAudit(prisma, request.actor, {
    action: "PATIENT_REGISTERED",
    entityType: "Patient",
    entityId: patient.id,
    traceCode: patient.traceCode,
    summary: referralDoctor
      ? `Patient ${patient.traceCode} registered under ${referralDoctor.fullName}`
      : `Patient ${patient.traceCode} registered`,
    payload,
  });
  return reply.code(201).send(serializePatient(patient));
});

app.post("/api/orders", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "order:write")) {
    return deny(reply, "order:write");
  }

  const payload = orderInputSchema.parse(request.body);
  const catalogItems = await ensureCatalogItemsForOrderSelection(payload.itemIds);
  const patient = await prisma.patient.findUnique({
    where: { id: payload.patientId },
  });

  if (!patient) {
    return reply.code(404).send({ message: "Patient not found." });
  }

  if (catalogItems.length !== payload.itemIds.length) {
    return reply
      .code(400)
      .send({ message: "One or more catalog items were not found." });
  }

  const catalogItemLookup = new Map(
    catalogItems.flatMap((item) => [
      [item.id, item],
      [item.code.trim().toUpperCase(), item],
    ]),
  );
  const selectedCatalogItems = payload.itemIds
    .map((itemId) => catalogItemLookup.get(itemId.trim().toUpperCase()) ?? catalogItemLookup.get(itemId))
    .filter((item): item is (typeof catalogItems)[number] => Boolean(item));

  if (selectedCatalogItems.length !== payload.itemIds.length) {
    return reply
      .code(400)
      .send({ message: "One or more catalog items were not found." });
  }

  const totalAmountCents = selectedCatalogItems.reduce(
    (sum, item) => sum + item.priceCents,
    0,
  );
  const payerType = normalizePayerType(
    payload.payerType,
    payload.insuranceAuthorized,
    payload.insuranceProvider,
  );
  const payerName =
    payload.payerName.trim() || payload.insuranceProvider?.trim() || null;
  const payerCoveragePercent = normalizeCoveragePercent(
    payerType,
    payload.payerCoveragePercent,
    payload.insuranceAuthorized,
  );
  const scheduledFor = payload.scheduledFor ? new Date(payload.scheduledFor) : null;
  const orderId = randomUUID();
  const accessionNumber = buildAccessionNumber();
  const invoiceId = randomUUID();
  const orderItems = selectedCatalogItems.map((item) => ({
    id: randomUUID(),
    catalogItem: item,
  }));
  const insuranceCoveredCents = Math.round(
    totalAmountCents * (payerCoveragePercent / 100),
  );
  const patientResponsibilityCents =
    totalAmountCents - insuranceCoveredCents;

  await prisma.$transaction([
    prisma.diagnosticOrder.create({
      data: {
        id: orderId,
        patientId: payload.patientId,
        accessionNumber,
        orderedBy: payload.orderedBy,
        priority: payload.priority,
        payerType,
        payerName,
        payerCoveragePercent,
        payerMemberId: payload.payerMemberId.trim() || null,
        payerAuthorizationCode: payload.payerAuthorizationCode.trim() || null,
        insuranceProvider: payload.insuranceProvider,
        insuranceAuthorized: payload.insuranceAuthorized,
        notes: payload.notes,
        referringClinic: payload.referringClinic,
        scheduledFor,
        totalAmountCents,
      },
    }),
    prisma.orderItem.createMany({
      data: orderItems.map(({ id, catalogItem }) => ({
        id,
        orderId,
        catalogItemId: catalogItem.id,
        status: catalogItem.kind === "IMAGING" ? "REGISTERED" : "COLLECTED",
      })),
    }),
    ...(orderItems.some(({ catalogItem }) => catalogItem.kind === "TEST")
      ? [
          prisma.sample.createMany({
            data: orderItems
              .filter(({ catalogItem }) => catalogItem.kind === "TEST")
              .map(({ catalogItem }) => ({
                patientId: payload.patientId,
                orderId,
                traceLabel: buildSampleLabel(patient.traceCode, catalogItem.department),
                specimenType: catalogItem.specimenType ?? "Unspecified",
                status: "PENDING",
              })),
          }),
        ]
      : []),
    ...(orderItems.some(({ catalogItem }) => catalogItem.kind === "IMAGING")
      ? [
          prisma.imagingStudy.createMany({
            data: orderItems
              .filter(({ catalogItem }) => catalogItem.kind === "IMAGING")
              .map(({ id, catalogItem }) => ({
                orderItemId: id,
                modality: catalogItem.modality ?? "Ultrasound",
                scheduledAt: scheduledFor,
                appointmentStatus: "SCHEDULED",
                sonographerName: payload.sonographerName || null,
                radiologistName: payload.radiologistName || null,
                priorStudyReference: payload.priorStudyReference || null,
              })),
          }),
        ]
      : []),
    prisma.invoice.create({
      data: {
        id: invoiceId,
        patientId: payload.patientId,
        orderId,
        payerType,
        payerName,
        payerCoveragePercent,
        payerMemberId: payload.payerMemberId.trim() || null,
        payerAuthorizationCode: payload.payerAuthorizationCode.trim() || null,
        payerResponsibilityCents: insuranceCoveredCents,
        patientResponsibilityCents,
        claimStatus:
          payerType === PayerType.SELF_PAY
            ? ClaimStatus.NOT_APPLICABLE
            : ClaimStatus.PENDING,
        subtotalCents: totalAmountCents,
        insuranceCoveredCents,
        amountDueCents: patientResponsibilityCents,
      },
    }),
    prisma.invoiceLine.createMany({
      data: selectedCatalogItems.map((item) => ({
        invoiceId,
        description: item.name,
        quantity: 1,
        unitPriceCents: item.priceCents,
        totalPriceCents: item.priceCents,
      })),
    }),
    prisma.syncEvent.create({
      data: {
        entityType: "DiagnosticOrder",
        entityId: orderId,
        operation: "UPSERT",
        payload: JSON.stringify({
          id: orderId,
          patientId: payload.patientId,
          accessionNumber,
          itemIds: selectedCatalogItems.map((item) => item.id),
          totalAmountCents,
        }),
        status: "PENDING_SYNC",
      },
    }),
    prisma.auditLog.create({
      data: {
        actorName: request.actor.displayName,
        actorRole: request.actor.role,
        action: "ORDER_CREATED",
        entityType: "DiagnosticOrder",
        entityId: orderId,
        traceCode: patient.traceCode,
        summary: `Order ${accessionNumber} created for ${patient.traceCode}`,
        payloadJson: JSON.stringify(payload),
      },
    }),
  ]);

  const [order, invoice] = await Promise.all([
    prisma.diagnosticOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { patient: true, items: { include: { catalogItem: true } } },
    }),
    prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { lines: true },
    }),
  ]);

  return reply.code(201).send({ order, invoice });
});

app.get("/api/workflow", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const [
    orders,
    samples,
    imaging,
    reports,
    invoices,
    payments,
    maintenance,
    notifications,
  ] = await Promise.all([
    prisma.diagnosticOrder.findMany({
      include: { patient: true, items: { include: { catalogItem: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.sample.findMany({
      include: { patient: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.imagingStudy.findMany({
      include: {
        orderItem: {
          include: { order: { include: { patient: true } }, catalogItem: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.invoice.findMany({
      include: {
        payments: true,
        patient: {
          include: {
            referralDoctor: true,
          },
        },
        order: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.paymentRecord.findMany({
      include: {
        invoice: {
          include: {
            patient: true,
            order: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.maintenanceEvent.findMany({
      include: { instrument: true },
      orderBy: { nextDueAt: "asc" },
      take: 6,
    }),
    prisma.notificationQueue.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return {
    orders: orders.map((order) => ({
      id: order.id,
      accessionNumber: order.accessionNumber,
      status: order.status,
      patientId: order.patientId,
      patientTraceCode: order.patient.traceCode,
      patientName: `${order.patient.firstName} ${order.patient.lastName}`,
      payerType: order.payerType,
      payerName: order.payerName,
      payerCoveragePercent: order.payerCoveragePercent,
      payerMemberId: order.payerMemberId,
      payerAuthorizationCode: order.payerAuthorizationCode,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => item.catalogItem.name),
    })),
    samples: samples.map(serializeSample),
    imaging: imaging.map((study) => ({
      id: study.id,
      orderId: study.orderItem.orderId,
      orderItemId: study.orderItemId,
      patientId: study.orderItem.order.patientId,
      patientTraceCode: study.orderItem.order.patient.traceCode,
      patientName: `${study.orderItem.order.patient.firstName} ${study.orderItem.order.patient.lastName}`,
      serviceName: study.orderItem.catalogItem.name,
      modality: study.modality,
      appointmentStatus: study.appointmentStatus,
      scheduledAt: study.scheduledAt?.toISOString() ?? null,
      sonographerName: study.sonographerName,
      radiologistName: study.radiologistName,
      priorStudyReference: study.priorStudyReference,
      criticalFlag: study.criticalFlag,
      createdAt: study.createdAt.toISOString(),
    })),
    reports: reports.map((report) => ({
      id: report.id,
      patientId: report.patientId,
      orderId: report.orderId,
      patientTraceCode: orders.find((order) => order.id === report.orderId)?.patient.traceCode ?? "",
      patientName:
        orders.find((order) => order.id === report.orderId)
          ? `${orders.find((order) => order.id === report.orderId)!.patient.firstName} ${orders.find((order) => order.id === report.orderId)!.patient.lastName}`
          : "",
      title: report.title,
      status: report.status,
      signedBy: report.signedBy,
      signedAt: report.signedAt?.toISOString() ?? null,
      pdfPath: report.pdfPath,
      criticalFlag: report.criticalFlag,
      createdAt: report.createdAt.toISOString(),
    })),
    invoices: invoices.map((invoice) => {
      const settlement = summarizeInvoiceSettlement(invoice);
      const referralAmountCents = resolveReferralAmountCents(invoice);

      return {
        id: invoice.id,
        patientId: invoice.patientId,
        orderId: invoice.orderId,
        traceCode: invoice.patient.traceCode,
        accessionNumber: invoice.order.accessionNumber,
        referralDoctorName: invoice.patient.referralDoctor?.fullName ?? null,
        referralAmountCents,
        referralDueCents: referralAmountCents ?? 0,
        referralOutstandingCents: referralAmountCents
          ? prorateReferralAmountCents(
              referralAmountCents,
              settlement.totalBalanceCents,
              settlement.totalDueCents,
            )
          : 0,
        payerType: invoice.payerType,
        payerName: invoice.payerName,
        payerCoveragePercent: invoice.payerCoveragePercent,
        payerMemberId: invoice.payerMemberId,
        payerAuthorizationCode: invoice.payerAuthorizationCode,
        payerResponsibilityCents: invoice.payerResponsibilityCents,
        patientResponsibilityCents: invoice.patientResponsibilityCents,
        claimStatus: resolveClaimSettlementStatus(
          invoice.claimStatus,
          invoice.payerResponsibilityCents,
          settlement.payerPaidCents,
        ),
        status: settlement.status,
        subtotalCents: invoice.subtotalCents,
        discountCents: invoice.discountCents,
        insuranceCoveredCents: invoice.insuranceCoveredCents,
        amountDueCents: invoice.amountDueCents,
        amountPaidCents: settlement.totalPaidCents,
        patientPaidCents: settlement.patientPaidCents,
        payerPaidCents: settlement.payerPaidCents,
        totalDueCents: settlement.totalDueCents,
        patientBalanceCents: settlement.patientBalanceCents,
        payerBalanceCents: settlement.payerBalanceCents,
        balanceCents: settlement.totalBalanceCents,
        createdAt: invoice.createdAt.toISOString(),
        paymentsCount: invoice.payments.length,
      };
    }),
    payments: payments.map((payment) => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      patientId: payment.invoice.patientId,
      traceCode: payment.traceCode ?? payment.invoice.patient.traceCode,
      accessionNumber: payment.invoice.order.accessionNumber,
      amountCents: payment.amountCents,
      method: payment.method,
      responsibility: payment.responsibility,
      reference: payment.reference,
      receivedBy: payment.receivedBy,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
    })),
    maintenance,
    notifications,
  } satisfies WorkflowPayload;
});

app.patch("/api/samples/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "order:write")) {
    return deny(reply, "order:write");
  }

  const { id } = request.params as { id: string };
  const payload = sampleUpdateInputSchema.parse(request.body);
  const sample = await prisma.sample.findUnique({
    where: { id },
    include: {
      patient: true,
      order: {
        include: {
          samples: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!sample) {
    return reply.code(404).send({ message: "Sample not found." });
  }

  if (payload.status === "REJECTED" && !payload.rejectionReason.trim()) {
    return reply.code(400).send({
      message: "A rejection reason is required when rejecting a specimen.",
    });
  }

  const custodyTrail = parseCustodyTrail(sample.chainOfCustodyJson);
  const eventActor = payload.collectedBy.trim() || request.actor.displayName;
  const eventNote = payload.note.trim() || payload.rejectionReason.trim();
  custodyTrail.unshift({
    at: new Date().toISOString(),
    action: payload.status,
    actor: eventActor,
    note: eventNote,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const savedSample = await tx.sample.update({
      where: { id: sample.id },
      data: {
        status: payload.status,
        collectedBy:
          payload.status === "COLLECTED" || sample.collectedBy
            ? eventActor
            : null,
        collectedAt:
          payload.status === "COLLECTED"
            ? sample.collectedAt ?? new Date()
            : sample.collectedAt,
        rejectionReason:
          payload.status === "REJECTED"
            ? payload.rejectionReason.trim()
            : null,
        chainOfCustodyJson: JSON.stringify(custodyTrail.slice(0, 24)),
      },
      include: { patient: true },
    });

    const otherStatuses = sample.order.samples.map((entry) =>
      entry.id === sample.id ? payload.status : entry.status,
    );
    await tx.diagnosticOrder.update({
      where: { id: sample.orderId },
      data: { status: resolveOrderStatusFromSamples(otherStatuses) },
    });

    await recordAudit(tx, request.actor, {
      action: "SAMPLE_UPDATED",
      entityType: "Sample",
      entityId: savedSample.id,
      traceCode: savedSample.patient.traceCode,
      summary: `${savedSample.traceLabel} moved to ${payload.status}`,
      payload,
    });

    return savedSample;
  });

  await recordDispatchEvent("Sample", updated.id, updated);
  return reply.send(serializeSample(updated));
});

app.patch("/api/imaging/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "order:write")) {
    return deny(reply, "order:write");
  }

  const id = (request.params as { id: string }).id;
  const payload = imagingStudyUpdateInputSchema.parse(
    request.body,
  ) as ImagingStudyUpdateInput;

  const existing = await prisma.imagingStudy.findFirst({
    where: {
      id,
      orderItem: {
        order: {
          patient: {
            facilityId: request.actor.facilityId,
          },
        },
      },
    },
    include: {
      orderItem: {
        include: {
          order: { include: { patient: true } },
          catalogItem: true,
        },
      },
    },
  });

  if (!existing) {
    return reply.code(404).send({ message: "Imaging study not found." });
  }

  const orderStatus =
    payload.appointmentStatus === "ARRIVED" ||
    payload.appointmentStatus === "SCANNING"
      ? "IN_PROGRESS"
      : payload.appointmentStatus === "REPORTED" ||
          payload.appointmentStatus === "COMPLETED"
        ? "READY_FOR_REVIEW"
        : payload.appointmentStatus === "CANCELLED"
          ? "CANCELLED"
          : "REGISTERED";

  const updated = await prisma.$transaction(async (tx) => {
    const imagingStudy = await tx.imagingStudy.update({
      where: { id: existing.id },
      data: {
        appointmentStatus: payload.appointmentStatus,
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
        sonographerName: payload.sonographerName || null,
        radiologistName: payload.radiologistName || null,
        priorStudyReference: payload.priorStudyReference || null,
        criticalFlag: payload.criticalFlag,
      },
      include: {
        orderItem: {
          include: {
            order: { include: { patient: true } },
            catalogItem: true,
          },
        },
      },
    });

    await tx.diagnosticOrder.update({
      where: { id: imagingStudy.orderItem.orderId },
      data: { status: orderStatus },
    });

    return imagingStudy;
  });

  await recordDispatchEvent("ImagingStudy", updated.id, updated);
  await recordAudit(prisma, request.actor, {
    action: "IMAGING_STUDY_UPDATED",
    entityType: "ImagingStudy",
    entityId: updated.id,
    traceCode: updated.orderItem.order.patient.traceCode,
    summary: `${updated.orderItem.catalogItem.name} updated to ${updated.appointmentStatus} for ${updated.orderItem.order.patient.traceCode}`,
    payload,
  });

  return {
    id: updated.id,
    orderId: updated.orderItem.orderId,
    orderItemId: updated.orderItemId,
    patientId: updated.orderItem.order.patientId,
    patientTraceCode: updated.orderItem.order.patient.traceCode,
    patientName: `${updated.orderItem.order.patient.firstName} ${updated.orderItem.order.patient.lastName}`,
    serviceName: updated.orderItem.catalogItem.name,
    modality: updated.modality,
    appointmentStatus: updated.appointmentStatus,
    scheduledAt: updated.scheduledAt?.toISOString() ?? null,
    sonographerName: updated.sonographerName,
    radiologistName: updated.radiologistName,
    priorStudyReference: updated.priorStudyReference,
    criticalFlag: updated.criticalFlag,
    createdAt: updated.createdAt.toISOString(),
  } satisfies WorkflowPayload["imaging"][number];
});

app.post("/api/reports", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "report:write")) {
    return deny(reply, "report:write");
  }

  const payload = reportInputSchema.parse(request.body);
  const reportLifecycle = resolveReportLifecycle(payload.status, payload.signedBy);
  const report = await prisma.report.create({
    data: {
      patientId: payload.patientId,
      orderId: payload.orderId,
      title: payload.title,
      medicalHistory: payload.medicalHistory,
      summary: payload.summary,
      findings: payload.findings,
      impression: payload.impression,
      signedBy: reportLifecycle.signedBy,
      signedAt: reportLifecycle.signedAt,
      status: reportLifecycle.status,
      criticalFlag: payload.criticalFlag,
      imagePathsJson: JSON.stringify(payload.imagePaths),
    },
  });

  if (reportLifecycle.requiresPdf) {
    await ensureReportPdf(prisma, report.id);
  }

  const order = await prisma.diagnosticOrder.update({
    where: { id: payload.orderId },
    data: {
      status: payload.criticalFlag
        ? "READY_FOR_REVIEW"
        : reportLifecycle.orderStatus,
    },
    include: { patient: true },
  });
  await recordDispatchEvent("Report", report.id, report);
  await recordAudit(prisma, request.actor, {
    action: reportLifecycle.auditAction,
    entityType: "Report",
    entityId: report.id,
    traceCode: order.patient.traceCode,
    summary: `Report ${report.title} ${reportLifecycle.status.toLowerCase().replace(/_/gu, " ")} for ${order.patient.traceCode}`,
    payload,
  });
  return reply
    .code(201)
    .send(await prisma.report.findUniqueOrThrow({ where: { id: report.id } }));
});

app.post(
  "/api/reports/preview",
  async (request, reply): Promise<PrintableReportPayload | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }
    if (!hasCapability(request.actor, "report:write")) {
      return deny(reply, "report:write");
    }

    const payload = reportInputSchema.parse(request.body);
    return renderDraftPrintableReportHtml(prisma, payload);
  },
);

app.patch("/api/reports/:id/status", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "report:write")) {
    return deny(reply, "report:write");
  }

  const { id } = request.params as { id: string };
  const payload = reportStatusUpdateInputSchema.parse(request.body);
  const existing = await prisma.report.findUnique({
    where: { id },
    include: {
      patient: true,
    },
  });

  if (!existing) {
    return reply.code(404).send({ message: "Report not found." });
  }

  const reportLifecycle = resolveReportLifecycle(
    payload.status,
    payload.signedBy.trim() || request.actor.displayName,
  );
  const updated = await prisma.report.update({
    where: { id: existing.id },
    data: {
      status: reportLifecycle.status,
      signedBy: reportLifecycle.signedBy,
      signedAt: reportLifecycle.signedAt,
    },
  });

  if (reportLifecycle.requiresPdf) {
    await ensureReportPdf(prisma, updated.id);
  }

  await prisma.diagnosticOrder.update({
    where: { id: existing.orderId },
    data: { status: reportLifecycle.orderStatus },
  });
  await recordDispatchEvent("Report", updated.id, updated);
  await recordAudit(prisma, request.actor, {
    action: reportLifecycle.auditAction,
    entityType: "Report",
    entityId: updated.id,
    traceCode: existing.patient.traceCode,
    summary: `Report ${existing.title} ${reportLifecycle.status.toLowerCase().replace(/_/gu, " ")} for ${existing.patient.traceCode}`,
    payload,
  });

  return reply.send(updated);
});

app.get(
  "/api/reports/:id/printable",
  async (request, reply): Promise<PrintableReportPayload | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }

    const id = (request.params as { id: string }).id;
    return renderPrintableReportHtml(prisma, id);
  },
);

app.get("/api/reports/:id/pdf", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const id = (request.params as { id: string }).id;
  const pdfBuffer = await readReportPdf(prisma, id);
  reply.type("application/pdf");
  return reply.send(pdfBuffer);
});

app.post("/api/qc/events", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "qc:manage")) {
    return deny(reply, "qc:manage");
  }

  const payload = qcEventInputSchema.parse(request.body);
  const history = await prisma.qualityControlEvent.findMany({
    where: { instrumentName: payload.instrumentName, analyte: payload.analyte },
    orderBy: { occurredAt: "asc" },
    take: 9,
  });
  const points = [
    ...history.map((event) => ({
      observedValue: event.observedValue,
      meanValue: event.meanValue,
      standardDeviation: event.standardDeviation,
      occurredAt: event.occurredAt,
    })),
    {
      observedValue: payload.observedValue,
      meanValue: payload.meanValue,
      standardDeviation: payload.standardDeviation,
      occurredAt: new Date(),
    },
  ];
  const violations = evaluateWestgard(points);
  const event = await prisma.qualityControlEvent.create({
    data: {
      module: payload.module,
      instrumentName: payload.instrumentName,
      analyte: payload.analyte,
      controlLevel: payload.controlLevel,
      lotNumber: payload.lotNumber,
      observedValue: payload.observedValue,
      meanValue: payload.meanValue,
      standardDeviation: payload.standardDeviation,
      expectedRange: payload.expectedRange,
      status: violations.length ? "REVIEW" : "PASS",
      performedBy: payload.performedBy,
      runDate: new Date(),
      traceCode: payload.traceCode,
      westgardViolationsJson: JSON.stringify(violations),
      notes: payload.notes,
    },
  });

  await recordDispatchEvent("QualityControlEvent", event.id, event);
  await recordAudit(prisma, request.actor, {
    action: "QC_RECORDED",
    entityType: "QualityControlEvent",
    entityId: event.id,
    traceCode: payload.traceCode,
    summary: `${payload.analyte} QC recorded on ${payload.instrumentName}${violations.length ? ` with ${violations.join(", ")}` : ""}`,
    payload,
  });
  return reply.code(201).send({ ...event, violations });
});

app.post("/api/inventory/transactions", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "inventory:manage")) {
    return deny(reply, "inventory:manage");
  }

  const payload = inventoryTransactionInputSchema.parse(request.body);
  const item = await prisma.inventoryItem.findUnique({
    where: { id: payload.itemId },
  });
  if (!item) {
    return reply.code(404).send({ message: "Inventory item not found." });
  }

  const signedQuantity = ["ISSUE", "EXPIRY"].includes(payload.type)
    ? -payload.quantity
    : payload.quantity;
  const quantityOnHand = Math.max(0, item.quantityOnHand + signedQuantity);
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: payload.type,
        quantity: payload.quantity,
        reason: payload.reason,
      },
    });
    const updated = await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantityOnHand,
        expiryDate:
          payload.expiryDate.trim().length > 0
            ? normalizeDateInput(payload.expiryDate)
            : item.expiryDate,
        preferredVendor:
          payload.preferredVendor.trim().length > 0
            ? payload.preferredVendor.trim()
            : item.preferredVendor,
        storageLocation:
          payload.storageLocation.trim().length > 0
            ? payload.storageLocation.trim()
            : item.storageLocation,
        lastRestockedAt:
          payload.type === "RECEIPT" ? new Date() : item.lastRestockedAt,
      },
    });
    await recordAudit(tx, request.actor, {
      action: "INVENTORY_UPDATED",
      entityType: "InventoryItem",
      entityId: updated.id,
      traceCode: payload.traceCode,
      summary: `${payload.type} ${payload.quantity} ${item.unit} for ${item.name}`,
      payload,
    });
    return { transaction, updated };
  });

  await recordDispatchEvent(
    "InventoryTransaction",
    result.transaction.id,
    result.transaction,
  );
  return reply.code(201).send(result);
});

app.post("/api/billing/payments", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "finance:manage")) {
    return deny(reply, "finance:manage");
  }

  const payload = paymentInputSchema.parse(request.body);
  const invoice = await prisma.invoice.findUnique({
    where: { id: payload.invoiceId },
    include: { patient: true, payments: true },
  });
  if (!invoice) {
    return reply.code(404).send({ message: "Invoice not found." });
  }

  const settlement = summarizeInvoiceSettlement(invoice);
  const targetBalanceCents =
    payload.responsibility === "PAYER"
      ? settlement.payerBalanceCents
      : settlement.patientBalanceCents;
  if (targetBalanceCents <= 0) {
    return reply.code(400).send({
      message:
        payload.responsibility === "PAYER"
          ? "No payer balance remains on this invoice."
          : "No patient balance remains on this invoice.",
    });
  }
  if (payload.amountCents > targetBalanceCents) {
    return reply.code(400).send({
      message: `Payment exceeds the remaining ${payload.responsibility.toLowerCase()} balance.`,
    });
  }

  const response = await prisma.$transaction(async (tx) => {
    const payment = await tx.paymentRecord.create({
      data: {
        invoiceId: invoice.id,
        method: payload.method,
        responsibility: payload.responsibility,
        amountCents: payload.amountCents,
        reference: payload.reference,
        receivedBy: payload.receivedBy,
        traceCode: payload.traceCode ?? invoice.patient.traceCode,
        notes: payload.notes,
      },
    });
    const nextPayments = [
      ...invoice.payments,
      { amountCents: payload.amountCents, responsibility: payload.responsibility },
    ];
    const nextSettlement = summarizeInvoiceSettlement({
      status: invoice.status,
      patientResponsibilityCents: invoice.patientResponsibilityCents,
      payerResponsibilityCents: invoice.payerResponsibilityCents,
      payments: nextPayments,
    });
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaidCents: nextSettlement.totalPaidCents,
        status: nextSettlement.status,
        claimStatus: resolveClaimSettlementStatus(
          invoice.claimStatus,
          invoice.payerResponsibilityCents,
          nextSettlement.payerPaidCents,
        ),
      },
    });
    await recordAudit(tx, request.actor, {
      action: "PAYMENT_RECORDED",
      entityType: "Invoice",
      entityId: updatedInvoice.id,
      traceCode: invoice.patient.traceCode,
      summary: `${payload.responsibility} ${payload.method} payment recorded for ${invoice.patient.traceCode}`,
      payload,
    });
    return { payment, updatedInvoice };
  });

  await recordDispatchEvent(
    "PaymentRecord",
    response.payment.id,
    response.payment,
  );
  return reply.code(201).send(response);
});

app.get(
  "/api/billing/payments/:id/printable",
  async (request, reply): Promise<PrintableReceiptPayload | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }

    const { id } = request.params as { id: string };
    return renderPrintableReceiptHtml(prisma, id);
  },
);

app.get(
  "/api/billing/invoices/:id/printable",
  async (request, reply): Promise<PrintableInvoicePayload | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }

    const { id } = request.params as { id: string };
    return renderPrintableInvoiceHtml(prisma, id);
  },
);

app.patch("/api/billing/invoices/:id/claim", async (request, reply) => {
  if (!hasCapability(request.actor, "finance:manage")) {
    return deny(reply, "finance:manage");
  }

  const { id } = request.params as { id: string };
  const payload = claimStatusUpdateInputSchema.parse(
    request.body,
  ) as ClaimStatusUpdateInput;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { patient: true },
  });
  if (!invoice) {
    return reply.code(404).send({ message: "Invoice not found." });
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { claimStatus: payload.claimStatus },
  });
  await recordAudit(prisma, request.actor, {
    action: "CLAIM_STATUS_UPDATED",
    entityType: "Invoice",
    entityId: updated.id,
    traceCode: invoice.patient.traceCode,
    summary: `Claim status moved to ${payload.claimStatus} for ${invoice.patient.traceCode}`,
    payload,
  });

  return reply.send(updated);
});

app.post("/api/notifications", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "notify:queue")) {
    return deny(reply, "notify:queue");
  }

  const payload = notificationInputSchema.parse(request.body);
  if (payload.channel === "INTERNAL") {
    return reply.code(400).send({
      message: "Use the internal bell workflow for INTERNAL alerts.",
    });
  }

  const channel: Exclude<NotificationInput["channel"], "INTERNAL"> =
    payload.channel;
  const notification = await prisma.notificationQueue.create({
    data: {
      patientId: payload.patientId,
      traceCode: payload.traceCode,
      recipient: payload.recipient,
      channel,
      message: payload.message,
      scheduledFor: payload.scheduledFor
        ? new Date(payload.scheduledFor)
        : null,
      createdBy: payload.createdBy,
      status: "QUEUED",
    },
  });
  await recordDispatchEvent("NotificationQueue", notification.id, notification);
  await recordAudit(prisma, request.actor, {
    action: "NOTIFICATION_QUEUED",
    entityType: "NotificationQueue",
    entityId: notification.id,
    traceCode: payload.traceCode,
    summary: `${payload.channel} notification queued for ${payload.recipient}`,
    payload,
  });
  return reply.code(201).send(notification);
});

app.get(
  "/api/users/directory",
  async (request, reply): Promise<UserDirectoryEntryPayload[] | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }

    const users = await prisma.appUser.findMany({
      where: { isActive: true },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
      },
    });

    return users;
  },
);

app.post("/api/notifications/internal", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const payload = internalAlertInputSchema.parse(request.body);
  const recipient = await prisma.appUser.findUnique({
    where: { username: payload.recipientUsername },
    select: { id: true, isActive: true, displayName: true },
  });

  if (!recipient || !recipient.isActive) {
    return reply.code(404).send({ message: "Selected user is not available." });
  }

  const notification = await prisma.notificationQueue.create({
    data: {
      recipient: `internal:${payload.recipientUsername}`,
      channel: "SMS",
      message: payload.message,
      createdBy: request.actor.displayName,
      status: "QUEUED",
    },
  });

  await recordAudit(prisma, request.actor, {
    action: "INTERNAL_ALERT_QUEUED",
    entityType: "NotificationQueue",
    entityId: notification.id,
    summary: `Internal alert queued for ${payload.recipientUsername}`,
    payload,
  });

  return reply.code(201).send({ id: notification.id });
});

app.get(
  "/api/notifications/inbox",
  async (request, reply): Promise<InternalAlertPayload[] | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }

    const alerts = await prisma.notificationQueue.findMany({
      where: {
        status: "QUEUED",
        recipient: `internal:${request.actor.username}`,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return alerts.map((alert) => ({
      id: alert.id,
      recipientUsername: request.actor.username,
      message: alert.message,
      createdBy: alert.createdBy,
      createdAt: alert.createdAt.toISOString(),
    }));
  },
);

app.post("/api/notifications/:id/acknowledge", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const id = (request.params as { id: string }).id;
  const alert = await prisma.notificationQueue.findUnique({ where: { id } });

  if (!alert || alert.recipient !== `internal:${request.actor.username}`) {
    return reply.code(404).send({ message: "Alert not found." });
  }

  await prisma.notificationQueue.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });

  return reply.code(200).send({ id, status: "SENT" });
});

app.get("/api/admin/backups", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "backup:manage")) {
    return deny(reply, "backup:manage");
  }

  return prisma.backupSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
});

app.post("/api/admin/backups", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "backup:manage")) {
    return deny(reply, "backup:manage");
  }

  const snapshot = await createEncryptedBackup(prisma, request.actor);
  return reply.code(201).send(snapshot);
});

app.post("/api/admin/backups/import", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "backup:manage")) {
    return deny(reply, "backup:manage");
  }

  const payload = importBackupInputSchema.parse(request.body);
  const snapshot = await importEncryptedBackup(prisma, request.actor, payload);
  return reply.code(201).send(snapshot);
});

app.get("/api/admin/backups/:id/download", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "backup:manage")) {
    return deny(reply, "backup:manage");
  }

  const { id } = request.params as { id: string };
  const snapshot = await prisma.backupSnapshot.findUniqueOrThrow({
    where: { id },
  });
  const encryptedPayload = await readFile(snapshot.filePath, "utf8");
  const safeFileName = `${snapshot.label.replace(/"/gu, "")}.enc`;

  reply.header("content-type", "application/octet-stream");
  reply.header(
    "content-disposition",
    `attachment; filename="${safeFileName}"`,
  );

  return reply.send(encryptedPayload);
});

app.post("/api/admin/restore", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "backup:manage")) {
    return deny(reply, "backup:manage");
  }

  const payload = restoreBackupInputSchema.parse(request.body);
  const snapshot = await restoreBackup(
    prisma,
    request.actor,
    payload.snapshotId,
  );
  return reply.code(200).send({ restored: snapshot.id, label: snapshot.label });
});

app.get(
  "/api/admin/users",
  async (request, reply): Promise<AdminUserSummaryPayload[] | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }
    if (!hasCapability(request.actor, "user:manage")) {
      return deny(reply, "user:manage");
    }

    const users = await listLocalUsers(prisma);
    return users.map((user) => ({
      ...user,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      pinChangedAt: user.pinChangedAt.toISOString(),
      createdAt: user.createdAt.toISOString(),
    }));
  },
);

app.post("/api/admin/users", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "user:manage")) {
    return deny(reply, "user:manage");
  }

  const payload = adminUserInputSchema.parse(request.body);
  const facility = await prisma.facility.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!facility) {
    return reply.code(500).send({ message: "Facility not initialized." });
  }

  const user = await createLocalUser(prisma, {
    ...payload,
    facilityId: facility.id,
  });
  await recordAudit(prisma, request.actor, {
    action: "USER_CREATED",
    entityType: "AppUser",
    entityId: user.id,
    summary: `Local user ${user.username} created with role ${user.role}`,
  });

  return reply.code(201).send(user);
});

app.post("/api/admin/users/:id/rotate-pin", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "user:manage")) {
    return deny(reply, "user:manage");
  }

  const id = (request.params as { id: string }).id;
  const payload = rotatePinInputSchema.parse(request.body);
  const user = await rotateUserPin(prisma, id, payload.newPin);
  await recordAudit(prisma, request.actor, {
    action: "PIN_ROTATED",
    entityType: "AppUser",
    entityId: user.id,
    summary: `PIN rotated for ${user.username}`,
  });

  return reply.code(200).send({
    id: user.id,
    username: user.username,
    pinChangedAt: user.pinChangedAt.toISOString(),
  });
});

app.post("/api/admin/users/:id/status", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "user:manage")) {
    return deny(reply, "user:manage");
  }

  const id = (request.params as { id: string }).id;
  const payload = userStatusInputSchema.parse(request.body);
  const user = await setUserActiveState(prisma, id, payload.isActive);
  await recordAudit(prisma, request.actor, {
    action: payload.isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
    entityType: "AppUser",
    entityId: user.id,
    summary: `${user.username} marked ${payload.isActive ? "active" : "inactive"}`,
  });

  return reply.code(200).send({ id: user.id, isActive: user.isActive });
});

app.post("/api/admin/users/:id/unlock", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "user:manage")) {
    return deny(reply, "user:manage");
  }

  const id = (request.params as { id: string }).id;
  const user = await unlockUser(prisma, id);
  await recordAudit(prisma, request.actor, {
    action: "USER_UNLOCKED",
    entityType: "AppUser",
    entityId: user.id,
    summary: `${user.username} lockout reset`,
  });

  return reply
    .code(200)
    .send({ id: user.id, lockedUntil: null, failedLoginCount: 0 });
});

app.delete("/api/admin/users/:id", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "user:manage")) {
    return deny(reply, "user:manage");
  }

  const id = (request.params as { id: string }).id;

  try {
    const user = await deleteLocalUser(prisma, {
      actorUserId: request.actor.id,
      actorFacilityId: request.actor.facilityId,
      userId: id,
    });
    await recordAudit(prisma, request.actor, {
      action: "USER_DELETED",
      entityType: "AppUser",
      entityId: user.id,
      summary: `${user.username} deleted from user management`,
    });

    return reply.code(204).send();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "User deletion failed.";
    const statusCode = message === "User not found." ? 404 : 409;
    return reply.code(statusCode).send({ message });
  }
});

const getIntegrationStatus = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<IntegrationDispatchStatusPayload | unknown> => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "integration:manage")) {
    return deny(reply, "integration:manage");
  }

  return getIntegrationDispatchStatus(prisma);
};

const runIntegrationDispatch = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<IntegrationDispatchRunPayload | unknown> => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "integration:manage")) {
    return deny(reply, "integration:manage");
  }

  return runIntegrationDispatchCycle(prisma, request.actor, 25);
};

app.get("/api/admin/integrations/status", getIntegrationStatus);

app.post("/api/admin/integrations/run", runIntegrationDispatch);

if (serveBundledWeb) {
  app.setNotFoundHandler(async (request, reply) => {
    const pathname = request.url.split("?")[0] ?? "/";
    if (
      pathname.startsWith("/api") ||
      pathname === "/health" ||
      pathname === "/ready"
    ) {
      return reply.code(404).send({ message: "Not found." });
    }

    if (pathname.includes(".")) {
      return reply.code(404).send({ message: "Not found." });
    }

    return reply.sendFile("index.html");
  });
}

const port = Number(process.env.PORT ?? 4000);

const bootstrap = async () => {
  const facilityCode = process.env.MEDILAB_FACILITY_CODE ?? "MLN-ACC";
  const facilityName =
    process.env.MEDILAB_FACILITY_NAME ?? "MediLab Nexus Diagnostic Centre";
  await purgeExpiredSessions(prisma);
  await prisma.facility.upsert({
    where: { code: facilityCode },
    update: {},
    create: {
      code: facilityCode,
      name: facilityName,
      phone: "+233 20 000 0000",
      email: "hello@medilabnexus.local",
      location: "Community 6, Tema",
      footerMessage:
        "Thank you for choosing MediLab Nexus. Present your Trace Code whenever you contact the lab.",
    },
  });
};

bootstrap()
  .then(() => app.listen({ port, host: "0.0.0.0" }))
  .catch(async (error) => {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
