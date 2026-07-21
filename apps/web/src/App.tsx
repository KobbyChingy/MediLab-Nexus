import {
  type AdminOverviewPayload,
  type AdminUserInput,
  type AdminUserSummaryPayload,
  type AuthSessionPayload,
  analyticsRangeKeys,
  type BulkServiceImportMode,
  type BulkServiceInput,
  type BootstrapPayload,
  type Capability,
  type CatalogSeedItem,
  type ExpenseInput,
  type ExpenseWorkspacePayload,
  type FacilityProfile,
  type FacilitySettingsInput,
  type FinanceAnalyticsPayload,
  appointmentStatuses,
  type InternalAlertPayload,
  type ImagingStudyUpdateInput,
  type NotificationInput,
  type OrderInput,
  type PatientInput,
  type PatientReferralUpdateInput,
  type PaymentInput,
  type PrintableAnalyticsPayload,
  type PrintableInvoicePayload,
  type PrintableReportPayload,
  type PrintableReceiptPayload,
  type QcEventInput,
  type ReferralDoctorInput,
  type ReferralDoctorSummaryPayload,
  type ReportInput,
  type ServiceInput,
  type UserDirectoryEntryPayload,
  type IntegrationDispatchRunPayload,
  type IntegrationDispatchStatusPayload,
  type WorkflowPayload,
  catalogSeed,
  notificationChannels,
  paymentMethods,
  reportTemplateKinds,
  userRoles,
} from "@medilab/shared";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import logoSrc from "./assets/medilab-nexus-logo.svg";
import omniWeaveMarkSrc from "./assets/omniweave-mark.svg";
import {
  fallbackAdminOverview,
  fallbackBootstrap,
  fallbackFinanceAnalytics,
} from "./data/fallback";
import {
  PortalBriefingRail,
  PortalDashboardDeck,
  PortalLoginSelector,
} from "./components/portal-surfaces";
import {
  InternalBellPanel,
  SystemAlertsSection,
  SystemAuditLogsSection,
  SystemSettingsSection,
  SystemUserManagementSection,
} from "./components/system-sections";

type NavKey =
  | "dashboard"
  | "patients"
  | "orders"
  | "tracking"
  | "sonography"
  | "scanReports"
  | "inventory"
  | "billing"
  | "analytics"
  | "expenses"
  | "services"
  | "referrals"
  | "quality"
  | "auditLogs"
  | "userManagement"
  | "alerts"
  | "settings";

type PatientRecord = {
  id: string;
  traceCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: string;
  referralDoctorId?: string | null;
  referralDoctorName?: string | null;
  referralDoctorCommissionPercent?: number | null;
};

type PatientTimelineEntry = {
  id: string;
  occurredAt: string;
  label: string;
  detail: string;
  meta: string;
  tone: "neutral" | "good" | "warn" | "critical";
};

type BackupRecord = {
  id: string;
  label: string;
  createdAt: string;
  restoredAt?: string | null;
  encrypted: boolean;
};

type InvoiceRecord = WorkflowPayload["invoices"][number];

type IntakeOrderState = {
  orderedBy: string;
  priority: OrderInput["priority"];
  insuranceProvider: string;
  insuranceAuthorized: boolean;
  scheduledFor: string;
};

type IntakePaymentState = {
  collectNow: boolean;
  amountCents: string;
  method: PaymentInput["method"];
  reference: string;
};

type PatientIntakeFormState = PatientInput & {
  referralName: string;
};

type ServiceFormState = {
  code: string;
  name: string;
  kind: ServiceInput["kind"];
  specimenType: string;
  modality: string;
  priceCents: string;
  tatMinutes: string;
  isActive: boolean;
};

type ReferralDoctorFormState = {
  fullName: string;
  phone: string;
  email: string;
  commissionPercent: string;
  isActive: boolean;
};

type ExpenseFormState = {
  category: string;
  description: string;
  amount: string;
  incurredAt: string;
  recordedBy: string;
  notes: string;
};

type ExpenseFiltersState = {
  category: string;
  startDate: string;
  endDate: string;
};

type UltrasoundReportAssistState = {
  sonographerName: string;
  technique: string;
  measurementsText: string;
  recommendation: string;
  gestationalAge: string;
  fetalHeartRate: string;
  placentaLocation: string;
  amnioticFluid: string;
  liverSpan: string;
  gallbladder: string;
  biliaryTree: string;
  renalSurvey: string;
  uterineSize: string;
  endometriumThickness: string;
  rightAdnexa: string;
  leftAdnexa: string;
  ejectionFraction: string;
  chamberAssessment: string;
  valveAssessment: string;
  pericardium: string;
};

type PresetAssistFieldConfig = {
  key: keyof UltrasoundReportAssistState;
  label: string;
  placeholder: string;
};

type BulkServiceImportResponse = {
  created: CatalogSeedItem[];
  updated: CatalogSeedItem[];
  skipped: Array<{ code: string; reason: string }>;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
};

type ParsedBulkServiceRow = {
  lineNumber: number;
  service: ServiceInput;
};

type BulkServicePreviewEntry = ParsedBulkServiceRow & {
  status: "new" | "overwrite" | "skip";
  statusLabel: string;
  statusTone: "tag-good" | "tag-warn" | "tag-critical";
  note: string;
};

type BulkImportHistoryEntry = {
  importedAt: string;
  mode: BulkServiceImportMode;
  sourceLabel: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
};

type UltrasoundTemplateKind = Exclude<ReportInput["templateKind"], "LAB_STANDARD">;

type PortalAction = {
  label: string;
  target: NavKey;
  tone: "primary" | "ghost";
};

type PortalProfile = {
  label: string;
  summary: string;
  spotlight: string;
  navKeys: NavKey[];
  highlights: string[];
  steps: string[];
  actions: PortalAction[];
  demoUsername: string;
  demoPin: string;
};

type PortalSnapshotCard = {
  label: string;
  value: string | number;
  note: string;
};

type NavSectionDef = {
  key: "main" | "management" | "system";
  label: string;
  items: NavKey[];
};

type PrimaryPortalRole =
  | "ADMIN"
  | "MANAGER"
  | "DOCTOR"
  | "RECEPTION"
  | "SONOGRAPHER";

const defaultUltrasoundReportAssistState: UltrasoundReportAssistState = {
  sonographerName: "",
  technique: "",
  measurementsText: "",
  recommendation: "",
  gestationalAge: "",
  fetalHeartRate: "",
  placentaLocation: "",
  amnioticFluid: "",
  liverSpan: "",
  gallbladder: "",
  biliaryTree: "",
  renalSurvey: "",
  uterineSize: "",
  endometriumThickness: "",
  rightAdnexa: "",
  leftAdnexa: "",
  ejectionFraction: "",
  chamberAssessment: "",
  valveAssessment: "",
  pericardium: "",
};

const apiBase = import.meta.env.VITE_API_BASE ?? "/api";

const analyticsRangeLabels: Record<FinanceAnalyticsPayload["range"], string> = {
  "7D": "7 days",
  "30D": "30 days",
  "90D": "90 days",
  "365D": "365 days",
  ALL: "All time",
};

const reportTemplateLabels: Record<ReportInput["templateKind"], string> = {
  LAB_STANDARD: "Scan standard",
  ULTRASOUND_STANDARD: "Ultrasound general",
  ULTRASOUND_ABDOMINAL: "Ultrasound abdominal",
  ULTRASOUND_PELVIC: "Ultrasound pelvic",
  ULTRASOUND_OBSTETRIC: "Ultrasound obstetric",
  ULTRASOUND_ECHOCARDIOGRAPHY: "Echocardiography",
};

const ultrasoundTemplatePresets: Record<
  UltrasoundTemplateKind,
  {
    summaryLabel: string;
    summaryStarter: string;
    findingsStarter: string;
    impressionStarter: string;
    techniquePlaceholder: string;
    measurementsPlaceholder: string;
    recommendationPlaceholder: string;
  }
> = {
  ULTRASOUND_STANDARD: {
    summaryLabel: "Clinical indication",
    summaryStarter: "Clinical indication:",
    findingsStarter: "FINDINGS:\n",
    impressionStarter: "IMPRESSION:",
    techniquePlaceholder:
      "Transabdominal, transvaginal, focused FAST, Doppler review...",
    measurementsPlaceholder:
      "BPD 38 mm, CRL 62 mm, fetal heart rate 148 bpm...",
    recommendationPlaceholder:
      "Follow-up scan in 2 weeks, correlate clinically, urgent clinician review...",
  },
  ULTRASOUND_ABDOMINAL: {
    summaryLabel: "Clinical indication",
    summaryStarter: "Clinical indication: abdominal pain / hepatobiliary review",
    findingsStarter:
      "FINDINGS:\nLiver:\nGallbladder:\nPancreas:\nSpleen:\nKidneys:\nAorta / IVC:\n",
    impressionStarter: "IMPRESSION:\n1. ",
    techniquePlaceholder:
      "Transabdominal sonography with focused hepatobiliary and renal survey.",
    measurementsPlaceholder:
      "Liver span, CBD diameter, spleen length, right kidney length, left kidney length...",
    recommendationPlaceholder:
      "Correlate with LFTs, surgical review if acute, interval follow-up if needed.",
  },
  ULTRASOUND_PELVIC: {
    summaryLabel: "Clinical indication",
    summaryStarter: "Clinical indication: pelvic pain / menstrual or adnexal assessment",
    findingsStarter:
      "FINDINGS:\nUterus:\nEndometrium:\nRight adnexa:\nLeft adnexa:\nCul-de-sac:\n",
    impressionStarter: "IMPRESSION:\n1. ",
    techniquePlaceholder:
      "Transabdominal pelvic sonography with transvaginal correlation when indicated.",
    measurementsPlaceholder:
      "Uterine size, endometrial thickness, right ovary volume, left ovary volume...",
    recommendationPlaceholder:
      "Gynecology review, cycle correlation, or interval follow-up as indicated.",
  },
  ULTRASOUND_OBSTETRIC: {
    summaryLabel: "Obstetric indication",
    summaryStarter: "Obstetric indication: dating / viability / anomaly follow-up",
    findingsStarter:
      "FINDINGS:\nGestation:\nPlacenta:\nLiquor volume:\nFetal heart activity:\nPresentation:\nCervix:\n",
    impressionStarter: "IMPRESSION:\n1. Single live intrauterine gestation ",
    techniquePlaceholder:
      "Obstetric scan with fetal biometry and placental assessment.",
    measurementsPlaceholder:
      "GS, CRL, BPD, HC, AC, FL, EFW, AFI, FHR...",
    recommendationPlaceholder:
      "Routine antenatal follow-up, anomaly scan timing, or urgent obstetric review if indicated.",
  },
  ULTRASOUND_ECHOCARDIOGRAPHY: {
    summaryLabel: "Clinical indication",
    summaryStarter: "Clinical indication: cardiac structure / function assessment",
    findingsStarter:
      "FINDINGS:\nChambers:\nValves:\nPericardium:\nLeft ventricular function:\nRight ventricular function:\n",
    impressionStarter: "IMPRESSION:\n1. ",
    techniquePlaceholder:
      "2D, M-mode, and Doppler echocardiographic assessment.",
    measurementsPlaceholder:
      "EF, LVEDD, LVESD, LA size, RVSP, valve gradients, TAPSE...",
    recommendationPlaceholder:
      "Cardiology review and correlation with ECG / clinical findings.",
  },
};

const ultrasoundPresetFieldMap: Partial<
  Record<UltrasoundTemplateKind, PresetAssistFieldConfig[]>
> = {
  ULTRASOUND_ABDOMINAL: [
    {
      key: "liverSpan",
      label: "Liver span",
      placeholder: "15.2 cm, normal echotexture",
    },
    {
      key: "gallbladder",
      label: "Gallbladder",
      placeholder: "Wall 2 mm, no stones, no pericholecystic fluid",
    },
    {
      key: "biliaryTree",
      label: "Biliary tree",
      placeholder: "CBD 4 mm, not dilated",
    },
    {
      key: "renalSurvey",
      label: "Renal survey",
      placeholder: "Kidneys normal in size, no hydronephrosis",
    },
  ],
  ULTRASOUND_PELVIC: [
    {
      key: "uterineSize",
      label: "Uterine size",
      placeholder: "7.8 x 4.2 x 5.1 cm, anteverted",
    },
    {
      key: "endometriumThickness",
      label: "Endometrium",
      placeholder: "8 mm, homogeneous",
    },
    {
      key: "rightAdnexa",
      label: "Right adnexa",
      placeholder: "Right ovary 8.2 mL, no adnexal mass",
    },
    {
      key: "leftAdnexa",
      label: "Left adnexa",
      placeholder: "Left ovary 7.9 mL, simple follicle",
    },
  ],
  ULTRASOUND_OBSTETRIC: [
    {
      key: "gestationalAge",
      label: "Gestational age",
      placeholder: "21 weeks + 4 days by biometry",
    },
    {
      key: "fetalHeartRate",
      label: "Fetal heart rate",
      placeholder: "148 bpm",
    },
    {
      key: "placentaLocation",
      label: "Placenta",
      placeholder: "Anterior high-lying placenta, grade 1",
    },
    {
      key: "amnioticFluid",
      label: "Amniotic fluid",
      placeholder: "AFI 14 cm, adequate",
    },
  ],
  ULTRASOUND_ECHOCARDIOGRAPHY: [
    {
      key: "ejectionFraction",
      label: "Ejection fraction",
      placeholder: "58%",
    },
    {
      key: "chamberAssessment",
      label: "Chambers",
      placeholder: "Mild left atrial enlargement",
    },
    {
      key: "valveAssessment",
      label: "Valves",
      placeholder: "Mild MR, no significant stenosis",
    },
    {
      key: "pericardium",
      label: "Pericardium",
      placeholder: "No effusion",
    },
  ],
};

const navItems: Array<{ key: NavKey; label: string; short: string }> = [
  { key: "dashboard", label: "Dashboard", short: "DB" },
  { key: "patients", label: "Patients", short: "PT" },
  { key: "orders", label: "Orders & Requests", short: "OR" },
  { key: "sonography", label: "Sonography Worklist", short: "SG" },
  { key: "scanReports", label: "Scan Reports", short: "SR" },
  { key: "analytics", label: "Operations Report", short: "RP" },
  { key: "expenses", label: "Expenses", short: "EX" },
  { key: "services", label: "Services", short: "SV" },
  { key: "auditLogs", label: "Audit Logs", short: "AL" },
  { key: "userManagement", label: "User Management", short: "UM" },
  { key: "alerts", label: "Alerts", short: "AR" },
  { key: "settings", label: "Settings", short: "ST" },
];

const navDescriptions: Record<NavKey, string> = {
  dashboard: "Live operational picture across your current workload.",
  patients: "Registration, lookup, and traceable patient context.",
  orders: "Create requests, capture intake, and control handoff.",
  tracking: "Specimen movement, collection visibility, and lab flow.",
  sonography: "Scheduled imaging, room status, and scan progression.",
  scanReports: "Preview finalized scan reports or write new interpretations.",
  inventory: "Supplies, stock movement, and controlled availability.",
  billing: "Invoices, payments, and outstanding balance follow-up.",
  analytics: "Combined billing, expenses, inventory activity, and user performance.",
  expenses: "Operating cost capture, categorization, and recent spend review.",
  services: "Service availability, pricing, and turnaround visibility.",
  referrals: "Referral doctor setup and commission visibility.",
  quality: "QC events, release risk, and corrective action tracking.",
  auditLogs: "Track significant system activities and operational changes.",
  userManagement: "Create accounts, rotate PINs, and control user access.",
  alerts: "Send internal bells and review active or queued alerts.",
  settings: "Facility profile, backups, and system setup visibility.",
};

const navSections: NavSectionDef[] = [
  {
    key: "main",
    label: "Main Menu",
    items: [
      "dashboard",
      "patients",
      "orders",
      "sonography",
      "scanReports",
      "analytics",
      "expenses",
      "services",
    ],
  },
  {
    key: "system",
    label: "System",
    items: ["auditLogs", "userManagement", "alerts", "settings"],
  },
];

const roleHome: Record<(typeof userRoles)[number], NavKey> = {
  RECEPTION: "dashboard",
  PHLEBOTOMIST: "dashboard",
  SONOGRAPHER: "sonography",
  DOCTOR: "sonography",
  LAB_TECH: "dashboard",
  RADIOLOGIST: "sonography",
  MANAGER: "dashboard",
  FINANCE: "dashboard",
  QA: "dashboard",
  ADMIN: "dashboard",
};

const roleCopy: Record<
  (typeof userRoles)[number],
  { title: string; subtitle: string }
> = {
  RECEPTION: {
    title: "Reception command center",
    subtitle: "Register patients, start orders, and keep queue times low.",
  },
  PHLEBOTOMIST: {
    title: "Collection bench",
    subtitle: "Track pending samples and keep specimen handoff visible.",
  },
  SONOGRAPHER: {
    title: "Ultrasound worklist",
    subtitle: "Move scheduled scans through image capture and scan reporting.",
  },
  DOCTOR: {
    title: "Doctor reading desk",
    subtitle: "Handle sonography intake handoff, interpret findings, and complete scan reports.",
  },
  LAB_TECH: {
    title: "Bench operations",
    subtitle: "Watch TAT, run QC, and keep the lab moving.",
  },
  RADIOLOGIST: {
    title: "Scan review desk",
    subtitle: "Interpret sonography studies and finalize scan reports.",
  },
  MANAGER: {
    title: "Operational overview",
    subtitle:
      "Monitor performance, staffing load, and revenue from one calm workspace.",
  },
  FINANCE: {
    title: "Billing desk",
    subtitle:
      "Capture payments and follow outstanding balances without losing traceability.",
  },
  QA: {
    title: "Quality assurance hub",
    subtitle: "Track QC breaches, maintenance due dates, and release risk.",
  },
  ADMIN: {
    title: "System control room",
    subtitle:
      "Oversee every module, user, and integration workflow from a single shell.",
  },
};

const userDisplayByRole: Record<(typeof userRoles)[number], string> = {
  RECEPTION: "Front Desk",
  PHLEBOTOMIST: "Sample Collector",
  SONOGRAPHER: "Sonography Tech",
  DOCTOR: "Doctor",
  LAB_TECH: "Lab Technologist",
  RADIOLOGIST: "Reporting Specialist",
  MANAGER: "Operations Manager",
  FINANCE: "Finance Desk",
  QA: "Quality Officer",
  ADMIN: "System Administrator",
};

const defaultPortalActions: PortalAction[] = [
  { label: "Open patients", target: "patients", tone: "primary" },
  { label: "Open sonography", target: "sonography", tone: "ghost" },
];

const primaryPortalRoles: PrimaryPortalRole[] = [
  "ADMIN",
  "MANAGER",
  "DOCTOR",
  "RECEPTION",
  "SONOGRAPHER",
];

const navCapabilityRequirements: Partial<Record<NavKey, Capability[]>> = {
  orders: ["order:write"],
  tracking: ["order:write"],
  sonography: ["order:write"],
  scanReports: ["report:view"],
  inventory: ["inventory:manage"],
  billing: ["finance:manage"],
  analytics: ["finance:manage"],
  expenses: ["finance:manage"],
  services: ["service:view"],
  referrals: ["service:manage"],
  quality: ["qc:manage"],
  auditLogs: ["admin:view"],
  userManagement: ["user:manage"],
  alerts: ["admin:view"],
  settings: ["settings:view"],
};

const portalRouteSlugs: Record<PrimaryPortalRole, string> = {
  ADMIN: "admin",
  MANAGER: "manager",
  DOCTOR: "doctor",
  RECEPTION: "receptionist",
  SONOGRAPHER: "sonographer",
};

const portalRoleBySlug = Object.fromEntries(
  Object.entries(portalRouteSlugs).map(([role, slug]) => [slug, role]),
) as Record<string, PrimaryPortalRole>;

function isNavKey(value: string): value is NavKey {
  return navItems.some((item) => item.key === value);
}

function isPrimaryPortalRole(
  role: (typeof userRoles)[number],
): role is PrimaryPortalRole {
  return role in portalRouteSlugs;
}

function parsePortalHash(hash: string) {
  const match = /^#\/portal\/([^/]+)(?:\/([^/?#]+))?$/i.exec(hash.trim());
  if (!match) {
    return null;
  }

  const roleSlug = match[1];
  if (!roleSlug) {
    return null;
  }

  const role = portalRoleBySlug[roleSlug.toLowerCase()];
  const nav = match[2];
  if (!role || !nav || !isNavKey(nav)) {
    return null;
  }

  return { role, nav };
}

function buildPortalHash(role: PrimaryPortalRole, nav: NavKey) {
  return `#/portal/${portalRouteSlugs[role]}/${nav}`;
}

function resolvePortalNavForRole(role: (typeof userRoles)[number]) {
  const route = parsePortalHash(window.location.hash);
  if (route && route.role === role) {
    return route.nav;
  }

  return roleHome[role];
}

function hasNavAccess(key: NavKey, allowedActions: Capability[]) {
  const requiredCapabilities = navCapabilityRequirements[key];
  if (!requiredCapabilities || requiredCapabilities.length === 0) {
    return true;
  }

  return requiredCapabilities.every((capability) =>
    allowedActions.includes(capability),
  );
}

const portalProfiles: Partial<Record<(typeof userRoles)[number], PortalProfile>> = {
  ADMIN: {
    label: "Admin portal",
    summary:
      "Own user access, scan setup, and operational controls from one workspace.",
    spotlight:
      "This portal keeps the scan service, sonography worklist, and system controls in view together.",
    navKeys: navItems.map((item) => item.key),
    highlights: [
      "User access",
      "Scan services",
      "Sonography flow",
      "Facility controls",
    ],
    steps: [
      "Start from Dashboard for queue pressure, alerts, and scan flow.",
      "Use Sonography Worklist to monitor room movement and pending reads.",
      "Keep Services current before operational changes.",
      "Use Settings for users, backups, and facility configuration.",
    ],
    actions: [
      { label: "Open sonography", target: "sonography", tone: "primary" },
      { label: "System settings", target: "settings", tone: "ghost" },
    ],
    demoUsername: "admin",
    demoPin: "2468",
  },
  MANAGER: {
    label: "Manager portal",
    summary:
      "Run the day-to-day scan operation with one view of queue pressure, staff activity, and operating results.",
    spotlight:
      "Use this portal to balance patient flow, room pressure, report handoff, expenses, and staff performance.",
    navKeys: [
      "dashboard",
      "patients",
      "sonography",
      "scanReports",
      "analytics",
      "expenses",
      "services",
      "userManagement",
      "alerts",
      "settings",
    ],
    highlights: [
      "Operations pulse",
      "Staff performance",
      "Scan queue",
      "Expenses",
      "Critical findings",
    ],
    steps: [
      "Read Dashboard first for queue pressure and critical flags.",
      "Open Operations Report to compare collections, expenses, and stock activity by user.",
      "Use Sonography Worklist to spot room bottlenecks early.",
      "Open Scan Reports when reception needs finalized print previews.",
      "Keep Users, Services, and Alerts aligned with active daily operations.",
    ],
    actions: [
      { label: "Open operations report", target: "analytics", tone: "primary" },
      { label: "Open scan reports", target: "scanReports", tone: "ghost" },
    ],
    demoUsername: "ops.manager",
    demoPin: "5566",
  },
  DOCTOR: {
    label: "Doctor portal",
    summary:
      "Review the scan queue, interpret findings, and complete scan reports with minimal distraction.",
    spotlight:
      "This portal is tuned for interpretation and reporting of sonography-driven studies.",
    navKeys: ["dashboard", "patients", "sonography", "scanReports"],
    highlights: [
      "Reading queue",
      "Clinical review",
      "Critical findings",
      "Structured reporting",
    ],
    steps: [
      "Start from Sonography Worklist to see what is ready for interpretation.",
      "Use Sonography Worklist to confirm scan readiness.",
      "Finalize narrative findings in Scan Reports.",
      "Escalate critical impressions without delaying scan handoff.",
    ],
    actions: [
      { label: "Open sonography", target: "sonography", tone: "primary" },
      { label: "Write scan report", target: "scanReports", tone: "ghost" },
    ],
    demoUsername: "doctor.sono",
    demoPin: "8899",
  },
  RECEPTION: {
    label: "Receptionist portal",
    summary:
      "Handle registration, front-desk expenses, service lookup, and printed scan report handoff.",
    spotlight:
      "This portal keeps the first touchpoint clean so intake, cash movement, and report pickup stay fast and traceable.",
    navKeys: ["dashboard", "patients", "expenses", "services", "scanReports", "settings"],
    highlights: [
      "Patient registration",
      "Front desk spend",
      "Service lookup",
      "Report preview",
    ],
    steps: [
      "Register the patient and confirm the Trace Code.",
      "Use Patients to attach the correct scan service and complete intake.",
      "Record front-desk expenses when they happen.",
      "Open Scan Reports only after the doctor or sonographer finishes the report, then preview or print it.",
    ],
    actions: [
      { label: "Register patient", target: "patients", tone: "primary" },
      { label: "Open reports", target: "scanReports", tone: "ghost" },
    ],
    demoUsername: "frontdesk",
    demoPin: "1122",
  },
  SONOGRAPHER: {
    label: "Sonographer portal",
    summary:
      "Run the imaging worklist, update scan status, and prepare structured handoff for doctor review.",
    spotlight:
      "This portal keeps the scan room focused on timely acquisition, status updates, and draft-ready reporting.",
    navKeys: ["dashboard", "patients", "orders", "sonography", "scanReports"],
    highlights: [
      "Scheduled scans",
      "Room flow",
      "Status updates",
      "Draft handoff",
    ],
    steps: [
      "Work from Sonography Worklist for scheduled studies.",
      "Update appointment status as patients arrive and scan.",
      "Use Scan Reports to draft structured ultrasound findings.",
      "Hand off completed studies to the doctor reading desk.",
    ],
    actions: [
      { label: "Open worklist", target: "sonography", tone: "primary" },
      { label: "Draft report", target: "scanReports", tone: "ghost" },
    ],
    demoUsername: "sono.tech",
    demoPin: "7788",
  },
};

const emptyWorkflow: WorkflowPayload = {
  orders: [],
  samples: [],
  imaging: [],
  reports: [],
  invoices: [],
  maintenance: [],
  notifications: [],
};

const emptySyncStatus: IntegrationDispatchStatusPayload = {
  pending: 0,
  failed: 0,
  conflicts: 0,
  synced: 0,
  queuedNotifications: 0,
  failedNotifications: 0,
  lastAttemptAt: null,
  integrationConfigured: false,
  notificationGatewayConfigured: false,
  mode: "standalone",
  worker: {
    enabled: true,
    intervalMs: 30000,
    batchSize: 25,
    targetsConfigured: false,
  },
  lastRun: null,
};

