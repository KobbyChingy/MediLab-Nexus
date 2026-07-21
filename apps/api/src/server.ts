import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { CatalogKind, Department, prisma } from "@medilab/db";
import {
  adminUserInputSchema,
  analyticsRangeKeys,
  bulkServiceInputSchema,
  catalogSeed,
  expenseInputSchema,
  facilitySettingsInputSchema,
  imagingStudyUpdateInputSchema,
  internalAlertInputSchema,
  inventoryTransactionInputSchema,
  loginInputSchema,
  notificationInputSchema,
  orderInputSchema,
  patientInputSchema,
  patientReferralUpdateInputSchema,
  paymentInputSchema,
  qcEventInputSchema,
  referralDoctorInputSchema,
  rotatePinInputSchema,
  reportInputSchema,
  restoreBackupInputSchema,
  serviceInputSchema,
  userStatusInputSchema,
  type AdminOverviewPayload,
  type AdminUserSummaryPayload,
  type BootstrapPayload,
  type Capability,
  type CatalogSeedItem,
  type ExpenseSummaryPayload,
  type ExpenseWorkspacePayload,
  type FacilityProfile,
  type FinanceAnalyticsPayload,
  type InternalAlertPayload,
  type ImagingStudyUpdateInput,
  type UserDirectoryEntryPayload,
  type ReferralDoctorSummaryPayload,
  type PrintableAnalyticsPayload,
  type PrintableInvoicePayload,
  type PrintableReportPayload,
  type PrintableReceiptPayload,
  type IntegrationDispatchRunPayload,
  type IntegrationDispatchStatusPayload,
  type NotificationInput,
  type WorkflowPayload,
} from "@medilab/shared";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { recordAudit } from "./services/audit.js";
import {
  createLocalUser,
  getSessionFromToken,
  listLocalUsers,
  loginWithPin,
  logoutSession,
  purgeExpiredSessions,
  rotateUserPin,
  setUserActiveState,
  unlockUser,
} from "./services/auth.js";
import { createEncryptedBackup, restoreBackup } from "./services/backup.js";
import { buildLeveyJenningsSeries, evaluateWestgard } from "./services/qc.js";
import {
  ensureReportPdf,
  renderPrintableFinanceAnalyticsHtml,
  renderPrintableInvoiceHtml,
  readReportPdf,
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
      }
    | null
    | undefined,
): FacilityProfile {
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
  };
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
  commissionPercent: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ReferralDoctorSummaryPayload {
  return {
    id: doctor.id,
    fullName: doctor.fullName,
    phone: doctor.phone,
    email: doctor.email,
    commissionPercent: doctor.commissionPercent,
    isActive: doctor.isActive,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}

function serializePatient(patient: {
  id: string;
  traceCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: Date;
  referralDoctorId: string | null;
  referralName?: string | null;
  referralCommissionPercent?: number | null;
  referralDoctor?: {
    fullName: string;
    commissionPercent: number;
  } | null;
}) {
  return {
    id: patient.id,
    traceCode: patient.traceCode,
    firstName: patient.firstName,
    lastName: patient.lastName,
    phone: patient.phone,
    createdAt: patient.createdAt.toISOString(),
    referralDoctorId: patient.referralDoctorId,
    referralDoctorName:
      patient.referralDoctor?.fullName ?? patient.referralName ?? null,
    referralDoctorCommissionPercent:
      patient.referralDoctor?.commissionPercent ??
      patient.referralCommissionPercent ??
      null,
  };
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

function getAnalyticsRangeStart(range: (typeof analyticsRangeKeys)[number]) {
  if (range === "ALL") {
    return null;
  }

  const days =
    range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  return new Date(Date.now() - 1000 * 60 * 60 * 24 * days);
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

function normalizeDateInput(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
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
  const range = resolveAnalyticsRange(query);
  const rangeStart = getAnalyticsRangeStart(range);
  const selectedCategory = query.category?.trim();
  const startDate = normalizeDateInput(query.startDate);
  const endDate = normalizeDateInput(query.endDate);

  const rangeExpenses = await prisma.expenseRecord.findMany({
    where: {
      facilityId: actor.facilityId,
      ...(rangeStart ? { incurredAt: { gte: rangeStart } } : {}),
    },
    orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
  });

  const endBoundary = endDate
    ? new Date(endDate.getTime() + 1000 * 60 * 60 * 24 - 1)
    : null;
  const filteredExpenses = rangeExpenses.filter((expense) => {
    const matchesCategory =
      !selectedCategory || selectedCategory === "ALL"
        ? true
        : expense.category === selectedCategory;
    const matchesStart = !startDate || expense.incurredAt >= startDate;
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
  const referralCommissionEarnedCents = invoices.reduce((sum, invoice) => {
    const commissionPercent = invoice.patient.referralDoctor?.commissionPercent;
    if (commissionPercent == null) {
      return sum;
    }

    return (
      sum + Math.round(invoice.amountPaidCents * (commissionPercent / 100))
    );
  }, 0);
  const referralCommissionOutstandingCents = invoices.reduce((sum, invoice) => {
    const commissionPercent = invoice.patient.referralDoctor?.commissionPercent;
    if (commissionPercent == null) {
      return sum;
    }

    return (
      sum +
      Math.round(
        Math.max(0, invoice.amountDueCents - invoice.amountPaidCents) *
          (commissionPercent / 100),
      )
    );
  }, 0);
  const referralLeaderMap = new Map<
    string,
    {
      doctorName: string;
      commissionPercent: number;
      invoicesCount: number;
      revenueCents: number;
      commissionDueCents: number;
      commissionOutstandingCents: number;
    }
  >();
  for (const invoice of invoices) {
    const doctor = invoice.patient.referralDoctor;
    if (!doctor) {
      continue;
    }

    const commissionDueCents = Math.round(
      invoice.amountDueCents * (doctor.commissionPercent / 100),
    );
    const commissionOutstandingForInvoice = Math.round(
      Math.max(0, invoice.amountDueCents - invoice.amountPaidCents) *
        (doctor.commissionPercent / 100),
    );
    const current = referralLeaderMap.get(doctor.id) ?? {
      doctorName: doctor.fullName,
      commissionPercent: doctor.commissionPercent,
      invoicesCount: 0,
      revenueCents: 0,
      commissionDueCents: 0,
      commissionOutstandingCents: 0,
    };
    current.invoicesCount += 1;
    current.revenueCents += invoice.amountPaidCents;
    current.commissionDueCents += commissionDueCents;
    current.commissionOutstandingCents += commissionOutstandingForInvoice;
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
      referralCommissionEarnedCents,
      referralCommissionOutstandingCents,
      paymentMix: [...paymentMixMap.entries()].map(([method, data]) => ({
        method,
        ...data,
      })),
      referralLeaders: [...referralLeaderMap.values()]
        .sort(
          (left, right) => right.commissionDueCents - left.commissionDueCents,
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
  range: (typeof analyticsRangeKeys)[number],
): Promise<FinanceAnalyticsPayload> {
  const rangeStart = getAnalyticsRangeStart(range);
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
      ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
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
      ...(rangeStart ? { incurredAt: { gte: rangeStart } } : {}),
    },
    orderBy: { incurredAt: "desc" },
  });
  const inventoryAudits = await prisma.auditLog.findMany({
    where: {
      action: "INVENTORY_UPDATED",
      ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const payments = invoices.flatMap((invoice) =>
    invoice.payments.filter((payment) =>
      rangeStart ? payment.createdAt >= rangeStart : true,
    ),
  );
  const grossBilledCents = invoices.reduce(
    (sum, invoice) => sum + invoice.subtotalCents,
    0,
  );
  const netDueCents = invoices.reduce(
    (sum, invoice) => sum + invoice.amountDueCents,
    0,
  );
  const collectedCents = payments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0,
  );
  const outstandingCents = invoices.reduce(
    (sum, invoice) =>
      sum + Math.max(0, invoice.amountDueCents - invoice.amountPaidCents),
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
  const referralCommissionDueCents = invoices.reduce((sum, invoice) => {
    const commissionPercent = invoice.patient.referralDoctor?.commissionPercent;
    if (commissionPercent == null) {
      return sum;
    }
    return sum + Math.round(invoice.amountDueCents * (commissionPercent / 100));
  }, 0);
  const referralCommissionOutstandingCents = invoices.reduce((sum, invoice) => {
    const commissionPercent = invoice.patient.referralDoctor?.commissionPercent;
    if (commissionPercent == null) {
      return sum;
    }
    return (
      sum +
      Math.round(
        Math.max(0, invoice.amountDueCents - invoice.amountPaidCents) *
          (commissionPercent / 100),
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
    const current = invoiceStatusMap.get(invoice.status) ?? {
      status: invoice.status,
      count: 0,
      totalDueCents: 0,
      outstandingCents: 0,
    };
    current.count += 1;
    current.totalDueCents += invoice.amountDueCents;
    current.outstandingCents += Math.max(
      0,
      invoice.amountDueCents - invoice.amountPaidCents,
    );
    invoiceStatusMap.set(invoice.status, current);
  }

  const paymentMixMap = new Map<
    string,
    { method: string; totalCents: number; count: number }
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
    const balanceCents = Math.max(
      0,
      invoice.amountDueCents - invoice.amountPaidCents,
    );
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
      month.billedCents += invoice.amountDueCents;
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
    const subtotalCents = Math.max(invoice.subtotalCents, 0);
    const amountDueCents = Math.max(invoice.amountDueCents, 0);
    const amountPaidCents = Math.max(invoice.amountPaidCents, 0);
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
      const lineShare = subtotalCents > 0 ? line.totalPriceCents / subtotalCents : 0;
      const lineBilledCents = line.totalPriceCents;
      const lineDueCents = Math.round(amountDueCents * lineShare);
      const lineCollectedCents = Math.min(
        lineDueCents,
        Math.round(amountPaidCents * lineShare),
      );
      const lineOutstandingCents = Math.max(0, lineDueCents - lineCollectedCents);

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
                (((secondHalfBilledCents - firstHalfBilledCents) /
                  firstHalfBilledCents) *
                  100).toFixed(2),
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
      commissionPercent: number;
      invoicesCount: number;
      billedCents: number;
      collectedCents: number;
      outstandingCents: number;
      commissionDueCents: number;
    }
  >();
  for (const invoice of invoices) {
    const doctor = invoice.patient.referralDoctor;
    if (!doctor) {
      continue;
    }
    const current = referrerMap.get(doctor.id) ?? {
      doctorName: doctor.fullName,
      commissionPercent: doctor.commissionPercent,
      invoicesCount: 0,
      billedCents: 0,
      collectedCents: 0,
      outstandingCents: 0,
      commissionDueCents: 0,
    };
    current.invoicesCount += 1;
    current.billedCents += invoice.amountDueCents;
    current.collectedCents += invoice.amountPaidCents;
    current.outstandingCents += Math.max(
      0,
      invoice.amountDueCents - invoice.amountPaidCents,
    );
    current.commissionDueCents += Math.round(
      invoice.amountDueCents * (doctor.commissionPercent / 100),
    );
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
    const actorEntry = ensureUserPerformance(payment.receivedBy || "Unknown user");
    actorEntry.generatedCents += payment.amountCents;
    actorEntry.paymentsCount += 1;
  }

  for (const expense of expenses) {
    const actorEntry = ensureUserPerformance(expense.recordedBy || "Unknown user");
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
    range,
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
      referralCommissionDueCents,
      referralCommissionOutstandingCents,
    },
    invoiceStatus: [...invoiceStatusMap.values()].sort(
      (left, right) => right.totalDueCents - left.totalDueCents,
    ),
    paymentMix: [...paymentMixMap.values()].sort(
      (left, right) => right.totalCents - left.totalCents,
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
      .sort((left, right) => right.commissionDueCents - left.commissionDueCents)
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

  reply.header(
    "set-cookie",
    serializeSessionCookie(session.sessionToken, session.expiresAt),
  );

  return reply.code(200).send({
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
  });
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
  }

  await logoutSession(prisma, sessionToken);
  return reply.code(204).send();
});

app.get("/api/bootstrap", async (): Promise<BootstrapPayload> => {
  const facility = await prisma.facility.findFirst({
    orderBy: { createdAt: "asc" },
  });
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

app.get("/api/analytics/finance", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "finance:manage")) {
    return deny(reply, "finance:manage");
  }

  const range = resolveAnalyticsRange(request.query as { range?: string });
  return buildFinanceAnalytics(request.actor, range);
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

    const range = resolveAnalyticsRange(request.query as { range?: string });
    const analytics = await buildFinanceAnalytics(request.actor, range);
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

  return buildExpenseWorkspace(request.actor, request.query as {
    range?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  });
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
    summary: `${created.category} expense recorded at ${created.amountCents} pesewas`,
    payload,
  });
  await recordDispatchEvent("ExpenseRecord", created.id, created);

  return reply.code(201).send(serializeExpense(created));
});

app.get("/api/admin/facility", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "user:manage")) {
    return deny(reply, "user:manage");
  }

  const facility = await prisma.facility.findFirst({
    orderBy: { createdAt: "asc" },
  });
  return serializeFacility(facility);
});

app.put("/api/admin/facility", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }
  if (!hasCapability(request.actor, "user:manage")) {
    return deny(reply, "user:manage");
  }

  const payload = facilitySettingsInputSchema.parse(request.body);
  const facility = await prisma.facility.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!facility) {
    return reply.code(500).send({ message: "Facility not initialized." });
  }

  const updated = await prisma.facility.update({
    where: { id: facility.id },
    data: {
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      location: payload.location,
      logoDataUrl: payload.logoDataUrl,
      footerMessage: payload.footerMessage,
    },
  });

  await recordAudit(prisma, request.actor, {
    action: "FACILITY_UPDATED",
    entityType: "Facility",
    entityId: updated.id,
    summary: `Facility profile updated for ${updated.code}`,
    payload: {
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      location: payload.location,
      footerMessage: payload.footerMessage,
      logoUpdated: Boolean(payload.logoDataUrl),
    },
  });

  return serializeFacility(updated);
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
      commissionPercent: payload.commissionPercent,
      isActive: payload.isActive,
    },
  });

  await recordAudit(prisma, request.actor, {
    action: "REFERRAL_DOCTOR_CREATED",
    entityType: "ReferralDoctor",
    entityId: created.id,
    summary: `Referral doctor ${created.fullName} added at ${created.commissionPercent}%`,
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
      commissionPercent: payload.commissionPercent,
      isActive: payload.isActive,
    },
  });

  await recordAudit(prisma, request.actor, {
    action: "REFERRAL_DOCTOR_UPDATED",
    entityType: "ReferralDoctor",
    entityId: updated.id,
    summary: `Referral doctor ${updated.fullName} updated to ${updated.commissionPercent}%`,
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
    summary: `Service ${created.code} created at ${created.priceCents} pesewas`,
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
        summary: `Service ${service.code} created at ${service.priceCents} pesewas via bulk import`,
        payload: serializeCatalogItem(service),
      }),
      recordDispatchEvent("CatalogItem", service.id, service),
    ]),
    ...updated.flatMap((service) => [
      recordAudit(prisma, request.actor, {
        action: "SERVICE_UPDATED",
        entityType: "CatalogItem",
        entityId: service.id,
        summary: `Service ${service.code} updated to ${service.priceCents} pesewas via bulk import`,
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
    summary: `Service ${updated.code} updated to ${updated.priceCents} pesewas`,
    payload,
  });
  await recordDispatchEvent("CatalogItem", updated.id, updated);

  return serializeCatalogItem(updated);
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
          commissionPercent: true,
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
          commissionPercent: true,
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
    },
    include: {
      referralDoctor: {
        select: {
          fullName: true,
          commissionPercent: true,
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

  const patient = await prisma.patient.create({
    data: {
      facilityId: trace.facilityId,
      referralDoctorId: referralDoctor?.id ?? null,
      referralName: payload.referralName.trim() || null,
      referralCommissionPercent: payload.referralCommissionPercent ?? null,
      traceCode: trace.traceCode,
      traceSequence: trace.traceSequence,
      initials: trace.initials,
      firstName: payload.firstName,
      middleName: payload.middleName,
      lastName: payload.lastName,
      dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
      gender: payload.gender,
      phone: payload.phone,
      nhisId: payload.nhisId,
      allergies: payload.allergies,
      medicalHistory: payload.medicalHistory,
      consentAccepted: payload.consentAccepted,
      photoPath: payload.photoPath,
      syncStatus: "LOCAL_ONLY",
    },
    include: {
      referralDoctor: {
        select: {
          fullName: true,
          commissionPercent: true,
        },
      },
    },
  });

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
  const catalogItems = await prisma.catalogItem.findMany({
    where: {
      OR: [{ id: { in: payload.itemIds } }, { code: { in: payload.itemIds } }],
    },
  });

  if (catalogItems.length !== payload.itemIds.length) {
    return reply
      .code(400)
      .send({ message: "One or more catalog items were not found." });
  }

  const totalAmountCents = catalogItems.reduce(
    (sum, item) => sum + item.priceCents,
    0,
  );
  const createdOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.diagnosticOrder.create({
      data: {
        patientId: payload.patientId,
        accessionNumber: buildAccessionNumber(),
        orderedBy: payload.orderedBy,
        priority: payload.priority,
        insuranceProvider: payload.insuranceProvider,
        insuranceAuthorized: payload.insuranceAuthorized,
        notes: payload.notes,
        referringClinic: payload.referringClinic,
        scheduledFor: payload.scheduledFor
          ? new Date(payload.scheduledFor)
          : null,
        totalAmountCents,
        items: {
          create: catalogItems.map((item) => ({
            catalogItemId: item.id,
            status: item.kind === "IMAGING" ? "REGISTERED" : "COLLECTED",
          })),
        },
      },
      include: { patient: true, items: { include: { catalogItem: true } } },
    });

    for (const item of order.items) {
      if (item.catalogItem.kind === "TEST") {
        await tx.sample.create({
          data: {
            patientId: order.patientId,
            orderId: order.id,
            traceLabel: buildSampleLabel(
              order.patient.traceCode,
              item.catalogItem.department,
            ),
            specimenType: item.catalogItem.specimenType ?? "Unspecified",
            status: "PENDING",
          },
        });
      }

      if (item.catalogItem.kind === "IMAGING") {
        await tx.imagingStudy.create({
          data: {
            orderItemId: item.id,
            modality: item.catalogItem.modality ?? "Ultrasound",
            scheduledAt: payload.scheduledFor
              ? new Date(payload.scheduledFor)
              : null,
            appointmentStatus: "SCHEDULED",
            sonographerName: payload.sonographerName || null,
            radiologistName: payload.radiologistName || null,
            priorStudyReference: payload.priorStudyReference || null,
          },
        });
      }
    }

    const insuranceCoveredCents = payload.insuranceAuthorized
      ? Math.round(totalAmountCents * 0.4)
      : 0;
    const invoice = await tx.invoice.create({
      data: {
        patientId: payload.patientId,
        orderId: order.id,
        subtotalCents: totalAmountCents,
        insuranceCoveredCents,
        amountDueCents: totalAmountCents - insuranceCoveredCents,
        payerName: payload.insuranceProvider,
        lines: {
          create: catalogItems.map((item) => ({
            description: item.name,
            quantity: 1,
            unitPriceCents: item.priceCents,
            totalPriceCents: item.priceCents,
          })),
        },
      },
    });

    await tx.syncEvent.create({
      data: {
        entityType: "DiagnosticOrder",
        entityId: order.id,
        operation: "UPSERT",
        payload: JSON.stringify(order),
        status: "PENDING_SYNC",
      },
    });
    await recordAudit(tx, request.actor, {
      action: "ORDER_CREATED",
      entityType: "DiagnosticOrder",
      entityId: order.id,
      traceCode: order.patient.traceCode,
      summary: `Order ${order.accessionNumber} created for ${order.patient.traceCode}`,
      payload,
    });
    return { order, invoice };
  });

  return reply.code(201).send(createdOrder);
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
    maintenance,
    notifications,
  ] = await Promise.all([
    prisma.diagnosticOrder.findMany({
      include: { patient: true, items: { include: { catalogItem: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.sample.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
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
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => item.catalogItem.name),
    })),
    samples,
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
      title: report.title,
      status: report.status,
      signedBy: report.signedBy,
      signedAt: report.signedAt?.toISOString() ?? null,
      pdfPath: report.pdfPath,
      criticalFlag: report.criticalFlag,
      createdAt: report.createdAt.toISOString(),
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      patientId: invoice.patientId,
      orderId: invoice.orderId,
      traceCode: invoice.patient.traceCode,
      accessionNumber: invoice.order.accessionNumber,
      referralDoctorName: invoice.patient.referralDoctor?.fullName ?? null,
      referralDoctorCommissionPercent:
        invoice.patient.referralDoctor?.commissionPercent ?? null,
      referralCommissionDueCents: invoice.patient.referralDoctor
        ? Math.round(
            invoice.amountDueCents *
              (invoice.patient.referralDoctor.commissionPercent / 100),
          )
        : 0,
      referralCommissionOutstandingCents: invoice.patient.referralDoctor
        ? Math.round(
            Math.max(0, invoice.amountDueCents - invoice.amountPaidCents) *
              (invoice.patient.referralDoctor.commissionPercent / 100),
          )
        : 0,
      status: invoice.status,
      subtotalCents: invoice.subtotalCents,
      discountCents: invoice.discountCents,
      insuranceCoveredCents: invoice.insuranceCoveredCents,
      amountDueCents: invoice.amountDueCents,
      amountPaidCents: invoice.amountPaidCents,
      balanceCents: Math.max(
        0,
        invoice.amountDueCents - invoice.amountPaidCents,
      ),
      createdAt: invoice.createdAt.toISOString(),
      paymentsCount: invoice.payments.length,
    })),
    maintenance,
    notifications,
  } satisfies WorkflowPayload;
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
  const report = await prisma.report.create({
    data: {
      patientId: payload.patientId,
      orderId: payload.orderId,
      title: payload.title,
      medicalHistory: payload.medicalHistory,
      summary: payload.summary,
      findings: payload.findings,
      impression: payload.impression,
      signedBy: payload.signedBy,
      signedAt: new Date(),
      status: "APPROVED",
      criticalFlag: payload.criticalFlag,
      imagePathsJson: JSON.stringify(payload.imagePaths),
    },
  });

  await ensureReportPdf(prisma, report.id);

  const order = await prisma.diagnosticOrder.update({
    where: { id: payload.orderId },
    data: { status: payload.criticalFlag ? "READY_FOR_REVIEW" : "VERIFIED" },
    include: { patient: true },
  });
  await recordDispatchEvent("Report", report.id, report);
  await recordAudit(prisma, request.actor, {
    action: "REPORT_APPROVED",
    entityType: "Report",
    entityId: report.id,
    traceCode: order.patient.traceCode,
    summary: `Report ${report.title} approved for ${order.patient.traceCode}`,
    payload,
  });
  return reply
    .code(201)
    .send(await prisma.report.findUniqueOrThrow({ where: { id: report.id } }));
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
    include: { patient: true },
  });
  if (!invoice) {
    return reply.code(404).send({ message: "Invoice not found." });
  }

  const response = await prisma.$transaction(async (tx) => {
    const payment = await tx.paymentRecord.create({
      data: {
        invoiceId: invoice.id,
        method: payload.method,
        amountCents: payload.amountCents,
        reference: payload.reference,
        receivedBy: payload.receivedBy,
        traceCode: payload.traceCode ?? invoice.patient.traceCode,
        notes: payload.notes,
      },
    });
    const amountPaidCents = invoice.amountPaidCents + payload.amountCents;
    const status =
      amountPaidCents >= invoice.amountDueCents ? "PAID" : "PARTIAL";
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaidCents, status },
    });
    await recordAudit(tx, request.actor, {
      action: "PAYMENT_RECORDED",
      entityType: "Invoice",
      entityId: updatedInvoice.id,
      traceCode: invoice.patient.traceCode,
      summary: `${payload.method} payment recorded for ${invoice.patient.traceCode}`,
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
    if (!hasCapability(request.actor, "finance:manage")) {
      return deny(reply, "finance:manage");
    }

    const id = (request.params as { id: string }).id;
    return renderPrintableReceiptHtml(prisma, id);
  },
);