function buildEmptyExpenseWorkspace(
  range: FinanceAnalyticsPayload["range"],
): ExpenseWorkspacePayload {
  return {
    generatedAt: new Date().toISOString(),
    range,
    availableCategories: [],
    summary: {
      totalCents: 0,
      entryCount: 0,
    },
    categories: [],
    expenses: [],
  };
}

function formatMoney(cents: number) {
  return `GHc ${(cents / 100).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatStudyDepartmentLabel(
  department: FinanceAnalyticsPayload["studyPerformance"][number]["department"],
) {
  return department === "IMAGING" ? "Imaging" : "Lab";
}

function formatStudyKindLabel(
  kind: FinanceAnalyticsPayload["studyPerformance"][number]["kind"],
) {
  return kind === "IMAGING" ? "Scan" : "Test";
}

function splitStructuredLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseBulkServiceText(source: string) {
  const rows = source
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line && !line.startsWith("#"));
  const services: ParsedBulkServiceRow[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const delimiter = row.line.includes("\t")
      ? "\t"
      : row.line.includes("|")
        ? "|"
        : ",";
    const values = splitStructuredLine(row.line, delimiter);

    if (
      values[0]?.toLowerCase() === "code" &&
      values[1]?.toLowerCase() === "name" &&
      values[2]?.toLowerCase() === "kind"
    ) {
      continue;
    }

    if (values.length < 6 || values.length > 7) {
      errors.push(
        `Line ${row.lineNumber}: use code, name, kind, specimen/modality, price, TAT, and optional active flag.`,
      );
      continue;
    }

    const [
      code = "",
      name = "",
      kindValue = "",
      detail = "",
      priceValue = "",
      tatValue = "",
      activeValue,
    ] = values;
    const normalizedKind = kindValue.toUpperCase();
    if (normalizedKind !== "TEST" && normalizedKind !== "IMAGING") {
      errors.push(`Line ${row.lineNumber}: kind must be TEST or IMAGING.`);
      continue;
    }
    const kind: ServiceInput["kind"] = normalizedKind;

    const priceCents = Number(priceValue);
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      errors.push(
        `Line ${row.lineNumber}: price must be a whole number in pesewas.`,
      );
      continue;
    }

    const tatMinutes = Number(tatValue);
    if (!Number.isInteger(tatMinutes) || tatMinutes <= 0) {
      errors.push(
        `Line ${row.lineNumber}: TAT must be a whole number above zero.`,
      );
      continue;
    }

    const normalizedActive = activeValue?.toLowerCase();
    const isActive = normalizedActive
      ? !["false", "inactive", "archived", "0", "no"].includes(normalizedActive)
      : true;

    const parsedService: ServiceInput = {
      code,
      name,
      kind,
      specimenType: kind === "TEST" ? detail : "",
      modality: kind === "IMAGING" ? detail : "",
      priceCents,
      tatMinutes,
      isActive,
    };

    services.push({
      lineNumber: row.lineNumber,
      service: parsedService,
    });
  }

  return { services, errors };
}

function downloadTextFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(objectUrl);
}

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? "P"}${lastName[0] ?? "T"}`.toUpperCase();
}

function buildLocalTraceCode(
  firstName: string,
  lastName: string,
  sequence: number,
) {
  return `${initials(firstName, lastName)}${sequence}`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Logo upload failed"));
    reader.readAsDataURL(file);
  });
}

function estimateDataUrlBytes(dataUrl: string) {
  const [, encoded = ""] = dataUrl.split(",");
  return Math.floor((encoded.length * 3) / 4);
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded"));
    image.src = dataUrl;
  });
}

async function normalizeFacilityLogo(file: File) {
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    throw new Error("Use a PNG or JPEG logo.");
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error("Logo must be 4MB or smaller.");
  }

  const sourceUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  const maxEdge = 512;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas processing is unavailable.");
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let output = canvas.toDataURL("image/png");
  if (estimateDataUrlBytes(output) > 320 * 1024) {
    output = canvas.toDataURL("image/jpeg", 0.86);
  }

  return {
    dataUrl: output,
    width,
    height,
    bytes: estimateDataUrlBytes(output),
  };
}

function getSyncTone(syncStatus: IntegrationDispatchStatusPayload) {
  if (syncStatus.failed > 0 || syncStatus.conflicts > 0) {
    return { label: "Attention Needed", tone: "warning" as const };
  }

  if (syncStatus.pending > 0) {
    return { label: "Dispatch Pending", tone: "warning" as const };
  }

  if (syncStatus.integrationConfigured) {
    return { label: "Connected", tone: "success" as const };
  }

  return { label: "Server Online", tone: "neutral" as const };
}

function getOrderTone(status: string) {
  if (["VERIFIED", "RELEASED"].includes(status)) {
    return "good";
  }
  if (["READY_FOR_REVIEW", "IN_PROGRESS"].includes(status)) {
    return "warn";
  }
  if (["REGISTERED", "SCHEDULED", "ARRIVED", "SCANNING"].includes(status)) {
    return "neutral";
  }
  return "critical";
}

function isSonographyServiceLabel(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("ultrasound") || normalized.includes("echo");
}

function isUltrasoundTemplate(
  templateKind: ReportInput["templateKind"],
): templateKind is UltrasoundTemplateKind {
  return templateKind !== "LAB_STANDARD";
}

function resolveUltrasoundTemplate(serviceLabel: string): UltrasoundTemplateKind {
  const normalized = serviceLabel.toLowerCase();
  if (normalized.includes("obstetric") || normalized.includes("pregnan")) {
    return "ULTRASOUND_OBSTETRIC";
  }
  if (normalized.includes("pelvic")) {
    return "ULTRASOUND_PELVIC";
  }
  if (normalized.includes("abdominal")) {
    return "ULTRASOUND_ABDOMINAL";
  }
  if (normalized.includes("echo") || normalized.includes("card")) {
    return "ULTRASOUND_ECHOCARDIOGRAPHY";
  }
  return "ULTRASOUND_STANDARD";
}

function buildPresetMeasurementLines(
  templateKind: UltrasoundTemplateKind,
  assist: UltrasoundReportAssistState,
) {
  const fields = ultrasoundPresetFieldMap[templateKind] ?? [];
  return fields
    .map((field) => {
      const value = assist[field.key];
      return value.trim() ? `${field.label}: ${value.trim()}` : "";
    })
    .filter(Boolean);
}

function orderIncludesSonography(items: string[]) {
  return items.some((item) => isSonographyServiceLabel(item));
}

function getRoleMetricCards(
  role: (typeof userRoles)[number],
  bootstrap: BootstrapPayload,
  adminOverview: AdminOverviewPayload,
  workflow: WorkflowPayload,
) {
  if (role === "RECEPTION") {
    return [
      {
        label: "Today's appointments",
        value: bootstrap.metrics.patientsToday,
        note: "Registrations started",
      },
      {
        label: "Open scans",
        value: workflow.imaging.filter(
          (study) => study.appointmentStatus !== "COMPLETED",
        ).length,
        note: "Waiting for arrival or scan completion",
      },
      {
        label: "Ready to report",
        value: workflow.imaging.filter(
          (study) =>
            study.appointmentStatus === "REPORTED" ||
            study.appointmentStatus === "COMPLETED",
        ).length,
        note: "Ultrasound studies awaiting interpretation",
      },
      {
        label: "Recent patients",
        value: bootstrap.recentPatients.length,
        note: "Quick lookup",
      },
    ];
  }

  if (role === "SONOGRAPHER") {
    return [
      {
        label: "Today's scans",
        value: workflow.imaging.length,
        note: "Assigned studies",
      },
      {
        label: "Scanning now",
        value: workflow.imaging.filter(
          (study) => study.appointmentStatus === "SCANNING",
        ).length,
        note: "On the sonography bench",
      },
      {
        label: "Critical alerts",
        value: adminOverview.aiFlags.filter((flag) => flag.severity === "high")
          .length,
        note: "Escalate now",
      },
      {
        label: "Ready to report",
        value: workflow.imaging.filter(
          (study) =>
            study.appointmentStatus === "REPORTED" ||
            study.appointmentStatus === "COMPLETED",
        ).length,
        note: "Interpretation queue",
      },
    ];
  }

  if (role === "FINANCE") {
    return [
      {
        label: "Revenue today",
        value: formatMoney(adminOverview.finance.revenueTodayCents),
        note: "Captured today",
      },
      {
        label: "Outstanding",
        value: formatMoney(adminOverview.finance.outstandingCents),
        note: "Collections follow-up",
      },
      {
        label: "Open invoices",
        value: adminOverview.finance.invoicesOpen,
        note: "Need payment",
      },
      {
        label: "Queued notices",
        value: adminOverview.notifications.queued,
        note: "Billing reminders",
      },
    ];
  }

  return [
    {
      label: "Today's scans",
      value: workflow.imaging.length,
      note: "Sonography-focused workload",
    },
    {
      label: "Waiting arrivals",
      value: workflow.imaging.filter(
        (study) => study.appointmentStatus === "SCHEDULED",
      ).length,
      note: "Scheduled patients not yet arrived",
    },
    {
      label: "Ready to report",
      value: workflow.imaging.filter(
        (study) =>
          study.appointmentStatus === "REPORTED" ||
          study.appointmentStatus === "COMPLETED",
      ).length,
      note: "Ultrasound studies awaiting release",
    },
    {
      label: "Revenue",
      value: formatMoney(adminOverview.finance.revenueTodayCents),
      note: "Captured today",
    },
  ];
}

function getPortalSnapshotCards(
  role: (typeof userRoles)[number],
  bootstrap: BootstrapPayload,
  adminOverview: AdminOverviewPayload,
  workflow: WorkflowPayload,
  syncStatus: IntegrationDispatchStatusPayload,
): PortalSnapshotCard[] {
  const readyToReportCount = workflow.imaging.filter(
    (study) =>
      study.appointmentStatus === "REPORTED" ||
      study.appointmentStatus === "COMPLETED",
  ).length;

  if (role === "ADMIN") {
    return [
      {
        label: "Audit events",
        value: adminOverview.auditTrail.length,
        note: "Recent system actions under review",
      },
      {
        label: "Dispatch queue",
        value: syncStatus.pending,
        note: "Records waiting for integration delivery",
      },
      {
        label: "QC review",
        value: adminOverview.qc.pendingReview,
        note: "Release-risk items still open",
      },
    ];
  }

  if (role === "MANAGER") {
    return [
      {
        label: "Open requests",
        value: bootstrap.metrics.openOrders,
        note: "Orders still in operational flow",
      },
      {
        label: "Outstanding",
        value: formatMoney(adminOverview.finance.outstandingCents),
        note: "Collections not yet recovered",
      },
      {
        label: "Critical alerts",
        value: adminOverview.aiFlags.filter((flag) => flag.severity === "high")
          .length,
        note: "High-priority cases to watch",
      },
    ];
  }

  if (role === "DOCTOR") {
    return [
      {
        label: "Reading queue",
        value: readyToReportCount,
        note: "Studies prepared for clinical interpretation",
      },
      {
        label: "Reported today",
        value: workflow.reports.length,
        note: "Scan reports available in the session feed",
      },
      {
        label: "Critical findings",
        value: adminOverview.aiFlags.filter((flag) => flag.severity === "high")
          .length,
        note: "Interpret and escalate without delay",
      },
    ];
  }

  if (role === "RECEPTION") {
    return [
      {
        label: "Registrations",
        value: bootstrap.metrics.patientsToday,
        note: "Patients checked in today",
      },
      {
        label: "Open invoices",
        value: adminOverview.finance.invoicesOpen,
        note: "Payments still waiting at the desk",
      },
      {
        label: "Recent patients",
        value: bootstrap.recentPatients.length,
        note: "Quick lookup list ready for recall",
      },
    ];
  }

  if (role === "SONOGRAPHER") {
    return [
      {
        label: "Scheduled",
        value: workflow.imaging.filter(
          (study) => study.appointmentStatus === "SCHEDULED",
        ).length,
        note: "Patients not yet in the scan room",
      },
      {
        label: "Scanning",
        value: workflow.imaging.filter(
          (study) => study.appointmentStatus === "SCANNING",
        ).length,
        note: "Studies currently on the bench",
      },
      {
        label: "Draft handoff",
        value: readyToReportCount,
        note: "Studies ready for doctor review",
      },
    ];
  }

  return [
    {
      label: "Open requests",
      value: bootstrap.metrics.openOrders,
      note: "Current operational load",
    },
    {
      label: "Reported",
      value: workflow.reports.length,
      note: "Reports available in the workspace",
    },
    {
      label: "Sync",
      value: syncStatus.pending,
      note: "Pending integration payloads",
    },
  ];
}

function LeveyJenningsChart({
  points,
}: {
  points: AdminOverviewPayload["qc"]["leveyJennings"];
}) {
  if (points.length === 0) {
    return <div className="chart-empty">No QC trend points yet.</div>;
  }

  const width = 460;
  const height = 180;
  const values = points.flatMap((point) => [
    point.plus3sd,
    point.minus3sd,
    point.value,
  ]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const mapX = (index: number) =>
    (index / Math.max(points.length - 1, 1)) * (width - 48) + 24;
  const mapY = (value: number) =>
    height - 24 - ((value - min) / range) * (height - 48);
  const plot = (
    getter: (
      point: AdminOverviewPayload["qc"]["leveyJennings"][number],
    ) => number,
  ) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${mapX(index)} ${mapY(getter(point))}`,
      )
      .join(" ");

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="lj-chart"
        role="img"
        aria-label="Levey-Jennings chart"
      >
        <path
          d={plot((point) => point.plus2sd)}
          className="chart-guide guide-2"
        />
        <path
          d={plot((point) => point.plus1sd)}
          className="chart-guide guide-1"
        />
        <path
          d={plot((point) => point.mean)}
          className="chart-guide guide-mean"
        />
        <path
          d={plot((point) => point.minus1sd)}
          className="chart-guide guide-1"
        />
        <path
          d={plot((point) => point.minus2sd)}
          className="chart-guide guide-2"
        />
        <path d={plot((point) => point.value)} className="chart-trace" />
        {points.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            cx={mapX(index)}
            cy={mapY(point.value)}
            r="4"
            className="chart-point"
          />
        ))}
      </svg>
      <div className="chart-labels">
        {points.map((point, index) => (
          <span key={`${point.label}-${index}`}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

function StudyPerformanceChart({
  points,
}: {
  points: FinanceAnalyticsPayload["studyPerformance"][number]["trend"];
}) {
  if (points.length === 0) {
    return <div className="chart-empty">No study trend points yet.</div>;
  }

  const width = 460;
  const height = 200;
  const max = Math.max(
    1,
    ...points.flatMap((point) => [point.billedCents, point.collectedCents]),
  );
  const mapX = (index: number) =>
    (index / Math.max(points.length - 1, 1)) * (width - 48) + 24;
  const mapY = (value: number) =>
    height - 24 - (value / max) * (height - 48);
  const plot = (
    getter: (
      point: FinanceAnalyticsPayload["studyPerformance"][number]["trend"][number],
    ) => number,
  ) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${mapX(index)} ${mapY(getter(point))}`,
      )
      .join(" ");
  const guides = [0, 0.25, 0.5, 0.75, 1].map((ratio) => mapY(max * ratio));

  return (
    <div className="chart-wrap study-chart-wrap">
      <div className="study-chart-legend">
        <span>
          <i className="legend-swatch billed" />
          Billed
        </span>
        <span>
          <i className="legend-swatch collected" />
          Collected
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="study-chart"
        role="img"
        aria-label="Study performance trend chart"
      >
        {guides.map((guide, index) => (
          <path
            key={`study-guide-${index}`}
            d={`M 18 ${guide} L ${width - 18} ${guide}`}
            className="study-chart-guide"
          />
        ))}
        <path
          d={plot((point) => point.billedCents)}
          className="study-chart-trace billed"
        />
        <path
          d={plot((point) => point.collectedCents)}
          className="study-chart-trace collected"
        />
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              cx={mapX(index)}
              cy={mapY(point.billedCents)}
              r="4"
              className="study-chart-point billed"
            />
            <circle
              cx={mapX(index)}
              cy={mapY(point.collectedCents)}
              r="4"
              className="study-chart-point collected"
            />
          </g>
        ))}
      </svg>
      <div className="chart-labels">
        {points.map((point, index) => (
          <span key={`${point.label}-${index}`}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(
    (window.localStorage.getItem("medilab-theme") as "light" | "dark") ??
      "light",
  );
  const [authSession, setAuthSession] = useState<AuthSessionPayload | null>(
    null,
  );
  const [authReady, setAuthReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [portalHash, setPortalHash] = useState(() => window.location.hash);
  const [activeNav, setActiveNav] = useState<NavKey>(
    () => parsePortalHash(window.location.hash)?.nav ?? "dashboard",
  );
  const [globalQuery, setGlobalQuery] = useState("");
  const [loginForm, setLoginForm] = useState({
    username: "admin",
    pin: "2468",
  });
  const [bootstrap, setBootstrap] =
    useState<BootstrapPayload>(fallbackBootstrap);
  const [adminOverview, setAdminOverview] = useState<AdminOverviewPayload>(
    fallbackAdminOverview,
  );
  const [workflow, setWorkflow] = useState<WorkflowPayload>(emptyWorkflow);
  const [financeAnalytics, setFinanceAnalytics] =
    useState<FinanceAnalyticsPayload>(fallbackFinanceAnalytics);
  const [analyticsRange, setAnalyticsRange] = useState<
    FinanceAnalyticsPayload["range"]
  >(fallbackFinanceAnalytics.range);
  const [selectedAnalyticsStudy, setSelectedAnalyticsStudy] = useState("");
  const [analyticsStudyDepartmentFilter, setAnalyticsStudyDepartmentFilter] =
    useState<"ALL" | "LAB" | "IMAGING">("ALL");
  const [expenseWorkspace, setExpenseWorkspace] =
    useState<ExpenseWorkspacePayload>(() =>
      buildEmptyExpenseWorkspace(fallbackFinanceAnalytics.range),
    );
  const [syncStatus, setSyncStatus] =
    useState<IntegrationDispatchStatusPayload>(emptySyncStatus);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [users, setUsers] = useState<AdminUserSummaryPayload[]>([]);
  const [services, setServices] = useState<CatalogSeedItem[]>([]);
  const [referralDoctors, setReferralDoctors] = useState<
    ReferralDoctorSummaryPayload[]
  >([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedImagingStudyId, setSelectedImagingStudyId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [registrationServiceQuery, setRegistrationServiceQuery] = useState("");
  const [orderServiceQuery, setOrderServiceQuery] = useState("");
  const [registrationItemIds, setRegistrationItemIds] = useState<string[]>([]);
  const [patientReferralCommission, setPatientReferralCommission] =
    useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedReferralDoctorId, setSelectedReferralDoctorId] = useState("");
  const [selectedPatientReferralDoctorId, setSelectedPatientReferralDoctorId] =
    useState("");
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [statusText, setStatusText] = useState("Ready to connect");
  const [patientForm, setPatientForm] = useState<PatientIntakeFormState>({
    firstName: "",
    lastName: "",
    middleName: "",
    traceCode: "",
    phone: "",
    allergies: "",
    medicalHistory: "",
    referralDoctorId: "",
    referralName: "",
    consentAccepted: true,
    gender: "Female",
    dateOfBirth: "",
  });
  const [intakeOrder, setIntakeOrder] = useState<IntakeOrderState>({
    orderedBy: "Front Desk",
    priority: "ROUTINE",
    insuranceProvider: "",
    insuranceAuthorized: false,
    scheduledFor: "",
  });
  const [intakePayment, setIntakePayment] = useState<IntakePaymentState>({
    collectNow: true,
    amountCents: "0",
    method: "CASH",
    reference: "",
  });
  const [orderForm, setOrderForm] = useState<OrderInput>({
    patientId: "",
    itemIds: [],
    orderedBy: "Front Desk",
    priority: "ROUTINE",
    insuranceProvider: "",
    insuranceAuthorized: false,
    notes: "",
    referringClinic: "",
    scheduledFor: "",
    sonographerName: "",
    priorStudyReference: "",
    radiologistName: "",
  });
  const [sonographyDeskForm, setSonographyDeskForm] =
    useState<ImagingStudyUpdateInput>({
      appointmentStatus: "SCHEDULED",
      scheduledAt: "",
      sonographerName: "",
      radiologistName: "",
      priorStudyReference: "",
      criticalFlag: false,
    });
  const [reportForm, setReportForm] = useState<ReportInput>({
    patientId: "",
    orderId: "",
    title: "Scan Report",
    medicalHistory: "",
    summary: "",
    findings: "",
    impression: "",
    signedBy: "System Administrator",
    templateKind: "LAB_STANDARD",
    criticalFlag: false,
    imagePaths: [],
  });
  const [ultrasoundReportAssist, setUltrasoundReportAssist] =
    useState<UltrasoundReportAssistState>(defaultUltrasoundReportAssistState);
  const [reportImagePathsText, setReportImagePathsText] = useState("");
  const [qcForm, setQcForm] = useState({
    module: "Laboratory",
    instrumentName: "Sysmex XN-330",
    analyte: "Hemoglobin",
    controlLevel: "Normal",
    lotNumber: "",
    observedValue: "13.2",
    meanValue: "13.0",
    standardDeviation: "0.2",
    expectedRange: "12.8 - 13.6",
    performedBy: userDisplayByRole.QA,
    notes: "",
    traceCode: "",
  });
  const [inventoryForm, setInventoryForm] = useState({
    itemId: "",
    type: "RECEIPT",
    quantity: "1",
    reason: "",
    traceCode: "",
    actor: userDisplayByRole.LAB_TECH,
  });
  const [paymentForm, setPaymentForm] = useState<PaymentInput>({
    invoiceId: "",
    amountCents: 0,
    method: "CASH",
    reference: "",
    receivedBy: userDisplayByRole.FINANCE,
    traceCode: "",
    notes: "",
  });
  const [facilityForm, setFacilityForm] = useState<FacilitySettingsInput>({
    name: fallbackBootstrap.facility.name,
    phone: fallbackBootstrap.facility.phone,
    email: fallbackBootstrap.facility.email,
    location: fallbackBootstrap.facility.location,
    logoDataUrl: fallbackBootstrap.facility.logoDataUrl,
    footerMessage: fallbackBootstrap.facility.footerMessage,
  });
  const [latestReceipt, setLatestReceipt] = useState<{
    paymentId: string;
    traceCode: string;
  } | null>(null);
  const [latestInvoiceId, setLatestInvoiceId] = useState("");
  const [serviceForm, setServiceForm] = useState<ServiceFormState>({
    code: "",
    name: "",
    kind: "TEST",
    specimenType: "Whole Blood",
    modality: "Ultrasound",
    priceCents: "0",
    tatMinutes: "60",
    isActive: true,
  });
  const [referralDoctorForm, setReferralDoctorForm] =
    useState<ReferralDoctorFormState>({
      fullName: "",
      phone: "",
      email: "",
      commissionPercent: "10",
      isActive: true,
    });
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>({
    category: "Operations",
    description: "",
    amount: "",
    incurredAt: new Date().toISOString().slice(0, 10),
    recordedBy: userDisplayByRole.FINANCE,
    notes: "",
  });
  const [expenseFilters, setExpenseFilters] = useState<ExpenseFiltersState>({
    category: "ALL",
    startDate: "",
    endDate: "",
  });
  const [bulkServiceText, setBulkServiceText] = useState("");
  const [bulkImportFileName, setBulkImportFileName] = useState("");
  const [bulkImportMode, setBulkImportMode] =
    useState<BulkServiceImportMode>("SKIP_EXISTING");
  const [bulkImportHistory, setBulkImportHistory] = useState<
    BulkImportHistoryEntry[]
  >([]);
  const [notificationForm, setNotificationForm] = useState<NotificationInput>({
    patientId: "",
    traceCode: "",
    recipient: "",
    channel: "WHATSAPP",
    message: "",
    scheduledFor: "",
    createdBy: userDisplayByRole.ADMIN,
  });
  const [userForm, setUserForm] = useState<AdminUserInput>({
    username: "",
    displayName: "",
    role: "RECEPTION",
    pin: "",
  });
  const [pinRotation, setPinRotation] = useState({ userId: "", newPin: "" });
  const [passwordVisibility, setPasswordVisibility] = useState({
    login: false,
    userCreate: false,
    rotatePin: false,
  });
  const [directoryUsers, setDirectoryUsers] = useState<
    UserDirectoryEntryPayload[]
  >([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellForm, setBellForm] = useState({
    recipientUsername: "",
    message: "",
  });
  const [incomingAlerts, setIncomingAlerts] = useState<InternalAlertPayload[]>(
    [],
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const heardAlertIdsRef = useRef<Set<string>>(new Set());
  const alertAudioContextRef = useRef<AudioContext | null>(null);

  const currentRole = authSession?.user.role ?? "ADMIN";
  const actorName = authSession?.user.displayName ?? "Unauthenticated";
  const allowedActions = authSession?.user.allowedActions ?? [];
  const portalProfile = portalProfiles[currentRole];
  const requestedPortalRoute = useMemo(
    () => parsePortalHash(portalHash),
    [portalHash],
  );
  const syncTone = getSyncTone(syncStatus);
  const externalNotificationChannels = notificationChannels.filter(
    (channel) => channel !== "INTERNAL",
  );
  const bellRecipientOptions = directoryUsers.filter(
    (user) => user.username !== authSession?.user.username,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("medilab-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 1080px)");

    const syncSidebarDrawer = () => {
      const drawerOpen = compactViewport.matches && sidebarOpen;
      document.body.classList.toggle("sidebar-drawer-open", drawerOpen);

      if (!compactViewport.matches && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    syncSidebarDrawer();
    compactViewport.addEventListener("change", syncSidebarDrawer);

    return () => {
      document.body.classList.remove("sidebar-drawer-open");
      compactViewport.removeEventListener("change", syncSidebarDrawer);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  useEffect(() => {
    let mounted = true;
    fetch(`${apiBase}/auth/session`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Session expired");
        }

        return (await response.json()) as AuthSessionPayload;
      })
      .then((session) => {
        if (!mounted) {
          return;
        }

        setAuthSession(session);
        setActiveNav(resolvePortalNavForRole(session.user.role));
        setReportForm((current) => ({
          ...current,
          signedBy: session.user.displayName,
        }));
        setAuthReady(true);
      })
      .catch(() => {
        if (mounted) {
          setAuthReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function requestJson<T>(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers ?? {});
    if (init?.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
    if (!response.ok) {
      let message = `Request failed: ${response.status}`;
      try {
        const payload = (await response.json()) as { message?: string };
        if (payload.message) {
          message = payload.message;
        }
      } catch {
        // Ignore non-JSON error bodies and fall back to the status code.
      }
      throw new Error(message);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  function togglePasswordVisibility(
    key: keyof typeof passwordVisibility,
  ) {
    setPasswordVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function playBellAlertSound() {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    if (!alertAudioContextRef.current) {
      alertAudioContextRef.current = new AudioContextClass();
    }

    const context = alertAudioContextRef.current;
    if (context.state === "suspended") {
      await context.resume();
    }

    const now = context.currentTime;
    const scheduleTone = (offset: number, frequency: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + offset + duration,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.02);
    };

    scheduleTone(0, 784, 0.18);
    scheduleTone(0.2, 988, 0.22);
  }

  async function primeAlertAudio() {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    if (!alertAudioContextRef.current) {
      alertAudioContextRef.current = new AudioContextClass();
    }

    if (alertAudioContextRef.current.state === "suspended") {
      await alertAudioContextRef.current.resume();
    }
  }

  async function acknowledgeAlert(alertId: string) {
    await requestJson<{ id: string; status: string }>(
      `/notifications/${alertId}/acknowledge`,
      {
        method: "POST",
      },
    );
  }

  async function loadOperationalData() {
    if (!authSession) {
      return;
    }

    const baseOverview = {
      ...fallbackAdminOverview,
      actor: {
        displayName: authSession.user.displayName,
        role: authSession.user.role,
        allowedActions: authSession.user.allowedActions,
      },
    } satisfies AdminOverviewPayload;

    try {
      const [
        bootstrapPayload,
        patientList,
        workflowPayload,
        overview,
        financeAnalyticsPayload,
        backupList,
        userList,
        directoryList,
        serviceList,
        referralDoctorList,
        syncPayload,
      ] = await Promise.all([
        requestJson<BootstrapPayload>("/bootstrap"),
        requestJson<PatientRecord[]>("/patients"),
        requestJson<WorkflowPayload>("/workflow"),
        allowedActions.includes("admin:view")
          ? requestJson<AdminOverviewPayload>("/admin/overview")
          : Promise.resolve(baseOverview),
        allowedActions.includes("finance:manage")
          ? requestJson<FinanceAnalyticsPayload>(
              `/analytics/finance?range=${encodeURIComponent(analyticsRange)}`,
            )
          : Promise.resolve(fallbackFinanceAnalytics),
        allowedActions.includes("backup:manage")
          ? requestJson<BackupRecord[]>("/admin/backups")
          : Promise.resolve([]),
        allowedActions.includes("user:manage")
          ? requestJson<AdminUserSummaryPayload[]>("/admin/users")
          : Promise.resolve([]),
        requestJson<UserDirectoryEntryPayload[]>("/users/directory"),
        allowedActions.includes("service:manage")
          ? requestJson<CatalogSeedItem[]>("/admin/services")
          : Promise.resolve(bootstrap.catalog),
        allowedActions.includes("service:manage")
          ? requestJson<ReferralDoctorSummaryPayload[]>(
              "/admin/referral-doctors",
            )
          : requestJson<ReferralDoctorSummaryPayload[]>("/referral-doctors"),
        allowedActions.includes("integration:manage")
          ? requestJson<IntegrationDispatchStatusPayload>(
              "/admin/integrations/status",
            )
          : Promise.resolve(emptySyncStatus),
      ]);

      startTransition(() => {
        setBootstrap(bootstrapPayload);
        setPatients(patientList);
        setWorkflow(workflowPayload);
        setAdminOverview(overview);
        setFinanceAnalytics(financeAnalyticsPayload);
        setBackups(backupList);
        setUsers(userList);
        setDirectoryUsers(directoryList);
        setServices(serviceList);
        setReferralDoctors(referralDoctorList);
        setSyncStatus(syncPayload);
      });

      if (!selectedBackupId && backupList[0]) {
        setSelectedBackupId(backupList[0].id);
      }

      setStatusText(`Connected as ${authSession.user.displayName}`);
    } catch {
      setPatients([]);
      setWorkflow(emptyWorkflow);
      setAdminOverview(baseOverview);
      setFinanceAnalytics({
        ...fallbackFinanceAnalytics,
        range: analyticsRange,
        generatedAt: new Date().toISOString(),
      });
      setExpenseWorkspace(buildEmptyExpenseWorkspace(analyticsRange));
      setBackups([]);
      setUsers([]);
      setDirectoryUsers([]);
      setServices([]);
      setReferralDoctors([]);
      setSyncStatus(emptySyncStatus);
      setStatusText(
        `Unable to reach the MediLab Nexus server for ${authSession.user.displayName}. Check the connection and try again.`,
      );
    }
  }

  async function loadExpenseWorkspace() {
    if (!authSession || !allowedActions.includes("finance:manage")) {
      setExpenseWorkspace(buildEmptyExpenseWorkspace(analyticsRange));
      return;
    }

    try {
      const params = new URLSearchParams({ range: analyticsRange });
      if (expenseFilters.category !== "ALL") {
        params.set("category", expenseFilters.category);
      }
      if (expenseFilters.startDate) {
        params.set("startDate", expenseFilters.startDate);
      }
      if (expenseFilters.endDate) {
        params.set("endDate", expenseFilters.endDate);
      }

      const payload = await requestJson<ExpenseWorkspacePayload>(
        `/finance/expenses?${params.toString()}`,
      );
      startTransition(() => {
        setExpenseWorkspace(payload);
      });
    } catch {
      setExpenseWorkspace(buildEmptyExpenseWorkspace(analyticsRange));
    }
  }

  useEffect(() => {
    void loadOperationalData();
  }, [authSession?.user.id, analyticsRange]);

  useEffect(() => {
    void loadExpenseWorkspace();
  }, [
    authSession?.user.id,
    analyticsRange,
    expenseFilters.category,
    expenseFilters.startDate,
    expenseFilters.endDate,
  ]);

  useEffect(() => {
    const primeAudio = () => {
      void primeAlertAudio().catch(() => undefined);
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
    };

    window.addEventListener("pointerdown", primeAudio, { once: true });
    window.addEventListener("keydown", primeAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
    };
  }, []);

  useEffect(() => {
    if (!authSession) {
      setIncomingAlerts([]);
      setBellOpen(false);
      return;
    }

    let active = true;

    const pollInbox = async () => {
      try {
        const alerts = await requestJson<InternalAlertPayload[]>(
          "/notifications/inbox",
        );
        if (!active) {
          return;
        }

        const freshAlerts = alerts.filter(
          (alert) => !heardAlertIdsRef.current.has(alert.id),
        );

        if (freshAlerts.length === 0) {
          return;
        }

        freshAlerts.forEach((alert) => {
          heardAlertIdsRef.current.add(alert.id);
        });

        setIncomingAlerts((current) => {
          const knownIds = new Set(current.map((alert) => alert.id));
          return [...freshAlerts.filter((alert) => !knownIds.has(alert.id)), ...current];
        });
        const newestAlert = freshAlerts[0];
        if (!newestAlert) {
          return;
        }
        setStatusText(
          `${newestAlert.createdBy} needs your attention.`,
        );
        await playBellAlertSound();
        await Promise.all(
          freshAlerts.map((alert) => acknowledgeAlert(alert.id)),
        );
      } catch {
        // Ignore transient polling failures.
      }
    };

    void pollInbox();
    const intervalId = window.setInterval(() => {
      void pollInbox();
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [authSession?.user.username]);

  useEffect(() => {
    if (!authSession) {
      return;
    }
    setReportForm((current) => ({
      ...current,
      signedBy: authSession.user.displayName,
    }));
    setExpenseForm((current) => ({
      ...current,
      recordedBy: authSession.user.displayName,
    }));
    setNotificationForm((current) => ({
      ...current,
      createdBy: authSession.user.displayName,
    }));
    setBellForm((current) => ({
      recipientUsername: current.recipientUsername,
      message:
        current.message ||
        `You are needed by ${authSession.user.displayName}.`,
    }));
  }, [authSession?.user.displayName]);

  useEffect(() => {
    setFacilityForm({
      name: bootstrap.facility.name,
      phone: bootstrap.facility.phone,
      email: bootstrap.facility.email,
      location: bootstrap.facility.location,
      logoDataUrl: bootstrap.facility.logoDataUrl,
      footerMessage: bootstrap.facility.footerMessage,
    });
  }, [bootstrap.facility]);

  useEffect(() => {
    const selectedService = services.find(
      (service) => service.id === selectedServiceId,
    );
    if (!selectedService) {
      return;
    }

    setServiceForm({
      code: selectedService.code,
      name: selectedService.name,
      kind: selectedService.kind,
      specimenType: selectedService.specimenType ?? "",
      modality: selectedService.modality ?? "",
      priceCents: String(selectedService.priceCents),
      tatMinutes: String(selectedService.tatMinutes),
      isActive: selectedService.isActive ?? true,
    });
  }, [selectedServiceId, services]);

  useEffect(() => {
    const selectedDoctor = referralDoctors.find(
      (doctor) => doctor.id === selectedReferralDoctorId,
    );
    if (!selectedDoctor) {
      return;
    }

    setReferralDoctorForm({
      fullName: selectedDoctor.fullName,
      phone: selectedDoctor.phone ?? "",
      email: selectedDoctor.email ?? "",
      commissionPercent: String(selectedDoctor.commissionPercent),
      isActive: selectedDoctor.isActive,
    });
  }, [selectedReferralDoctorId, referralDoctors]);

  useEffect(() => {
    const currentPatient =
      patients.find((patient) => patient.id === selectedPatientId) ??
      patients.find((patient) => patient.id === reportForm.patientId) ??
      null;
    setSelectedPatientReferralDoctorId(currentPatient?.referralDoctorId ?? "");
  }, [patients, reportForm.patientId, selectedPatientId]);

  useEffect(() => {
    const selectedOrder = workflow.orders.find(
      (order) => order.id === reportForm.orderId,
    );
    if (!selectedOrder) {
      return;
    }

    const sonographyItem = selectedOrder.items.find((item) =>
      isSonographyServiceLabel(item),
    );

    setReportForm((current) => ({
      ...current,
      patientId: selectedOrder.patientId,
      title:
        current.title === "Scan Report"
          ? `${selectedOrder.items[0] ?? "Scan"} Report`
          : current.title,
      templateKind: sonographyItem
        ? resolveUltrasoundTemplate(sonographyItem)
        : current.templateKind,
    }));
  }, [reportForm.orderId, workflow.orders]);

  const catalogOptions = (
    bootstrap.catalog.length ? bootstrap.catalog : catalogSeed
  ) as CatalogSeedItem[];
  const selectedPatient = useMemo(
    () =>
      patients.find((patient) => patient.id === selectedPatientId) ??
      patients.find((patient) => patient.id === reportForm.patientId) ??
      null,
    [patients, reportForm.patientId, selectedPatientId],
  );
  const availableReferralDoctors = useMemo(
    () => referralDoctors.filter((doctor) => doctor.isActive !== false),
    [referralDoctors],
  );
  const selectedPatientTimeline = useMemo(() => {
    if (!selectedPatient) {
      return [] as PatientTimelineEntry[];
    }

    const events: PatientTimelineEntry[] = [
      {
        id: `patient-${selectedPatient.id}`,
        occurredAt: selectedPatient.createdAt,
        label: "Patient registered",
        detail: `${selectedPatient.traceCode} profile opened for operational tracking.`,
        meta: selectedPatient.referralDoctorName
          ? `Referral linked to ${selectedPatient.referralDoctorName}`
          : "No referral doctor linked at registration",
        tone: "good",
      },
    ];

    for (const order of workflow.orders.filter(
      (entry) => entry.patientId === selectedPatient.id,
    )) {
      events.push({
        id: `order-${order.id}`,
        occurredAt: order.createdAt,
        label: `Order ${order.accessionNumber}`,
        detail: `${order.items.length} service(s) requested for ${order.patientTraceCode}.`,
        meta: `${order.status} · ${order.items.join(", ") || "No items listed"}`,
        tone:
          order.status === "COMPLETED"
            ? "good"
            : order.status === "CANCELLED"
              ? "critical"
              : "neutral",
      });
    }

    for (const invoice of workflow.invoices.filter(
      (entry) => entry.patientId === selectedPatient.id,
    )) {
      events.push({
        id: `invoice-${invoice.id}`,
        occurredAt: invoice.createdAt,
        label: `Invoice ${invoice.accessionNumber}`,
        detail: `${formatMoney(invoice.amountPaidCents)} paid against ${formatMoney(invoice.amountDueCents)} due.`,
        meta:
          invoice.balanceCents > 0
            ? `${invoice.status} · Balance ${formatMoney(invoice.balanceCents)}`
            : `${invoice.status} · Settled${invoice.paymentsCount > 0 ? ` in ${invoice.paymentsCount} payment(s)` : ""}`,
        tone:
          invoice.balanceCents > 0
            ? invoice.status === "OVERDUE"
              ? "critical"
              : "warn"
            : "good",
      });
    }

    for (const report of workflow.reports.filter(
      (entry) => entry.patientId === selectedPatient.id,
    )) {
      events.push({
        id: `report-${report.id}`,
        occurredAt: report.signedAt ?? report.createdAt,
        label: report.signedAt ? "Report signed" : "Report drafted",
        detail: report.title,
        meta: report.signedAt
          ? `${report.status} · Signed by ${report.signedBy ?? "Unknown"}`
          : `${report.status} · Awaiting scan sign-off`,
        tone: report.criticalFlag
          ? "critical"
          : report.signedAt
            ? "good"
            : "neutral",
      });
    }

    return events.sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
  }, [selectedPatient, workflow.invoices, workflow.orders, workflow.reports]);
  const selectedPatientHistorySummary = useMemo(() => {
    if (!selectedPatient) {
      return null;
    }

    const orderCount = workflow.orders.filter(
      (entry) => entry.patientId === selectedPatient.id,
    ).length;
    const reportCount = workflow.reports.filter(
      (entry) => entry.patientId === selectedPatient.id,
    ).length;
    const outstandingBalanceCents = workflow.invoices
      .filter((entry) => entry.patientId === selectedPatient.id)
      .reduce((sum, entry) => sum + entry.balanceCents, 0);

    return {
      orderCount,
      reportCount,
      outstandingBalanceCents,
      lastActivityAt: selectedPatientTimeline[0]?.occurredAt ?? selectedPatient.createdAt,
    };
  }, [selectedPatient, selectedPatientTimeline, workflow.invoices, workflow.orders, workflow.reports]);
  const patientTracePreview = useMemo(() => {
    const manualTraceCode = patientForm.traceCode.trim().toUpperCase();
    return (
      manualTraceCode ||
      buildLocalTraceCode(patientForm.firstName, patientForm.lastName, 1214)
    );
  }, [patientForm.firstName, patientForm.lastName, patientForm.traceCode]);
  const sonographyIntakeCatalog = useMemo(() => {
    const scoreCatalogItem = (item: CatalogSeedItem) => {
      const modality = item.modality?.toLowerCase() ?? "";
      if (
        item.kind === "IMAGING" &&
        (modality.includes("ultrasound") || modality.includes("echo"))
      ) {
        return 3;
      }
      if (item.kind === "IMAGING") {
        return 2;
      }
      return 1;
    };

    return [...catalogOptions].sort((left, right) => {
      const scoreDifference = scoreCatalogItem(right) - scoreCatalogItem(left);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return left.name.localeCompare(right.name);
    });
  }, [catalogOptions]);
  const sonographyStudies = useMemo(
    () =>
      [...workflow.imaging]
        .filter(
          (study) =>
            isSonographyServiceLabel(study.serviceName) ||
            isSonographyServiceLabel(study.modality),
        )
        .sort((left, right) => {
          const leftTime = new Date(
            left.scheduledAt ?? left.createdAt,
          ).getTime();
          const rightTime = new Date(
            right.scheduledAt ?? right.createdAt,
          ).getTime();
          return leftTime - rightTime;
        }),
    [workflow.imaging],
  );
  const filteredRegistrationServices = useMemo(() => {
    const query = registrationServiceQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return sonographyIntakeCatalog.filter((item) =>
      [item.name, item.code, item.modality ?? "", item.department]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [registrationServiceQuery, sonographyIntakeCatalog]);
  const filteredOrderServices = useMemo(() => {
    const query = orderServiceQuery.trim().toLowerCase();
    if (!query) {
      return sonographyIntakeCatalog;
    }

    return sonographyIntakeCatalog.filter((item) =>
      [item.name, item.code, item.modality ?? "", item.department]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [orderServiceQuery, sonographyIntakeCatalog]);
  const selectedImagingStudy = useMemo(
    () =>
      sonographyStudies.find((study) => study.id === selectedImagingStudyId) ??
      sonographyStudies.find((study) => study.patientId === selectedPatientId) ??
      sonographyStudies[0] ??
      null,
    [selectedImagingStudyId, selectedPatientId, sonographyStudies],
  );
  useEffect(() => {
    if (!selectedImagingStudyId && sonographyStudies[0]) {
      setSelectedImagingStudyId(sonographyStudies[0].id);
    }
  }, [selectedImagingStudyId, sonographyStudies]);
  useEffect(() => {
    if (!selectedImagingStudy) {
      return;
    }

    setSonographyDeskForm({
      appointmentStatus: selectedImagingStudy.appointmentStatus,
      scheduledAt: selectedImagingStudy.scheduledAt
        ? selectedImagingStudy.scheduledAt.slice(0, 16)
        : "",
      sonographerName: selectedImagingStudy.sonographerName ?? "",
      radiologistName: selectedImagingStudy.radiologistName ?? "",
      priorStudyReference: selectedImagingStudy.priorStudyReference ?? "",
      criticalFlag: selectedImagingStudy.criticalFlag,
    });
    setNotificationForm((current) => ({
      ...current,
      patientId: selectedImagingStudy.patientId,
      traceCode: selectedImagingStudy.patientTraceCode,
      recipient:
        current.patientId === selectedImagingStudy.patientId && current.recipient
          ? current.recipient
          : selectedPatient?.phone ?? current.recipient,
    }));
  }, [selectedImagingStudy, selectedPatient?.phone]);
  const searchMatches = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (!query) {
      return patients.slice(0, 6);
    }

    return patients
      .filter((patient) =>
        [
          patient.traceCode,
          patient.firstName,
          patient.lastName,
          patient.phone,
          patient.referralDoctorName ?? "",
        ].some((value) => value.toLowerCase().includes(query)),
      )
      .slice(0, 8);
  }, [globalQuery, patients]);
  const orderMatches = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (!query) {
      return workflow.orders.slice(0, 6);
    }

    return workflow.orders
      .filter((order) =>
        [
          order.patientTraceCode,
          order.patientName,
          order.accessionNumber,
          order.items.join(" "),
        ].some((value) => value.toLowerCase().includes(query)),
      )
      .slice(0, 8);
  }, [globalQuery, workflow.orders]);
  const recentCritical = useMemo(
    () => adminOverview.aiFlags.filter((flag) => flag.severity === "high"),
    [adminOverview.aiFlags],
  );
  const totalCents = useMemo(
    () =>
      catalogOptions
        .filter((item) => selectedItemIds.includes(item.id ?? item.code))
        .reduce((sum, item) => sum + item.priceCents, 0),
    [catalogOptions, selectedItemIds],
  );
  const registrationTotalCents = useMemo(
    () =>
      catalogOptions
        .filter((item) => registrationItemIds.includes(item.id ?? item.code))
        .reduce((sum, item) => sum + item.priceCents, 0),
    [catalogOptions, registrationItemIds],
  );
  const registrationDueCents = useMemo(
    () =>
      intakeOrder.insuranceAuthorized
        ? registrationTotalCents - Math.round(registrationTotalCents * 0.4)
        : registrationTotalCents,
    [intakeOrder.insuranceAuthorized, registrationTotalCents],
  );
  const expenseFilterCategories = useMemo(
    () => ["ALL", ...expenseWorkspace.availableCategories],
    [expenseWorkspace.availableCategories],
  );
  const reportableOrders = useMemo(
    () =>
      workflow.orders.filter(
        (order) =>
          !workflow.reports.some((report) => report.orderId === order.id),
      ),
    [workflow.orders, workflow.reports],
  );
  const selectedReportImagingStudy = useMemo(
    () =>
      workflow.imaging.find((study) => study.orderId === reportForm.orderId) ??
      null,
    [reportForm.orderId, workflow.imaging],
  );
  const selectedUltrasoundTemplatePreset = useMemo(
    () =>
      isUltrasoundTemplate(reportForm.templateKind)
        ? ultrasoundTemplatePresets[reportForm.templateKind]
        : null,
    [reportForm.templateKind],
  );
  const selectedUltrasoundPresetFields = useMemo(
    () =>
      isUltrasoundTemplate(reportForm.templateKind)
        ? ultrasoundPresetFieldMap[reportForm.templateKind] ?? []
        : [],
    [reportForm.templateKind],
  );
  useEffect(() => {
    if (!isUltrasoundTemplate(reportForm.templateKind) || !selectedReportImagingStudy) {
      return;
    }

    setUltrasoundReportAssist((current) => ({
      ...current,
      sonographerName:
        current.sonographerName || selectedReportImagingStudy.sonographerName || "",
    }));
  }, [reportForm.templateKind, selectedReportImagingStudy]);
  const labServices = useMemo(
    () =>
      services
        .filter((service) => service.kind === "TEST")
        .sort(
          (left, right) =>
            Number(right.isActive ?? true) - Number(left.isActive ?? true) ||
            left.name.localeCompare(right.name),
        ),
    [services],
  );
  const imagingServices = useMemo(
    () =>
      services
        .filter((service) => service.kind === "IMAGING")
        .sort(
          (left, right) =>
            Number(right.isActive ?? true) - Number(left.isActive ?? true) ||
            left.name.localeCompare(right.name),
        ),
    [services],
  );
  const bulkServicePreview = useMemo(
    () => parseBulkServiceText(bulkServiceText),
    [bulkServiceText],
  );
  const bulkPreviewEntries = useMemo(() => {
    const existingCodes = new Set(
      services.map((service) => service.code.trim().toUpperCase()),
    );
    const codeCounts = new Map<string, number>();
    for (const entry of bulkServicePreview.services) {
      const code = entry.service.code.trim().toUpperCase();
      codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    }

    return bulkServicePreview.services.map((entry) => {
      const normalizedCode = entry.service.code.trim().toUpperCase();
      const duplicateInBatch = (codeCounts.get(normalizedCode) ?? 0) > 1;

      if (duplicateInBatch) {
        return {
          ...entry,
          status: "skip",
          statusLabel: "Will skip",
          statusTone: "tag-critical",
          note: "Duplicate code appears more than once in this batch.",
        } satisfies BulkServicePreviewEntry;
      }

      if (existingCodes.has(normalizedCode)) {
        return {
          ...entry,
          status:
            bulkImportMode === "OVERWRITE_EXISTING" ? "overwrite" : "skip",
          statusLabel:
            bulkImportMode === "OVERWRITE_EXISTING"
              ? "Will overwrite"
              : "Will skip",
          statusTone:
            bulkImportMode === "OVERWRITE_EXISTING"
              ? "tag-warn"
              : "tag-critical",
          note:
            bulkImportMode === "OVERWRITE_EXISTING"
              ? "Existing service code will be updated in place."
              : "Existing service code will be left unchanged.",
        } satisfies BulkServicePreviewEntry;
      }

      return {
        ...entry,
        status: "new",
        statusLabel: "New",
        statusTone: "tag-good",
        note: "New service will be created in the active catalog.",
      } satisfies BulkServicePreviewEntry;
    });
  }, [bulkImportMode, bulkServicePreview.services, services]);
  const outstandingInvoices = useMemo(
    () =>
      [...workflow.invoices]
        .filter(
          (invoice) => invoice.balanceCents > 0 && invoice.status !== "VOID",
        )
        .sort((left, right) => {
          if (right.balanceCents !== left.balanceCents) {
            return right.balanceCents - left.balanceCents;
          }

          return (
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime()
          );
        }),
    [workflow.invoices],
  );
  const metrics = getRoleMetricCards(
    currentRole,
    bootstrap,
    adminOverview,
    workflow,
  );
  const portalSnapshotCards = useMemo(
    () =>
      getPortalSnapshotCards(
        currentRole,
        bootstrap,
        adminOverview,
        workflow,
        syncStatus,
      ),
    [adminOverview, bootstrap, currentRole, syncStatus, workflow],
  );
  const loginPortalProfiles = primaryPortalRoles.flatMap((role) => {
    const profile = portalProfiles[role];
    return profile
      ? [
          {
            key: role,
            label: profile.label,
            summary: profile.summary,
            demoUsername: profile.demoUsername,
            demoPin: profile.demoPin,
          },
        ]
      : [];
  });

  const canWriteReports = allowedActions.includes("report:write");
  const canManageQc = allowedActions.includes("qc:manage");
  const canManageInventory = allowedActions.includes("inventory:manage");
  const canManageFinance = allowedActions.includes("finance:manage");
  const canManageServices = allowedActions.includes("service:manage");
  const canManageBackups = allowedActions.includes("backup:manage");
  const canQueueNotifications = allowedActions.includes("notify:queue");
  const canManageUsers = allowedActions.includes("user:manage");
  const canManageIntegrations = allowedActions.includes("integration:manage");
  const visibleNavItems = useMemo(() => {
    const scopedNavItems = portalProfile
      ? navItems.filter((item) => portalProfile.navKeys.includes(item.key))
      : navItems;

    return scopedNavItems.filter((item) => hasNavAccess(item.key, allowedActions));
  }, [allowedActions, portalProfile]);
  const visibleNavKeys = useMemo(
    () => new Set(visibleNavItems.map((item) => item.key)),
    [visibleNavItems],
  );
  const visibleNavSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items
            .map((key) => visibleNavItems.find((item) => item.key === key))
            .filter((item): item is (typeof navItems)[number] => Boolean(item)),
        }))
        .filter((section) => section.items.length > 0),
    [visibleNavItems],
  );
  const filteredStudyPerformance = useMemo(
    () =>
      analyticsStudyDepartmentFilter === "ALL"
        ? financeAnalytics.studyPerformance
        : financeAnalytics.studyPerformance.filter(
            (study) => study.department === analyticsStudyDepartmentFilter,
          ),
    [analyticsStudyDepartmentFilter, financeAnalytics.studyPerformance],
  );
  const analyticsStudyDepartments = useMemo(
    () =>
      [
        "ALL",
        ...Array.from(
          new Set(financeAnalytics.studyPerformance.map((study) => study.department)),
        ),
      ] as Array<"ALL" | "LAB" | "IMAGING">,
    [financeAnalytics.studyPerformance],
  );
  const selectedAnalyticsStudyEntry = useMemo(
    () =>
      filteredStudyPerformance.find(
        (study) => study.description === selectedAnalyticsStudy,
      ) ?? null,
    [filteredStudyPerformance, selectedAnalyticsStudy],
  );
  const rankedStudyPerformance = useMemo(
    () =>
      [...filteredStudyPerformance].sort((left, right) => {
        if (right.growthRatePercent !== left.growthRatePercent) {
          return right.growthRatePercent - left.growthRatePercent;
        }
        if (right.billedCents !== left.billedCents) {
          return right.billedCents - left.billedCents;
        }
        return left.description.localeCompare(right.description);
      }),
    [filteredStudyPerformance],
  );
  const topStudiesByRevenue = useMemo(
    () =>
      [...filteredStudyPerformance]
        .sort((left, right) => right.billedCents - left.billedCents)
        .slice(0, 8),
    [filteredStudyPerformance],
  );
  useEffect(() => {
    if (filteredStudyPerformance.length === 0) {
      if (selectedAnalyticsStudy) {
        setSelectedAnalyticsStudy("");
      }
      return;
    }

    const selectionExists = filteredStudyPerformance.some(
      (study) => study.description === selectedAnalyticsStudy,
    );
    if (!selectionExists) {
      setSelectedAnalyticsStudy(filteredStudyPerformance[0]?.description ?? "");
    }
  }, [filteredStudyPerformance, selectedAnalyticsStudy]);
  const portalQuickActions = (portalProfile?.actions ?? defaultPortalActions).filter(
    (action) => visibleNavKeys.has(action.target),
  );
  const dashboardPortalItems = visibleNavItems.filter(
    (item) => item.key !== "dashboard",
  );
  const dashboardActionItems = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...portalQuickActions,
            ...dashboardPortalItems.slice(0, 4).map((item) => ({
              label: item.label,
              target: item.key,
              tone: "ghost" as const,
            })),
          ].map((item) => [item.target, item]),
        ).values(),
      ).slice(0, 4),
    [dashboardPortalItems, portalQuickActions],
  );
  const dashboardActivityItems = useMemo(() => {
    const invoiceEvents = workflow.invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      label:
        invoice.amountPaidCents > 0 ? "Payment recorded" : "Invoice opened",
      meta: `${invoice.traceCode} · ${formatMoney(
        invoice.amountPaidCents > 0 ? invoice.amountPaidCents : invoice.amountDueCents,
      )}`,
      occurredAt: invoice.createdAt,
      tone: invoice.balanceCents > 0 ? "warn" : "good",
    }));
    const orderEvents = workflow.orders.map((order) => ({
      id: `order-${order.id}`,
      label: "Order created",
      meta: `${order.patientTraceCode} · ${order.items[0] ?? "Request"}`,
      occurredAt: order.createdAt,
      tone: "neutral" as const,
    }));
    const reportEvents = workflow.reports.map((report) => ({
      id: `report-${report.id}`,
      label: report.signedAt ? "Report signed" : "Report drafted",
      meta: `${report.title} · ${report.signedBy ?? "Pending signature"}`,
      occurredAt: report.signedAt ?? report.createdAt,
      tone: report.criticalFlag ? "critical" : "good",
    }));

    return [...invoiceEvents, ...orderEvents, ...reportEvents]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      )
      .slice(0, 4);
  }, [workflow.invoices, workflow.orders, workflow.reports]);

  useEffect(() => {
    const firstVisibleNavItem = visibleNavItems[0];
    if (!firstVisibleNavItem) {
      return;
    }

    if (!visibleNavKeys.has(activeNav)) {
      setActiveNav(firstVisibleNavItem.key);
    }
  }, [activeNav, visibleNavItems, visibleNavKeys]);

  useEffect(() => {
    const syncFromHash = () => {
      const nextHash = window.location.hash;
      setPortalHash(nextHash);

      const route = parsePortalHash(nextHash);
      if (authSession && route && route.role === currentRole && visibleNavKeys.has(route.nav)) {
        setActiveNav(route.nav);
      }
    };

    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [authSession, currentRole, visibleNavKeys]);

  useEffect(() => {
    if (!authSession || !isPrimaryPortalRole(currentRole)) {
      return;
    }

    const nextHash = buildPortalHash(currentRole, activeNav);
    if (portalHash === nextHash) {
      return;
    }

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${nextHash}`,
    );
    setPortalHash(nextHash);
  }, [activeNav, authSession, currentRole, portalHash]);

  useEffect(() => {
    setIntakePayment((current) => ({
      ...current,
      amountCents: String(registrationDueCents),
    }));
  }, [registrationDueCents]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      if (!response.ok) {
        if (response.status === 423) {
          const payload = (await response.json()) as { message: string };
          throw new Error(payload.message);
        }
        throw new Error("Invalid username or PIN");
      }

      const session = (await response.json()) as AuthSessionPayload;
      setAuthSession(session);
      setActiveNav(resolvePortalNavForRole(session.user.role));
      setStatusText(`Signed in as ${session.user.displayName}`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Login failed. Confirm the MediLab Nexus server is running.",
      );
    }
  }

  async function handleLogout() {
    try {
      if (authSession) {
        await fetch(`${apiBase}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      }
    } finally {
      setAuthSession(null);
      setAuthReady(true);
      setBellOpen(false);
      setIncomingAlerts([]);
      setStatusText("Signed out");
    }
  }

  function openPatient(patient: PatientRecord) {
    setSelectedPatientId(patient.id);
    setOrderForm((current) => ({ ...current, patientId: patient.id }));
    setNotificationForm((current) => ({
      ...current,
      patientId: patient.id,
      traceCode: patient.traceCode,
      recipient: current.recipient || patient.phone,
    }));
    setActiveNav("patients");
  }

  async function handlePatientSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const referralName = patientForm.referralName.trim();
    const referralCommissionInput = patientReferralCommission.trim();
    const referralCommissionPercent =
      referralCommissionInput === ""
        ? undefined
        : Number(referralCommissionInput);

    if (referralCommissionInput !== "" && !referralName) {
      setStatusText(
        "Enter the referral name before adding a commission percentage",
      );
      return;
    }

    if (
      referralCommissionPercent !== undefined &&
      (!Number.isFinite(referralCommissionPercent) ||
        referralCommissionPercent < 0 ||
        referralCommissionPercent > 100)
    ) {
      setStatusText("Commission percentage must be between 0 and 100");
      return;
    }

    try {
      const created = await requestJson<PatientRecord>("/patients", {
        method: "POST",
        body: JSON.stringify({
          ...patientForm,
          referralName,
          referralCommissionPercent,
        } satisfies PatientInput),
      });
      setPatients((current) => [created, ...current]);
      openPatient(created);
      let statusMessage = `Patient ${created.traceCode} registered`;

      if (registrationItemIds.length > 0) {
        try {
          const orderResponse = await requestJson<{
            order: { id: string; accessionNumber: string };
            invoice: { id: string; amountDueCents: number };
          }>("/orders", {
            method: "POST",
            body: JSON.stringify({
              patientId: created.id,
              itemIds: registrationItemIds,
              orderedBy: intakeOrder.orderedBy,
              priority: intakeOrder.priority,
              insuranceProvider: intakeOrder.insuranceProvider,
              insuranceAuthorized: intakeOrder.insuranceAuthorized,
              scheduledFor: intakeOrder.scheduledFor,
              sonographerName: "",
              priorStudyReference: "",
              radiologistName: "",
            } satisfies OrderInput),
          });

          setLatestInvoiceId(orderResponse.invoice.id);
          statusMessage = `Patient ${created.traceCode} registered and order ${orderResponse.order.accessionNumber} created`;

          if (
            canManageFinance &&
            intakePayment.collectNow &&
            Number(intakePayment.amountCents) > 0
          ) {
            try {
              const paymentResponse = await requestJson<{
                payment: { id: string; traceCode: string | null };
                updatedInvoice: { id: string };
              }>("/billing/payments", {
                method: "POST",
                body: JSON.stringify({
                  invoiceId: orderResponse.invoice.id,
                  amountCents: Number(intakePayment.amountCents),
                  method: intakePayment.method,
                  reference: intakePayment.reference,
                  receivedBy: actorName,
                  traceCode: created.traceCode,
                } satisfies PaymentInput),
              });

              setLatestInvoiceId(paymentResponse.updatedInvoice.id);
              setLatestReceipt({
                paymentId: paymentResponse.payment.id,
                traceCode:
                  paymentResponse.payment.traceCode ?? created.traceCode,
              });
              statusMessage = `Patient ${created.traceCode} registered, service request added, payment captured, and receipt generated`;
              await handlePreviewReceipt(paymentResponse.payment.id);
            } catch {
              statusMessage = `Patient ${created.traceCode} registered and service request added, but payment could not be captured`;
            }
          }
        } catch {
          statusMessage = `Patient ${created.traceCode} registered, but the service request could not be created`;
        }
      }

      setStatusText(statusMessage);
      setPatientForm({
        firstName: "",
        lastName: "",
        middleName: "",
        traceCode: "",
        phone: "",
        allergies: "",
        medicalHistory: "",
        referralDoctorId: "",
        referralName: "",
        consentAccepted: true,
        gender: "Female",
        dateOfBirth: "",
      });
      setPatientReferralCommission("");
      setRegistrationItemIds([]);
      setRegistrationServiceQuery("");
      setIntakeOrder({
        orderedBy: "Front Desk",
        priority: "ROUTINE",
        insuranceProvider: "",
        insuranceAuthorized: false,
        scheduledFor: "",
      });
      setIntakePayment({
        collectNow: true,
        amountCents: "0",
        method: "CASH",
        reference: "",
      });
      await loadOperationalData();
    } catch {
      setStatusText(
        "Patient registration failed. Verify server connectivity and try again.",
      );
    }
  }

  async function handleSelectedPatientReferralUpdate() {
    if (!selectedPatient) {
      setStatusText("Choose a patient before updating the referral doctor");
      return;
    }

    try {
      const updated = await requestJson<PatientRecord>(
        `/patients/${selectedPatient.id}/referral`,
        {
          method: "PUT",
          body: JSON.stringify({
            referralDoctorId: selectedPatientReferralDoctorId,
          } satisfies PatientReferralUpdateInput),
        },
      );
      setPatients((current) =>
        current.map((patient) =>
          patient.id === updated.id ? updated : patient,
        ),
      );
      await loadOperationalData();
      setStatusText(
        updated.referralDoctorName
          ? `${updated.traceCode} now linked to ${updated.referralDoctorName}`
          : `${updated.traceCode} referral doctor cleared`,
      );
    } catch {
      setStatusText("Patient referral doctor could not be updated right now");
    }
  }

  async function handleOrderSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: OrderInput = {
      ...orderForm,
      patientId: selectedPatientId || orderForm.patientId,
      itemIds: selectedItemIds,
    };
    try {
      await requestJson("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatusText(
        selectedItemIds.some((itemId) => {
          const catalogItem = catalogOptions.find(
            (entry) => (entry.id ?? entry.code) === itemId,
          );
          return catalogItem ? catalogItem.kind === "IMAGING" : false;
        })
          ? "Sonography request placed into the workflow"
          : "Order placed into the workflow",
      );
      setSelectedItemIds([]);
      setOrderServiceQuery("");
      await loadOperationalData();
    } catch {
      setStatusText(
        "Order submission failed. Retry when the server is available.",
      );
    }
  }

  async function handleReportSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const presetMeasurementLines = isUltrasoundTemplate(reportForm.templateKind)
      ? buildPresetMeasurementLines(reportForm.templateKind, ultrasoundReportAssist)
      : [];
    const compiledMeasurements = [
      ultrasoundReportAssist.measurementsText.trim(),
      ...presetMeasurementLines,
    ].filter(Boolean);
    const findings =
      isUltrasoundTemplate(reportForm.templateKind)
        ? [
            ultrasoundReportAssist.technique
              ? `Technique: ${ultrasoundReportAssist.technique}`
              : "",
            ultrasoundReportAssist.sonographerName
              ? `Prepared by: ${ultrasoundReportAssist.sonographerName}`
              : "",
            reportForm.findings,
            compiledMeasurements.length > 0
              ? `Measurements:\n${compiledMeasurements.join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n")
        : reportForm.findings;
    const impression =
      isUltrasoundTemplate(reportForm.templateKind)
        ? [
            reportForm.impression,
            ultrasoundReportAssist.recommendation
              ? `Recommendation: ${ultrasoundReportAssist.recommendation}`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
        : reportForm.impression;
    const payload: ReportInput = {
      ...reportForm,
      summary: reportForm.summary.trim(),
      findings,
      impression,
      imagePaths: reportImagePathsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      await requestJson("/reports", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatusText(`Scan report ${payload.title} prepared with printable output`);
      setReportForm({
        patientId: "",
        orderId: "",
        title: "Scan Report",
        medicalHistory: "",
        summary: "",
        findings: "",
        impression: "",
        signedBy: actorName,
        templateKind: "LAB_STANDARD",
        criticalFlag: false,
        imagePaths: [],
      });
      setReportImagePathsText("");
      setUltrasoundReportAssist(defaultUltrasoundReportAssistState);
      await loadOperationalData();
    } catch {
      setStatusText(
        "Scan report could not be submitted. Retry when the server is available.",
      );
    }
  }

  async function handleSonographyDeskSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!selectedImagingStudy) {
      setStatusText("Choose a sonography study before updating the scan desk");
      return;
    }

    try {
      await requestJson(`/imaging/${selectedImagingStudy.id}`, {
        method: "PATCH",
        body: JSON.stringify(sonographyDeskForm),
      });
      await loadOperationalData();
      setStatusText(
        `${selectedImagingStudy.serviceName} updated to ${sonographyDeskForm.appointmentStatus}`,
      );
    } catch {
      setStatusText(
        "Sonography desk update failed. Retry when the server is available.",
      );
    }
  }

  function openUltrasoundReportDraft() {
    if (!selectedImagingStudy) {
      setStatusText("Choose a sonography study before opening the scan report draft");
      return;
    }

    const templateKind = resolveUltrasoundTemplate(
      selectedImagingStudy.serviceName,
    );
    const preset = ultrasoundTemplatePresets[templateKind];

    setSelectedPatientId(selectedImagingStudy.patientId);
    setReportForm((current) => ({
      ...current,
      patientId: selectedImagingStudy.patientId,
      orderId: selectedImagingStudy.orderId,
      title: `${selectedImagingStudy.serviceName} Report`,
      medicalHistory:
        current.orderId === selectedImagingStudy.orderId
          ? current.medicalHistory
          : "",
      templateKind,
      summary:
        current.orderId === selectedImagingStudy.orderId ? current.summary : "",
      findings:
        current.orderId === selectedImagingStudy.orderId && current.findings
          ? current.findings
          : preset.findingsStarter,
      impression:
        current.orderId === selectedImagingStudy.orderId && current.impression
          ? current.impression
          : preset.impressionStarter,
    }));
    setUltrasoundReportAssist((current) => ({
      ...defaultUltrasoundReportAssistState,
      sonographerName: selectedImagingStudy.sonographerName ?? "",
      technique: preset.techniquePlaceholder,
    }));
    setActiveNav("scanReports");
  }

  function updateUltrasoundAssistField(
    field: keyof UltrasoundReportAssistState,
    value: string,
  ) {
    setUltrasoundReportAssist((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openPreviewWindow(blockedMessage: string, loadingTitle: string) {
    const preview = window.open("", "_blank");
    if (!preview) {
      setStatusText(blockedMessage);
      return null;
    }

    preview.document.open();
    preview.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${loadingTitle}</title>
    <style>
      :root { color-scheme: light; font-family: Georgia, "Times New Roman", serif; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #f5efe4, #edf4ef);
        color: #16332c;
      }
      .preview-loading {
        padding: 24px 28px;
        border-radius: 20px;
        background: rgba(255, 253, 249, 0.94);
        border: 1px solid rgba(13, 95, 88, 0.14);
        box-shadow: 0 24px 60px rgba(27, 43, 37, 0.12);
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="preview-loading">Preparing printable preview...</div>
  </body>
</html>`);
    preview.document.close();
    return preview;
  }

  function writePreviewWindow(preview: Window, html: string) {
    if (preview.closed) {
      return false;
    }

    preview.document.open();
    preview.document.write(html);
    preview.document.close();
    preview.focus();
    return true;
  }

  async function handlePreviewReport(reportId: string) {
    const preview = openPreviewWindow(
      "Popup blocked. Allow popups to preview the report.",
      "Preparing report preview",
    );
    if (!preview) {
      return;
    }

    try {
      const printable = await requestJson<PrintableReportPayload>(
        `/reports/${reportId}/printable`,
      );
      if (writePreviewWindow(preview, printable.html)) {
        setStatusText(`Opened printable report ${printable.fileName}`);
      } else {
        setStatusText("Preview window was closed before the report loaded");
      }
    } catch {
      preview.close();
      setStatusText("Printable preview is unavailable right now");
    }
  }

  async function handlePreviewReceipt(paymentId: string) {
    const preview = openPreviewWindow(
      "Popup blocked. Allow popups to preview the receipt.",
      "Preparing receipt preview",
    );
    if (!preview) {
      return;
    }

    try {
      const printable = await requestJson<PrintableReceiptPayload>(
        `/billing/payments/${paymentId}/printable`,
      );
      if (writePreviewWindow(preview, printable.html)) {
        setStatusText(`Opened printable receipt ${printable.fileName}`);
      } else {
        setStatusText("Preview window was closed before the receipt loaded");
      }
    } catch {
      preview.close();
      setStatusText("Printable receipt is unavailable right now");
    }
  }

  async function handlePreviewInvoice(invoiceId: string) {
    const preview = openPreviewWindow(
      "Popup blocked. Allow popups to preview the invoice.",
      "Preparing invoice preview",
    );
    if (!preview) {
      return;
    }

    try {
      const printable = await requestJson<PrintableInvoicePayload>(
        `/billing/invoices/${invoiceId}/printable`,
      );
      if (writePreviewWindow(preview, printable.html)) {
        setLatestInvoiceId(invoiceId);
        setStatusText(`Opened printable invoice ${printable.fileName}`);
      } else {
        setStatusText("Preview window was closed before the invoice loaded");
      }
    } catch {
      preview.close();
      setStatusText("Printable invoice is unavailable right now");
    }
  }

  async function handlePreviewAnalytics() {
    const preview = openPreviewWindow(
      "Popup blocked. Allow popups to preview the operations report.",
      "Preparing operations report preview",
    );
    if (!preview) {
      return;
    }

    try {
      const printable = await requestJson<PrintableAnalyticsPayload>(
        `/analytics/finance/printable?range=${encodeURIComponent(analyticsRange)}`,
      );
      if (writePreviewWindow(preview, printable.html)) {
        setStatusText(`Opened operations report ${printable.fileName}`);
      } else {
        setStatusText(
          "Preview window was closed before the operations report loaded",
        );
      }
    } catch {
      preview.close();
      setStatusText("Printable operations report is unavailable right now");
    }
  }

  function handleDownloadAnalyticsCsv() {
    const rows = [
      ["Report Area", "Item", "Amount", "Count", "Notes"],
      [
        "Overview",
        "Range",
        analyticsRangeLabels[financeAnalytics.range],
        "",
        "",
      ],
      [
        "Overview",
        "Gross billed",
        (financeAnalytics.summary.grossBilledCents / 100).toFixed(2),
        "",
        "",
      ],
      [
        "Overview",
        "Net due",
        (financeAnalytics.summary.netDueCents / 100).toFixed(2),
        "",
        "",
      ],
      [
        "Overview",
        "Collected",
        (financeAnalytics.summary.collectedCents / 100).toFixed(2),
        "",
        "",
      ],
      [
        "Overview",
        "Expenses",
        (financeAnalytics.summary.expenseCents / 100).toFixed(2),
        "",
        "",
      ],
      [
        "Overview",
        "Net profit",
        (financeAnalytics.summary.netProfitCents / 100).toFixed(2),
        "",
        "",
      ],
      ...financeAnalytics.paymentMix.map((item) => [
        "Payment mix",
        item.method,
        (item.totalCents / 100).toFixed(2),
        String(item.count),
        "",
      ]),
      ...financeAnalytics.topServices.map((service) => [
        "Top service",
        service.description,
        (service.revenueCents / 100).toFixed(2),
        String(service.quantity),
        String(service.invoicesCount),
      ]),
      ...financeAnalytics.studyPerformance.flatMap((study) => [
        [
          "Study summary",
          `${study.description} (${study.department})`,
          (study.billedCents / 100).toFixed(2),
          String(study.quantity),
          `Collected ${(study.collectedCents / 100).toFixed(2)} / Outstanding ${(study.outstandingCents / 100).toFixed(2)} / Invoices ${study.invoicesCount} / Growth ${study.growthRatePercent.toFixed(2)}%`,
        ],
        ...study.trend.map((month) => [
          "Study trend",
          `${study.description} - ${month.label}`,
          (month.billedCents / 100).toFixed(2),
          String(month.quantity),
          `Collected ${(month.collectedCents / 100).toFixed(2)} / Outstanding ${(month.outstandingCents / 100).toFixed(2)} / Invoices ${month.invoicesCount}`,
        ]),
      ]),
      ...financeAnalytics.topReferrers.map((referrer) => [
        "Top referrer",
        referrer.doctorName,
        (referrer.commissionDueCents / 100).toFixed(2),
        String(referrer.invoicesCount),
        (referrer.billedCents / 100).toFixed(2),
      ]),
      ...financeAnalytics.expenseCategories.map((category) => [
        "Expense category",
        category.category,
        (category.totalCents / 100).toFixed(2),
        String(category.count),
        "",
      ]),
      ...financeAnalytics.userPerformance.map((entry) => [
        "Staff performance",
        entry.actorName,
        (entry.netCents / 100).toFixed(2),
        String(entry.inventoryActions),
        `Collections ${(entry.generatedCents / 100).toFixed(2)} / Expenses ${(entry.lossCents / 100).toFixed(2)}`,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/gu, '""')}"`).join(","),
      )
      .join("\n");
    downloadTextFile(
      csv,
      `medilab-operations-report-${financeAnalytics.range.toLowerCase()}.csv`,
    );
    setStatusText("Operations report CSV downloaded");
  }

  async function handleExpenseSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: ExpenseInput = {
      category: expenseForm.category,
      description: expenseForm.description,
      amountCents: Math.round(Number(expenseForm.amount || "0") * 100),
      incurredAt: new Date(expenseForm.incurredAt).toISOString(),
      recordedBy: expenseForm.recordedBy,
      notes: expenseForm.notes,
    };

    if (!Number.isFinite(payload.amountCents) || payload.amountCents <= 0) {
      setStatusText("Enter a valid expense amount before saving");
      return;
    }

    try {
      await requestJson("/finance/expenses", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setExpenseForm((current) => ({
        ...current,
        description: "",
        amount: "",
        notes: "",
      }));
      await loadOperationalData();
      await loadExpenseWorkspace();
      setStatusText("Expense recorded and expenses refreshed");
    } catch {
      setStatusText("Expense could not be recorded right now");
    }
  }

  async function handleFacilityLogoChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const normalized = await normalizeFacilityLogo(file);
      setFacilityForm((current) => ({
        ...current,
        logoDataUrl: normalized.dataUrl,
      }));
      setStatusText(
        `${file.name} optimized to ${normalized.width}x${normalized.height} for branded reports`,
      );
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Logo upload failed. Try a PNG or JPEG file.",
      );
    } finally {
      event.target.value = "";
    }
  }

  async function handleFacilitySave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updatedFacility = await requestJson<FacilityProfile>(
        "/admin/facility",
        {
          method: "PUT",
          body: JSON.stringify(facilityForm),
        },
      );
      setBootstrap((current) => ({ ...current, facility: updatedFacility }));
      setStatusText("Facility profile saved for receipts and reports");
    } catch {
      setStatusText("Facility profile could not be saved right now");
    }
  }

  async function handleServiceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: ServiceInput = {
      code: serviceForm.code,
      name: serviceForm.name,
      kind: serviceForm.kind,
      specimenType: serviceForm.kind === "TEST" ? serviceForm.specimenType : "",
      modality: serviceForm.kind === "IMAGING" ? serviceForm.modality : "",
      priceCents: Number(serviceForm.priceCents),
      tatMinutes: Number(serviceForm.tatMinutes),
      isActive: serviceForm.isActive,
    };

    try {
      const path = selectedServiceId
        ? `/admin/services/${selectedServiceId}`
        : "/admin/services";
      const method = selectedServiceId ? "PUT" : "POST";
      await requestJson<CatalogSeedItem>(path, {
        method,
        body: JSON.stringify(payload),
      });
      resetServiceEditor();
      await loadOperationalData();
      setStatusText(
        selectedServiceId
          ? "Service updated and pricing refreshed"
          : "New service added and available for ordering",
      );
    } catch {
      setStatusText("Service could not be saved right now");
    }
  }

  function resetReferralDoctorEditor() {
    setSelectedReferralDoctorId("");
    setReferralDoctorForm({
      fullName: "",
      phone: "",
      email: "",
      commissionPercent: "10",
      isActive: true,
    });
  }

  async function handleReferralDoctorSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const payload: ReferralDoctorInput = {
      fullName: referralDoctorForm.fullName,
      phone: referralDoctorForm.phone,
      email: referralDoctorForm.email,
      commissionPercent: Number(referralDoctorForm.commissionPercent),
      isActive: referralDoctorForm.isActive,
    };

    try {
      const path = selectedReferralDoctorId
        ? `/admin/referral-doctors/${selectedReferralDoctorId}`
        : "/admin/referral-doctors";
      const method = selectedReferralDoctorId ? "PUT" : "POST";
      await requestJson<ReferralDoctorSummaryPayload>(path, {
        method,
        body: JSON.stringify(payload),
      });
      resetReferralDoctorEditor();
      await loadOperationalData();
      setStatusText(
        selectedReferralDoctorId
          ? "Referral doctor updated and intake options refreshed"
          : "Referral doctor added and ready for patient registration",
      );
    } catch {
      setStatusText("Referral doctor could not be saved right now");
    }
  }

  async function handleToggleReferralDoctorActive(
    doctor: ReferralDoctorSummaryPayload,
  ) {
    const nextActive = !doctor.isActive;
    const confirmed = window.confirm(
      nextActive
        ? `Reactivate ${doctor.fullName} for new patient referrals?`
        : `Archive ${doctor.fullName}? The doctor will stop appearing in patient registration.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await requestJson<ReferralDoctorSummaryPayload>(
        `/admin/referral-doctors/${doctor.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            fullName: doctor.fullName,
            phone: doctor.phone ?? "",
            email: doctor.email ?? "",
            commissionPercent: doctor.commissionPercent,
            isActive: nextActive,
          } satisfies ReferralDoctorInput),
        },
      );
      if (selectedReferralDoctorId === doctor.id && !nextActive) {
        resetReferralDoctorEditor();
      }
      if (patientForm.referralDoctorId === doctor.id && !nextActive) {
        setPatientForm((current) => ({ ...current, referralDoctorId: "" }));
      }
      await loadOperationalData();
      setStatusText(
        nextActive
          ? `${doctor.fullName} restored for new referrals`
          : `${doctor.fullName} archived from patient registration`,
      );
    } catch {
      setStatusText("Referral doctor status could not be updated right now");
    }
  }

  async function handleBulkServiceSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!bulkServicePreview.services.length) {
      setStatusText("Paste at least one valid service row before bulk add");
      return;
    }
    const firstBulkError = bulkServicePreview.errors[0];
    if (firstBulkError) {
      setStatusText(firstBulkError);
      return;
    }

    try {
      const payload: BulkServiceInput = {
        services: bulkServicePreview.services.map((entry) => entry.service),
        mode: bulkImportMode,
      };
      const result = await requestJson<BulkServiceImportResponse>(
        "/admin/services/bulk",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      if (result.skippedCount === 0) {
        setBulkServiceText("");
        setBulkImportFileName("");
      }
      setBulkImportHistory((current) =>
        [
          {
            importedAt: new Date().toISOString(),
            mode: bulkImportMode,
            sourceLabel: bulkImportFileName || "Pasted rows",
            createdCount: result.createdCount,
            updatedCount: result.updatedCount,
            skippedCount: result.skippedCount,
          },
          ...current,
        ].slice(0, 5),
      );
      await loadOperationalData();
      const summary = [
        result.createdCount > 0 ? `${result.createdCount} created` : null,
        result.updatedCount > 0 ? `${result.updatedCount} updated` : null,
        result.skippedCount > 0 ? `${result.skippedCount} skipped` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      setStatusText(
        summary
          ? `Bulk import complete: ${summary}`
          : "No services were imported",
      );
    } catch {
      setStatusText("Bulk service import could not be completed right now");
    }
  }

  async function handleBulkServiceFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".txt")) {
        throw new Error("Use a .csv or .txt file for bulk service import");
      }

      const content = await file.text();
      setBulkServiceText(content);
      setBulkImportFileName(file.name);
      setStatusText(`Loaded ${file.name} for bulk service review`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Bulk service file could not be read",
      );
    } finally {
      event.target.value = "";
    }
  }

  function handleBulkTemplateDownload() {
    downloadTextFile(
      [
        "code,name,kind,specimen_or_modality,price_cents,tat_minutes,is_active",
        "LAB-CRP,C-Reactive Protein,TEST,Serum,8500,120,true",
        "IMG-PELVIC,Pelvic Ultrasound,IMAGING,Ultrasound,35000,45,true",
      ].join("\n"),
      "medilab-services-template.csv",
    );
    setStatusText("Bulk services CSV template downloaded");
  }

  function resetServiceEditor() {
    setSelectedServiceId("");
    setServiceForm({
      code: "",
      name: "",
      kind: "TEST",
      specimenType: "Whole Blood",
      modality: "Ultrasound",
      priceCents: "0",
      tatMinutes: "60",
      isActive: true,
    });
  }

  async function handleToggleServiceActive(service: CatalogSeedItem) {
    if (!service.id) {
      return;
    }

    const nextActive = !(service.isActive ?? true);
    const confirmed = window.confirm(
      nextActive
        ? `Reactivate ${service.name} and make it available for ordering again?`
        : `Archive ${service.name}? It will stop appearing in Reception Intake and Orders & Requests.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await requestJson<CatalogSeedItem>(`/admin/services/${service.id}`, {
        method: "PUT",
        body: JSON.stringify({
          code: service.code,
          name: service.name,
          kind: service.kind,
          specimenType: service.specimenType ?? "",
          modality: service.modality ?? "",
          priceCents: service.priceCents,
          tatMinutes: service.tatMinutes,
          isActive: nextActive,
        } satisfies ServiceInput),
      });
      if (selectedServiceId === service.id && !nextActive) {
        resetServiceEditor();
      }
      await loadOperationalData();
      setStatusText(
        nextActive
          ? `${service.name} reactivated for ordering`
          : `${service.name} archived from active ordering`,
      );
    } catch {
      setStatusText("Service status could not be updated right now");
    }
  }

  async function handleDownloadPdf(reportId: string, title: string) {
    if (!authSession) {
      return;
    }

    try {
      const response = await fetch(`${apiBase}/reports/${reportId}/pdf`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("PDF download failed");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${title.replace(/[^a-z0-9_-]+/giu, "-")}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setStatusText(`Downloaded PDF for ${title}`);
    } catch {
      setStatusText("PDF download failed. Check API connectivity.");
    }
  }

  async function handleQcSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: QcEventInput = {
      module: qcForm.module,
      instrumentName: qcForm.instrumentName,
      analyte: qcForm.analyte,
      controlLevel: qcForm.controlLevel,
      lotNumber: qcForm.lotNumber,
      observedValue: Number(qcForm.observedValue),
      meanValue: Number(qcForm.meanValue),
      standardDeviation: Number(qcForm.standardDeviation),
      expectedRange: qcForm.expectedRange,
      performedBy: qcForm.performedBy,
      notes: qcForm.notes,
      traceCode: qcForm.traceCode,
    };

    try {
      await requestJson("/qc/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await loadOperationalData();
      setStatusText("QC event recorded with Westgard evaluation");
    } catch {
      setStatusText(
        "QC event could not be recorded. Retry when the server is available.",
      );
    }
  }

  async function handleInventorySubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const payload = {
      ...inventoryForm,
      quantity: Number(inventoryForm.quantity),
    };
    try {
      await requestJson("/inventory/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await loadOperationalData();
      setStatusText("Inventory movement recorded");
    } catch {
      setStatusText(
        "Inventory movement failed. Retry when the server is available.",
      );
    }
  }

  async function handlePaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ...paymentForm,
      amountCents: Number(paymentForm.amountCents),
    };
    try {
      const response = await requestJson<{
        payment: { id: string; traceCode: string | null };
        updatedInvoice: { id: string };
      }>("/billing/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setLatestReceipt({
        paymentId: response.payment.id,
        traceCode: response.payment.traceCode ?? paymentForm.traceCode ?? "",
      });
      setLatestInvoiceId(response.updatedInvoice.id);
      await loadOperationalData();
      setStatusText("Payment captured");
      await handlePreviewReceipt(response.payment.id);
    } catch {
      setStatusText(
        "Payment could not be captured. Retry when the server is available.",
      );
    }
  }

  function handlePrepareInvoiceCollection(
    invoice: InvoiceRecord,
    amountCents = invoice.balanceCents,
  ) {
    setPaymentForm((current) => ({
      ...current,
      invoiceId: invoice.id,
      amountCents,
      traceCode: invoice.traceCode,
    }));
    setLatestInvoiceId(invoice.id);
    setActiveNav("billing");
    setStatusText(
      `Prepared ${formatMoney(amountCents)} collection for ${invoice.traceCode}`,
    );
  }

  async function handleNotificationSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    try {
      await requestJson("/notifications", {
        method: "POST",
        body: JSON.stringify(notificationForm),
      });
      await loadOperationalData();
      setStatusText(`${notificationForm.channel} notification queued`);
    } catch {
      setStatusText(
        "Notification could not be queued. Retry when the server is available.",
      );
    }
  }

  async function handleBellSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await requestJson<{ id: string }>("/notifications/internal", {
        method: "POST",
        body: JSON.stringify(bellForm),
      });
      const recipient = bellRecipientOptions.find(
        (user) => user.username === bellForm.recipientUsername,
      );
      setBellForm({
        recipientUsername: "",
        message: `You are needed by ${actorName}.`,
      });
      setBellOpen(false);
      setStatusText(
        `Bell alert sent to ${recipient?.displayName ?? bellForm.recipientUsername}`,
      );
    } catch {
      setStatusText("Bell alert could not be sent right now.");
    }
  }

  function dismissIncomingAlert(alertId: string) {
    setIncomingAlerts((current) =>
      current.filter((alert) => alert.id !== alertId),
    );
  }

  async function handleBackupCreate() {
    try {
      const snapshot = await requestJson<BackupRecord>("/admin/backups", {
        method: "POST",
      });
      setBackups((current) => [snapshot, ...current]);
      setSelectedBackupId(snapshot.id);
      setStatusText("Encrypted backup created");
      await loadOperationalData();
    } catch {
      setStatusText(
        "Backup request failed. Retry when the server is available.",
      );
    }
  }

  async function handleRestoreLatest() {
    if (!selectedBackupId) {
      setStatusText("Select a backup snapshot first");
      return;
    }

    try {
      await requestJson("/admin/restore", {
        method: "POST",
        body: JSON.stringify({ snapshotId: selectedBackupId }),
      });
      await loadOperationalData();
      setStatusText("Backup restored");
    } catch {
      setStatusText(
        "Restore failed. Verify server availability and try again.",
      );
    }
  }

  async function handleUserCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await requestJson("/admin/users", {
        method: "POST",
        body: JSON.stringify(userForm),
      });
      const username = userForm.username;
      setUserForm({
        username: "",
        displayName: "",
        role: "RECEPTION",
        pin: "",
      });
      await loadOperationalData();
      setStatusText(`Account ${username} created`);
    } catch {
      setStatusText(
        "User creation failed. Check duplicates or API availability.",
      );
    }
  }

  async function handleRotatePin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pinRotation.userId) {
      setStatusText("Choose a user before rotating a PIN");
      return;
    }

    try {
      await requestJson(`/admin/users/${pinRotation.userId}/rotate-pin`, {
        method: "POST",
        body: JSON.stringify({ newPin: pinRotation.newPin }),
      });
      setPinRotation({ userId: "", newPin: "" });
      await loadOperationalData();
      setStatusText("PIN rotated and previous sessions revoked");
    } catch {
      setStatusText("PIN rotation failed");
    }
  }

  async function handleToggleUser(userId: string, isActive: boolean) {
    try {
      await requestJson(`/admin/users/${userId}/status`, {
        method: "POST",
        body: JSON.stringify({ isActive }),
      });
      await loadOperationalData();
      setStatusText(isActive ? "User reactivated" : "User deactivated");
    } catch {
      setStatusText("User status update failed");
    }
  }

  async function handleUnlockUser(userId: string) {
    try {
      await requestJson(`/admin/users/${userId}/unlock`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadOperationalData();
      setStatusText("User lockout reset");
    } catch {
      setStatusText("Unlock failed");
    }
  }

  async function handleRunIntegrationDispatch() {
    try {
      const result = await requestJson<IntegrationDispatchRunPayload>(
        "/admin/integrations/run",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      setSyncStatus(result);
      await loadOperationalData();
      setStatusText(
        `Dispatch cycle processed ${result.processedEvents} outbound record(s) and sent ${result.sentNotifications} notification(s)`,
      );
    } catch {
      setStatusText("Integration dispatch could not be started");
    }
  }

  const dashboardSection = (
    <>
      <section className="dashboard-shell">
        <div className="dashboard-heading-row">
          <div>
            <h1>Dashboard</h1>
            <p className="hero-copy">
              {portalProfile?.summary ?? roleCopy[currentRole].subtitle}
            </p>
          </div>
          <div className="dashboard-status-row">
            <span className={`sync-chip ${syncTone.tone}`}>{syncTone.label}</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => void loadOperationalData()}
            >
              Sync
            </button>
          </div>
        </div>

        <section className="dashboard-summary-grid">
          {metrics.map((metric) => (
            <article key={metric.label} className="dashboard-stat-card">
              <div className="dashboard-stat-top">
                <div>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
                <div className="dashboard-stat-icon">{metric.label.slice(0, 2).toUpperCase()}</div>
              </div>
              <p>{metric.note}</p>
            </article>
          ))}
        </section>

        <section className="dashboard-feature-grid">
          <article className="surface-card dashboard-revenue-card">
            <span>Today&apos;s revenue</span>
            <strong>{formatMoney(adminOverview.finance.revenueTodayCents)}</strong>
            <p>
              Outstanding balances: {formatMoney(adminOverview.finance.outstandingCents)}
            </p>
          </article>

          <article className="surface-card dashboard-performance-card">
            <div className="section-head compact-head">
              <div>
                <h3>Performance overview</h3>
                <p>Operational and financial snapshot for the active portal.</p>
              </div>
            </div>
            <div className="dashboard-performance-metrics">
              {portalSnapshotCards.map((card) => (
                <div key={card.label} className="dashboard-performance-metric">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="dashboard-lower-grid">
          <article className="surface-card dashboard-actions-card">
            <div className="section-head compact-head">
              <div>
                <h3>Quick actions</h3>
                <p>Jump to the most used pages in this portal.</p>
              </div>
            </div>
            <div className="dashboard-actions-grid">
              {dashboardActionItems.map((action, index) => (
                <button
                  key={action.target}
                  type="button"
                  className={index === 0 ? "primary-action" : "ghost-action"}
                  onClick={() => setActiveNav(action.target)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </article>

          <article className="surface-card dashboard-activity-card">
            <div className="section-head compact-head">
              <div>
                <h3>Recent activity</h3>
                <p>Latest workflow movement across requests, billing, and reports.</p>
              </div>
            </div>
            <div className="dashboard-activity-list">
              {dashboardActivityItems.length === 0 ? (
                <div className="list-row">
                  <span>No recent activity</span>
                  <small>Waiting for new events</small>
                </div>
              ) : null}
              {dashboardActivityItems.map((item) => (
                <article key={item.id} className={`dashboard-activity-item tone-${item.tone}`}>
                  <div className="dashboard-activity-badge">
                    {item.label.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.meta}</span>
                    <small>{formatDate(item.occurredAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      </section>

      <PortalDashboardDeck
        label={portalProfile?.label ?? "Workspace menu"}
        spotlight={
          portalProfile?.spotlight ??
          "Move through the modules that matter for the current signed-in role."
        }
        highlights={
          portalProfile?.highlights ??
          dashboardPortalItems.slice(0, 4).map((item) => item.label)
        }
        items={dashboardPortalItems.map((item) => ({
          key: item.key,
          label: item.label,
          short: item.short,
          description: navDescriptions[item.key],
        }))}
        activeKey={activeNav}
        onSelect={(key) => setActiveNav(key as NavKey)}
        steps={
          portalProfile?.steps ?? [
            "Review the dashboard for the live queue and critical events.",
            "Open the next operational module that needs intervention.",
            "Return here to re-balance the day when priorities shift.",
          ]
        }
        snapshotCards={portalSnapshotCards}
      />

      {recentCritical.length > 0 ? (
        <section className="alert-banner">
          <strong>Critical values need attention.</strong>
          <span>{recentCritical.map((flag) => flag.title).join(" · ")}</span>
        </section>
      ) : null}

      <section className="content-grid two-wide">
        <article className="surface-card chart-card">
          <div className="section-head">
            <div>
              <h2>Operational flow</h2>
              <p>
                Sonography intake through scan reporting with clear scheduling and
                release checkpoints.
              </p>
            </div>
          </div>
          <div className="workflow-grid">
            {[
              {
                label: "Registrations",
                count: bootstrap.metrics.patientsToday,
                note: "Patients booked in today",
              },
              {
                label: "Scheduled scans",
                count: workflow.imaging.filter(
                  (study) => study.appointmentStatus === "SCHEDULED",
                ).length,
                note: "Waiting for arrival",
              },
              {
                label: "Scanning",
                count: workflow.imaging.filter(
                  (study) => study.appointmentStatus === "SCANNING",
                ).length,
                note: "On the sonography bench",
              },
              {
                label: "Ready to report",
                count: workflow.imaging.filter(
                  (study) =>
                    study.appointmentStatus === "REPORTED" ||
                    study.appointmentStatus === "COMPLETED",
                ).length,
                note: "Awaiting radiologist sign-off",
              },
            ].map((step) => (
              <div key={step.label} className="workflow-tile">
                <span>{step.label}</span>
                <strong>{step.count}</strong>
                <p>{step.note}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <h2>Quality trend</h2>
              <p>Levey-Jennings review with quick visual drift detection.</p>
            </div>
          </div>
          <LeveyJenningsChart points={adminOverview.qc.leveyJennings} />
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <h2>Recent Trace Codes</h2>
              <p>Open a patient and move directly into ordering.</p>
            </div>
          </div>
          <div className="list-stack">
            {patients.slice(0, 5).map((patient) => (
              <button
                key={patient.id}
                type="button"
                className="list-row button-row"
                onClick={() => openPatient(patient)}
              >
                <div>
                  <strong>{patient.traceCode}</strong>
                  <span>
                    {patient.firstName} {patient.lastName}
                  </span>
                  {patient.referralDoctorName ? (
                    <small>
                      {patient.referralDoctorName} ·{" "}
                      {patient.referralDoctorCommissionPercent}%
                    </small>
                  ) : null}
                </div>
                <small>{patient.phone}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <h2>Pending scans</h2>
              <p>Live ultrasound worklist with current patient status.</p>
            </div>
          </div>
          <div className="list-stack">
            {sonographyStudies.slice(0, 6).map((study) => (
              <div key={study.id} className="list-row">
                <div>
                  <strong>{study.patientTraceCode}</strong>
                  <span>{study.serviceName}</span>
                  <small>
                    {study.appointmentStatus}
                    {study.sonographerName
                      ? ` · ${study.sonographerName}`
                      : " · Sonographer pending"}
                  </small>
                </div>
                <small
                  className={`status-pill tone-${getOrderTone(
                    study.appointmentStatus === "REPORTED" ||
                      study.appointmentStatus === "COMPLETED"
                      ? "READY_FOR_REVIEW"
                      : study.appointmentStatus === "SCANNING"
                        ? "IN_PROGRESS"
                        : "REGISTERED",
                  )}`}
                >
                  {study.appointmentStatus}
                </small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );

  const patientSection = (
    <section className="content-grid two-wide">
      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Reception intake</h2>
            <p>
              Register the patient, assign a trace code when needed, attach
              requested services, collect payment, and open the receipt from
              one front-desk flow.
            </p>
          </div>
          <span className="trace-preview">{patientTracePreview}</span>
        </div>
        <form className="form-grid" onSubmit={handlePatientSubmit}>
          <div className="full-width intake-progress">
            <div className="intake-progress-step active">
              <strong>1</strong>
              <span>Patient details</span>
            </div>
            <div
              className={`intake-progress-step ${registrationItemIds.length > 0 ? "active" : ""}`}
            >
              <strong>2</strong>
              <span>Search services</span>
            </div>
            <div
              className={`intake-progress-step ${intakePayment.collectNow ? "active" : ""}`}
            >
              <strong>3</strong>
              <span>Payment and receipt</span>
            </div>
          </div>

          <section className="full-width intake-step-card">
            <div className="section-head stacked-head">
              <div>
                <h3>Step 1: Patient details</h3>
                <p>
                  Capture the patient details, optional custom trace code, and
                  referral details before the study is prepared.
                </p>
              </div>
            </div>
            <div className="intake-step-grid">
              <label>
                <span>First name</span>
                <input
                  value={patientForm.firstName}
                  onChange={(event) =>
                    setPatientForm((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Last name</span>
                <input
                  value={patientForm.lastName}
                  onChange={(event) =>
                    setPatientForm((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Phone</span>
                <input
                  value={patientForm.phone}
                  onChange={(event) =>
                    setPatientForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Trace code</span>
                <input
                  value={patientForm.traceCode}
                  onChange={(event) =>
                    setPatientForm((current) => ({
                      ...current,
                      traceCode: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Leave blank to auto-generate"
                />
              </label>
              <label>
                <span>Date of birth</span>
                <input
                  type="date"
                  value={patientForm.dateOfBirth}
                  onChange={(event) =>
                    setPatientForm((current) => ({
                      ...current,
                      dateOfBirth: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Gender</span>
                <select
                  value={patientForm.gender}
                  onChange={(event) =>
                    setPatientForm((current) => ({
                      ...current,
                      gender: event.target.value,
                    }))
                  }
                >
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                <span>Referral</span>
                <input
                  value={patientForm.referralName}
                  onChange={(event) =>
                    setPatientForm((current) => ({
                      ...current,
                      referralName: event.target.value,
                    }))
                  }
                  placeholder="Type the referring source or clinician"
                />
              </label>
              <label>
                <span>Commission %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={patientReferralCommission}
                  onChange={(event) =>
                    setPatientReferralCommission(event.target.value)
                  }
                  placeholder="Optional"
                />
              </label>
              <div className="summary-panel">
                <span>Trace and referral</span>
                <strong>
                  {patientForm.traceCode.trim()
                    ? patientForm.traceCode.trim().toUpperCase()
                    : `${patientTracePreview} · auto`}
                </strong>
                <p className="muted-copy">
                  {patientForm.referralName.trim()
                    ? `${patientForm.referralName.trim()}${patientReferralCommission.trim() ? ` will be recorded at ${patientReferralCommission.trim()}% commission.` : " will be recorded on this intake."}`
                    : "Manual trace codes must keep the initials-plus-number format. Leave blank to continue sequential numbering."}
                </p>
              </div>
              <label className="full-width">
                <span>Allergies</span>
                <textarea
                  rows={2}
                  value={patientForm.allergies}
                  onChange={(event) =>
                    setPatientForm((current) => ({
                      ...current,
                      allergies: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="summary-panel full-width">
                <span>Clinical note handling</span>
                <strong>History will be completed on the report</strong>
                <p className="muted-copy">
                  The doctor or sonographer will add the history later when the
                  scan report is being prepared.
                </p>
              </div>
            </div>
          </section>

          <section className="full-width intake-step-card">
            <div className="section-head stacked-head">
              <div>
                <h3>Step 2: Search services</h3>
                <p>
                  Search for the service, then tick it to attach it to this
                  patient intake.
                </p>
              </div>
            </div>
            <div className="full-width service-search-panel">
              <label className="full-width">
                <span>Search registered services</span>
                <input
                  value={registrationServiceQuery}
                  onChange={(event) =>
                    setRegistrationServiceQuery(event.target.value)
                  }
                  placeholder="Search ultrasound, echo, pelvic, abdominal..."
                />
              </label>
              <small className="section-note">
                {registrationServiceQuery.trim()
                  ? `${filteredRegistrationServices.length} registered service(s) match.`
                  : "Type to search the available services."}
              </small>
            </div>
            {registrationServiceQuery.trim() ? (
              <div className="service-selection-list full-width">
                {filteredRegistrationServices.map((item) => {
                  const value = item.id ?? item.code;
                  const checked = registrationItemIds.includes(value);
                  return (
                    <label
                      key={`intake-${item.code}`}
                      className={`service-option-row ${checked ? "selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setRegistrationItemIds((current) =>
                            current.includes(value)
                              ? current.filter((entry) => entry !== value)
                              : [...current, value],
                          )
                        }
                      />
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.department} ·{" "}
                          {item.modality ?? item.specimenType ?? "General"}
                        </span>
                        <small>{item.code}</small>
                      </div>
                      <div className="service-option-meta">
                        <small>{formatMoney(item.priceCents)}</small>
                        <small>{item.tatMinutes} min TAT</small>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : null}
            {registrationServiceQuery.trim() && filteredRegistrationServices.length === 0 ? (
              <p className="section-note full-width">
                No registered services match that search yet.
              </p>
            ) : null}
          </section>

          <section className="full-width intake-step-card">
            <div className="section-head stacked-head">
              <div>
                <h3>Step 3: Payment and receipt</h3>
                <p>
                  Capture payment immediately and open the receipt as soon as
                  registration is completed.
                </p>
              </div>
            </div>
            <div className="intake-step-grid">
              <label className="full-width inline-toggle">
                <input
                  type="checkbox"
                  checked={intakePayment.collectNow}
                  onChange={(event) =>
                    setIntakePayment((current) => ({
                      ...current,
                      collectNow: event.target.checked,
                    }))
                  }
                  disabled={
                    !canManageFinance || registrationItemIds.length === 0
                  }
                />
                <span>Take payment now and generate receipt</span>
              </label>
              <label>
                <span>Payment method</span>
                <select
                  value={intakePayment.method}
                  onChange={(event) =>
                    setIntakePayment((current) => ({
                      ...current,
                      method: event.target.value as PaymentInput["method"],
                    }))
                  }
                  disabled={!canManageFinance || !intakePayment.collectNow}
                >
                  {paymentMethods.map((method) => (
                    <option key={`intake-${method}`} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Payment amount (pesewas)</span>
                <input
                  type="number"
                  value={intakePayment.amountCents}
                  onChange={(event) =>
                    setIntakePayment((current) => ({
                      ...current,
                      amountCents: event.target.value,
                    }))
                  }
                  disabled={!canManageFinance || !intakePayment.collectNow}
                />
              </label>
              <label className="full-width">
                <span>Payment reference</span>
                <input
                  value={intakePayment.reference}
                  onChange={(event) =>
                    setIntakePayment((current) => ({
                      ...current,
                      reference: event.target.value,
                    }))
                  }
                  disabled={!canManageFinance || !intakePayment.collectNow}
                />
              </label>
            </div>
          </section>

          <aside className="summary-panel full-width intake-summary-panel">
            <div>
              <span>Reception intake summary</span>
              <strong>{formatMoney(registrationTotalCents)}</strong>
              <p className="muted-copy">
                {registrationItemIds.length > 0
                  ? `${registrationItemIds.length} service item(s) selected · Amount due now ${formatMoney(registrationDueCents)}`
                  : "Register the patient first, then search for the scan service before billing."}
              </p>
            </div>
            <button type="submit">
              {registrationItemIds.length > 0
                ? intakePayment.collectNow && canManageFinance
                  ? "Register Patient + Service + Payment"
                  : "Register Patient + Service"
                : "Register Patient Only"}
            </button>
          </aside>
          <div className="full-width action-row">
            <span className="section-note">
              Reception can register the patient, attach the service, and open
              the printed receipt from this single form.
            </span>
          </div>
        </form>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Patient search</h2>
            <p>Search by Trace Code, name, or phone.</p>
          </div>
        </div>
        <div className="list-stack">
          {searchMatches.map((patient) => (
            <button
              key={patient.id}
              type="button"
              className="list-row button-row"
              onClick={() => openPatient(patient)}
            >
              <div>
                <strong>{patient.traceCode}</strong>
                <span>
                  {patient.firstName} {patient.lastName}
                </span>
                {patient.referralDoctorName ? (
                  <small>
                    {patient.referralDoctorName} ·{" "}
                    {patient.referralDoctorCommissionPercent}%
                  </small>
                ) : null}
              </div>
              <small>Start order</small>
            </button>
          ))}
        </div>
        <div className="bordered-top">
          <div className="section-head">
            <div>
              <h3>Selected patient referral</h3>
              <p>Correct or clear the linked referral doctor after intake.</p>
            </div>
          </div>
          {selectedPatient ? (
            <div className="form-grid">
              <div className="summary-panel full-width">
                <span>Active patient</span>
                <strong>
                  {selectedPatient.traceCode} · {selectedPatient.firstName}{" "}
                  {selectedPatient.lastName}
                </strong>
                <p className="muted-copy">
                  {selectedPatient.referralDoctorName
                    ? `Current referral: ${selectedPatient.referralDoctorName} · ${selectedPatient.referralDoctorCommissionPercent}%`
                    : "No referral doctor linked yet."}
                </p>
              </div>
              <label className="full-width">
                <span>Referral doctor</span>
                <select
                  value={selectedPatientReferralDoctorId}
                  onChange={(event) =>
                    setSelectedPatientReferralDoctorId(event.target.value)
                  }
                >
                  <option value="">No referral doctor</option>
                  {availableReferralDoctors.map((doctor) => (
                    <option key={`selected-${doctor.id}`} value={doctor.id}>
                      {doctor.fullName} · {doctor.commissionPercent}%
                    </option>
                  ))}
                </select>
              </label>
              <div className="full-width action-row">
                <button
                  type="button"
                  onClick={handleSelectedPatientReferralUpdate}
                >
                  Update referral doctor
                </button>
              </div>
            </div>
          ) : (
            <p className="section-note">
              Search or open a patient first to update the linked referral
              doctor.
            </p>
          )}
        </div>
        <div className="bordered-top patient-history-panel">
          <div className="section-head">
            <div>
              <h3>Visit history timeline</h3>
              <p>Trace the selected patient's registration, orders, billing, and reports.</p>
            </div>
          </div>
          {selectedPatient && selectedPatientHistorySummary ? (
            <div className="list-stack">
              <div className="history-summary-grid">
                <div className="summary-panel">
                  <span>Orders</span>
                  <strong>{selectedPatientHistorySummary.orderCount}</strong>
                  <p className="muted-copy">Requests linked to this patient record.</p>
                </div>
                <div className="summary-panel">
                  <span>Reports</span>
                  <strong>{selectedPatientHistorySummary.reportCount}</strong>
                  <p className="muted-copy">Drafted or approved result documents.</p>
                </div>
                <div className="summary-panel">
                  <span>Outstanding</span>
                  <strong>{formatMoney(selectedPatientHistorySummary.outstandingBalanceCents)}</strong>
                  <p className="muted-copy">Current unpaid balance across patient invoices.</p>
                </div>
              </div>
              <div className="timeline-list compact-scroll">
                {selectedPatientTimeline.map((entry) => (
                  <article key={entry.id} className={`timeline-item tone-${entry.tone}`}>
                    <div className="timeline-marker" aria-hidden="true" />
                    <div className="timeline-content">
                      <div className="timeline-head">
                        <strong>{entry.label}</strong>
                        <small>{formatDate(entry.occurredAt)}</small>
                      </div>
                      <span>{entry.detail}</span>
                      <small>{entry.meta}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="section-note">
              Search or open a patient first to review the visit timeline.
            </p>
          )}
        </div>
      </article>
    </section>
  );

  const ordersSection = (
    <section className="content-grid two-wide">
      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Orders and requests</h2>
            <p>Ultrasound-first ordering with slot, sonographer, and prior-study context.</p>
          </div>
          <span className="patient-chip">
            {selectedPatient?.traceCode ?? "Select patient"}
          </span>
        </div>
        <form className="form-grid" onSubmit={handleOrderSubmit}>
          <label className="full-width">
            <span>Patient</span>
            <select
              value={selectedPatientId}
              onChange={(event) => setSelectedPatientId(event.target.value)}
            >
              <option value="">Choose patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.traceCode} · {patient.firstName} {patient.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Ordered by</span>
            <input
              value={orderForm.orderedBy}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  orderedBy: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Priority</span>
            <select
              value={orderForm.priority}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  priority: event.target.value as OrderInput["priority"],
                }))
              }
            >
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="STAT">STAT</option>
            </select>
          </label>
          <label>
            <span>Insurance</span>
            <input
              value={orderForm.insuranceProvider}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  insuranceProvider: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Preferred time</span>
            <input
              type="datetime-local"
              value={orderForm.scheduledFor}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  scheduledFor: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Sonographer</span>
            <input
              value={orderForm.sonographerName}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  sonographerName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Reviewing radiologist</span>
            <input
              value={orderForm.radiologistName}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  radiologistName: event.target.value,
                }))
              }
            />
          </label>
          <label className="full-width">
            <span>Prior study reference</span>
            <input
              value={orderForm.priorStudyReference}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  priorStudyReference: event.target.value,
                }))
              }
              placeholder="Previous scan date, accession, or external reference"
            />
          </label>
          <label className="full-width inline-toggle">
            <input
              type="checkbox"
              checked={orderForm.insuranceAuthorized}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  insuranceAuthorized: event.target.checked,
                }))
              }
            />
            <span>Pre-authorized insurance</span>
          </label>
          <div className="full-width service-search-panel">
            <label className="full-width">
              <span>Search registered services</span>
              <input
                value={orderServiceQuery}
                onChange={(event) => setOrderServiceQuery(event.target.value)}
                placeholder="Search ultrasound, echo, pelvic, abdominal..."
              />
            </label>
            <small className="section-note">
              {filteredOrderServices.length} registered service(s) match.
            </small>
          </div>
          <div className="service-selection-list full-width">
            {filteredOrderServices.map((item) => {
              const value = item.id ?? item.code;
              const checked = selectedItemIds.includes(value);
              return (
                <label
                  key={item.code}
                  className={`service-option-row ${checked ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedItemIds((current) =>
                        current.includes(value)
                          ? current.filter((entry) => entry !== value)
                          : [...current, value],
                      )
                    }
                  />
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.department} ·{" "}
                      {item.modality ?? item.specimenType ?? "General"}
                    </span>
                    <small>{item.code}</small>
                  </div>
                  <div className="service-option-meta">
                    <small>{formatMoney(item.priceCents)}</small>
                    <small>{item.tatMinutes} min TAT</small>
                  </div>
                </label>
              );
            })}
          </div>
          {filteredOrderServices.length === 0 ? (
            <p className="section-note full-width">
              No registered services match that search yet.
            </p>
          ) : null}
          <aside className="summary-panel full-width">
            <div>
              <span>Total cost</span>
              <strong>{formatMoney(totalCents)}</strong>
            </div>
            <button type="submit">Place order</button>
          </aside>
        </form>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Recent requests</h2>
            <p>Trace Code first, with quick visual status tags.</p>
          </div>
        </div>
        <div className="list-stack">
          {orderMatches.map((order) => (
            <div key={order.id} className="list-row">
              <div>
                <strong>{order.patientTraceCode}</strong>
                <span>{order.items.join(", ")}</span>
              </div>
              <small
                className={`status-pill tone-${getOrderTone(order.status)}`}
              >
                {order.status}
              </small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );

  const trackingSection = (
    <section className="content-grid two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Sample tracking</h2>
            <p>Kanban-inspired lane with timing cues.</p>
          </div>
        </div>
        <div className="workflow-board">
          {[
            {
              label: "Collected",
              value: workflow.orders.filter((order) =>
                ["COLLECTED", "REGISTERED"].includes(order.status),
              ),
            },
            {
              label: "In Lab",
              value: workflow.orders.filter(
                (order) => order.status === "IN_PROGRESS",
              ),
            },
            {
              label: "Ready for Review",
              value: workflow.orders.filter(
                (order) => order.status === "READY_FOR_REVIEW",
              ),
            },
          ].map((lane) => (
            <div key={lane.label} className="board-column">
              <h3>{lane.label}</h3>
              {lane.value.map((order) => (
                <div key={order.id} className="board-card">
                  <strong>{order.patientTraceCode}</strong>
                  <span>{order.patientName}</span>
                  <small>{order.items.join(", ")}</small>
                </div>
              ))}
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Collection priorities</h2>
            <p>Fast glance at work that may slip turnaround targets.</p>
          </div>
        </div>
        <div className="list-stack">
          {workflow.orders.slice(0, 6).map((order, index) => (
            <div key={order.id} className="list-row">
              <div>
                <strong>{order.patientTraceCode}</strong>
                <span>{order.patientName}</span>
              </div>
              <small
                className={`tag ${index < 2 ? "tag-critical" : index < 4 ? "tag-warn" : "tag-good"}`}
              >
                {index < 2
                  ? "Overdue"
                  : index < 4
                    ? "Approaching TAT"
                    : "On time"}
              </small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );

  const sonographySection = (
    <section className="content-grid two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Sonography worklist</h2>
            <p>
              Scheduled ultrasound scans with slot time, assigned staff, and immediate scan reporting context.
            </p>
          </div>
        </div>
        <div className="history-summary-grid sonography-summary-grid">
          <div className="summary-panel">
            <span>Scheduled</span>
            <strong>
              {sonographyStudies.filter(
                (study) => study.appointmentStatus === "SCHEDULED",
              ).length}
            </strong>
            <p className="muted-copy">Patients still expected today.</p>
          </div>
          <div className="summary-panel">
            <span>Scanning</span>
            <strong>
              {sonographyStudies.filter(
                (study) => study.appointmentStatus === "SCANNING",
              ).length}
            </strong>
            <p className="muted-copy">Studies currently on the bench.</p>
          </div>
          <div className="summary-panel">
            <span>Ready to report</span>
            <strong>
              {sonographyStudies.filter(
                (study) =>
                  study.appointmentStatus === "REPORTED" ||
                  study.appointmentStatus === "COMPLETED",
              ).length}
            </strong>
            <p className="muted-copy">Scans ready for interpretation.</p>
          </div>
        </div>
        <div className="list-stack">
          {sonographyStudies.map((study) => (
              <button
                key={study.id}
                type="button"
                className={`imaging-row button-row ${
                  selectedImagingStudy?.id === study.id ? "selected-study" : ""
                }`}
                onClick={() => {
                  setSelectedImagingStudyId(study.id);
                  setSelectedPatientId(study.patientId);
                }}
              >
                <div className="thumb-placeholder">IMG</div>
                <div>
                  <strong>{study.patientTraceCode}</strong>
                  <span>{study.patientName}</span>
                  <small>
                    {study.serviceName}
                    {study.scheduledAt
                      ? ` · ${formatDate(study.scheduledAt)}`
                      : " · No slot set"}
                  </small>
                </div>
                <small
                  className={`status-pill tone-${getOrderTone(
                    study.appointmentStatus === "REPORTED" ||
                      study.appointmentStatus === "COMPLETED"
                      ? "READY_FOR_REVIEW"
                      : study.appointmentStatus === "SCANNING"
                        ? "IN_PROGRESS"
                        : "REGISTERED",
                  )}`}
                >
                  {study.appointmentStatus}
                </small>
              </button>
            ))}
        </div>
      </article>

      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Scan desk</h2>
            <p>
              Assign staff, confirm the appointment slot, and hand the study off to scan reports.
            </p>
          </div>
        </div>
        {selectedImagingStudy ? (
          <form className="form-grid" onSubmit={handleSonographyDeskSubmit}>
            <div className="summary-panel full-width">
              <span>Active study</span>
              <strong>
                {selectedImagingStudy.patientTraceCode} · {selectedImagingStudy.serviceName}
              </strong>
              <p className="muted-copy">
                {selectedImagingStudy.patientName}
                {selectedImagingStudy.sonographerName
                  ? ` · ${selectedImagingStudy.sonographerName}`
                  : " · Sonographer not assigned yet"}
              </p>
            </div>
            <label>
              <span>Appointment status</span>
              <select
                value={sonographyDeskForm.appointmentStatus}
                onChange={(event) =>
                  setSonographyDeskForm((current) => ({
                    ...current,
                    appointmentStatus: event.target
                      .value as ImagingStudyUpdateInput["appointmentStatus"],
                  }))
                }
              >
                {appointmentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Scan slot</span>
              <input
                type="datetime-local"
                value={sonographyDeskForm.scheduledAt}
                onChange={(event) =>
                  setSonographyDeskForm((current) => ({
                    ...current,
                    scheduledAt: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Sonographer</span>
              <input
                value={sonographyDeskForm.sonographerName}
                onChange={(event) =>
                  setSonographyDeskForm((current) => ({
                    ...current,
                    sonographerName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Radiologist</span>
              <input
                value={sonographyDeskForm.radiologistName}
                onChange={(event) =>
                  setSonographyDeskForm((current) => ({
                    ...current,
                    radiologistName: event.target.value,
                  }))
                }
              />
            </label>
            <label className="full-width">
              <span>Prior study reference</span>
              <input
                value={sonographyDeskForm.priorStudyReference}
                onChange={(event) =>
                  setSonographyDeskForm((current) => ({
                    ...current,
                    priorStudyReference: event.target.value,
                  }))
                }
                placeholder="Last scan accession, external PACS id, or comparison note"
              />
            </label>
            <label className="full-width inline-toggle">
              <input
                type="checkbox"
                checked={sonographyDeskForm.criticalFlag}
                onChange={(event) =>
                  setSonographyDeskForm((current) => ({
                    ...current,
                    criticalFlag: event.target.checked,
                  }))
                }
              />
              <span>Flag this study for urgent scan report follow-up</span>
            </label>
            <div className="full-width action-row">
              <button type="submit">Save scan desk update</button>
              <button type="button" className="ghost-action" onClick={openUltrasoundReportDraft}>
                Open scan report draft
              </button>
            </div>
          </form>
        ) : (
          <p className="section-note">
            Select an ultrasound study from the worklist to assign staff and slot time.
          </p>
        )}
        <div className="bordered-top">
          <div className="section-head">
            <div>
              <h3>Patient notice</h3>
              <p>Queue WhatsApp, SMS, or email updates straight from the scan desk.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleNotificationSubmit}>
          <label>
            <span>Recipient</span>
            <input
              value={notificationForm.recipient}
              onChange={(event) =>
                setNotificationForm((current) => ({
                  ...current,
                  recipient: event.target.value,
                }))
              }
              disabled={!canQueueNotifications}
            />
          </label>
          <label>
            <span>Channel</span>
            <select
              value={notificationForm.channel}
              onChange={(event) =>
                setNotificationForm((current) => ({
                  ...current,
                  channel: event.target.value as NotificationInput["channel"],
                }))
              }
              disabled={!canQueueNotifications}
            >
              {externalNotificationChannels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Trace Code</span>
            <input
              value={notificationForm.traceCode}
              onChange={(event) =>
                setNotificationForm((current) => ({
                  ...current,
                  traceCode: event.target.value,
                }))
              }
              disabled={!canQueueNotifications}
            />
          </label>
          <label>
            <span>Schedule</span>
            <input
              type="datetime-local"
              value={notificationForm.scheduledFor}
              onChange={(event) =>
                setNotificationForm((current) => ({
                  ...current,
                  scheduledFor: event.target.value,
                }))
              }
              disabled={!canQueueNotifications}
            />
          </label>
          <label className="full-width">
            <span>Message</span>
            <textarea
              rows={4}
              value={notificationForm.message}
              onChange={(event) =>
                setNotificationForm((current) => ({
                  ...current,
                  message: event.target.value,
                }))
              }
              disabled={!canQueueNotifications}
            />
          </label>
          <div className="full-width action-row">
            <button type="submit" disabled={!canQueueNotifications}>
              Queue notification
            </button>
          </div>
          </form>
        </div>
      </article>
    </section>
  );

  const scanReportsSection = (
    <section className="content-grid two-wide">
      {canWriteReports ? (
        <article className="surface-card form-card">
          <div className="section-head">
            <div>
              <h2>Scan Reports</h2>
              <p>
                Structured ultrasound scan reporting with printable output and guided measurement capture.
              </p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleReportSubmit}>
          <label>
            <span>Patient</span>
            <select
              value={reportForm.patientId}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  patientId: event.target.value,
                }))
              }
              disabled={!canWriteReports}
            >
              <option value="">Select patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.traceCode} · {patient.firstName} {patient.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Order</span>
            <select
              value={reportForm.orderId}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  orderId: event.target.value,
                }))
              }
              disabled={!canWriteReports}
            >
              <option value="">Select order</option>
              {reportableOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.patientTraceCode} · {order.accessionNumber} · {order.items.join(", ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Template</span>
            <select
              value={reportForm.templateKind}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  templateKind: event.target.value as ReportInput["templateKind"],
                }))
              }
              disabled={!canWriteReports}
            >
              {reportTemplateKinds.map((templateKind) => (
                <option key={templateKind} value={templateKind}>
                  {reportTemplateLabels[templateKind]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Report title</span>
            <input
              value={reportForm.title}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              disabled={!canWriteReports}
            />
          </label>
          {isUltrasoundTemplate(reportForm.templateKind) &&
          selectedReportImagingStudy ? (
            <div className="summary-panel full-width">
              <span>{reportTemplateLabels[reportForm.templateKind]} study context</span>
              <strong>
                {selectedReportImagingStudy.patientTraceCode} · {selectedReportImagingStudy.serviceName}
              </strong>
              <p className="muted-copy">
                {selectedReportImagingStudy.patientName}
                {selectedReportImagingStudy.sonographerName
                  ? ` · Sonographer ${selectedReportImagingStudy.sonographerName}`
                  : " · Sonographer not captured yet"}
              </p>
            </div>
          ) : null}
          {isUltrasoundTemplate(reportForm.templateKind) ? (
            <>
              <label>
                <span>Sonographer</span>
                <input
                  value={ultrasoundReportAssist.sonographerName}
                  onChange={(event) =>
                    updateUltrasoundAssistField(
                      "sonographerName",
                      event.target.value,
                    )
                  }
                  disabled={!canWriteReports}
                />
              </label>
              <label className="full-width">
                <span>Technique</span>
                <textarea
                  rows={2}
                  value={ultrasoundReportAssist.technique}
                  onChange={(event) =>
                    updateUltrasoundAssistField("technique", event.target.value)
                  }
                  placeholder={
                    selectedUltrasoundTemplatePreset?.techniquePlaceholder
                  }
                  disabled={!canWriteReports}
                />
              </label>
            </>
          ) : null}
          <label className="full-width">
            <span>History</span>
            <textarea
              rows={3}
              value={reportForm.medicalHistory}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  medicalHistory: event.target.value,
                }))
              }
              placeholder="Type the clinical history for this scan report"
              disabled={!canWriteReports}
            />
          </label>
          <label className="full-width">
            <span>Description</span>
            <textarea
              rows={8}
              value={reportForm.findings}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  findings: event.target.value,
                }))
              }
              placeholder="Type or paste the report description here, then edit as needed"
              disabled={!canWriteReports}
            />
          </label>
          {isUltrasoundTemplate(reportForm.templateKind) ? (
            <label className="full-width">
              <span>Measurements</span>
              <textarea
                rows={3}
                value={ultrasoundReportAssist.measurementsText}
                onChange={(event) =>
                  updateUltrasoundAssistField(
                    "measurementsText",
                    event.target.value,
                  )
                }
                placeholder={
                  selectedUltrasoundTemplatePreset?.measurementsPlaceholder
                }
                disabled={!canWriteReports}
              />
            </label>
          ) : null}
          {selectedUltrasoundPresetFields.length > 0 ? (
            <div className="full-width report-assist-grid">
              {selectedUltrasoundPresetFields.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <input
                    value={ultrasoundReportAssist[field.key]}
                    onChange={(event) =>
                      updateUltrasoundAssistField(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                    disabled={!canWriteReports}
                  />
                </label>
              ))}
            </div>
          ) : null}
          <label className="full-width">
            <span>Impression</span>
            <textarea
              rows={3}
              value={reportForm.impression}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  impression: event.target.value,
                }))
              }
              disabled={!canWriteReports}
            />
          </label>
          {isUltrasoundTemplate(reportForm.templateKind) ? (
            <label className="full-width">
              <span>Recommendation</span>
              <textarea
                rows={2}
                value={ultrasoundReportAssist.recommendation}
                onChange={(event) =>
                  updateUltrasoundAssistField(
                    "recommendation",
                    event.target.value,
                  )
                }
                placeholder={
                  selectedUltrasoundTemplatePreset?.recommendationPlaceholder
                }
                disabled={!canWriteReports}
              />
            </label>
          ) : null}
          <label>
            <span>Signed by</span>
            <input
              value={reportForm.signedBy}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  signedBy: event.target.value,
                }))
              }
              disabled={!canWriteReports}
            />
          </label>
          <label>
            <span>Image references</span>
            <input
              value={reportImagePathsText}
              onChange={(event) => setReportImagePathsText(event.target.value)}
              placeholder="abdomen-01.png, scan-02.dcm"
              disabled={!canWriteReports}
            />
          </label>
          <label className="full-width inline-toggle">
            <input
              type="checkbox"
              checked={reportForm.criticalFlag}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  criticalFlag: event.target.checked,
                }))
              }
              disabled={!canWriteReports}
            />
            <span>Highlight critical value and notify clinician</span>
          </label>
          <div className="full-width action-row">
            <button type="submit" disabled={!canWriteReports}>
              Generate report PDF
            </button>
          </div>
          </form>
        </article>
      ) : (
        <article className="surface-card">
          <div className="section-head">
            <div>
              <h2>Scan report pickup</h2>
              <p>
                Completed reports appear here after the doctor or sonographer
                finishes them. Preview the report and print it for the patient.
              </p>
            </div>
          </div>
          <div className="summary-panel full-width">
            <span>Reception access</span>
            <strong>Preview and print only</strong>
            <p className="muted-copy">
              Reception can open finished reports here, but only clinical staff
              can write or approve them.
            </p>
          </div>
        </article>
      )}

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Scan reports</h2>
            <p>Open finished reports and print the PDF when needed.</p>
          </div>
        </div>
        <div className="list-stack">
          {workflow.reports.map((report) => (
            <div key={report.id} className="report-card-row">
              <div>
                <strong>{report.title}</strong>
                <span>{formatDate(report.createdAt)}</span>
              </div>
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost-action small"
                  onClick={() => handlePreviewReport(report.id)}
                >
                  Preview
                </button>
                <button
                  type="button"
                  className="primary-action small"
                  onClick={() => handleDownloadPdf(report.id, report.title)}
                >
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );

  const inventorySection = (
    <section className="content-grid two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Inventory watchlist</h2>
            <p>Low stock, expiry pressure, and reorder guidance in one view.</p>
          </div>
        </div>
        <div className="split-card-grid">
          <div className="mini-panel">
            <h3>Low stock</h3>
            <div className="list-stack tight">
              {adminOverview.inventory.lowStock.map((item) => (
                <div key={item.id} className="list-row">
                  <span>{item.name}</span>
                  <small>
                    {item.quantityOnHand} {item.unit}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <div className="mini-panel">
            <h3>Expiry soon</h3>
            <div className="list-stack tight">
              {adminOverview.inventory.expiringSoon.map((item) => (
                <div key={item.id} className="list-row">
                  <span>{item.name}</span>
                  <small>
                    {new Date(item.expiryDate).toLocaleDateString()}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Stock movement</h2>
            <p>Touch-friendly receipts, issues, returns, and adjustments.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleInventorySubmit}>
          <label>
            <span>Item</span>
            <select
              value={inventoryForm.itemId}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  itemId: event.target.value,
                }))
              }
              disabled={!canManageInventory}
            >
              <option value="">Select item</option>
              {adminOverview.inventory.lowStock.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Movement</span>
            <select
              value={inventoryForm.type}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
              disabled={!canManageInventory}
            >
              <option value="RECEIPT">Receipt</option>
              <option value="ISSUE">Issue</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="EXPIRY">Expiry</option>
              <option value="RETURN">Return</option>
            </select>
          </label>
          <label>
            <span>Quantity</span>
            <input
              value={inventoryForm.quantity}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
              disabled={!canManageInventory}
            />
          </label>
          <label className="full-width">
            <span>Reason</span>
            <input
              value={inventoryForm.reason}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              disabled={!canManageInventory}
            />
          </label>
          <div className="full-width action-row">
            <button type="submit" disabled={!canManageInventory}>
              Record movement
            </button>
          </div>
        </form>
      </article>
    </section>
  );

  const billingSection = (
    <section className="content-grid two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Finance overview</h2>
            <p>Payments, outstanding balances, and payer mix.</p>
          </div>
        </div>
        <div className="metric-cluster">
          <div className="metric-mini">
            <span>Revenue today</span>
            <strong>
              {formatMoney(adminOverview.finance.revenueTodayCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Outstanding</span>
            <strong>
              {formatMoney(adminOverview.finance.outstandingCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Invoices open</span>
            <strong>{adminOverview.finance.invoicesOpen}</strong>
          </div>
          <div className="metric-mini">
            <span>Referral earned</span>
            <strong>
              {formatMoney(adminOverview.finance.referralCommissionEarnedCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Referral outstanding</span>
            <strong>
              {formatMoney(
                adminOverview.finance.referralCommissionOutstandingCents,
              )}
            </strong>
          </div>
        </div>
        <div className="list-stack">
          {adminOverview.finance.paymentMix.map((item) => (
            <div key={item.method} className="list-row">
              <div>
                <strong>{item.method}</strong>
                <span>{item.count} payment(s)</span>
              </div>
              <small>{formatMoney(item.totalCents)}</small>
            </div>
          ))}
        </div>
        <div className="bordered-top">
          <div className="section-head">
            <div>
              <h3>Top referrers</h3>
              <p>Commission exposure by referring doctor.</p>
            </div>
          </div>
          <div className="list-stack compact-scroll">
            {adminOverview.finance.referralLeaders.length === 0 ? (
              <div className="list-row">
                <span>No referral commission data yet.</span>
                <small>Awaiting linked invoices</small>
              </div>
            ) : null}
            {adminOverview.finance.referralLeaders.map((leader) => (
              <div key={leader.doctorName} className="list-row">
                <div>
                  <strong>{leader.doctorName}</strong>
                  <span>
                    {leader.commissionPercent}% commission ·{" "}
                    {leader.invoicesCount} invoice(s)
                  </span>
                  <small>
                    Paid base {formatMoney(leader.revenueCents)} · Outstanding
                    commission {formatMoney(leader.commissionOutstandingCents)}
                  </small>
                </div>
                <small>{formatMoney(leader.commissionDueCents)}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="bordered-top">
          <div className="section-head">
            <div>
              <h3>Recent invoices</h3>
              <p>Open branded invoice statements before or after payment.</p>
            </div>
          </div>
          <div className="list-stack compact-scroll">
            {workflow.invoices.map((invoice) => {
              const balanceTone =
                invoice.balanceCents > 0 ? "tag-warn" : "tag-good";
              return (
                <div key={invoice.id} className="list-row user-admin-row">
                  <div>
                    <strong>{invoice.traceCode}</strong>
                    <span>
                      {invoice.accessionNumber} · {invoice.status}
                    </span>
                    {invoice.referralDoctorName ? (
                      <small>
                        {invoice.referralDoctorName} ·{" "}
                        {invoice.referralDoctorCommissionPercent}% commission ·
                        Due {formatMoney(invoice.referralCommissionDueCents)}
                      </small>
                    ) : null}
                    <small>
                      Due {formatMoney(invoice.amountDueCents)} · Paid{" "}
                      {formatMoney(invoice.amountPaidCents)}
                    </small>
                  </div>
                  <div className="inline-actions">
                    <span className={`tag ${balanceTone}`}>
                      {formatMoney(invoice.balanceCents)}
                    </span>
                    <button
                      type="button"
                      className="ghost-action small"
                      onClick={() => handlePreviewInvoice(invoice.id)}
                      disabled={!canManageFinance}
                    >
                      Print invoice
                    </button>
                    {invoice.balanceCents > 0 ? (
                      <button
                        type="button"
                        className="primary-action small"
                        onClick={() => handlePrepareInvoiceCollection(invoice)}
                        disabled={!canManageFinance}
                      >
                        Collect balance
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bordered-top">
          <div className="section-head">
            <div>
              <h3>Collections worklist</h3>
              <p>
                Prepare follow-up and balance settlement from open invoices.
              </p>
            </div>
          </div>
          <div className="list-stack compact-scroll">
            {outstandingInvoices.length === 0 ? (
              <div className="list-row">
                <span>All invoice balances are cleared.</span>
                <small>Up to date</small>
              </div>
            ) : null}
            {outstandingInvoices.slice(0, 8).map((invoice) => {
              const ageDays = Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(invoice.createdAt).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              );

              return (
                <div
                  key={`collection-${invoice.id}`}
                  className="list-row user-admin-row"
                >
                  <div>
                    <strong>{invoice.traceCode}</strong>
                    <span>
                      {invoice.accessionNumber} · {invoice.status} · {ageDays}{" "}
                      day(s)
                    </span>
                    {invoice.referralDoctorName ? (
                      <small>
                        {invoice.referralDoctorName} · Referral outstanding{" "}
                        {formatMoney(
                          invoice.referralCommissionOutstandingCents,
                        )}
                      </small>
                    ) : null}
                    <small>
                      Outstanding {formatMoney(invoice.balanceCents)} of{" "}
                      {formatMoney(invoice.amountDueCents)}
                    </small>
                  </div>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="ghost-action small"
                      onClick={() =>
                        handlePrepareInvoiceCollection(
                          invoice,
                          invoice.amountDueCents,
                        )
                      }
                      disabled={!canManageFinance}
                    >
                      Full due
                    </button>
                    <button
                      type="button"
                      className="primary-action small"
                      onClick={() => handlePrepareInvoiceCollection(invoice)}
                      disabled={!canManageFinance}
                    >
                      Settle now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </article>

      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Record payment</h2>
            <p>
              Cash, mobile money, card, and NHIS capture with instant receipt
              preview.
            </p>
          </div>
          {latestReceipt ? (
            <button
              type="button"
              className="ghost-action small"
              onClick={() => handlePreviewReceipt(latestReceipt.paymentId)}
              disabled={!canManageFinance}
            >
              Preview last receipt
            </button>
          ) : null}
        </div>
        <form className="form-grid" onSubmit={handlePaymentSubmit}>
          <label>
            <span>Invoice ID</span>
            <input
              value={paymentForm.invoiceId}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  invoiceId: event.target.value,
                }))
              }
              disabled={!canManageFinance}
            />
          </label>
          <label>
            <span>Amount (pesewas)</span>
            <input
              type="number"
              value={paymentForm.amountCents}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  amountCents: Number(event.target.value),
                }))
              }
              disabled={!canManageFinance}
            />
          </label>
          <label>
            <span>Method</span>
            <select
              value={paymentForm.method}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  method: event.target.value as PaymentInput["method"],
                }))
              }
              disabled={!canManageFinance}
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Reference</span>
            <input
              value={paymentForm.reference}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  reference: event.target.value,
                }))
              }
              disabled={!canManageFinance}
            />
          </label>
          <label>
            <span>Trace Code</span>
            <input
              value={paymentForm.traceCode}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  traceCode: event.target.value,
                }))
              }
              disabled={!canManageFinance}
            />
          </label>
          <div className="full-width action-row">
            <button type="submit" disabled={!canManageFinance}>
              Record payment
            </button>
          </div>
        </form>
        {latestReceipt ? (
          <p className="section-note">
            Last receipt ready for{" "}
            {latestReceipt.traceCode || "the recent payment"}.
          </p>
        ) : null}
        {latestInvoiceId ? (
          <p className="section-note">
            Invoice preview is ready for reuse from the recent invoice list.
          </p>
        ) : null}
      </article>
    </section>
  );

  const analyticsSection = (
    <section className="content-grid two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Operations report</h2>
            <p>
              One management report for collections, expenses, inventory
              activity, and staff performance across the day-to-day operation.
            </p>
            <div className="inline-actions">
              {analyticsRangeKeys.map((rangeKey) => (
                <button
                  key={rangeKey}
                  type="button"
                  onClick={() => setAnalyticsRange(rangeKey)}
                  disabled={analyticsRange === rangeKey}
                >
                  {analyticsRangeLabels[rangeKey]}
                </button>
              ))}
            </div>
          </div>
          <div className="inline-actions">
            <button type="button" onClick={handleDownloadAnalyticsCsv}>
              Export CSV
            </button>
            <button type="button" onClick={handlePreviewAnalytics}>
              Printable view
            </button>
          </div>
        </div>
        <p className="section-note">
          Range: {analyticsRangeLabels[financeAnalytics.range]} · Generated{" "}
          {new Date(financeAnalytics.generatedAt).toLocaleString()}
        </p>
        <div className="metric-cluster">
          <div className="metric-mini">
            <span>Gross billed</span>
            <strong>
              {formatMoney(financeAnalytics.summary.grossBilledCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Net due</span>
            <strong>{formatMoney(financeAnalytics.summary.netDueCents)}</strong>
          </div>
          <div className="metric-mini">
            <span>Collected</span>
            <strong>
              {formatMoney(financeAnalytics.summary.collectedCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Outstanding</span>
            <strong>
              {formatMoney(financeAnalytics.summary.outstandingCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Collection rate</span>
            <strong>
              {formatPercent(financeAnalytics.summary.collectionRatePercent)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Avg invoice</span>
            <strong>
              {formatMoney(financeAnalytics.summary.averageInvoiceCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Discounts</span>
            <strong>
              {formatMoney(financeAnalytics.summary.discountCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Insurance cover</span>
            <strong>
              {formatMoney(financeAnalytics.summary.insuranceCoveredCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Expenses</span>
            <strong>
              {formatMoney(financeAnalytics.summary.expenseCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Net profit</span>
            <strong>
              {formatMoney(financeAnalytics.summary.netProfitCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Referral due</span>
            <strong>
              {formatMoney(financeAnalytics.summary.referralCommissionDueCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Referral outstanding</span>
            <strong>
              {formatMoney(
                financeAnalytics.summary.referralCommissionOutstandingCents,
              )}
            </strong>
          </div>
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Study performance</h2>
            <p>
              Pull each study from billed services and compare how that test or
              scan performs over time.
            </p>
          </div>
        </div>
        {financeAnalytics.studyPerformance.length > 0 ? (
          <div className="study-filter-row">
            <div
              className="pill-filter-group"
              role="group"
              aria-label="Study department filter"
            >
              {analyticsStudyDepartments.map((department) => (
                <button
                  key={department}
                  type="button"
                  className={`pill-filter ${
                    analyticsStudyDepartmentFilter === department ? "active" : ""
                  }`}
                  onClick={() => setAnalyticsStudyDepartmentFilter(department)}
                >
                  {department === "ALL"
                    ? "All studies"
                    : department === "LAB"
                      ? "Lab studies"
                      : "Imaging studies"}
                </button>
              ))}
            </div>
            <label>
              Study
              <select
                value={selectedAnalyticsStudy}
                onChange={(event) => setSelectedAnalyticsStudy(event.target.value)}
              >
                {filteredStudyPerformance.map((study) => (
                  <option key={study.description} value={study.description}>
                    {study.description}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div className="list-stack">
          {filteredStudyPerformance.length === 0 ? (
            <div className="list-row user-admin-row">
              <div>
                <strong>No study activity in range</strong>
                <span>No billed tests or scans match the selected department.</span>
              </div>
            </div>
          ) : null}
          {selectedAnalyticsStudyEntry ? (
              <div key={selectedAnalyticsStudyEntry.description} className="stack-gap-md">
                <div className="study-chip-row">
                  <span className="study-chip">
                    {formatStudyDepartmentLabel(selectedAnalyticsStudyEntry.department)}
                  </span>
                  <span className="study-chip">
                    {formatStudyKindLabel(selectedAnalyticsStudyEntry.kind)}
                  </span>
                  <span
                    className={`trend-pill ${
                      selectedAnalyticsStudyEntry.growthRatePercent > 0
                        ? "trend-up"
                        : selectedAnalyticsStudyEntry.growthRatePercent < 0
                          ? "trend-down"
                          : "trend-flat"
                    }`}
                  >
                    Growth {formatPercent(selectedAnalyticsStudyEntry.growthRatePercent)}
                  </span>
                </div>
                <div className="metric-cluster">
                  <div className="metric-mini">
                    <span>Study billed</span>
                    <strong>{formatMoney(selectedAnalyticsStudyEntry.billedCents)}</strong>
                  </div>
                  <div className="metric-mini">
                    <span>Collected</span>
                    <strong>{formatMoney(selectedAnalyticsStudyEntry.collectedCents)}</strong>
                  </div>
                  <div className="metric-mini">
                    <span>Outstanding</span>
                    <strong>{formatMoney(selectedAnalyticsStudyEntry.outstandingCents)}</strong>
                  </div>
                  <div className="metric-mini">
                    <span>Study count</span>
                    <strong>{selectedAnalyticsStudyEntry.quantity}</strong>
                  </div>
                  <div className="metric-mini">
                    <span>Invoices</span>
                    <strong>{selectedAnalyticsStudyEntry.invoicesCount}</strong>
                  </div>
                  <div className="metric-mini">
                    <span>Avg billed</span>
                    <strong>{formatMoney(selectedAnalyticsStudyEntry.averageBilledCents)}</strong>
                  </div>
                </div>
                <StudyPerformanceChart points={selectedAnalyticsStudyEntry.trend} />
                <div className="list-stack compact-scroll">
                {selectedAnalyticsStudyEntry.trend.map((month) => (
                  <div key={`${selectedAnalyticsStudyEntry.description}-${month.label}`} className="list-row user-admin-row">
                    <div>
                      <strong>{month.label}</strong>
                      <span>
                        Billed {formatMoney(month.billedCents)} · Collected {formatMoney(month.collectedCents)} · Outstanding {formatMoney(month.outstandingCents)}
                      </span>
                      <small>
                        {month.quantity} study item(s) · {month.invoicesCount} invoice(s)
                      </small>
                    </div>
                    <small>
                      {month.billedCents > 0
                        ? formatPercent(
                            (month.collectedCents / month.billedCents) * 100,
                          )
                        : "0.0%"}
                    </small>
                  </div>
                ))}
                </div>
                <p className="section-note">
                  Growth compares the latest half of the selected range against the earliest half for this study.
                </p>
              </div>
          ) : null}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Study momentum</h2>
            <p>
              Rank studies by growth or decline percentage across the selected
              reporting window.
            </p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {rankedStudyPerformance.length === 0 ? (
            <div className="list-row user-admin-row">
              <div>
                <strong>No ranked studies yet</strong>
                <span>
                  Study momentum will appear after billing activity lands in the
                  selected department.
                </span>
              </div>
            </div>
          ) : null}
          {rankedStudyPerformance.map((study, index) => (
            <div key={`${study.description}-momentum`} className="list-row user-admin-row">
              <div>
                <strong>
                  {index + 1}. {study.description}
                </strong>
                <span>
                  {formatStudyDepartmentLabel(study.department)} · {formatStudyKindLabel(study.kind)} · Billed {formatMoney(study.billedCents)}
                </span>
                <small>
                  {study.quantity} study item(s) · {study.invoicesCount} invoice(s)
                </small>
              </div>
              <small
                className={`trend-pill ${
                  study.growthRatePercent > 0
                    ? "trend-up"
                    : study.growthRatePercent < 0
                      ? "trend-down"
                      : "trend-flat"
                }`}
              >
                {formatPercent(study.growthRatePercent)}
              </small>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Staff performance</h2>
            <p>
              Compare collections handled, expenses recorded, and inventory
              activity by staff member in one place.
            </p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {financeAnalytics.userPerformance.length === 0 ? (
            <div className="list-row user-admin-row">
              <div>
                <strong>No user activity in range</strong>
                <span>Awaiting payments, expenses, or inventory movement.</span>
              </div>
            </div>
          ) : null}
          {financeAnalytics.userPerformance.map((entry) => (
            <div key={entry.actorName} className="list-row user-admin-row">
              <div>
                <strong>{entry.actorName}</strong>
                <span>
                  Collections {formatMoney(entry.generatedCents)} · Expenses {formatMoney(entry.lossCents)} · Net {formatMoney(entry.netCents)}
                </span>
                <small>
                  {entry.paymentsCount} payment(s) · {entry.expensesCount} expense entry(ies) · {entry.inventoryActions} inventory action(s) · Received {entry.stockReceivedQuantity.toFixed(1)} · Issued {entry.stockIssuedQuantity.toFixed(1)} · Expired {entry.stockExpiredQuantity.toFixed(1)}
                </small>
              </div>
              <small>{formatMoney(entry.netCents)}</small>
            </div>
          ))}
        </div>
        <p className="section-note">
          Inventory movement comes from audit activity counts because stock items do not currently store unit cost in the database.
        </p>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Monthly billed vs collected</h2>
            <p>Six-month trend of expected revenue against cash received.</p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {financeAnalytics.monthlyCollections.map((month) => (
            <div key={month.label} className="list-row user-admin-row">
              <div>
                <strong>{month.label}</strong>
                <span>
                  Billed {formatMoney(month.billedCents)} · Collected{" "}
                  {formatMoney(month.collectedCents)}
                </span>
              </div>
              <small>
                {month.billedCents > 0
                  ? formatPercent(
                      (month.collectedCents / month.billedCents) * 100,
                    )
                  : "0.0%"}
              </small>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Receivables aging</h2>
            <p>Outstanding balances bucketed by invoice age.</p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {financeAnalytics.agingBuckets.map((bucket) => (
            <div key={bucket.label} className="list-row">
              <div>
                <strong>{bucket.label}</strong>
                <span>{bucket.invoiceCount} invoice(s)</span>
              </div>
              <small>{formatMoney(bucket.balanceCents)}</small>
            </div>
          ))}
        </div>
        <div className="bordered-top">
          <div className="section-head">
            <div>
              <h3>Invoice status mix</h3>
              <p>Status distribution by due value and unresolved balance.</p>
            </div>
          </div>
          <div className="list-stack compact-scroll">
            {financeAnalytics.invoiceStatus.map((status) => (
              <div key={status.status} className="list-row user-admin-row">
                <div>
                  <strong>{status.status}</strong>
                  <span>{status.count} invoice(s)</span>
                  <small>
                    Due {formatMoney(status.totalDueCents)} · Outstanding{" "}
                    {formatMoney(status.outstandingCents)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Payment method mix</h2>
            <p>Collections split by method across the lab.</p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {financeAnalytics.paymentMix.map((item) => (
            <div key={item.method} className="list-row">
              <div>
                <strong>{item.method}</strong>
                <span>{item.count} payment(s)</span>
              </div>
              <small>{formatMoney(item.totalCents)}</small>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Top studies by revenue</h2>
            <p>Most valuable billed tests and scans based on invoice lines.</p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {topStudiesByRevenue.map((service) => (
            <div key={service.description} className="list-row user-admin-row">
              <div>
                <strong>{service.description}</strong>
                <span>
                  {formatStudyDepartmentLabel(service.department)} · {service.quantity} unit(s) · {service.invoicesCount} invoice(s)
                </span>
                <small>Growth {formatPercent(service.growthRatePercent)}</small>
              </div>
              <small>{formatMoney(service.billedCents)}</small>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Top referrers</h2>
            <p>Revenue and commission obligations by referral doctor.</p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {financeAnalytics.topReferrers.length === 0 ? (
            <div className="list-row">
              <span>No referrer-linked invoices yet.</span>
              <small>Awaiting referral activity</small>
            </div>
          ) : null}
          {financeAnalytics.topReferrers.map((referrer) => (
            <div key={referrer.doctorName} className="list-row user-admin-row">
              <div>
                <strong>{referrer.doctorName}</strong>
                <span>
                  {referrer.commissionPercent}% commission ·{" "}
                  {referrer.invoicesCount} invoice(s)
                </span>
                <small>
                  Billed {formatMoney(referrer.billedCents)} · Collected{" "}
                  {formatMoney(referrer.collectedCents)} · Outstanding{" "}
                  {formatMoney(referrer.outstandingCents)}
                </small>
              </div>
              <small>{formatMoney(referrer.commissionDueCents)}</small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );

  const expensesSection = (
    <section className="content-grid two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Operating expenses</h2>
            <p>
              Record day-to-day expenses like utilities, transport,
              consumables, or maintenance from one front-desk page.
            </p>
            <div className="inline-actions">
              {analyticsRangeKeys.map((rangeKey) => (
                <button
                  key={`expenses-range-${rangeKey}`}
                  type="button"
                  onClick={() => setAnalyticsRange(rangeKey)}
                  disabled={analyticsRange === rangeKey}
                >
                  {analyticsRangeLabels[rangeKey]}
                </button>
              ))}
            </div>
          </div>
          <div className="inline-actions">
            <button type="button" onClick={() => setActiveNav("analytics")}>
              Open operations report
            </button>
          </div>
        </div>
        <div className="metric-cluster">
          <div className="metric-mini">
            <span>Total expenses</span>
            <strong>{formatMoney(financeAnalytics.summary.expenseCents)}</strong>
          </div>
          <div className="metric-mini">
            <span>Net profit</span>
            <strong>{formatMoney(financeAnalytics.summary.netProfitCents)}</strong>
          </div>
          <div className="metric-mini">
            <span>Range</span>
            <strong>{analyticsRangeLabels[expenseWorkspace.range]}</strong>
          </div>
          <div className="metric-mini">
            <span>Visible entries</span>
            <strong>{expenseWorkspace.summary.entryCount}</strong>
          </div>
          <div className="metric-mini">
            <span>Visible spend</span>
            <strong>{formatMoney(expenseWorkspace.summary.totalCents)}</strong>
          </div>
        </div>
        <p className="section-note">
          Generated {new Date(expenseWorkspace.generatedAt).toLocaleString()}
        </p>
      </article>

      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Filter expenses</h2>
            <p>
              Narrow the expense list by category and date before reviewing the
              entries below.
            </p>
          </div>
        </div>
        <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Category</span>
            <select
              value={expenseFilters.category}
              onChange={(event) =>
                setExpenseFilters((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            >
              {expenseFilterCategories.map((category) => (
                <option key={`expense-filter-${category}`} value={category}>
                  {category === "ALL" ? "All categories" : category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Start date</span>
            <input
              type="date"
              value={expenseFilters.startDate}
              onChange={(event) =>
                setExpenseFilters((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>End date</span>
            <input
              type="date"
              value={expenseFilters.endDate}
              onChange={(event) =>
                setExpenseFilters((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </label>
          <div className="inline-actions">
            <button
              type="button"
              onClick={() =>
                setExpenseFilters({
                  category: "ALL",
                  startDate: "",
                  endDate: "",
                })
              }
            >
              Clear filters
            </button>
          </div>
        </form>
        <p className="section-note">
          The filters update the full expense list for the selected date range.
        </p>
      </article>

      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Record operating expense</h2>
            <p>
              Enter the expense details here so they appear in the operations
              report automatically.
            </p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleExpenseSubmit}>
          <label>
            <span>Category</span>
            <input
              value={expenseForm.category}
              onChange={(event) =>
                setExpenseForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              placeholder="Utilities"
              required
            />
          </label>
          <label>
            <span>Description</span>
            <input
              value={expenseForm.description}
              onChange={(event) =>
                setExpenseForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Generator fuel top-up"
              required
            />
          </label>
          <label>
            <span>Amount (GHc)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={expenseForm.amount}
              onChange={(event) =>
                setExpenseForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Incurred on</span>
            <input
              type="date"
              value={expenseForm.incurredAt}
              onChange={(event) =>
                setExpenseForm((current) => ({
                  ...current,
                  incurredAt: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Recorded by</span>
            <input
              value={expenseForm.recordedBy}
              onChange={(event) =>
                setExpenseForm((current) => ({
                  ...current,
                  recordedBy: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Notes</span>
            <input
              value={expenseForm.notes}
              onChange={(event) =>
                setExpenseForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional reference or scan note"
            />
          </label>
          <div className="inline-actions">
            <button type="submit">Record expense</button>
          </div>
        </form>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Expense categories</h2>
            <p>Category totals for the expenses currently on screen.</p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {expenseWorkspace.categories.length === 0 ? (
            <div className="list-row">
              <span>No expense categories match these filters.</span>
              <small>Clear filters or record a matching expense</small>
            </div>
          ) : null}
          {expenseWorkspace.categories.map((item) => (
            <div key={item.category} className="list-row user-admin-row">
              <div>
                <strong>{item.category}</strong>
                <span>{item.count} expense item(s)</span>
              </div>
              <small>{formatMoney(item.totalCents)}</small>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Recent expenses</h2>
            <p>
              The latest expense entries that match the current filters.
            </p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {expenseWorkspace.expenses.length === 0 ? (
            <div className="list-row">
              <span>No expense entries match the current filters.</span>
              <small>Clear filters or record a matching expense</small>
            </div>
          ) : null}
          {expenseWorkspace.expenses.map((expense) => (
            <div key={expense.id} className="list-row user-admin-row">
              <div>
                <strong>{expense.description}</strong>
                <span>
                  {expense.category} · {formatDate(expense.incurredAt)}
                </span>
                <small>
                  Recorded by {expense.recordedBy}
                  {expense.notes ? ` · ${expense.notes}` : ""}
                </small>
              </div>
              <small>{formatMoney(expense.amountCents)}</small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );

  const servicesSection = (
    <section className="content-grid two-wide">
      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Service catalog</h2>
            <p>
              Check available services, prices, and turnaround times here.
            </p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleServiceSubmit}>
          <label>
            <span>Service code</span>
            <input
              value={serviceForm.code}
              onChange={(event) =>
                setServiceForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              disabled={!canManageServices}
              required
            />
          </label>
          <label>
            <span>Service name</span>
            <input
              value={serviceForm.name}
              onChange={(event) =>
                setServiceForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              disabled={!canManageServices}
              required
            />
          </label>
          <label>
            <span>Type</span>
            <select
              value={serviceForm.kind}
              onChange={(event) =>
                setServiceForm((current) => ({
                  ...current,
                  kind: event.target.value as ServiceInput["kind"],
                }))
              }
              disabled={!canManageServices}
            >
              <option value="TEST">Lab test</option>
              <option value="IMAGING">Sonograph / imaging</option>
            </select>
          </label>
          <label>
            <span>
              {serviceForm.kind === "IMAGING" ? "Modality" : "Specimen type"}
            </span>
            <input
              value={
                serviceForm.kind === "IMAGING"
                  ? serviceForm.modality
                  : serviceForm.specimenType
              }
              onChange={(event) =>
                setServiceForm((current) =>
                  current.kind === "IMAGING"
                    ? { ...current, modality: event.target.value }
                    : { ...current, specimenType: event.target.value },
                )
              }
              disabled={!canManageServices}
            />
          </label>
          <label>
            <span>Price (pesewas)</span>
            <input
              type="number"
              value={serviceForm.priceCents}
              onChange={(event) =>
                setServiceForm((current) => ({
                  ...current,
                  priceCents: event.target.value,
                }))
              }
              disabled={!canManageServices}
              required
            />
          </label>
          <label>
            <span>Turnaround time (minutes)</span>
            <input
              type="number"
              value={serviceForm.tatMinutes}
              onChange={(event) =>
                setServiceForm((current) => ({
                  ...current,
                  tatMinutes: event.target.value,
                }))
              }
              disabled={!canManageServices}
              required
            />
          </label>
          <label className="full-width inline-toggle">
            <input
              type="checkbox"
              checked={serviceForm.isActive}
              onChange={(event) =>
                setServiceForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              disabled={!canManageServices}
            />
            <span>Active and available for ordering</span>
          </label>
          <div className="full-width action-row">
            <button type="submit" disabled={!canManageServices}>
              {selectedServiceId ? "Update service price" : "Add service"}
            </button>
            {selectedServiceId ? (
              <button
                type="button"
                className="ghost-action"
                onClick={resetServiceEditor}
                disabled={!canManageServices}
              >
                New service
              </button>
            ) : null}
          </div>
        </form>
        <div className="form-divider" />
        <form className="form-grid" onSubmit={handleBulkServiceSubmit}>
          <div className="section-head stacked-head full-width">
            <div>
              <h3>Bulk add services</h3>
              <p>
                Upload a CSV or paste one service per line using pipe, comma, or
                tab columns: code, name, kind, specimen or modality, price in
                pesewas, TAT minutes, and optional active flag.
              </p>
            </div>
            <button
              type="button"
              className="ghost-action small"
              onClick={handleBulkTemplateDownload}
              disabled={!canManageServices}
            >
              Download CSV template
            </button>
          </div>
          <label className="full-width">
            <span>Import CSV or text file</span>
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={handleBulkServiceFileChange}
              disabled={!canManageServices}
            />
          </label>
          <label>
            <span>Import mode</span>
            <select
              value={bulkImportMode}
              onChange={(event) =>
                setBulkImportMode(event.target.value as BulkServiceImportMode)
              }
              disabled={!canManageServices}
            >
              <option value="SKIP_EXISTING">Skip existing service codes</option>
              <option value="OVERWRITE_EXISTING">
                Overwrite existing service codes
              </option>
            </select>
          </label>
          {bulkImportFileName ? (
            <p className="section-note full-width">
              Loaded file: {bulkImportFileName}
            </p>
          ) : null}
          <label className="full-width">
            <span>Bulk rows</span>
            <textarea
              rows={8}
              value={bulkServiceText}
              onChange={(event) => setBulkServiceText(event.target.value)}
              placeholder={[
                "LAB-CRP | C-Reactive Protein | TEST | Serum | 8500 | 120",
                "IMG-PELVIC | Pelvic Ultrasound | IMAGING | Ultrasound | 35000 | 45",
              ].join("\n")}
              disabled={!canManageServices}
            />
          </label>
          <aside className="summary-panel full-width bulk-import-summary">
            <div>
              <span>Bulk import readiness</span>
              <strong>{bulkServicePreview.services.length} valid row(s)</strong>
              <p className="muted-copy">
                {bulkServicePreview.errors.length > 0
                  ? `${bulkServicePreview.errors.length} row issue(s) must be fixed before import.`
                  : bulkImportMode === "OVERWRITE_EXISTING"
                    ? "Matching service codes will be updated in place with the imported prices and TAT values."
                    : "Existing codes will be skipped instead of overwriting current prices."}
              </p>
            </div>
            <button
              type="submit"
              disabled={
                !canManageServices || !bulkServicePreview.services.length
              }
            >
              Bulk add services
            </button>
          </aside>
          {bulkPreviewEntries.length > 0 ? (
            <div className="full-width list-stack tight bulk-feedback-list">
              {bulkPreviewEntries.slice(0, 6).map((entry) => (
                <div
                  key={`${entry.lineNumber}-${entry.service.code}`}
                  className="list-row bulk-feedback-row"
                >
                  <div className="bulk-feedback-main">
                    <div className="bulk-feedback-head">
                      <strong>{entry.service.name}</strong>
                      <span className={`tag ${entry.statusTone}`}>
                        {entry.statusLabel}
                      </span>
                    </div>
                    <span>
                      {entry.service.code} ·{" "}
                      {entry.service.kind === "IMAGING"
                        ? entry.service.modality || "Imaging"
                        : entry.service.specimenType || "General"}
                    </span>
                    <small>{entry.note}</small>
                  </div>
                  <small>
                    {formatMoney(entry.service.priceCents)} ·{" "}
                    {entry.service.tatMinutes} min
                  </small>
                </div>
              ))}
              {bulkPreviewEntries.length > 6 ? (
                <p className="section-note">
                  {bulkPreviewEntries.length - 6} more row(s) ready to review.
                </p>
              ) : null}
            </div>
          ) : null}
          {bulkServicePreview.errors.length > 0 ? (
            <div className="full-width list-stack tight bulk-feedback-list">
              {bulkServicePreview.errors.slice(0, 6).map((error) => (
                <div
                  key={error}
                  className="list-row bulk-feedback-row bulk-feedback-error"
                >
                  <strong>Check row</strong>
                  <span>{error}</span>
                </div>
              ))}
            </div>
          ) : null}
          {bulkImportHistory.length > 0 ? (
            <div className="full-width bordered-top">
              <div className="section-head stacked-head">
                <div>
                  <h3>Recent imports</h3>
                  <p>Latest bulk import results from this session.</p>
                </div>
              </div>
              <div className="list-stack tight bulk-history-list">
                {bulkImportHistory.map((entry) => (
                  <div
                    key={`${entry.importedAt}-${entry.sourceLabel}`}
                    className="list-row bulk-feedback-row"
                  >
                    <div className="bulk-feedback-main">
                      <div className="bulk-feedback-head">
                        <strong>{entry.sourceLabel}</strong>
                        <span
                          className={`tag ${entry.mode === "OVERWRITE_EXISTING" ? "tag-warn" : "tag-good"}`}
                        >
                          {entry.mode === "OVERWRITE_EXISTING"
                            ? "Overwrite mode"
                            : "Skip mode"}
                        </span>
                      </div>
                      <span>{new Date(entry.importedAt).toLocaleString()}</span>
                      <small>
                        {entry.createdCount} created · {entry.updatedCount}{" "}
                        updated · {entry.skippedCount} skipped
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </form>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Available services</h2>
            <p>
              Services are grouped for quick lookup. Archived services stay out
              of intake and ordering.
            </p>
          </div>
        </div>
        <div className="service-groups compact-scroll">
          {[
            { title: "Lab tests", items: labServices },
            { title: "Sonography and imaging", items: imagingServices },
          ].map((group) => (
            <section key={group.title} className="service-group">
              <div className="section-head stacked-head">
                <div>
                  <h3>{group.title}</h3>
                  <p>
                    {
                      group.items.filter(
                        (service) => service.isActive !== false,
                      ).length
                    }{" "}
                    active service(s)
                  </p>
                </div>
              </div>
              <div className="list-stack tight">
                {group.items.map((service) => (
                  <div
                    key={service.id ?? service.code}
                    className="list-row service-row"
                  >
                    <button
                      type="button"
                      className="button-row service-row-main"
                      onClick={() => setSelectedServiceId(service.id ?? "")}
                    >
                      <div>
                        <strong>{service.name}</strong>
                        <span>
                          {service.code} ·{" "}
                          {service.kind === "IMAGING"
                            ? (service.modality ?? "Imaging")
                            : (service.specimenType ?? "Lab test")}
                        </span>
                        <small>
                          {service.isActive === false
                            ? "Archived from ordering"
                            : "Active in Reception Intake and Orders & Requests"}
                        </small>
                      </div>
                      <small>{formatMoney(service.priceCents)}</small>
                    </button>
                    <div className="inline-actions">
                      <span
                        className={`tag ${service.isActive === false ? "tag-critical" : "tag-good"}`}
                      >
                        {service.isActive === false ? "Archived" : "Active"}
                      </span>
                      <button
                        type="button"
                        className="ghost-action small"
                        onClick={() => handleToggleServiceActive(service)}
                        disabled={!canManageServices}
                      >
                        {service.isActive === false ? "Reactivate" : "Archive"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </section>
  );

  const referralDoctorsSection = (
    <section className="content-grid two-wide">
      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Referral doctors</h2>
            <p>
              Keep referring doctors and their commission percentages visible
              for patient registration and downstream finance review.
            </p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleReferralDoctorSubmit}>
          <label>
            <span>Doctor name</span>
            <input
              value={referralDoctorForm.fullName}
              onChange={(event) =>
                setReferralDoctorForm((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
              disabled={!canManageServices}
              required
            />
          </label>
          <label>
            <span>Phone</span>
            <input
              value={referralDoctorForm.phone}
              onChange={(event) =>
                setReferralDoctorForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              disabled={!canManageServices}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={referralDoctorForm.email}
              onChange={(event) =>
                setReferralDoctorForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              disabled={!canManageServices}
            />
          </label>
          <label>
            <span>Commission percentage</span>
            <input
              type="number"
              min="0"
              max="100"
              value={referralDoctorForm.commissionPercent}
              onChange={(event) =>
                setReferralDoctorForm((current) => ({
                  ...current,
                  commissionPercent: event.target.value,
                }))
              }
              disabled={!canManageServices}
              required
            />
          </label>
          <label className="full-width inline-toggle">
            <input
              type="checkbox"
              checked={referralDoctorForm.isActive}
              onChange={(event) =>
                setReferralDoctorForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              disabled={!canManageServices}
            />
            <span>Active and available in patient registration</span>
          </label>
          <div className="full-width action-row">
            <button type="submit" disabled={!canManageServices}>
              {selectedReferralDoctorId
                ? "Update referral doctor"
                : "Add referral doctor"}
            </button>
            {selectedReferralDoctorId ? (
              <button
                type="button"
                className="ghost-action"
                onClick={resetReferralDoctorEditor}
                disabled={!canManageServices}
              >
                New referral doctor
              </button>
            ) : null}
          </div>
        </form>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Doctor list</h2>
            <p>
              Archived doctors stay visible here for history, but only active
              ones appear during reception intake.
            </p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {referralDoctors.map((doctor) => (
            <div key={doctor.id} className="list-row service-row">
              <button
                type="button"
                className="button-row service-row-main"
                onClick={() => setSelectedReferralDoctorId(doctor.id)}
              >
                <div>
                  <strong>{doctor.fullName}</strong>
                  <span>
                    {doctor.commissionPercent}% commission
                    {doctor.phone ? ` · ${doctor.phone}` : ""}
                  </span>
                  <small>{doctor.email || "No email saved"}</small>
                </div>
                <small>{doctor.isActive ? "Active" : "Archived"}</small>
              </button>
              <div className="inline-actions">
                <span
                  className={`tag ${doctor.isActive ? "tag-good" : "tag-critical"}`}
                >
                  {doctor.isActive ? "Active" : "Archived"}
                </span>
                <button
                  type="button"
                  className="ghost-action small"
                  onClick={() => handleToggleReferralDoctorActive(doctor)}
                  disabled={!canManageServices}
                >
                  {doctor.isActive ? "Archive" : "Reactivate"}
                </button>
              </div>
            </div>
          ))}
          {referralDoctors.length === 0 ? (
            <p className="section-note">
              No referral doctors have been added yet.
            </p>
          ) : null}
        </div>
      </article>
    </section>
  );

  const qualitySection = (
    <section className="content-grid two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>QC dashboard</h2>
            <p>
              Breaches, maintenance deadlines, and shift-ready trend review.
            </p>
          </div>
        </div>
        <LeveyJenningsChart points={adminOverview.qc.leveyJennings} />
        <div className="list-stack">
          {adminOverview.qc.breaches.map((breach) => (
            <div
              key={`${breach.instrumentName}-${breach.occurredAt}`}
              className="list-row"
            >
              <div>
                <strong>{breach.analyte}</strong>
                <span>
                  {breach.instrumentName} · {breach.rules.join(", ")}
                </span>
              </div>
              <small className="tag tag-critical">
                {breach.observedValue.toFixed(2)}
              </small>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Record QC run</h2>
            <p>Fast data entry with structured analyte capture.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleQcSubmit}>
          <label>
            <span>Instrument</span>
            <input
              value={qcForm.instrumentName}
              onChange={(event) =>
                setQcForm((current) => ({
                  ...current,
                  instrumentName: event.target.value,
                }))
              }
              disabled={!canManageQc}
            />
          </label>
          <label>
            <span>Analyte</span>
            <input
              value={qcForm.analyte}
              onChange={(event) =>
                setQcForm((current) => ({
                  ...current,
                  analyte: event.target.value,
                }))
              }
              disabled={!canManageQc}
            />
          </label>
          <label>
            <span>Observed</span>
            <input
              value={qcForm.observedValue}
              onChange={(event) =>
                setQcForm((current) => ({
                  ...current,
                  observedValue: event.target.value,
                }))
              }
              disabled={!canManageQc}
            />
          </label>
          <label>
            <span>Mean</span>
            <input
              value={qcForm.meanValue}
              onChange={(event) =>
                setQcForm((current) => ({
                  ...current,
                  meanValue: event.target.value,
                }))
              }
              disabled={!canManageQc}
            />
          </label>
          <label>
            <span>SD</span>
            <input
              value={qcForm.standardDeviation}
              onChange={(event) =>
                setQcForm((current) => ({
                  ...current,
                  standardDeviation: event.target.value,
                }))
              }
              disabled={!canManageQc}
            />
          </label>
          <label>
            <span>Expected range</span>
            <input
              value={qcForm.expectedRange}
              onChange={(event) =>
                setQcForm((current) => ({
                  ...current,
                  expectedRange: event.target.value,
                }))
              }
              disabled={!canManageQc}
            />
          </label>
          <div className="full-width action-row">
            <button type="submit" disabled={!canManageQc}>
              Record QC run
            </button>
          </div>
        </form>
      </article>
    </section>
  );

  const userManagementSection = (
    <SystemUserManagementSection
      canManageUsers={canManageUsers}
      userForm={userForm}
      setUserForm={setUserForm}
      passwordVisibility={passwordVisibility}
      togglePasswordVisibility={togglePasswordVisibility}
      handleUserCreate={handleUserCreate}
      pinRotation={pinRotation}
      setPinRotation={setPinRotation}
      handleRotatePin={handleRotatePin}
      users={users}
      formatDate={formatDate}
      handleToggleUser={handleToggleUser}
      handleUnlockUser={handleUnlockUser}
    />
  );

  const alertsSection = (
    <SystemAlertsSection
      bellForm={bellForm}
      setBellForm={setBellForm}
      bellRecipientOptions={bellRecipientOptions}
      handleBellSubmit={handleBellSubmit}
      incomingAlerts={incomingAlerts}
      dismissIncomingAlert={dismissIncomingAlert}
      notificationItems={adminOverview.notifications.items}
      formatDate={formatDate}
    />
  );

  const auditLogsSection = (
    <SystemAuditLogsSection
      auditTrail={adminOverview.auditTrail}
      formatDate={formatDate}
    />
  );

  const settingsSection = (
    <SystemSettingsSection
      facilityForm={facilityForm}
      setFacilityForm={setFacilityForm}
      handleFacilitySave={handleFacilitySave}
      handleFacilityLogoChange={handleFacilityLogoChange}
      canManageUsers={canManageUsers}
      logoSrc={logoSrc}
      fallbackFacilityName={bootstrap.facility.name}
      canManageBackups={canManageBackups}
      canManageIntegrations={canManageIntegrations}
      handleBackupCreate={handleBackupCreate}
      handleRestoreLatest={handleRestoreLatest}
      handleRunIntegrationDispatch={handleRunIntegrationDispatch}
      selectedBackupId={selectedBackupId}
      setSelectedBackupId={setSelectedBackupId}
      backups={backups}
      syncStatus={syncStatus}
    />
  );

  const sectionMap: Record<NavKey, React.JSX.Element> = {
    dashboard: dashboardSection,
    patients: patientSection,
    orders: ordersSection,
    tracking: trackingSection,
    sonography: sonographySection,
    scanReports: scanReportsSection,
    inventory: inventorySection,
    billing: billingSection,
    analytics: analyticsSection,
    expenses: expensesSection,
    services: servicesSection,
    referrals: referralDoctorsSection,
    quality: qualitySection,
    auditLogs: auditLogsSection,
    userManagement: userManagementSection,
    alerts: alertsSection,
    settings: settingsSection,
  };

  if (!authReady) {
    return (
      <div className="login-shell">
        <div className="login-backdrop" />
        <section className="login-card compact">
          <h2>Starting MediLab Nexus</h2>
          <p>Restoring your authenticated session.</p>
        </section>
      </div>
    );
  }

  if (!authSession) {
    return (
      <div className="login-shell">
        <div className="login-backdrop" aria-hidden="true">
          <div className="login-dna login-dna-left" />
          <div className="login-dna login-dna-right" />
        </div>
        <section className="login-glass-card" aria-label="Sign in to MediLab Nexus">
          <div className="login-brand-heading">
            <h1>MediLab</h1>
            <p>Nexus</p>
          </div>
          <form className="login-glass-form" onSubmit={handleLogin}>
            <label className="login-field">
              <span>Username</span>
              <input
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                placeholder="Username"
                required
              />
            </label>
            <label className="login-field">
              <span>PIN</span>
              <div className="password-field">
                <input
                  type={passwordVisibility.login ? "text" : "password"}
                  inputMode="numeric"
                  value={loginForm.pin}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      pin: event.target.value,
                    }))
                  }
                  placeholder="PIN"
                  required
                />
                <button
                  type="button"
                  className="field-action-button"
                  onClick={() => togglePasswordVisibility("login")}
                >
                  {passwordVisibility.login ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <div className="login-glass-meta">
              <label className="inline-toggle">
                <input type="checkbox" defaultChecked />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="login-link-button"
                onClick={() =>
                  setStatusText("Use a demo profile below or contact your administrator.")
                }
              >
                Forgot PIN?
              </button>
            </div>
            <button type="submit" className="primary-action full-width login-submit">
              Login
            </button>
          </form>
          {statusText !== "Ready to connect" && statusText !== "Signed out" ? (
            <p className="login-status glass-status">{statusText}</p>
          ) : null}
          <PortalLoginSelector
            profiles={loginPortalProfiles}
            selectedKey={requestedPortalRoute?.role ?? null}
            onSelect={(profile) => {
              const role = profile.key as PrimaryPortalRole;
              const nextHash = buildPortalHash(role, roleHome[role]);
              window.history.replaceState(
                null,
                "",
                `${window.location.pathname}${window.location.search}${nextHash}`,
              );
              setPortalHash(nextHash);
              setLoginForm({
                username: profile.demoUsername,
                pin: profile.demoPin,
              });
              setStatusText(`Loaded ${profile.label} demo access.`);
            }}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="nav-toggle"
            onClick={() => setSidebarOpen((current) => !current)}
          >
            Menu
          </button>
          <div className="brand-lockup">
            <img
              src={logoSrc}
              alt="MediLab Nexus logo"
              className="brand-logo topbar-logo"
            />
            <div>
              <strong>MediLab Nexus</strong>
              <span>{bootstrap.facility.name}</span>
            </div>
          </div>
          <div className="search-shell">
            <input
              ref={searchInputRef}
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
              placeholder="Search by Trace Code, name, or phone"
            />
            <kbd>Ctrl K</kbd>
          </div>
        </div>
        <div className="topbar-right">
          <span className={`sync-chip ${syncTone.tone}`}>{syncTone.label}</span>
          <div className="bell-shell">
            <button
              type="button"
              className="icon-button bell-button"
              onClick={() => setBellOpen((current) => !current)}
            >
              Bell
              {incomingAlerts.length > 0 ? (
                <span className="bell-count">{incomingAlerts.length}</span>
              ) : null}
            </button>
            {bellOpen ? (
              <InternalBellPanel
                bellForm={bellForm}
                setBellForm={setBellForm}
                bellRecipientOptions={bellRecipientOptions}
                handleBellSubmit={handleBellSubmit}
                incomingAlerts={incomingAlerts}
                dismissIncomingAlert={dismissIncomingAlert}
                onClose={() => setBellOpen(false)}
              />
            ) : null}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() =>
              setTheme((current) => (current === "light" ? "dark" : "light"))
            }
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <div className="user-pill">
            <div className="avatar-badge">
              {actorName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <strong>{actorName}</strong>
              <span>{currentRole}</span>
            </div>
          </div>
        </div>
      </header>

      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className={`workspace ${sidebarOpen ? "sidebar-visible" : ""}`}>
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-portal-card">
            <p className="eyebrow">{portalProfile?.label ?? "Workspace"}</p>
            <strong>{roleCopy[currentRole].title}</strong>
          </div>
          <nav className="nav-list grouped" aria-label="Portal navigation">
            {visibleNavSections.map((section) => (
              <div key={section.key} className="nav-section">
                <p className="nav-section-label">{section.label}</p>
                <div className="nav-section-items">
                  {section.items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`nav-item ${activeNav === item.key ? "active" : ""}`}
                      onClick={() => {
                        setActiveNav(item.key);
                        setSidebarOpen(false);
                      }}
                    >
                      <span className="nav-icon">{item.short}</span>
                      <span>{item.label}</span>
                      {item.key === "alerts" && incomingAlerts.length > 0 ? (
                        <span className="nav-count">{incomingAlerts.length}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <p>Connection: {syncTone.label}</p>
            <div className="developer-lockup sidebar-developer-lockup">
              <div className="developer-badge">Built by</div>
              <div className="developer-logo-frame compact mark-lockup">
                <img
                  src={omniWeaveMarkSrc}
                  alt="OmniWeave Softwares logo"
                  className="developer-logo compact"
                />
              </div>
              <div className="developer-copy compact">
                <strong>OmniWeave</strong>
                <span>Technology partner for MediLab Nexus</span>
                <small>Weaving Digital Solutions for Africa</small>
              </div>
            </div>
            <button
              type="button"
              className="ghost-action small"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="main-content">
          <div className="page-head">
            <div>
              <p className="eyebrow">
                {visibleNavItems.find((item) => item.key === activeNav)
                  ?.label ??
                  navItems.find((item) => item.key === activeNav)?.label}
              </p>
              <h2>{portalProfile?.label ?? roleCopy[currentRole].title}</h2>
            </div>
            <div className="quick-actions">
              {(portalQuickActions.length > 0
                ? portalQuickActions
                : defaultPortalActions
              )
                .slice(0, 2)
                .map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={
                      action.tone === "primary"
                        ? "primary-action small"
                        : "ghost-action small"
                    }
                    onClick={() => setActiveNav(action.target)}
                  >
                    {action.label}
                  </button>
                ))}
            </div>
          </div>
          {sectionMap[activeNav]}
        </main>

        <aside className="context-rail">
          <PortalBriefingRail
            label={portalProfile?.label ?? "Portal briefing"}
            spotlight={portalProfile?.spotlight ?? roleCopy[currentRole].subtitle}
            highlights={portalProfile?.highlights ?? []}
            snapshotCards={portalSnapshotCards}
          />

          <article className="surface-card rail-card">
            <div className="section-head">
              <div>
                <h3>Active patient</h3>
                <p>Quick summary when a Trace Code is active.</p>
              </div>
            </div>
            {selectedPatient ? (
              <div className="patient-summary">
                <div className="trace-badge">{selectedPatient.traceCode}</div>
                <strong>
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </strong>
                <span>{selectedPatient.phone}</span>
                {selectedPatient.referralDoctorName ? (
                  <span>
                    {selectedPatient.referralDoctorName} ·{" "}
                    {selectedPatient.referralDoctorCommissionPercent}% referral
                  </span>
                ) : null}
                <span>
                  {selectedPatient.traceCode} ready for ordering and payment
                </span>
                <button
                  type="button"
                  className="primary-action small"
                  onClick={() => setActiveNav("orders")}
                >
                  Start order
                </button>
                {selectedPatientHistorySummary ? (
                  <div className="patient-activity-stack">
                    <div className="mini-status-grid patient-activity-metrics">
                      <div className="mini-status">
                        <span>Orders</span>
                        <strong>{selectedPatientHistorySummary.orderCount}</strong>
                      </div>
                      <div className="mini-status">
                        <span>Reports</span>
                        <strong>{selectedPatientHistorySummary.reportCount}</strong>
                      </div>
                    </div>
                    <div className="mini-status">
                      <span>Last activity</span>
                      <strong>{formatDate(selectedPatientHistorySummary.lastActivityAt)}</strong>
                    </div>
                    <div className="timeline-list rail-timeline-list">
                      {selectedPatientTimeline.slice(0, 3).map((entry) => (
                        <article key={`rail-${entry.id}`} className={`timeline-item compact tone-${entry.tone}`}>
                          <div className="timeline-marker" aria-hidden="true" />
                          <div className="timeline-content">
                            <div className="timeline-head">
                              <strong>{entry.label}</strong>
                              <small>{formatDate(entry.occurredAt)}</small>
                            </div>
                            <small>{entry.meta}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="muted-copy">
                Search or select a patient to pin their summary here.
              </p>
            )}
          </article>

          <article className="surface-card rail-card">
            <div className="section-head">
              <div>
                <h3>Critical findings</h3>
                <p>High-priority notifications and QC breaches.</p>
              </div>
            </div>
            <div className="list-stack tight">
              {recentCritical.length === 0 ? (
                <div className="list-row">
                  <span>No critical alerts</span>
                  <small>Stable</small>
                </div>
              ) : null}
              {recentCritical.map((flag) => (
                <div key={flag.title} className="list-row">
                  <div>
                    <strong>{flag.title}</strong>
                    <span>{flag.note}</span>
                  </div>
                  <small className="tag tag-critical">{flag.severity}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="surface-card rail-card">
            <div className="section-head">
              <div>
                <h3>Connection status</h3>
                <p>Live server and integration visibility for this session.</p>
              </div>
            </div>
            <div className="list-stack tight">
              <div className="list-row">
                <div>
                  <strong>Application server</strong>
                  <span>{syncTone.label}</span>
                </div>
                <small>{syncTone.tone === "warning" ? "Check" : "Live"}</small>
              </div>
              <div className="list-row">
                <div>
                  <strong>Integration mode</strong>
                  <span>{syncStatus.mode}</span>
                </div>
                <small>
                  {syncStatus.integrationConfigured
                    ? "Connected"
                    : "Standalone"}
                </small>
              </div>
              <div className="list-row">
                <div>
                  <strong>Pending outbound events</strong>
                  <span>{syncStatus.pending} waiting</span>
                </div>
                <small>
                  {syncStatus.failed > 0
                    ? `${syncStatus.failed} failed`
                    : "Healthy"}
                </small>
              </div>
              <div className="list-row">
                <div>
                  <strong>Background worker</strong>
                  <span>
                    {syncStatus.worker.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <small>
                  {syncStatus.worker.targetsConfigured
                    ? `Every ${Math.round(syncStatus.worker.intervalMs / 1000)}s`
                    : "No targets configured"}
                </small>
              </div>
              <div className="list-row">
                <div>
                  <strong>Last dispatch attempt</strong>
                  <span>
                    {syncStatus.lastAttemptAt
                      ? new Date(syncStatus.lastAttemptAt).toLocaleString()
                      : "No dispatch run yet"}
                  </span>
                </div>
                <small>{syncStatus.synced} delivered</small>
              </div>
            </div>
          </article>

          <article className="surface-card rail-card">
            <div className="section-head">
              <div>
                <h3>Dispatch activity</h3>
                <p>Latest worker cycle throughput and deferred work.</p>
              </div>
            </div>
            {syncStatus.lastRun ? (
              <div className="list-stack tight">
                <div className="list-row">
                  <div>
                    <strong>Last run</strong>
                    <span>
                      {new Date(
                        syncStatus.lastRun.triggeredAt,
                      ).toLocaleString()}
                    </span>
                  </div>
                  <small>{syncStatus.lastRun.triggeredBy}</small>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Outbound events</strong>
                    <span>
                      {syncStatus.lastRun.syncedEvents} synced ·{" "}
                      {syncStatus.lastRun.failedEvents} failed
                    </span>
                  </div>
                  <small>{syncStatus.lastRun.processedEvents} processed</small>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Notifications</strong>
                    <span>
                      {syncStatus.lastRun.sentNotifications} sent ·{" "}
                      {syncStatus.lastRun.deferredNotifications} deferred
                    </span>
                  </div>
                  <small>{syncStatus.lastRun.conflictedEvents} conflicts</small>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Deferred events</strong>
                    <span>
                      {syncStatus.lastRun.deferredEvents} retained for retry
                    </span>
                  </div>
                  <small>
                    {canManageIntegrations ? "Run from dashboard" : "Read only"}
                  </small>
                </div>
              </div>
            ) : (
              <p className="muted-copy">
                No completed dispatch cycle has been recorded yet.
              </p>
            )}
          </article>
        </aside>
      </div>
    </div>
  );
}