app.get(
  "/api/billing/invoices/:id/printable",
  async (request, reply): Promise<PrintableInvoicePayload | unknown> => {
    if (!request.actor.authenticated) {
      return unauthorized(reply);
    }
    if (!hasCapability(request.actor, "finance:manage")) {
      return deny(reply, "finance:manage");
    }

    const id = (request.params as { id: string }).id;
    return renderPrintableInvoiceHtml(prisma, id);
  },
);

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

  if (
    !alert ||
    alert.recipient !== `internal:${request.actor.username}`
  ) {
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
  const facility = await prisma.facility.upsert({
    where: { code: facilityCode },
    update: { name: facilityName },
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

  if ((await prisma.catalogItem.count()) === 0) {
    await prisma.catalogItem.createMany({ data: catalogSeed });
  }

  if ((await prisma.appUser.count()) === 0) {
    const defaultUsers = [
      {
        username: "admin",
        displayName: "Local Administrator",
        role: "ADMIN",
        pin: "2468",
      },
      {
        username: "qa.officer",
        displayName: "Quality Officer",
        role: "QA",
        pin: "1357",
      },
      {
        username: "finance.desk",
        displayName: "Finance Desk",
        role: "FINANCE",
        pin: "2244",
      },
      {
        username: "frontdesk",
        displayName: "Front Desk",
        role: "RECEPTION",
        pin: "1122",
      },
      {
        username: "sono.tech",
        displayName: "Sonography Tech",
        role: "SONOGRAPHER",
        pin: "7788",
      },
      {
        username: "doctor.sono",
        displayName: "Sonography Doctor",
        role: "DOCTOR",
        pin: "8899",
      },
    ] as const;

    await prisma.appUser.createMany({
      data: defaultUsers.map((user) => {
        const salt = `${facility.code}-${user.username}`;
        return {
          facilityId: facility.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          pinSalt: salt,
          pinHash: hashPin(user.pin, salt).hash,
        };
      }),
    });
  }
};

bootstrap()
  .then(() => app.listen({ port, host: "0.0.0.0" }))
  .catch(async (error) => {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
