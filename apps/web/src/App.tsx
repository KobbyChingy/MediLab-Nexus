import {
  type ChangeOwnPinInput,
  type AdminOverviewPayload,
  type AdminUserInput,
  type AdminUserSummaryPayload,
  type AuthSessionPayload,
  analyticsRangeKeys,
  claimStatuses,
  sampleStatuses,
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
  type InitialSetupInput,
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
  type ReportTemplateInput,
  type ReportTemplatePayload,
  type ReportTemplateAssistPayload,
  type ReportStatusUpdateInput,
  type ServiceInput,
  type SetupStatusPayload,
  reportStatuses,
  type SampleUpdateInput,
  type UserDirectoryEntryPayload,
  type IntegrationDispatchRunPayload,
  type IntegrationDispatchStatusPayload,
  type WorkflowPayload,
  catalogSeed,
  notificationChannels,
  paymentMethods,
  paymentResponsibilities,
  payerTypes,
  reportTemplateKinds,
  userRoles,
} from "@medilab/shared";
import { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from "react";
import logoSrc from "./assets/medilab-nexus-logo.svg";
import omniWeaveMarkSrc from "./assets/omniweave-mark.svg";
import {
  fallbackAdminOverview,
  fallbackBootstrap,
  fallbackFinanceAnalytics,
} from "./data/fallback";
import {
  InternalBellPanel,
  SystemAlertsSection,
  SystemAuditLogsSection,
  SystemSettingsSection,
  SystemUserManagementSection,
} from "./components/system-sections";
const RichTextEditor = lazy(async () => {
  const module = await import("./components/rich-text-editor");
  return { default: module.RichTextEditor };
});

function RichTextEditorFallback({ label }: { label: string }) {
  return (
    <div className="field-shell full-width">
      <div className="field-label-row">
        <span>{label}</span>
      </div>
      <div className="rich-text-editor is-disabled">
        <div className="rich-text-editor__viewport">
          <div className="rich-text-editor__content">Loading editor...</div>
        </div>
      </div>
    </div>
  );
}

type NavKey =
  | "dashboard"
  | "patients"
  | "patientRecords"
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
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone: string;
  location?: string;
  nhisId?: string;
  allergies?: string;
  medicalHistory?: string;
  consentAccepted?: boolean;
  photoPath?: string;
  createdAt: string;
  referralDoctorId?: string | null;
  referralName?: string;
  referralDoctorName?: string | null;
  referralDoctorCommissionPercent?: number | null;
};

type InitialSetupFormState = InitialSetupInput;

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
type SampleRecord = WorkflowPayload["samples"][number];
type ReportRecord = WorkflowPayload["reports"][number];

type IntakeOrderState = {
  orderedBy: string;
  priority: OrderInput["priority"];
  payerType: OrderInput["payerType"];
  payerName: string;
  payerCoveragePercent: number;
  payerMemberId: string;
  payerAuthorizationCode: string;
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

type UltrasoundReportAssistState = ReportTemplateAssistPayload;

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

type UltrasoundTemplateKind = Exclude<
  ReportInput["templateKind"],
  "LAB_STANDARD"
>;

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

function buildPatientDraft(
  patient?: PatientRecord | null,
): PatientIntakeFormState {
  return {
    firstName: patient?.firstName ?? "",
    lastName: patient?.lastName ?? "",
    middleName: patient?.middleName ?? "",
    traceCode: patient?.traceCode ?? "",
    dateOfBirth: patient?.dateOfBirth ?? "",
    gender: patient?.gender ?? "Female",
    phone: patient?.phone ?? "",
    location: patient?.location ?? "",
    nhisId: patient?.nhisId ?? "",
    allergies: patient?.allergies ?? "",
    medicalHistory: patient?.medicalHistory ?? "",
    referralDoctorId: patient?.referralDoctorId ?? "",
    referralName: patient?.referralName ?? "",
    referralCommissionPercent:
      patient?.referralDoctorCommissionPercent ?? undefined,
    consentAccepted: patient?.consentAccepted ?? true,
    photoPath: patient?.photoPath ?? "",
  };
}

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
  TODAY: "Today",
  YESTERDAY: "Yesterday",
  "7D": "7 days",
  "30D": "A month",
  CUSTOM: "Custom",
  ALL: "All time",
};

const analyticsQuickRangeKeys: Array<FinanceAnalyticsPayload["range"]> = [
  "TODAY",
  "YESTERDAY",
  "7D",
  "30D",
];

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
    summaryStarter:
      "Clinical indication: abdominal pain / hepatobiliary review",
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
    summaryStarter:
      "Clinical indication: pelvic pain / menstrual or adnexal assessment",
    findingsStarter:
      "FINDINGS:\nUterus:\nEndometrium:\nRight adnexa:\nLeft adnexa:\nCul-de-sac:\n",
    impressionStarter: "IMPRESSION:\n1. ",
    techniquePlaceholder:
      "Transabdominal pelvic sonography with transvaginal correlation when indicated.",
    measurementsPlaceholder:
      "Uterine dimensions, endometrial thickness, ovarian volumes, dominant follicles...",
    recommendationPlaceholder:
      "Gynecology review, correlate with beta-hCG or repeat scan as clinically indicated.",
  },
  ULTRASOUND_OBSTETRIC: {
    summaryLabel: "Clinical indication",
    summaryStarter:
      "Clinical indication: routine fetal assessment / obstetric review",
    findingsStarter:
      "FINDINGS:\nFetal lie / presentation:\nPlacenta:\nLiquor volume:\nBiometry:\nFetal heart activity:\nCervix:\n",
    impressionStarter: "IMPRESSION:\n1. ",
    techniquePlaceholder:
      "Transabdominal obstetric sonography with fetal biometry and placental review.",
    measurementsPlaceholder:
      "BPD, HC, AC, FL, estimated fetal weight, AFI, cervical length...",
    recommendationPlaceholder:
      "Routine ANC follow-up, fetal surveillance, or obstetric review based on findings.",
  },
  ULTRASOUND_ECHOCARDIOGRAPHY: {
    summaryLabel: "Clinical indication",
    summaryStarter:
      "Clinical indication: cardiac structure and function assessment",
    findingsStarter:
      "FINDINGS:\nCardiac chambers:\nValves:\nLV systolic function:\nPericardium:\nDoppler:\n",
    impressionStarter: "IMPRESSION:\n1. ",
    techniquePlaceholder:
      "Transthoracic echocardiography with 2D, M-mode, and Doppler assessment.",
    measurementsPlaceholder:
      "EF, chamber sizes, wall motion, valve gradients, TAPSE, pericardial findings...",
    recommendationPlaceholder:
      "Cardiology review, interval echo follow-up, or urgent referral based on severity.",
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
  { key: "patientRecords", label: "Patient Records", short: "PR" },
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
  patientRecords: "Patient history, payment records, and receipt reprints.",
  orders: "Create requests, capture intake, and control handoff.",
  tracking: "Specimen movement, collection visibility, and lab flow.",
  sonography: "Scheduled imaging, room status, and scan progression.",
  scanReports: "Preview finalized scan reports or write new interpretations.",
  inventory: "Supplies, stock movement, and controlled availability.",
  billing: "Invoices, payments, and outstanding balance follow-up.",
  analytics:
    "Combined billing, expenses, inventory activity, and user performance.",
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
      "patientRecords",
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
    subtitle:
      "Handle sonography intake handoff, interpret findings, and complete scan reports.",
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

const portalProfiles: Partial<
  Record<(typeof userRoles)[number], PortalProfile>
> = {
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
      "patientRecords",
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
  },
  DOCTOR: {
    label: "Doctor portal",
    summary:
      "Review the scan queue, interpret findings, and complete scan reports with minimal distraction.",
    spotlight:
      "This portal is tuned for interpretation and reporting of sonography-driven studies.",
    navKeys: [
      "dashboard",
      "patients",
      "patientRecords",
      "sonography",
      "scanReports",
    ],
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
  },
  RECEPTION: {
    label: "Receptionist portal",
    summary:
      "Handle registration, front-desk expenses, service lookup, and printed scan report handoff.",
    spotlight:
      "This portal keeps the first touchpoint clean so intake, cash movement, and report pickup stay fast and traceable.",
    navKeys: [
      "dashboard",
      "patients",
      "patientRecords",
      "expenses",
      "services",
      "scanReports",
      "settings",
    ],
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
  },
  SONOGRAPHER: {
    label: "Sonographer portal",
    summary:
      "Run the imaging worklist, update scan status, and prepare structured handoff for doctor review.",
    spotlight:
      "This portal keeps the scan room focused on timely acquisition, status updates, and draft-ready reporting.",
    navKeys: [
      "dashboard",
      "patients",
      "patientRecords",
      "orders",
      "sonography",
      "scanReports",
    ],
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
  },
};

const emptyWorkflow: WorkflowPayload = {
  orders: [],
  samples: [],
  imaging: [],
  reports: [],
  invoices: [],
  payments: [],
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

function buildAnalyticsQueryString(
  range: FinanceAnalyticsPayload["range"],
  customDateRange: { startDate: string; endDate: string },
) {
  const params = new URLSearchParams({ range });
  if (range === "CUSTOM") {
    if (customDateRange.startDate) {
      params.set("startDate", customDateRange.startDate);
    }
    if (customDateRange.endDate) {
      params.set("endDate", customDateRange.endDate);
    }
  }
  return params.toString();
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/u, "").trim();
}

function normalizeImportedTemplateText(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/\u0000/gu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function escapeEditorHtml(value: string) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function plainTextToRichHtml(value: string) {
  const normalized = normalizeImportedTemplateText(value);
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/u)
    .map(
      (paragraph) =>
        `<p>${escapeEditorHtml(paragraph).replace(/\n/gu, "<br />")}</p>`,
    )
    .join("");
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][^>]*>/iu.test(value);
}

function ensureRichTextHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return looksLikeHtml(trimmed) ? trimmed : plainTextToRichHtml(trimmed);
}

function buildRichTextTextBlock(value: string) {
  return plainTextToRichHtml(value);
}

function joinRichTextSections(...sections: string[]) {
  return sections
    .map((section) => section.trim())
    .filter(Boolean)
    .join("");
}

function richTextToPlainText(value: string) {
  if (!value.trim()) {
    return "";
  }

  if (typeof document === "undefined") {
    return value.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
  }

  const container = document.createElement("div");
  container.innerHTML = value;
  return (container.textContent || container.innerText || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function extractStructuredTemplateSections(text: string) {
  const normalized = normalizeImportedTemplateText(text);
  const sectionPattern =
    /^(TITLE|REPORT TITLE|MEDICAL HISTORY|HISTORY|SUMMARY|DESCRIPTION|FINDINGS|IMPRESSION|RECOMMENDATION)\s*:?\s*$/gimu;
  const matches = Array.from(normalized.matchAll(sectionPattern));
  const sections = new Map<string, string>();

  if (matches.length > 0) {
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      if (!match) {
        continue;
      }
      const nextMatch = matches[index + 1];
      const key = (match[1] ?? "").toUpperCase();
      const start = (match.index ?? 0) + match[0].length;
      const end = nextMatch?.index ?? normalized.length;
      sections.set(key, normalized.slice(start, end).trim());
    }
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const detectedTitle =
    sections.get("TITLE") ||
    sections.get("REPORT TITLE") ||
    (lines[0] && !lines[0].includes(":") ? lines[0] : "");
  const findings =
    sections.get("FINDINGS") || sections.get("DESCRIPTION") || normalized;
  const impression = sections.get("IMPRESSION") || "";
  const summary =
    sections.get("SUMMARY") ||
    (impression ? impression.split("\n")[0]?.trim() ?? "" : "");

  return {
    title: detectedTitle,
    medicalHistory:
      sections.get("MEDICAL HISTORY") || sections.get("HISTORY") || "",
    summary,
    findings,
    impression,
    recommendation: sections.get("RECOMMENDATION") || "",
  };
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

function downloadBlobFile(blob: Blob, fileName: string) {
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

function sanitizeDownloadName(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9_-]+/giu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
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
  if (["VERIFIED", "RELEASED", "APPROVED", "COMPLETED", "STORED"].includes(status)) {
    return "good";
  }
  if (["READY_FOR_REVIEW", "IN_PROGRESS", "IN_REVIEW", "PROCESSING", "COLLECTED", "RECEIVED", "AMENDED"].includes(status)) {
    return "warn";
  }
  if (["REGISTERED", "SCHEDULED", "ARRIVED", "SCANNING", "DRAFT", "PENDING"].includes(status)) {
    return "neutral";
  }
  return "critical";
}

function formatStatusLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSampleTone(status: SampleRecord["status"]) {
  if (["STORED", "DISPOSED"].includes(status)) {
    return "good";
  }
  if (["COLLECTED", "RECEIVED", "PROCESSING"].includes(status)) {
    return "warn";
  }
  if (status === "PENDING") {
    return "neutral";
  }
  return "critical";
}

function getNextReportStatus(
  status: ReportRecord["status"],
): ReportStatusUpdateInput["status"] | null {
  if (status === "DRAFT") {
    return "IN_REVIEW";
  }
  if (status === "IN_REVIEW") {
    return "APPROVED";
  }
  if (status === "APPROVED" || status === "AMENDED") {
    return "RELEASED";
  }
  return null;
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

function resolveUltrasoundTemplate(
  serviceLabel: string,
): UltrasoundTemplateKind {
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
  const mapY = (value: number) => height - 24 - (value / max) * (height - 48);
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
    username: "",
    pin: "",
  });
  const [showInitialSetupForm, setShowInitialSetupForm] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatusPayload | null>(
    null,
  );
  const [setupForm, setSetupForm] = useState<InitialSetupFormState>({
    admin: {
      displayName: "",
      username: "",
      pin: "",
    },
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
  const [analyticsCustomDateRange, setAnalyticsCustomDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [selectedAnalyticsStudy, setSelectedAnalyticsStudy] = useState("");
  const [analyticsStudyDepartmentFilter, setAnalyticsStudyDepartmentFilter] =
    useState<"ALL" | "LAB" | "IMAGING">("ALL");
  const [billingPayerTypeFilter, setBillingPayerTypeFilter] = useState<
    "ALL" | InvoiceRecord["payerType"]
  >("ALL");
  const [billingClaimStatusFilter, setBillingClaimStatusFilter] = useState<
    "ALL" | InvoiceRecord["claimStatus"]
  >("ALL");
  const [expenseWorkspace, setExpenseWorkspace] =
    useState<ExpenseWorkspacePayload>(() =>
      buildEmptyExpenseWorkspace(fallbackFinanceAnalytics.range),
    );
  const [syncStatus, setSyncStatus] =
    useState<IntegrationDispatchStatusPayload>(emptySyncStatus);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const backupImportInputRef = useRef<HTMLInputElement | null>(null);
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
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [statusText, setStatusText] = useState("Ready to connect");
  const [patientForm, setPatientForm] = useState<PatientIntakeFormState>({
    firstName: "",
    lastName: "",
    middleName: "",
    traceCode: "",
    phone: "",
    location: "",
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
    payerType: "SELF_PAY",
    payerName: "",
    payerCoveragePercent: 0,
    payerMemberId: "",
    payerAuthorizationCode: "",
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
    payerType: "SELF_PAY",
    payerName: "",
    payerCoveragePercent: 0,
    payerMemberId: "",
    payerAuthorizationCode: "",
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
    status: "IN_REVIEW",
    templateKind: "LAB_STANDARD",
    criticalFlag: false,
    imagePaths: [],
  });
  const [sampleForm, setSampleForm] = useState<SampleUpdateInput>({
    status: "PENDING",
    collectedBy: "",
    rejectionReason: "",
    note: "",
  });
  const [ultrasoundReportAssist, setUltrasoundReportAssist] =
    useState<UltrasoundReportAssistState>(defaultUltrasoundReportAssistState);
  const [reportImagePathsText, setReportImagePathsText] = useState("");
  const [reportPatientQuery, setReportPatientQuery] = useState("");
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
    expiryDate: "",
    preferredVendor: "",
    storageLocation: "",
  });
  const [paymentForm, setPaymentForm] = useState<PaymentInput>({
    invoiceId: "",
    amountCents: 0,
    method: "CASH",
    responsibility: "PATIENT",
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
    printFontSize: fallbackBootstrap.facility.printFontSize,
  });
  const [latestReceipt, setLatestReceipt] = useState<{
    paymentId: string;
    traceCode: string;
  } | null>(null);
  const [latestInvoiceId, setLatestInvoiceId] = useState("");
  const [reportTemplates, setReportTemplates] = useState<
    ReportTemplatePayload[]
  >([]);
  const [selectedReportTemplateId, setSelectedReportTemplateId] = useState("");
  const [reportTemplateName, setReportTemplateName] = useState("");
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
  const [serviceEditorOpen, setServiceEditorOpen] = useState(false);
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
  const [expenseEntryType, setExpenseEntryType] = useState<
    "EXPENSE" | "REFUND"
  >("EXPENSE");
  const [refundPatientQuery, setRefundPatientQuery] = useState("");
  const [refundPatientId, setRefundPatientId] = useState("");
  const [patientRecordsQuery, setPatientRecordsQuery] = useState("");
  const [expenseFilters, setExpenseFilters] = useState<ExpenseFiltersState>({
    category: "ALL",
    startDate: "",
    endDate: "",
  });
  const [isEditingPatientRecord, setIsEditingPatientRecord] = useState(false);
  const [patientRecordDraft, setPatientRecordDraft] =
    useState<PatientIntakeFormState>(buildPatientDraft());
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
  const [pinRecovery, setPinRecovery] = useState({ userId: "", newPin: "" });
  const [selfPinChange, setSelfPinChange] = useState<ChangeOwnPinInput>({
    currentPin: "",
    newPin: "",
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    login: false,
    userCreate: false,
    recoverPin: false,
    selfCurrentPin: false,
    selfNewPin: false,
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
  const reportTemplateFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentRole = authSession?.user.role ?? "ADMIN";
  const actorName = authSession?.user.displayName ?? "Unauthenticated";
  const allowedActions = authSession?.user.allowedActions ?? [];
  const portalProfile = portalProfiles[currentRole];
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

    void (async () => {
      try {
        const sessionResponse = await fetch(`${apiBase}/auth/session`, {
          credentials: "include",
        });

        if (sessionResponse.ok) {
          const session =
            (await sessionResponse.json()) as AuthSessionPayload;

          if (!mounted) {
            return;
          }

          setAuthSession(session);
          setSetupStatus(null);
          setActiveNav(resolvePortalNavForRole(session.user.role));
          setReportForm((current) => ({
            ...current,
            signedBy: session.user.displayName,
          }));
          return;
        }

        const statusResponse = await fetch(`${apiBase}/setup/status`, {
          credentials: "include",
        });

        if (!statusResponse.ok) {
          throw new Error("Setup status unavailable");
        }

        const status = (await statusResponse.json()) as SetupStatusPayload;
        if (!mounted) {
          return;
        }

        setSetupStatus(status);
        if (status.requiresSetup) {
          setStatusText(
            "Complete the first administrator setup to open MediLab Nexus.",
          );
        }
      } catch {
        if (!mounted) {
          return;
        }

        setSetupStatus(null);
        setStatusText(
          "Database setup is not ready. Confirm the PostgreSQL connection and run the schema push before registering the first administrator.",
        );
      } finally {
        if (mounted) {
          setAuthReady(true);
        }
      }
    })();

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

  function togglePasswordVisibility(key: keyof typeof passwordVisibility) {
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
    const scheduleTone = (
      offset: number,
      frequency: number,
      duration: number,
    ) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
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
        reportTemplateList,
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
              `/analytics/finance?${buildAnalyticsQueryString(
                analyticsRange,
                analyticsCustomDateRange,
              )}`,
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
        canWriteReports
          ? requestJson<ReportTemplatePayload[]>("/report-templates")
          : Promise.resolve([]),
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
        setReportTemplates(reportTemplateList);
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
        customStartDate:
          analyticsRange === "CUSTOM" && analyticsCustomDateRange.startDate
            ? new Date(analyticsCustomDateRange.startDate).toISOString()
            : null,
        customEndDate:
          analyticsRange === "CUSTOM" && analyticsCustomDateRange.endDate
            ? new Date(analyticsCustomDateRange.endDate).toISOString()
            : null,
        generatedAt: new Date().toISOString(),
      });
      setExpenseWorkspace(buildEmptyExpenseWorkspace(analyticsRange));
      setBackups([]);
      setUsers([]);
      setDirectoryUsers([]);
      setServices([]);
      setReferralDoctors([]);
      setReportTemplates([]);
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
  }, [
    authSession?.user.id,
    analyticsRange,
    analyticsCustomDateRange.startDate,
    analyticsCustomDateRange.endDate,
  ]);

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
    if (!setupStatus?.requiresSetup) {
      setShowInitialSetupForm(false);
    }
  }, [setupStatus]);

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
          return [
            ...freshAlerts.filter((alert) => !knownIds.has(alert.id)),
            ...current,
          ];
        });
        const newestAlert = freshAlerts[0];
        if (!newestAlert) {
          return;
        }
        setStatusText(`${newestAlert.createdBy} needs your attention.`);
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
        current.message || `You are needed by ${authSession.user.displayName}.`,
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
      printFontSize: bootstrap.facility.printFontSize,
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
    setPatientRecordDraft(buildPatientDraft(currentPatient));
    setIsEditingPatientRecord(false);
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
        detail: `${formatMoney(invoice.amountPaidCents)} paid against ${formatMoney(invoice.totalDueCents)} due.`,
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
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
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
      lastActivityAt:
        selectedPatientTimeline[0]?.occurredAt ?? selectedPatient.createdAt,
    };
  }, [
    selectedPatient,
    selectedPatientTimeline,
    workflow.invoices,
    workflow.orders,
    workflow.reports,
  ]);
  const patientTestsById = useMemo(() => {
    const testsByPatient = new Map<string, string[]>();

    workflow.orders.forEach((order) => {
      const existing = testsByPatient.get(order.patientId) ?? [];
      const merged = [...existing];

      order.items.forEach((item) => {
        if (!merged.includes(item)) {
          merged.push(item);
        }
      });

      testsByPatient.set(order.patientId, merged);
    });

    return testsByPatient;
  }, [workflow.orders]);
  const selectedPatientPayments = useMemo(() => {
    if (!selectedPatient) {
      return [] as WorkflowPayload["payments"];
    }

    return workflow.payments.filter(
      (payment) => payment.patientId === selectedPatient.id,
    );
  }, [selectedPatient, workflow.payments]);
  const filteredPatientRecords = useMemo(() => {
    const query = patientRecordsQuery.trim().toLowerCase();
    const rankedPatients = [...patients].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );

    if (!query) {
      return rankedPatients;
    }

    return rankedPatients.filter((patient) => {
      const tests = patientTestsById.get(patient.id) ?? [];
      return [
        patient.traceCode,
        patient.firstName,
        patient.lastName,
        patient.phone,
        patient.referralDoctorName ?? "",
        ...tests,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [patientRecordsQuery, patientTestsById, patients]);
  const refundPatientMatches = useMemo(() => {
    const query = refundPatientQuery.trim().toLowerCase();
    const sortedPatients = [...patients].sort((left, right) =>
      `${left.firstName} ${left.lastName}`.localeCompare(
        `${right.firstName} ${right.lastName}`,
      ),
    );

    if (!query) {
      return sortedPatients;
    }

    return sortedPatients.filter((patient) =>
      [
        patient.traceCode,
        patient.firstName,
        patient.lastName,
        patient.phone,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [patients, refundPatientQuery]);
  const selectedRefundPatient = useMemo(
    () => patients.find((patient) => patient.id === refundPatientId) ?? null,
    [patients, refundPatientId],
  );
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
  const specimenBoard = useMemo(
    () => [
      {
        label: "Pending",
        statuses: ["PENDING", "REJECTED"] as SampleRecord["status"][],
      },
      {
        label: "Collected",
        statuses: ["COLLECTED", "RECEIVED"] as SampleRecord["status"][],
      },
      {
        label: "In Lab",
        statuses: ["PROCESSING", "STORED", "DISPOSED"] as SampleRecord["status"][],
      },
    ],
    [],
  );
  const [sampleSearchQuery, setSampleSearchQuery] = useState("");
  const [selectedSampleStatus, setSelectedSampleStatus] = useState<
    "ALL" | SampleRecord["status"]
  >("ALL");
  const filteredSamples = useMemo(() => {
    const query = sampleSearchQuery.trim().toLowerCase();

    return workflow.samples.filter((sample) => {
      if (
        selectedSampleStatus !== "ALL" &&
        sample.status !== selectedSampleStatus
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        sample.patientTraceCode,
        sample.specimenType,
        sample.traceLabel,
        sample.collectedBy ?? "",
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [sampleSearchQuery, selectedSampleStatus, workflow.samples]);
  const pendingSampleCount = useMemo(
    () =>
      filteredSamples.filter((sample) =>
        ["PENDING", "REJECTED"].includes(sample.status),
      ).length,
    [filteredSamples],
  );
  const activeBenchSampleCount = useMemo(
    () =>
      filteredSamples.filter((sample) =>
        ["COLLECTED", "RECEIVED", "PROCESSING"].includes(sample.status),
      ).length,
    [filteredSamples],
  );
  const selectedSample = useMemo(
    () =>
      workflow.samples.find((sample) => sample.id === selectedSampleId) ??
      workflow.samples[0] ??
      null,
    [selectedSampleId, workflow.samples],
  );
  useEffect(() => {
    if (!selectedSampleId && workflow.samples[0]) {
      setSelectedSampleId(workflow.samples[0].id);
    }
  }, [selectedSampleId, workflow.samples]);
  useEffect(() => {
    if (!selectedSample) {
      return;
    }

    setSampleForm({
      status: selectedSample.status,
      collectedBy: selectedSample.collectedBy ?? "",
      rejectionReason: selectedSample.rejectionReason ?? "",
      note: "",
    });
  }, [selectedSample]);
  const filteredRegistrationServices = useMemo(() => {
    const query = registrationServiceQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return sonographyIntakeCatalog.filter((item) =>
      [item.name, item.code, item.modality ?? "", item.department].some(
        (value) => value.toLowerCase().includes(query),
      ),
    );
  }, [registrationServiceQuery, sonographyIntakeCatalog]);
  const filteredOrderServices = useMemo(() => {
    const query = orderServiceQuery.trim().toLowerCase();
    if (!query) {
      return sonographyIntakeCatalog;
    }

    return sonographyIntakeCatalog.filter((item) =>
      [item.name, item.code, item.modality ?? "", item.department].some(
        (value) => value.toLowerCase().includes(query),
      ),
    );
  }, [orderServiceQuery, sonographyIntakeCatalog]);
  const selectedImagingStudy = useMemo(
    () =>
      sonographyStudies.find((study) => study.id === selectedImagingStudyId) ??
      sonographyStudies.find(
        (study) => study.patientId === selectedPatientId,
      ) ??
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
        current.patientId === selectedImagingStudy.patientId &&
        current.recipient
          ? current.recipient
          : (selectedPatient?.phone ?? current.recipient),
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
  const showPatientIntakeTools =
    currentRole !== "DOCTOR" && currentRole !== "SONOGRAPHER";
  const canEditPatientRecords = allowedActions.includes("patient:write");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<
    "ALL" | string
  >("ALL");
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
  const orderStatusOptions = useMemo(
    () =>
      Array.from(new Set(workflow.orders.map((order) => order.status).filter(Boolean))),
    [workflow.orders],
  );
  const filteredOrders = useMemo(() => {
    const query = orderSearchQuery.trim().toLowerCase();

    return workflow.orders.filter((order) => {
      if (selectedOrderStatus !== "ALL" && order.status !== selectedOrderStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        order.patientTraceCode,
        order.patientName,
        order.accessionNumber,
        order.items.join(" "),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [orderSearchQuery, selectedOrderStatus, workflow.orders]);
  const openOrderCount = useMemo(
    () =>
      filteredOrders.filter(
        (order) => !["COMPLETED", "RELEASED", "CANCELLED"].includes(order.status),
      ).length,
    [filteredOrders],
  );
  const completedOrderCount = useMemo(
    () =>
      filteredOrders.filter((order) =>
        ["COMPLETED", "RELEASED"].includes(order.status),
      ).length,
    [filteredOrders],
  );
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
      registrationTotalCents -
      Math.round(
        registrationTotalCents *
          ((intakeOrder.payerType === "SELF_PAY"
            ? 0
            : intakeOrder.payerCoveragePercent) /
            100),
      ),
    [
      intakeOrder.payerCoveragePercent,
      intakeOrder.payerType,
      registrationTotalCents,
    ],
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
  const filteredReportPatients = useMemo(() => {
    const normalizedQuery = reportPatientQuery.trim().toLowerCase();
    const sortedPatients = [...patients].sort((left, right) => {
      const leftLabel = `${left.firstName} ${left.lastName}`.trim();
      const rightLabel = `${right.firstName} ${right.lastName}`.trim();

      return (
        leftLabel.localeCompare(rightLabel) ||
        left.traceCode.localeCompare(right.traceCode)
      );
    });

    if (!normalizedQuery) {
      return sortedPatients;
    }

    return sortedPatients.filter((patient) => {
      const fullName = `${patient.firstName} ${patient.lastName}`
        .trim()
        .toLowerCase();

      return (
        patient.traceCode.toLowerCase().includes(normalizedQuery) ||
        fullName.includes(normalizedQuery)
      );
    });
  }, [patients, reportPatientQuery]);
  const reportOrdersForSelectedPatient = useMemo(
    () =>
      reportableOrders
        .filter(
          (order) =>
            !reportForm.patientId || order.patientId === reportForm.patientId,
        )
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        ),
    [reportForm.patientId, reportableOrders],
  );
  const selectedReportOrder = useMemo(
    () =>
      reportOrdersForSelectedPatient.find(
        (order) => order.id === reportForm.orderId,
      ) ??
      reportableOrders.find((order) => order.id === reportForm.orderId) ??
      null,
    [reportForm.orderId, reportOrdersForSelectedPatient, reportableOrders],
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
        ? (ultrasoundPresetFieldMap[reportForm.templateKind] ?? [])
        : [],
    [reportForm.templateKind],
  );
  useEffect(() => {
    if (!reportForm.patientId) {
      if (!reportForm.orderId) {
        return;
      }

      setReportForm((current) => ({
        ...current,
        orderId: "",
      }));
      return;
    }

    if (reportOrdersForSelectedPatient.length === 0) {
      if (!reportForm.orderId) {
        return;
      }

      setReportForm((current) =>
        current.patientId === reportForm.patientId
          ? {
              ...current,
              orderId: "",
            }
          : current,
      );
      return;
    }

    const orderStillMatchesPatient = reportOrdersForSelectedPatient.some(
      (order) => order.id === reportForm.orderId,
    );
    if (!orderStillMatchesPatient) {
      setReportForm((current) =>
        current.patientId === reportForm.patientId
          ? {
              ...current,
              orderId: reportOrdersForSelectedPatient[0]?.id ?? "",
            }
          : current,
      );
    }
  }, [
    reportForm.orderId,
    reportForm.patientId,
    reportOrdersForSelectedPatient,
  ]);

  useEffect(() => {
    if (!selectedReportOrder) {
      return;
    }

    const serviceName =
      selectedReportImagingStudy?.serviceName ??
      selectedReportOrder.items[0] ??
      "Scan";
    const templateKind =
      selectedReportImagingStudy ||
      orderIncludesSonography(selectedReportOrder.items)
        ? resolveUltrasoundTemplate(serviceName)
        : "LAB_STANDARD";
    const preset =
      templateKind === "LAB_STANDARD"
        ? null
        : ultrasoundTemplatePresets[templateKind];

    setReportForm((current) => {
      if (current.orderId !== selectedReportOrder.id) {
        return current;
      }

      return {
        ...current,
        patientId: selectedReportOrder.patientId,
        title: `${serviceName} Report`,
        templateKind,
        findings:
          current.orderId === selectedReportOrder.id && current.findings
            ? current.findings
            : ensureRichTextHtml(preset?.findingsStarter ?? ""),
        impression:
          current.orderId === selectedReportOrder.id && current.impression
            ? current.impression
            : ensureRichTextHtml(preset?.impressionStarter ?? ""),
      };
    });

    if (preset) {
      setUltrasoundReportAssist((current) => ({
        ...defaultUltrasoundReportAssistState,
        sonographerName:
          current.sonographerName ||
          selectedReportImagingStudy?.sonographerName ||
          "",
        technique: current.technique || preset.techniquePlaceholder,
      }));
    }
  }, [selectedReportImagingStudy, selectedReportOrder]);

  useEffect(() => {
    if (
      !isUltrasoundTemplate(reportForm.templateKind) ||
      !selectedReportImagingStudy
    ) {
      return;
    }

    setUltrasoundReportAssist((current) => ({
      ...current,
      sonographerName:
        current.sonographerName ||
        selectedReportImagingStudy.sonographerName ||
        "",
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
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [selectedServiceKind, setSelectedServiceKind] = useState<
    "ALL" | ServiceInput["kind"]
  >("ALL");
  const [selectedServiceState, setSelectedServiceState] = useState<
    "ALL" | "ACTIVE" | "ARCHIVED"
  >("ALL");
  const filteredServiceRows = useMemo(() => {
    const query = serviceSearchQuery.trim().toLowerCase();

    return services.filter((service) => {
      if (selectedServiceKind !== "ALL" && service.kind !== selectedServiceKind) {
        return false;
      }

      if (selectedServiceState === "ACTIVE" && service.isActive === false) {
        return false;
      }
      if (selectedServiceState === "ARCHIVED" && service.isActive !== false) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        service.name,
        service.code,
        service.kind,
        service.modality ?? "",
        service.specimenType ?? "",
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [selectedServiceKind, selectedServiceState, serviceSearchQuery, services]);
  const activeServiceCount = useMemo(
    () => filteredServiceRows.filter((service) => service.isActive !== false).length,
    [filteredServiceRows],
  );
  const imagingServiceCount = useMemo(
    () => filteredServiceRows.filter((service) => service.kind === "IMAGING").length,
    [filteredServiceRows],
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
          (invoice) =>
            invoice.patientBalanceCents > 0 && invoice.status !== "VOID",
        )
        .sort((left, right) => {
          if (right.patientBalanceCents !== left.patientBalanceCents) {
            return right.patientBalanceCents - left.patientBalanceCents;
          }

          return (
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime()
          );
        }),
    [workflow.invoices],
  );
  const claimInvoices = useMemo(
    () =>
      workflow.invoices.filter((invoice) => invoice.payerType !== "SELF_PAY"),
    [workflow.invoices],
  );
  const filteredClaimInvoices = useMemo(
    () =>
      claimInvoices.filter((invoice) => {
        if (
          billingPayerTypeFilter !== "ALL" &&
          invoice.payerType !== billingPayerTypeFilter
        ) {
          return false;
        }
        if (
          billingClaimStatusFilter !== "ALL" &&
          invoice.claimStatus !== billingClaimStatusFilter
        ) {
          return false;
        }
        return true;
      }),
    [billingClaimStatusFilter, billingPayerTypeFilter, claimInvoices],
  );
  const filteredClaimSummary = useMemo(
    () => ({
      invoicesCount: filteredClaimInvoices.length,
      coveredCents: filteredClaimInvoices.reduce(
        (sum, invoice) => sum + invoice.payerResponsibilityCents,
        0,
      ),
      pendingCount: filteredClaimInvoices.filter((invoice) =>
        ["PENDING", "SUBMITTED", "PARTIAL"].includes(invoice.claimStatus),
      ).length,
      settledCount: filteredClaimInvoices.filter(
        (invoice) => invoice.claimStatus === "SETTLED",
      ).length,
    }),
    [filteredClaimInvoices],
  );
  const metrics = getRoleMetricCards(
    currentRole,
    bootstrap,
    adminOverview,
    workflow,
  );
  const canWriteReports = allowedActions.includes("report:write");
  const pickupReports = useMemo(
    () =>
      workflow.reports.filter(
        (report) => !["DRAFT", "IN_REVIEW"].includes(report.status),
      ),
    [workflow.reports],
  );
  const canEditPrintSettings =
    currentRole === "DOCTOR" ||
    currentRole === "SONOGRAPHER" ||
    currentRole === "ADMIN";
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

    return scopedNavItems.filter((item) =>
      hasNavAccess(item.key, allowedActions),
    );
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
  const selectedSavedReportTemplate = useMemo(
    () =>
      reportTemplates.find((template) => template.id === selectedReportTemplateId) ??
      null,
    [reportTemplates, selectedReportTemplateId],
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
          new Set(
            financeAnalytics.studyPerformance.map((study) => study.department),
          ),
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
  const portalQuickActions = (
    portalProfile?.actions ?? defaultPortalActions
  ).filter((action) => visibleNavKeys.has(action.target));
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
        invoice.amountPaidCents > 0
          ? invoice.amountPaidCents
          : invoice.totalDueCents,
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
      if (
        authSession &&
        route &&
        route.role === currentRole &&
        visibleNavKeys.has(route.nav)
      ) {
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
      setSetupStatus(null);
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

  async function handleInitialSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const session = await requestJson<AuthSessionPayload>(
        "/setup/initialize",
        {
          method: "POST",
          body: JSON.stringify(setupForm satisfies InitialSetupInput),
        },
      );
      setAuthSession(session);
      setSetupStatus({
        requiresSetup: false,
        hasUsers: true,
        hasFacility: true,
        facility: setupStatus?.facility ?? bootstrap.facility,
      });
      setActiveNav(resolvePortalNavForRole(session.user.role));
      setStatusText(`Setup complete. Signed in as ${session.user.displayName}.`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Initial setup failed. Confirm the MediLab Nexus server is running.",
      );
    }
  }

  async function handleDeletePatient() {
    if (!selectedPatient) {
      setStatusText("Choose a patient record before deleting it");
      return;
    }

    if (
      !window.confirm(
        `Delete patient ${selectedPatient.traceCode}? This only works when no dependent workflow records exist.`,
      )
    ) {
      return;
    }

    try {
      await requestJson(`/patients/${selectedPatient.id}`, {
        method: "DELETE",
      });
      setPatients((current) =>
        current.filter((patient) => patient.id !== selectedPatient.id),
      );
      setSelectedPatientId("");
      setPatientRecordDraft(buildPatientDraft(null));
      setIsEditingPatientRecord(false);
      setRefundPatientId((current) =>
        current === selectedPatient.id ? "" : current,
      );
      setOrderForm((current) => ({
        ...current,
        patientId:
          current.patientId === selectedPatient.id ? "" : current.patientId,
      }));
      setNotificationForm((current) => ({
        ...current,
        patientId:
          current.patientId === selectedPatient.id ? "" : current.patientId,
        traceCode:
          current.patientId === selectedPatient.id ? "" : current.traceCode,
      }));
      await loadOperationalData();
      setStatusText(`Deleted patient ${selectedPatient.traceCode}`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Patient record could not be deleted right now",
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

  function openPatient(patient: PatientRecord, nextNav: NavKey = "patients") {
    setSelectedPatientId(patient.id);
    setOrderForm((current) => ({ ...current, patientId: patient.id }));
    setNotificationForm((current) => ({
      ...current,
      patientId: patient.id,
      traceCode: patient.traceCode,
      recipient: current.recipient || patient.phone,
    }));
    setActiveNav(nextNav);
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
              payerType: intakeOrder.payerType,
              payerName: intakeOrder.payerName,
              payerCoveragePercent: intakeOrder.payerCoveragePercent,
              payerMemberId: intakeOrder.payerMemberId,
              payerAuthorizationCode: intakeOrder.payerAuthorizationCode,
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
                  responsibility: "PATIENT",
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
      setPatientForm(buildPatientDraft());
      setPatientReferralCommission("");
      setRegistrationItemIds([]);
      setRegistrationServiceQuery("");
      setIntakeOrder({
        orderedBy: "Front Desk",
        priority: "ROUTINE",
        payerType: "SELF_PAY",
        payerName: "",
        payerCoveragePercent: 0,
        payerMemberId: "",
        payerAuthorizationCode: "",
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

  async function handlePatientRecordUpdate(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedPatient) {
      setStatusText("Choose a patient record before saving changes");
      return;
    }

    try {
      const updated = await requestJson<PatientRecord>(
        `/patients/${selectedPatient.id}`,
        {
          method: "PUT",
          body: JSON.stringify(patientRecordDraft satisfies PatientInput),
        },
      );
      setPatients((current) =>
        current.map((patient) =>
          patient.id === updated.id ? updated : patient,
        ),
      );
      setPatientRecordDraft(buildPatientDraft(updated));
      setIsEditingPatientRecord(false);
      await loadOperationalData();
      setStatusText(`Updated patient record ${updated.traceCode}`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Patient record could not be updated right now",
      );
    }
  }

  async function handleOrderSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payerName = orderForm.payerName.trim();
    const payload: OrderInput = {
      ...orderForm,
      patientId: selectedPatientId || orderForm.patientId,
      itemIds: selectedItemIds,
      insuranceProvider:
        orderForm.payerType === "SELF_PAY" ? "" : payerName,
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
    const payload = buildPreparedReportPayload();
    if (!payload) {
      return;
    }

    try {
      await requestJson("/reports", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatusText(
        `Scan report ${payload.title} prepared with printable output`,
      );
      setReportForm({
        patientId: "",
        orderId: "",
        title: "Scan Report",
        medicalHistory: "",
        summary: "",
        findings: "",
        impression: "",
        signedBy: actorName,
        status: "IN_REVIEW",
        templateKind: "LAB_STANDARD",
        criticalFlag: false,
        imagePaths: [],
      });
      setReportImagePathsText("");
      setUltrasoundReportAssist(defaultUltrasoundReportAssistState);
      await loadOperationalData();
      setStatusText(
        `Scan report ${payload.title} saved as ${formatStatusLabel(payload.status)}`,
      );
    } catch {
      setStatusText(
        "Scan report could not be submitted. Retry when the server is available.",
      );
    }
  }

  function buildPreparedReportPayload() {
    if (
      !reportForm.patientId ||
      !reportForm.orderId ||
      reportForm.title.trim().length < 3 ||
      reportForm.signedBy.trim().length < 3
    ) {
      setStatusText(
        "Select the patient and order, then add a report title and signature before previewing or saving.",
      );
      return null;
    }

    const presetMeasurementLines = isUltrasoundTemplate(reportForm.templateKind)
      ? buildPresetMeasurementLines(
          reportForm.templateKind,
          ultrasoundReportAssist,
        )
      : [];
    const compiledMeasurements = [
      ultrasoundReportAssist.measurementsText.trim(),
      ...presetMeasurementLines,
    ].filter(Boolean);
    const findings = isUltrasoundTemplate(reportForm.templateKind)
      ? joinRichTextSections(
          ultrasoundReportAssist.technique
            ? buildRichTextTextBlock(
                `Technique: ${ultrasoundReportAssist.technique}`,
              )
            : "",
          ultrasoundReportAssist.sonographerName
            ? buildRichTextTextBlock(
                `Prepared by: ${ultrasoundReportAssist.sonographerName}`,
              )
            : "",
          ensureRichTextHtml(reportForm.findings),
          compiledMeasurements.length > 0
            ? buildRichTextTextBlock(
                `Measurements:\n${compiledMeasurements.join("\n")}`,
              )
            : "",
        )
      : ensureRichTextHtml(reportForm.findings);
    const impression = isUltrasoundTemplate(reportForm.templateKind)
      ? joinRichTextSections(
          ensureRichTextHtml(reportForm.impression),
          ultrasoundReportAssist.recommendation
            ? buildRichTextTextBlock(
                `Recommendation: ${ultrasoundReportAssist.recommendation}`,
              )
            : "",
        )
      : ensureRichTextHtml(reportForm.impression);

    if (
      richTextToPlainText(findings).length < 3 ||
      richTextToPlainText(impression).length < 3
    ) {
      setStatusText("Add report description and impression before saving.");
      return null;
    }

    return {
      ...reportForm,
      title: reportForm.title.trim(),
      signedBy: reportForm.signedBy.trim(),
      medicalHistory: ensureRichTextHtml(reportForm.medicalHistory),
      summary: reportForm.summary.trim() || reportForm.title.trim(),
      findings,
      impression,
      imagePaths: reportImagePathsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    } satisfies ReportInput;
  }

  async function handlePreviewDraftReport(autoPrint = false) {
    const payload = buildPreparedReportPayload();
    if (!payload) {
      return;
    }

    const preview = openPreviewWindow(
      autoPrint
        ? "Popup blocked. Allow popups to print the report."
        : "Popup blocked. Allow popups to preview the report.",
      autoPrint ? "Preparing report for print" : "Preparing report preview",
    );
    if (!preview) {
      return;
    }

    try {
      const printable = await requestJson<PrintableReportPayload>(
        "/reports/preview",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      if (writePreviewWindow(preview, printable.html)) {
        if (autoPrint) {
          preview.focus();
          preview.print();
          setStatusText(`Opened printable draft ${payload.title}`);
        } else {
          setStatusText(`Opened preview for ${payload.title}`);
        }
      } else {
        setStatusText("Preview window was closed before the report loaded");
      }
    } catch {
      preview.close();
      setStatusText("Draft preview is unavailable right now");
    }
  }

  function applyReportTemplate(template: ReportTemplatePayload) {
    setReportForm((current) => ({
      ...current,
      templateKind: template.templateKind,
      title: template.title,
      medicalHistory: ensureRichTextHtml(template.medicalHistory),
      summary: template.summary,
      findings: ensureRichTextHtml(template.findings),
      impression: ensureRichTextHtml(template.impression),
    }));
    setUltrasoundReportAssist({
      ...defaultUltrasoundReportAssistState,
      ...template.assist,
    });
    setReportTemplateName(template.name);
    setStatusText(`Loaded report template ${template.name}`);
  }

  async function handleSaveReportTemplate() {
    const templateName = reportTemplateName.trim() || reportForm.title.trim();
    if (
      !templateName ||
      reportForm.summary.trim().length < 3 ||
      richTextToPlainText(reportForm.findings).length < 3
    ) {
      setStatusText(
        "Add a template name plus report summary/findings before saving the template.",
      );
      return;
    }

    try {
      const saved = await requestJson<ReportTemplatePayload>(
        "/report-templates",
        {
          method: "POST",
          body: JSON.stringify({
            name: templateName,
            templateKind: reportForm.templateKind,
            title: reportForm.title,
            medicalHistory: ensureRichTextHtml(reportForm.medicalHistory),
            summary: reportForm.summary,
            findings: ensureRichTextHtml(reportForm.findings),
            impression: ensureRichTextHtml(reportForm.impression),
            assist: ultrasoundReportAssist,
          } satisfies ReportTemplateInput),
        },
      );
      setReportTemplates((current) => {
        const remaining = current.filter((template) => template.id !== saved.id);
        return [saved, ...remaining];
      });
      setSelectedReportTemplateId(saved.id);
      setReportTemplateName(saved.name);
      setStatusText(`Saved report template ${saved.name}`);
    } catch {
      setStatusText("Report template could not be saved right now.");
    }
  }

  async function handleDeleteReportTemplate() {
    if (!selectedSavedReportTemplate) {
      setStatusText("Choose a saved template first.");
      return;
    }

    if (!window.confirm(`Delete template ${selectedSavedReportTemplate.name}?`)) {
      return;
    }

    try {
      await requestJson(`/report-templates/${selectedSavedReportTemplate.id}`, {
        method: "DELETE",
      });
      setReportTemplates((current) =>
        current.filter((template) => template.id !== selectedSavedReportTemplate.id),
      );
      setSelectedReportTemplateId("");
      setStatusText(`Deleted report template ${selectedSavedReportTemplate.name}`);
    } catch {
      setStatusText("Report template could not be deleted right now.");
    }
  }

  async function handleExportCurrentTemplateDocument() {
    const templateName = reportTemplateName.trim() || reportForm.title.trim();
    const descriptionHtml = ensureRichTextHtml(reportForm.findings);
    const impressionHtml = ensureRichTextHtml(reportForm.impression);
    const historyHtml = ensureRichTextHtml(reportForm.medicalHistory);

    if (!templateName || richTextToPlainText(descriptionHtml).length < 3) {
      setStatusText("Add a template name and document content before export.");
      return;
    }

    const facilityContact = [
      bootstrap.facility.location,
      bootstrap.facility.phone,
      bootstrap.facility.email,
    ]
      .filter(Boolean)
      .join(" · ");
    const wordHtml = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(templateName)}</title>
    <style>
      @page { size: A4; margin: 1.1cm; }
      body { font-family: Georgia, "Times New Roman", serif; color: #10233d; margin: 0; }
      .sheet { max-width: 780px; margin: 0 auto; }
      .brand { border-bottom: 2px solid #cbd5e1; padding-bottom: 14px; margin-bottom: 20px; }
      .brand h1 { margin: 0 0 6px; font-size: 26px; text-transform: uppercase; }
      .brand p { margin: 0; color: #475569; }
      .section { margin-bottom: 18px; }
      .section h2 { margin: 0 0 8px; font-size: 16px; text-transform: uppercase; text-decoration: underline; }
      .section h3 { margin: 0 0 8px; font-size: 14px; }
      .section p { margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #94a3b8; padding: 8px 10px; vertical-align: top; }
      th { background: #eff6ff; }
      img { max-width: 100%; height: auto; }
      mark { padding: 0.05rem 0.18rem; border-radius: 4px; }
      .editor-page-break { page-break-before: always; break-before: page; height: 0; border: 0; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <header class="brand">
        <h1>${escapeHtml(bootstrap.facility.name)}</h1>
        <p>${escapeHtml(templateName)}</p>
        ${facilityContact ? `<p>${escapeHtml(facilityContact)}</p>` : ""}
      </header>
      ${historyHtml ? `<section class="section"><h2>History</h2>${historyHtml}</section>` : ""}
      ${reportForm.summary.trim() ? `<section class="section"><h2>Summary</h2><p>${escapeHtml(reportForm.summary.trim())}</p></section>` : ""}
      <section class="section"><h2>Description</h2>${descriptionHtml}</section>
      ${impressionHtml ? `<section class="section"><h2>Impression</h2>${impressionHtml}</section>` : ""}
    </div>
  </body>
</html>`;

    try {
      const { asBlob } = await import("html-docx-js-typescript");
      const result = await asBlob(wordHtml, {
        margins: {
          top: 720,
          right: 720,
          bottom: 720,
          left: 720,
        },
      });
      const blob =
        result instanceof Blob
          ? result
          : new Blob([
              new Uint8Array(Array.from(result as unknown as Iterable<number>)),
            ], {
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });

      downloadBlobFile(
        blob,
        `${sanitizeDownloadName(templateName) || "report-template"}.docx`,
      );
      setStatusText(`Exported ${templateName} as a DOCX document`);
    } catch {
      setStatusText("DOCX export could not be completed right now.");
    }
  }

  async function handleImportReportTemplateFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) {
      return;
    }

    try {
      const lowerName = file.name.toLowerCase();
      let rawText = "";

      if (lowerName.endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        const workerModule = await import("pdfjs-dist/build/pdf.worker.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
        const document = await pdfjs.getDocument({
          data: await file.arrayBuffer(),
        }).promise;
        const pages: string[] = [];

        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          const textItems = content.items as Array<{ str?: string }>;
          pages.push(
            textItems.map((item) => item.str ?? "").join(" "),
          );
        }

        rawText = pages.join("\n\n");
      } else if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({
          arrayBuffer: await file.arrayBuffer(),
        });
        rawText = result.value;
      } else {
        throw new Error("Unsupported template file. Use PDF or Word format.");
      }

      const parsed = extractStructuredTemplateSections(rawText);
      setReportForm((current) => ({
        ...current,
        title: parsed.title || current.title,
        medicalHistory: parsed.medicalHistory
          ? plainTextToRichHtml(parsed.medicalHistory)
          : current.medicalHistory,
        summary: parsed.summary || current.summary,
        findings: parsed.findings
          ? plainTextToRichHtml(parsed.findings)
          : current.findings,
        impression: parsed.impression
          ? plainTextToRichHtml(parsed.impression)
          : current.impression,
      }));
      setUltrasoundReportAssist((current) => ({
        ...current,
        recommendation: parsed.recommendation || current.recommendation,
      }));
      setReportTemplateName(stripFileExtension(file.name));
      setStatusText(`Loaded template from ${file.name}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Template file could not be loaded.";
      setStatusText(message);
    } finally {
      event.target.value = "";
    }
  }

  async function handleSampleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSample) {
      setStatusText("Choose a specimen before updating its lifecycle");
      return;
    }

    try {
      await requestJson<SampleRecord>(`/samples/${selectedSample.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...sampleForm,
          collectedBy: sampleForm.collectedBy.trim() || actorName,
        } satisfies SampleUpdateInput),
      });
      await loadOperationalData();
      setStatusText(
        `${selectedSample.traceLabel} moved to ${formatStatusLabel(sampleForm.status)}`,
      );
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Specimen update failed. Retry when the server is available.",
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
      setStatusText(
        "Choose a sonography study before opening the scan report draft",
      );
      return;
    }

    const templateKind = resolveUltrasoundTemplate(
      selectedImagingStudy.serviceName,
    );
    const preset = ultrasoundTemplatePresets[templateKind];

    setSelectedPatientId(selectedImagingStudy.patientId);
    setReportPatientQuery(
      `${selectedImagingStudy.patientTraceCode} · ${selectedImagingStudy.patientName}`,
    );
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
      status:
        current.orderId === selectedImagingStudy.orderId ? current.status : "DRAFT",
      findings:
        current.orderId === selectedImagingStudy.orderId && current.findings
          ? current.findings
          : ensureRichTextHtml(preset.findingsStarter),
      impression:
        current.orderId === selectedImagingStudy.orderId && current.impression
          ? current.impression
          : ensureRichTextHtml(preset.impressionStarter),
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

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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

  function handlePrintPatientRecord() {
    if (!selectedPatient) {
      setStatusText("Choose a patient record before printing");
      return;
    }

    const preview = openPreviewWindow(
      "Popup blocked. Allow popups to print the patient record.",
      "Preparing patient record",
    );
    if (!preview) {
      return;
    }

    const patientTests = patientTestsById.get(selectedPatient.id) ?? [];
    const patientRecordLogoSrc =
      bootstrap.facility.logoDataUrl.trim() || logoSrc;
    const patientRecordTypographyCss =
      bootstrap.facility.printFontSize === "SMALL"
        ? "--print-body-size: 12px; --print-title-size: 24px; --print-section-title-size: 16px; --print-copy-size: 13px;"
        : bootstrap.facility.printFontSize === "LARGE"
          ? "--print-body-size: 16px; --print-title-size: 32px; --print-section-title-size: 20px; --print-copy-size: 16px;"
          : "--print-body-size: 14px; --print-title-size: 28px; --print-section-title-size: 18px; --print-copy-size: 14px;";
    const patientRecordContactLine = [
      bootstrap.facility.location,
      bootstrap.facility.phone,
      bootstrap.facility.email,
    ]
      .filter((value) => value.trim().length > 0)
      .join(" / ");
    const timelineMarkup = selectedPatientTimeline
      .map(
        (entry) => `
          <article class="timeline-item">
            <div>
              <strong>${escapeHtml(entry.label)}</strong>
              <span>${escapeHtml(entry.detail)}</span>
              <small>${escapeHtml(entry.meta)}</small>
            </div>
            <small>${escapeHtml(formatDate(entry.occurredAt))}</small>
          </article>`,
      )
      .join("");

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(selectedPatient.traceCode)} Patient Record</title>
    <style>
      :root { color-scheme: light; font-family: Georgia, "Times New Roman", serif; ${patientRecordTypographyCss} color: #1a1a1a; background: #f5f5f5; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 18px; color: #1f2a24; background: #f5f5f5; font-size: var(--print-body-size); }
      .sheet { max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #d7d7d7; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08); }
      .hero, .section { padding: 14px 24px; }
      .hero { border-bottom: 1px solid #d7d7d7; }
      .section { border-bottom: 1px solid #ececec; }
      .section:last-of-type { border-bottom: 0; }
      .brand-row { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
      .brand-main { display: flex; gap: 18px; align-items: flex-start; }
      .brand-logo { width: 72px; height: 72px; object-fit: contain; flex: 0 0 auto; }
      .brand-copy { display: grid; gap: 4px; }
      .brand-copy p, .brand-copy h1, .brand-copy h2 { margin: 0; }
      .facility-name { font-size: calc(var(--print-title-size) - 8px); font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
      .brand-copy p { font-size: var(--print-copy-size); }
      .brand-copy h2 { font-size: var(--print-title-size); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 6px; }
      .record-type { font-size: var(--print-copy-size); text-transform: uppercase; text-decoration: underline; margin-top: 2px; }
      .rule { margin-top: 10px; border-top: 2px solid #1f1f1f; }
      .brand-actions { display: grid; justify-items: end; gap: 12px; }
      .print-button { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; color: #1f1f1f; background: #f3f4f6; cursor: pointer; }
      .section h3 { margin: 0 0 8px; font-size: var(--print-section-title-size); text-transform: uppercase; text-decoration: underline; }
      .section-copy-title { margin: 0 0 8px; font-size: var(--print-title-size); }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; }
      .meta-grid strong, .timeline-item strong { display: block; }
      .meta-grid strong { font-size: 13px; text-transform: uppercase; }
      .timeline-item { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px solid #ecefed; }
      .timeline-item:first-child { border-top: 0; padding-top: 0; }
      .muted { color: #5c6b63; }
      @media (max-width: 720px) {
        .brand-row, .brand-main { flex-direction: column; }
        .brand-actions { justify-items: start; }
        .brand-logo { width: 60px; height: 60px; }
        .meta-grid { grid-template-columns: 1fr; }
      }
      @media print { .print-button { display: none; } body { padding: 0; background: #fff; } .sheet { border: 0; box-shadow: none; } .section { break-inside: avoid; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <section class="hero">
        <div class="brand-row">
          <div class="brand-main">
            <img class="brand-logo" src="${patientRecordLogoSrc}" alt="Facility logo" />
            <div class="brand-copy">
              <p class="facility-name">${escapeHtml(bootstrap.facility.name)}</p>
              ${patientRecordContactLine ? `<p>${escapeHtml(patientRecordContactLine)}</p>` : ""}
              <h2>${escapeHtml(selectedPatient.firstName)} ${escapeHtml(selectedPatient.lastName)}</h2>
              <p class="record-type">Patient Record</p>
              <div class="rule"></div>
            </div>
          </div>
          <div class="brand-actions">
            <button class="print-button" type="button" onclick="window.print()">Print patient record</button>
          </div>
        </div>
      </section>
      <section class="section">
        <h3>Patient details</h3>
        <div class="meta-grid">
          <div><strong>Trace code</strong><span>${escapeHtml(selectedPatient.traceCode)}</span></div>
          <div><strong>Phone</strong><span>${escapeHtml(selectedPatient.phone || "-")}</span></div>
          <div><strong>Gender</strong><span>${escapeHtml(selectedPatient.gender || "-")}</span></div>
          <div><strong>Location</strong><span>${escapeHtml(selectedPatient.location || "-")}</span></div>
          <div><strong>Date of birth</strong><span>${escapeHtml(selectedPatient.dateOfBirth || "-")}</span></div>
          <div><strong>NHIS ID</strong><span>${escapeHtml(selectedPatient.nhisId || "-")}</span></div>
          <div><strong>Referral</strong><span>${escapeHtml(selectedPatient.referralDoctorName || selectedPatient.referralName || "-")}</span></div>
        </div>
      </section>
      <section class="section">
        <h3>Tests and scans</h3>
        <p>${escapeHtml(patientTests.join(", ") || "No tests or scans ordered yet.")}</p>
      </section>
      <section class="section">
        <h3>Clinical notes</h3>
        <p><strong>Allergies</strong><br />${escapeHtml(selectedPatient.allergies || "No allergies recorded.")}</p>
        <p><strong>Medical history</strong><br />${escapeHtml(selectedPatient.medicalHistory || "No medical history recorded.")}</p>
      </section>
      <section class="section">
        <h3>Visit timeline</h3>
        ${timelineMarkup || '<p class="muted">No timeline activity recorded yet.</p>'}
      </section>
    </div>
  </body>
</html>`;

    if (writePreviewWindow(preview, html)) {
      setStatusText(
        `Opened printable patient record ${selectedPatient.traceCode}`,
      );
    } else {
      setStatusText(
        "Preview window was closed before the patient record loaded",
      );
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
        `/analytics/finance/printable?${buildAnalyticsQueryString(
          analyticsRange,
          analyticsCustomDateRange,
        )}`,
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
    const rangeLabel =
      financeAnalytics.range === "CUSTOM"
        ? `${analyticsCustomDateRange.startDate || "Start"} to ${analyticsCustomDateRange.endDate || "End"}`
        : analyticsRangeLabels[financeAnalytics.range];
    const rows = [
      ["Report Area", "Item", "Amount", "Count", "Notes"],
      [
        "Overview",
        "Range",
        rangeLabel,
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
      ...financeAnalytics.payerMix.map((item) => [
        "Payer mix",
        `${item.payerName} (${formatStatusLabel(item.payerType)})`,
        (item.coveredCents / 100).toFixed(2),
        String(item.invoicesCount),
        `Outstanding ${(item.outstandingCents / 100).toFixed(2)}`,
      ]),
      ...financeAnalytics.claimStatus.map((item) => [
        "Claim status",
        formatStatusLabel(item.claimStatus),
        (item.coveredCents / 100).toFixed(2),
        String(item.invoicesCount),
        `Outstanding ${(item.outstandingCents / 100).toFixed(2)}`,
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

    const amountCents = Math.round(Number(expenseForm.amount || "0") * 100);
    const refundTests = selectedRefundPatient
      ? (patientTestsById.get(selectedRefundPatient.id) ?? [])
      : [];

    if (expenseEntryType === "REFUND" && !selectedRefundPatient) {
      setStatusText("Choose the patient receiving the returned funds first");
      return;
    }

    const payload: ExpenseInput =
      expenseEntryType === "REFUND" && selectedRefundPatient
        ? {
            category: "Patient Refund",
            description: `Refund for ${selectedRefundPatient.traceCode} · ${selectedRefundPatient.firstName} ${selectedRefundPatient.lastName}`,
            amountCents,
            incurredAt: new Date(expenseForm.incurredAt).toISOString(),
            recordedBy: expenseForm.recordedBy,
            notes: [
              expenseForm.description.trim(),
              refundTests.length > 0 ? `Tests: ${refundTests.join(", ")}` : "",
              expenseForm.notes.trim(),
            ]
              .filter(Boolean)
              .join(" · "),
          }
        : {
            category: expenseForm.category,
            description: expenseForm.description,
            amountCents,
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
        category:
          expenseEntryType === "REFUND" ? "Patient Refund" : current.category,
        description: "",
        amount: "",
        notes: "",
      }));
      if (expenseEntryType === "REFUND") {
        setRefundPatientId("");
        setRefundPatientQuery("");
      }
      await loadOperationalData();
      await loadExpenseWorkspace();
      setStatusText(
        expenseEntryType === "REFUND"
          ? "Patient refund recorded and analytics refreshed"
          : "Expense recorded and expenses refreshed",
      );
    } catch {
      setStatusText(
        expenseEntryType === "REFUND"
          ? "Patient refund could not be recorded right now"
          : "Expense could not be recorded right now",
      );
    }
  }

  async function handleDeleteExpense(expenseId: string, description: string) {
    if (!window.confirm(`Delete expense ${description}?`)) {
      return;
    }

    try {
      await requestJson(`/finance/expenses/${expenseId}`, {
        method: "DELETE",
      });
      await loadOperationalData();
      await loadExpenseWorkspace();
      setStatusText(`Deleted expense ${description}`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Expense could not be deleted right now",
      );
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
    const confirmed = window.confirm(
      "Save these facility profile changes to receipts, reports, and other print surfaces?",
    );
    if (!confirmed) {
      setStatusText("Facility profile changes were not saved");
      return;
    }

    try {
      const updatedFacility = await requestJson<FacilityProfile>(
        "/admin/facility",
        {
          method: "PUT",
          body: JSON.stringify(facilityForm),
        },
      );
      setBootstrap((current) => ({
        ...current,
        facility: updatedFacility,
      }));
      setFacilityForm(updatedFacility);
      setStatusText("Facility profile saved");
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
    setServiceEditorOpen(false);
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

  function startNewServiceEditor() {
    setServiceEditorOpen(true);
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

  function startEditServiceEditor(serviceId: string) {
    setServiceEditorOpen(true);
    setSelectedServiceId(serviceId);
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

  async function handleDeleteService(service: CatalogSeedItem) {
    if (!service.id) {
      setStatusText("This service cannot be deleted yet.");
      return;
    }

    if (
      !window.confirm(
        `Delete ${service.name}? This only works when the service has not been used in workflow records.`,
      )
    ) {
      return;
    }

    try {
      await requestJson(`/admin/services/${service.id}`, {
        method: "DELETE",
      });
      if (selectedServiceId === service.id) {
        resetServiceEditor();
      }
      await loadOperationalData();
      setStatusText(`Deleted service ${service.name}`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Service could not be deleted right now",
      );
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
      setInventoryForm((current) => ({
        ...current,
        quantity: "1",
        reason: "",
        expiryDate: "",
        preferredVendor: "",
        storageLocation: "",
      }));
    } catch {
      setStatusText(
        "Inventory movement failed. Retry when the server is available.",
      );
    }
  }

  function applyStudyNotificationTemplate(
    template: "ARRIVAL_REMINDER" | "REPORT_READY",
  ) {
    if (!selectedImagingStudy) {
      setStatusText("Choose a sonography study before preparing a patient notice");
      return;
    }

    const schedule =
      selectedImagingStudy.scheduledAt?.slice(0, 16) ??
      notificationForm.scheduledFor;
    const message =
      template === "ARRIVAL_REMINDER"
        ? `Reminder: ${selectedImagingStudy.serviceName} for ${selectedImagingStudy.patientTraceCode} is scheduled${selectedImagingStudy.scheduledAt ? ` on ${formatDate(selectedImagingStudy.scheduledAt)}` : " soon"}. Please arrive 15 minutes early.`
        : `Your ${selectedImagingStudy.serviceName} report for ${selectedImagingStudy.patientTraceCode} is ready for review or collection. Please contact MediLab Nexus if you need assistance.`;

    setNotificationForm((current) => ({
      ...current,
      patientId: selectedImagingStudy.patientId,
      traceCode: selectedImagingStudy.patientTraceCode,
      scheduledFor: template === "ARRIVAL_REMINDER" ? schedule : "",
      message,
    }));
    setStatusText("Notification template prepared");
  }

  async function handleReportStatusTransition(
    report: ReportRecord,
    status: ReportStatusUpdateInput["status"],
  ) {
    try {
      await requestJson(`/reports/${report.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          signedBy: actorName,
        } satisfies ReportStatusUpdateInput),
      });
      await loadOperationalData();
      setStatusText(
        `${report.title} moved to ${formatStatusLabel(status)}`,
      );
    } catch {
      setStatusText("Report status change failed. Retry when the server is available.");
    }
  }

  async function handleClaimStatusUpdate(
    invoice: InvoiceRecord,
    claimStatus: InvoiceRecord["claimStatus"],
  ) {
    try {
      await requestJson(`/billing/invoices/${invoice.id}/claim`, {
        method: "PATCH",
        body: JSON.stringify({ claimStatus }),
      });
      await loadOperationalData();
      setStatusText(
        `${invoice.traceCode} claim moved to ${formatStatusLabel(claimStatus)}`,
      );
    } catch {
      setStatusText("Claim status update failed. Retry when the server is available.");
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
      setStatusText(
        payload.responsibility === "PAYER"
          ? "Payer remittance captured"
          : "Payment captured",
      );
      await handlePreviewReceipt(response.payment.id);
    } catch {
      setStatusText(
        "Payment could not be captured. Retry when the server is available.",
      );
    }
  }

  function handlePrepareInvoiceCollection(
    invoice: InvoiceRecord,
    amountCents = invoice.patientBalanceCents,
  ) {
    setPaymentForm((current) => ({
      ...current,
      invoiceId: invoice.id,
      amountCents,
      responsibility: "PATIENT",
      traceCode: invoice.traceCode,
    }));
    setLatestInvoiceId(invoice.id);
    setActiveNav("billing");
    setStatusText(
      `Prepared ${formatMoney(amountCents)} collection for ${invoice.traceCode}`,
    );
  }

  function handlePreparePayerRemittance(
    invoice: InvoiceRecord,
    amountCents = invoice.payerBalanceCents,
  ) {
    setPaymentForm((current) => ({
      ...current,
      invoiceId: invoice.id,
      amountCents,
      responsibility: "PAYER",
      method: "BANK_TRANSFER",
      reference: invoice.payerName ?? current.reference,
      traceCode: invoice.traceCode,
    }));
    setLatestInvoiceId(invoice.id);
    setActiveNav("billing");
    setStatusText(
      `Prepared ${formatMoney(amountCents)} payer remittance for ${invoice.traceCode}`,
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

  async function handleBackupExport() {
    if (!selectedBackupId) {
      setStatusText("Select a backup snapshot first");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/backups/${selectedBackupId}/download`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const payload = (await response.json()) as { message?: string };
          if (payload.message) {
            message = payload.message;
          }
        } catch {
          // Ignore non-JSON error bodies and use the status fallback.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/iu);
      const fileName = fileNameMatch?.[1] ?? "medilab-backup.enc";
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      setStatusText("Backup exported to file");
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "Backup export failed",
      );
    }
  }

  function handleBackupImportPrompt() {
    backupImportInputRef.current?.click();
  }

  async function handleBackupImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const snapshot = await requestJson<BackupRecord>("/admin/backups/import", {
        method: "POST",
        body: JSON.stringify({
          label: file.name.replace(/\.enc$/iu, ""),
          encryptedPayload: await file.text(),
        }),
      });
      setBackups((current) => [snapshot, ...current]);
      setSelectedBackupId(snapshot.id);
      setStatusText("Backup imported and ready to restore");
      await loadOperationalData();
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "Backup import failed",
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
      const { username } = userForm;
      setUserForm({
        username: "",
        displayName: "",
        role: "RECEPTION",
        pin: "",
      });
      await loadOperationalData();
      setStatusText(`Account ${username} created`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "User creation failed. Check duplicates or API availability.",
      );
    }
  }

  async function handleRecoverPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pinRecovery.userId) {
      setStatusText("Choose a user before recovering a PIN");
      return;
    }

    try {
      await requestJson(`/admin/users/${pinRecovery.userId}/rotate-pin`, {
        method: "POST",
        body: JSON.stringify({ newPin: pinRecovery.newPin }),
      });
      setPinRecovery({ userId: "", newPin: "" });
      await loadOperationalData();
      setStatusText("Recovery PIN updated and previous sessions revoked");
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "PIN recovery failed",
      );
    }
  }

  async function handleChangeOwnPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await requestJson("/auth/change-pin", {
        method: "POST",
        body: JSON.stringify(selfPinChange satisfies ChangeOwnPinInput),
      });
      setSelfPinChange({ currentPin: "", newPin: "" });
      await loadOperationalData();
      setStatusText("Your PIN was changed and previous sessions were revoked");
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "PIN change failed",
      );
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
            <span className={`sync-chip ${syncTone.tone}`}>
              {syncTone.label}
            </span>
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
                <div className="dashboard-stat-icon">
                  {metric.label.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <p>{metric.note}</p>
            </article>
          ))}
        </section>

        <section className="dashboard-feature-grid">
          <article className="surface-card dashboard-revenue-card">
            <span>Today&apos;s revenue</span>
            <strong>
              {formatMoney(adminOverview.finance.revenueTodayCents)}
            </strong>
            <p>
              Outstanding balances:{" "}
              {formatMoney(adminOverview.finance.outstandingCents)}
            </p>
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
                <p>
                  Latest workflow movement across requests, billing, and
                  reports.
                </p>
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
                <article
                  key={item.id}
                  className={`dashboard-activity-item tone-${item.tone}`}
                >
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
                Sonography intake through scan reporting with clear scheduling
                and release checkpoints.
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
      </section>
    </>
  );

  const patientRecordsPanel = (
    <article className="surface-card">
      <div className="section-head">
        <div>
          <h2>Patient records</h2>
          <p>
            All patient records in the lab, including their ordered tests and
            scan history.
          </p>
        </div>
      </div>
      <div className="form-grid">
        <label className="full-width">
          <span>Search patient records</span>
          <input
            value={patientRecordsQuery}
            onChange={(event) => setPatientRecordsQuery(event.target.value)}
            placeholder="Search by trace code, patient name, phone, or ordered test"
          />
        </label>
      </div>
      <div className="list-stack compact-scroll bordered-top">
        {filteredPatientRecords.length === 0 ? (
          <div className="list-row">
            <span>No patient records match that search.</span>
            <small>Try a trace code, patient name, or test name</small>
          </div>
        ) : null}
        {filteredPatientRecords.map((patient) => {
          const patientTests = patientTestsById.get(patient.id) ?? [];

          return (
            <button
              key={patient.id}
              type="button"
              className="list-row button-row"
              onClick={() => openPatient(patient, "patientRecords")}
            >
              <div>
                <strong>{patient.traceCode}</strong>
                <span>
                  {patient.firstName} {patient.lastName}
                </span>
                <small>
                  {patientTests.length > 0
                    ? patientTests.join(", ")
                    : "No tests or scans ordered yet"}
                </small>
              </div>
              <small>View record</small>
            </button>
          );
        })}
      </div>
      <div className="bordered-top patient-history-panel">
        <div className="section-head">
          <div>
            <h3>Selected patient record</h3>
            <p>
              Review the patient's tests, billing summary, and visit timeline.
            </p>
          </div>
        </div>
        {selectedPatient && selectedPatientHistorySummary ? (
          <div className="list-stack">
            <div className="summary-panel full-width">
              <span>Patient details</span>
              <strong>
                {selectedPatient.firstName}{" "}
                {selectedPatient.middleName
                  ? `${selectedPatient.middleName} `
                  : ""}
                {selectedPatient.lastName}
              </strong>
              <p className="muted-copy">
                {selectedPatient.traceCode} ·{" "}
                {selectedPatient.gender || "Gender not recorded"}
                {selectedPatient.dateOfBirth
                  ? ` · DOB ${selectedPatient.dateOfBirth}`
                  : ""}
                {selectedPatient.location
                  ? ` · ${selectedPatient.location}`
                  : ""}
                {selectedPatient.nhisId
                  ? ` · NHIS ${selectedPatient.nhisId}`
                  : ""}
              </p>
              <p className="muted-copy">
                {selectedPatient.allergies || selectedPatient.medicalHistory
                  ? [selectedPatient.allergies, selectedPatient.medicalHistory]
                      .filter(Boolean)
                      .join(" · ")
                  : "No allergies or medical history recorded yet."}
              </p>
              <div className="inline-actions">
                {canEditPatientRecords ? (
                  <button
                    type="button"
                    className="ghost-action small"
                    onClick={() =>
                      setIsEditingPatientRecord((current) => !current)
                    }
                  >
                    {isEditingPatientRecord ? "Close editor" : "Edit record"}
                  </button>
                ) : null}
                {canEditPatientRecords ? (
                  <button
                    type="button"
                    className="ghost-action small"
                    onClick={() => void handleDeletePatient()}
                  >
                    Delete patient
                  </button>
                ) : null}
                <button
                  type="button"
                  className="primary-action small"
                  onClick={handlePrintPatientRecord}
                >
                  Print record
                </button>
              </div>
            </div>
            {canEditPatientRecords && isEditingPatientRecord ? (
              <form
                className="form-grid bordered-top"
                onSubmit={handlePatientRecordUpdate}
              >
                <label>
                  <span>First name</span>
                  <input
                    value={patientRecordDraft.firstName}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Middle name</span>
                  <input
                    value={patientRecordDraft.middleName ?? ""}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        middleName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Last name</span>
                  <input
                    value={patientRecordDraft.lastName}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Trace code</span>
                  <input
                    value={patientRecordDraft.traceCode}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        traceCode: event.target.value.toUpperCase(),
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Gender</span>
                  <input
                    value={patientRecordDraft.gender ?? ""}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        gender: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Date of birth</span>
                  <input
                    type="date"
                    value={patientRecordDraft.dateOfBirth ?? ""}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        dateOfBirth: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Phone</span>
                  <input
                    value={patientRecordDraft.phone}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Location / Address</span>
                  <input
                    value={patientRecordDraft.location ?? ""}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>NHIS ID</span>
                  <input
                    value={patientRecordDraft.nhisId ?? ""}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        nhisId: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="full-width">
                  <span>Allergies</span>
                  <textarea
                    rows={3}
                    value={patientRecordDraft.allergies ?? ""}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        allergies: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="full-width">
                  <span>Medical history</span>
                  <textarea
                    rows={4}
                    value={patientRecordDraft.medicalHistory ?? ""}
                    onChange={(event) =>
                      setPatientRecordDraft((current) => ({
                        ...current,
                        medicalHistory: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="full-width inline-actions">
                  <button type="submit">Save patient record</button>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => {
                      setPatientRecordDraft(buildPatientDraft(selectedPatient));
                      setIsEditingPatientRecord(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
            <div className="history-summary-grid">
              <div className="summary-panel">
                <span>Tests and scans</span>
                <strong>
                  {(patientTestsById.get(selectedPatient.id) ?? []).length}
                </strong>
                <p className="muted-copy">
                  {(patientTestsById.get(selectedPatient.id) ?? []).join(
                    ", ",
                  ) || "No tests or scans ordered yet."}
                </p>
              </div>
              <div className="summary-panel">
                <span>Orders</span>
                <strong>{selectedPatientHistorySummary.orderCount}</strong>
                <p className="muted-copy">
                  Requests linked to this patient record.
                </p>
              </div>
              <div className="summary-panel">
                <span>Reports</span>
                <strong>{selectedPatientHistorySummary.reportCount}</strong>
                <p className="muted-copy">
                  Drafted or approved result documents.
                </p>
              </div>
              <div className="summary-panel">
                <span>Outstanding</span>
                <strong>
                  {formatMoney(
                    selectedPatientHistorySummary.outstandingBalanceCents,
                  )}
                </strong>
                <p className="muted-copy">
                  Current unpaid balance across patient invoices.
                </p>
              </div>
            </div>
            <div className="timeline-list compact-scroll">
              {selectedPatientTimeline.map((entry) => (
                <article
                  key={entry.id}
                  className={`timeline-item tone-${entry.tone}`}
                >
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
            Search or open a patient first to review the patient record.
          </p>
        )}
      </div>
      {showPatientIntakeTools ? (
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
      ) : null}
    </article>
  );

  const patientRecordsSection = (
    <section className="content-grid">
      {patientRecordsPanel}
    </section>
  );

  const patientSection = showPatientIntakeTools ? (
    <section className="content-grid">
      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Reception intake</h2>
            <p>
              Register the patient, assign a trace code when needed, attach
              requested services, collect payment, and open the receipt from one
              front-desk flow.
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
                <span>Location / Address</span>
                <input
                  value={patientForm.location ?? ""}
                  onChange={(event) =>
                    setPatientForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Town, district, or patient address"
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
            {registrationServiceQuery.trim() &&
            filteredRegistrationServices.length === 0 ? (
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
              <label>
                <span>Payer type</span>
                <select
                  value={intakeOrder.payerType}
                  onChange={(event) => {
                    const payerType = event.target.value as OrderInput["payerType"];
                    setIntakeOrder((current) => ({
                      ...current,
                      payerType,
                      insuranceAuthorized: payerType === "SELF_PAY" ? false : current.insuranceAuthorized,
                      insuranceProvider:
                        payerType === "SELF_PAY" ? "" : current.insuranceProvider,
                    }));
                  }}
                >
                  {payerTypes.map((type) => (
                    <option key={`intake-payer-${type}`} value={type}>
                      {formatStatusLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Payer name</span>
                <input
                  value={intakeOrder.payerName}
                  onChange={(event) =>
                    setIntakeOrder((current) => ({
                      ...current,
                      payerName: event.target.value,
                      insuranceProvider: event.target.value,
                    }))
                  }
                  placeholder="NHIS, insurer, or corporate sponsor"
                  disabled={intakeOrder.payerType === "SELF_PAY"}
                />
              </label>
              <label>
                <span>Coverage %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={intakeOrder.payerCoveragePercent}
                  onChange={(event) =>
                    setIntakeOrder((current) => ({
                      ...current,
                      payerCoveragePercent: Number(event.target.value),
                    }))
                  }
                  disabled={intakeOrder.payerType === "SELF_PAY"}
                />
              </label>
              <label>
                <span>Member ID</span>
                <input
                  value={intakeOrder.payerMemberId}
                  onChange={(event) =>
                    setIntakeOrder((current) => ({
                      ...current,
                      payerMemberId: event.target.value,
                    }))
                  }
                  disabled={intakeOrder.payerType === "SELF_PAY"}
                />
              </label>
              <label className="full-width">
                <span>Authorization code</span>
                <input
                  value={intakeOrder.payerAuthorizationCode}
                  onChange={(event) =>
                    setIntakeOrder((current) => ({
                      ...current,
                      payerAuthorizationCode: event.target.value,
                    }))
                  }
                  disabled={intakeOrder.payerType === "SELF_PAY"}
                />
              </label>
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
              {registrationItemIds.length > 0 && intakeOrder.payerType !== "SELF_PAY" ? (
                <p className="muted-copy">
                  {formatStatusLabel(intakeOrder.payerType)} covering {intakeOrder.payerCoveragePercent}% via {intakeOrder.payerName || "selected payer"}.
                </p>
              ) : null}
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
    </section>
  ) : (
    <section className="content-grid">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Patients</h2>
            <p>
              Intake tools are not available in this portal. Use Patient
              Records when you need the visit history, billing summary, or
              receipt reprints.
            </p>
          </div>
        </div>
      </article>
    </section>
  );

  const ordersSection = (
    <section className="content-grid admin-workspace-layout">
      <article className="surface-card form-card workspace-form-card">
        <div className="section-head">
          <div>
            <h2>Orders and requests</h2>
            <p>
              Ultrasound-first ordering with slot, sonographer, and prior-study
              context.
            </p>
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
            <span>Payer type</span>
            <select
              value={orderForm.payerType}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  payerType: event.target.value as OrderInput["payerType"],
                  insuranceAuthorized:
                    event.target.value === "SELF_PAY"
                      ? false
                      : current.insuranceAuthorized,
                  insuranceProvider:
                    event.target.value === "SELF_PAY"
                      ? ""
                      : current.insuranceProvider,
                }))
              }
            >
              {payerTypes.map((type) => (
                <option key={`order-payer-${type}`} value={type}>
                  {formatStatusLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Payer name</span>
            <input
              value={orderForm.payerName}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  payerName: event.target.value,
                  insuranceProvider: event.target.value,
                }))
              }
              disabled={orderForm.payerType === "SELF_PAY"}
            />
          </label>
          <label>
            <span>Coverage %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={orderForm.payerCoveragePercent}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  payerCoveragePercent: Number(event.target.value),
                }))
              }
              disabled={orderForm.payerType === "SELF_PAY"}
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
            <span>Member ID</span>
            <input
              value={orderForm.payerMemberId}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  payerMemberId: event.target.value,
                }))
              }
              disabled={orderForm.payerType === "SELF_PAY"}
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
            <span>Authorization code</span>
            <input
              value={orderForm.payerAuthorizationCode}
              onChange={(event) =>
                setOrderForm((current) => ({
                  ...current,
                  payerAuthorizationCode: event.target.value,
                }))
              }
              disabled={orderForm.payerType === "SELF_PAY"}
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

      <article className="surface-card workspace-table-card">
        <div className="section-head compact-head">
          <div>
            <h2>Request workspace</h2>
            <p>Search, filter, and review the live request stream from one table.</p>
          </div>
        </div>
        <div className="audit-log-toolbar">
          <label className="audit-log-search">
            <span>Search requests</span>
            <input
              value={orderSearchQuery}
              onChange={(event) => setOrderSearchQuery(event.target.value)}
              placeholder="Search trace code, patient, accession, or service"
            />
          </label>
          <div className="study-filter-row audit-log-filter-row">
            <div className="pill-filter-group">
              <button
                type="button"
                className={`pill-filter${selectedOrderStatus === "ALL" ? " active" : ""}`}
                onClick={() => setSelectedOrderStatus("ALL")}
              >
                All statuses
              </button>
              {orderStatusOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`pill-filter${selectedOrderStatus === status ? " active" : ""}`}
                  onClick={() => setSelectedOrderStatus(status)}
                >
                  {formatStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>
          <div className="audit-log-metrics">
            <div className="metric-mini audit-log-metric">
              <span>Visible requests</span>
              <strong>{filteredOrders.length}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Open requests</span>
              <strong>{openOrderCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Completed</span>
              <strong>{completedOrderCount}</strong>
            </div>
          </div>
        </div>
        {filteredOrders.length === 0 ? (
          <div className="chart-empty audit-log-empty-state">
            No requests match the current filters.
          </div>
        ) : (
          <div className="audit-log-table-shell compact-scroll admin-table-shell">
            <table className="audit-log-table admin-table">
              <thead>
                <tr>
                  <th>Trace Code</th>
                  <th>Patient</th>
                  <th>Accession</th>
                  <th>Services</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.patientTraceCode}</strong>
                    </td>
                    <td>{order.patientName}</td>
                    <td>
                      <span className="admin-table-subcopy">{order.accessionNumber}</span>
                    </td>
                    <td>{order.items.join(", ")}</td>
                    <td>
                      <small
                        className={`status-pill tone-${getOrderTone(order.status)}`}
                      >
                        {formatStatusLabel(order.status)}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );

  const trackingSection = (
    <section className="content-grid admin-workspace-layout">
      <article className="surface-card form-card workspace-form-card">
        <div className="section-head">
          <div>
            <h2>Specimen handoff</h2>
            <p>Update collection state, capture rejection reasons, and keep a short custody trail.</p>
          </div>
        </div>
        {selectedSample ? (
          <>
            <div className="summary-panel full-width">
              <div>
                <span>Selected specimen</span>
                <strong>
                  {selectedSample.patientTraceCode} · {selectedSample.specimenType}
                </strong>
                <p className="muted-copy">{selectedSample.traceLabel}</p>
              </div>
              <small className={`status-pill tone-${getSampleTone(selectedSample.status)}`}>
                {formatStatusLabel(selectedSample.status)}
              </small>
            </div>
            <form className="form-grid" onSubmit={handleSampleSubmit}>
              <label>
                <span>Specimen status</span>
                <select
                  value={sampleForm.status}
                  onChange={(event) =>
                    setSampleForm((current) => ({
                      ...current,
                      status: event.target.value as SampleUpdateInput["status"],
                    }))
                  }
                >
                  {sampleStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Handled by</span>
                <input
                  value={sampleForm.collectedBy}
                  onChange={(event) =>
                    setSampleForm((current) => ({
                      ...current,
                      collectedBy: event.target.value,
                    }))
                  }
                  placeholder="Collector or bench operator"
                />
              </label>
              <label className="full-width">
                <span>Rejection reason</span>
                <input
                  value={sampleForm.rejectionReason}
                  onChange={(event) =>
                    setSampleForm((current) => ({
                      ...current,
                      rejectionReason: event.target.value,
                    }))
                  }
                  placeholder="Required when the specimen is rejected"
                />
              </label>
              <label className="full-width">
                <span>Custody note</span>
                <textarea
                  rows={3}
                  value={sampleForm.note}
                  onChange={(event) =>
                    setSampleForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Collector note, storage note, or recollection instruction"
                />
              </label>
              <div className="full-width action-row">
                <button type="submit">Update specimen</button>
              </div>
            </form>
            <div className="bordered-top">
              <div className="section-head compact-head">
                <div>
                  <h3>Custody trail</h3>
                  <p>Most recent handoff events for this specimen.</p>
                </div>
              </div>
              <div className="list-stack compact-scroll">
                {selectedSample.chainOfCustody.length > 0 ? (
                  selectedSample.chainOfCustody.map((entry) => (
                    <div key={`${entry.at}-${entry.action}`} className="list-row">
                      <div>
                        <strong>{formatStatusLabel(entry.action)}</strong>
                        <span>{entry.actor}</span>
                        <small>{entry.note || "No note recorded"}</small>
                      </div>
                      <small>{formatDate(entry.at)}</small>
                    </div>
                  ))
                ) : (
                  <p className="section-note">No custody updates recorded yet.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="section-note">No specimens are in the workflow yet.</p>
        )}
      </article>

      <article className="surface-card workspace-table-card">
        <div className="section-head compact-head">
          <div>
            <h2>Sample tracking</h2>
            <p>Specimen lifecycle board with rejection, custody, and bench visibility.</p>
          </div>
        </div>
        <div className="audit-log-toolbar">
          <label className="audit-log-search">
            <span>Search specimens</span>
            <input
              value={sampleSearchQuery}
              onChange={(event) => setSampleSearchQuery(event.target.value)}
              placeholder="Search trace code, specimen, label, or handler"
            />
          </label>
          <div className="study-filter-row audit-log-filter-row">
            <div className="pill-filter-group">
              <button
                type="button"
                className={`pill-filter${selectedSampleStatus === "ALL" ? " active" : ""}`}
                onClick={() => setSelectedSampleStatus("ALL")}
              >
                All statuses
              </button>
              {sampleStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`pill-filter${selectedSampleStatus === status ? " active" : ""}`}
                  onClick={() => setSelectedSampleStatus(status)}
                >
                  {formatStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>
          <div className="audit-log-metrics">
            <div className="metric-mini audit-log-metric">
              <span>Visible specimens</span>
              <strong>{filteredSamples.length}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Pending or rejected</span>
              <strong>{pendingSampleCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Active on bench</span>
              <strong>{activeBenchSampleCount}</strong>
            </div>
          </div>
        </div>
        <div className="admin-split-panels">
          <div className="surface-subpanel">
            <div className="section-head compact-head">
              <div>
                <h3>Lifecycle board</h3>
                <p>Keep the lane view while focusing on the filtered specimens.</p>
              </div>
            </div>
            <div className="workflow-board">
              {specimenBoard.map((lane) => {
                const laneSamples = filteredSamples.filter((sample) =>
                  lane.statuses.includes(sample.status),
                );

                return (
                  <div key={lane.label} className="board-column">
                    <h3>{lane.label}</h3>
                    {laneSamples.length === 0 ? (
                      <p className="section-note">No specimens in this lane.</p>
                    ) : (
                      laneSamples.map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          className={`board-card button-row ${
                            selectedSample?.id === sample.id ? "selected-study" : ""
                          }`}
                          onClick={() => setSelectedSampleId(sample.id)}
                        >
                          <div>
                            <strong>{sample.patientTraceCode}</strong>
                            <span>{sample.specimenType}</span>
                            <small>{sample.traceLabel}</small>
                          </div>
                          <small
                            className={`status-pill tone-${getSampleTone(sample.status)}`}
                          >
                            {formatStatusLabel(sample.status)}
                          </small>
                        </button>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="surface-subpanel">
            <div className="section-head compact-head">
              <div>
                <h3>Specimen directory</h3>
                <p>Open any specimen directly into the handoff form.</p>
              </div>
            </div>
            {filteredSamples.length === 0 ? (
              <div className="chart-empty audit-log-empty-state">
                No specimens match the current filters.
              </div>
            ) : (
              <div className="audit-log-table-shell compact-scroll admin-table-shell">
                <table className="audit-log-table admin-table">
                  <thead>
                    <tr>
                      <th>Trace Code</th>
                      <th>Specimen</th>
                      <th>Label</th>
                      <th>Status</th>
                      <th>Handled By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSamples.map((sample) => (
                      <tr key={sample.id}>
                        <td>
                          <strong>{sample.patientTraceCode}</strong>
                        </td>
                        <td>{sample.specimenType}</td>
                        <td>{sample.traceLabel}</td>
                        <td>
                          <small className={`status-pill tone-${getSampleTone(sample.status)}`}>
                            {formatStatusLabel(sample.status)}
                          </small>
                        </td>
                        <td>{sample.collectedBy || "Unassigned"}</td>
                        <td>
                          <div className="inline-actions admin-table-actions">
                            <button
                              type="button"
                              className="ghost-action small"
                              onClick={() => setSelectedSampleId(sample.id)}
                            >
                              {selectedSample?.id === sample.id ? "Open" : "Select"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
              Scheduled ultrasound scans with slot time, assigned staff, and
              immediate scan reporting context.
            </p>
          </div>
        </div>
        <div className="history-summary-grid sonography-summary-grid">
          <div className="summary-panel">
            <span>Scheduled</span>
            <strong>
              {
                sonographyStudies.filter(
                  (study) => study.appointmentStatus === "SCHEDULED",
                ).length
              }
            </strong>
            <p className="muted-copy">Patients still expected today.</p>
          </div>
          <div className="summary-panel">
            <span>Scanning</span>
            <strong>
              {
                sonographyStudies.filter(
                  (study) => study.appointmentStatus === "SCANNING",
                ).length
              }
            </strong>
            <p className="muted-copy">Studies currently on the bench.</p>
          </div>
          <div className="summary-panel">
            <span>Ready to report</span>
            <strong>
              {
                sonographyStudies.filter(
                  (study) =>
                    study.appointmentStatus === "REPORTED" ||
                    study.appointmentStatus === "COMPLETED",
                ).length
              }
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
              Assign staff, confirm the appointment slot, and hand the study off
              to scan reports.
            </p>
          </div>
        </div>
        {selectedImagingStudy ? (
          <form className="form-grid" onSubmit={handleSonographyDeskSubmit}>
            <div className="summary-panel full-width">
              <span>Active study</span>
              <strong>
                {selectedImagingStudy.patientTraceCode} ·{" "}
                {selectedImagingStudy.serviceName}
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
              <button
                type="button"
                className="ghost-action"
                onClick={openUltrasoundReportDraft}
              >
                Open scan report draft
              </button>
            </div>
          </form>
        ) : (
          <p className="section-note">
            Select an ultrasound study from the worklist to assign staff and
            slot time.
          </p>
        )}
        <div className="bordered-top">
          <div className="section-head">
            <div>
              <h3>Patient notice</h3>
              <p>
                Queue WhatsApp, SMS, or email updates straight from the scan
                desk.
              </p>
            </div>
          </div>
          <div className="inline-actions template-action-row">
            <button
              type="button"
              className="ghost-action small"
              onClick={() => applyStudyNotificationTemplate("ARRIVAL_REMINDER")}
            >
              Arrival reminder
            </button>
            <button
              type="button"
              className="ghost-action small"
              onClick={() => applyStudyNotificationTemplate("REPORT_READY")}
            >
              Report ready notice
            </button>
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
    <section className="content-grid">
      {canWriteReports ? (
        <article className="surface-card form-card report-compose-card">
          <div className="section-head">
            <div>
              <h2>Scan Reports</h2>
              <p>
                Full-screen scan reporting with live preview and print while
                you type.
              </p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleReportSubmit}>
            <label className="full-width">
              <span>Search patient or trace code</span>
              <input
                value={reportPatientQuery}
                onChange={(event) => setReportPatientQuery(event.target.value)}
                placeholder="Search by patient name or trace code"
                disabled={!canWriteReports}
              />
            </label>
            <label>
              <span>Patient</span>
              <select
                value={reportForm.patientId}
                onChange={(event) => {
                  const nextPatient = patients.find(
                    (patient) => patient.id === event.target.value,
                  );

                  setReportForm((current) => ({
                    ...current,
                    patientId: event.target.value,
                  }));
                  setReportPatientQuery(
                    nextPatient
                      ? `${nextPatient.traceCode} · ${nextPatient.firstName} ${nextPatient.lastName}`
                      : "",
                  );
                }}
                disabled={!canWriteReports}
              >
                <option value="">Select patient</option>
                {filteredReportPatients.map((patient) => (
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
                {reportOrdersForSelectedPatient.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.patientTraceCode} · {order.accessionNumber} ·{" "}
                    {order.items.join(", ")}
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
                    templateKind: event.target
                      .value as ReportInput["templateKind"],
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
              <span>Saved template</span>
              <select
                value={selectedReportTemplateId}
                onChange={(event) =>
                  setSelectedReportTemplateId(event.target.value)
                }
                disabled={!canWriteReports}
              >
                <option value="">Choose saved template</option>
                {reportTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · {reportTemplateLabels[template.templateKind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Template name</span>
              <input
                value={reportTemplateName}
                onChange={(event) => setReportTemplateName(event.target.value)}
                placeholder="Abdominal normal study"
                disabled={!canWriteReports}
              />
            </label>
            <div className="summary-panel full-width template-library-panel">
              <div className="template-library-copy">
                <span className="eyebrow">Reusable templates</span>
                <strong>Save a scan or test template and load it any time</strong>
                <p>
                  Load a saved template, import one from your device, or save
                  the current report for reuse.
                </p>
              </div>
              <input
                ref={reportTemplateFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(event) => void handleImportReportTemplateFile(event)}
                disabled={!canWriteReports}
              />
              <div className="template-library-actions">
                <button
                  type="button"
                  className="ghost-action small"
                  onClick={() =>
                    selectedSavedReportTemplate
                      ? applyReportTemplate(selectedSavedReportTemplate)
                      : setStatusText("Choose a saved template first.")
                  }
                  disabled={!canWriteReports}
                >
                  Load template
                </button>
                <button
                  type="button"
                  className="ghost-action small"
                  onClick={() => reportTemplateFileInputRef.current?.click()}
                  disabled={!canWriteReports}
                >
                  Load from drive
                </button>
                <button
                  type="button"
                  className="ghost-action small"
                  onClick={() => void handleSaveReportTemplate()}
                  disabled={!canWriteReports}
                >
                  Save current as template
                </button>
                <button
                  type="button"
                  className="ghost-action small"
                  onClick={handleExportCurrentTemplateDocument}
                  disabled={!canWriteReports}
                >
                  Export DOCX file
                </button>
                <button
                  type="button"
                  className="ghost-action small"
                  onClick={() => void handleDeleteReportTemplate()}
                  disabled={!canWriteReports || !selectedSavedReportTemplate}
                >
                  Delete template
                </button>
              </div>
            </div>
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
            <label>
              <span>Workflow status</span>
              <select
                value={reportForm.status}
                onChange={(event) =>
                  setReportForm((current) => ({
                    ...current,
                    status: event.target.value as ReportInput["status"],
                  }))
                }
                disabled={!canWriteReports}
              >
                {reportStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            {isUltrasoundTemplate(reportForm.templateKind) &&
            selectedReportImagingStudy ? (
              <div className="summary-panel full-width">
                <span>
                  {reportTemplateLabels[reportForm.templateKind]} study context
                </span>
                <strong>
                  {selectedReportImagingStudy.patientTraceCode} ·{" "}
                  {selectedReportImagingStudy.serviceName}
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
                      updateUltrasoundAssistField(
                        "technique",
                        event.target.value,
                      )
                    }
                    placeholder={
                      selectedUltrasoundTemplatePreset?.techniquePlaceholder
                    }
                    disabled={!canWriteReports}
                  />
                </label>
              </>
            ) : null}
            <Suspense fallback={<RichTextEditorFallback label="History" />}>
              <RichTextEditor
                label="History"
                value={ensureRichTextHtml(reportForm.medicalHistory)}
                onChange={(value) =>
                  setReportForm((current) => ({
                    ...current,
                    medicalHistory: value,
                  }))
                }
                placeholder="Type the clinical history for this scan report"
                disabled={!canWriteReports}
              />
            </Suspense>
            <Suspense fallback={<RichTextEditorFallback label="Description" />}>
              <RichTextEditor
                label="Description"
                value={ensureRichTextHtml(reportForm.findings)}
                onChange={(value) =>
                  setReportForm((current) => ({
                    ...current,
                    findings: value,
                  }))
                }
                placeholder="Type or paste the report description here, then format it as needed"
                disabled={!canWriteReports}
                documentMode
              />
            </Suspense>
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
                        updateUltrasoundAssistField(
                          field.key,
                          event.target.value,
                        )
                      }
                      placeholder={field.placeholder}
                      disabled={!canWriteReports}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <Suspense fallback={<RichTextEditorFallback label="Impression" />}>
              <RichTextEditor
                label="Impression"
                value={ensureRichTextHtml(reportForm.impression)}
                onChange={(value) =>
                  setReportForm((current) => ({
                    ...current,
                    impression: value,
                  }))
                }
                placeholder="Summarize the report impression"
                disabled={!canWriteReports}
              />
            </Suspense>
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
                onChange={(event) =>
                  setReportImagePathsText(event.target.value)
                }
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
              <button
                type="button"
                className="ghost-action"
                onClick={() => void handlePreviewDraftReport(false)}
                disabled={!canWriteReports}
              >
                Preview draft
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => void handlePreviewDraftReport(true)}
                disabled={!canWriteReports}
              >
                Print draft
              </button>
              <button type="submit" disabled={!canWriteReports}>
                Save report
              </button>
            </div>
          </form>
        </article>
      ) : (
        <article className="surface-card report-pickup-card">
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
          <div className="list-stack">
            {pickupReports.length === 0 ? (
              <div className="chart-empty audit-log-empty-state">
                No finished reports are ready for reception pickup yet.
              </div>
            ) : (
              pickupReports.map((report) => (
                <div key={report.id} className="report-card-row">
                  <div>
                    <strong>{report.title}</strong>
                    <span>
                      {report.patientTraceCode} · {formatDate(report.createdAt)}
                    </span>
                  </div>
                  <div className="inline-actions">
                    <small className={`status-pill tone-${getOrderTone(report.status)}`}>
                      {formatStatusLabel(report.status)}
                    </small>
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
              ))
            )}
          </div>
        </article>
      )}
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
          <label>
            <span>Expiry date</span>
            <input
              type="date"
              value={inventoryForm.expiryDate}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  expiryDate: event.target.value,
                }))
              }
              disabled={!canManageInventory}
            />
          </label>
          <label>
            <span>Preferred vendor</span>
            <input
              value={inventoryForm.preferredVendor}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  preferredVendor: event.target.value,
                }))
              }
              disabled={!canManageInventory}
            />
          </label>
          <label className="full-width">
            <span>Storage location</span>
            <input
              value={inventoryForm.storageLocation}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  storageLocation: event.target.value,
                }))
              }
              placeholder="Cold room, shelf, cabinet, or bench location"
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
                      {formatStatusLabel(invoice.payerType)}
                      {invoice.payerName ? ` · ${invoice.payerName}` : ""}
                      {invoice.payerType !== "SELF_PAY"
                        ? ` · Claim ${formatStatusLabel(invoice.claimStatus)}`
                        : ""}
                    </small>
                    <small>
                      Patient {formatMoney(invoice.patientPaidCents)} of {formatMoney(invoice.patientResponsibilityCents)} · Payer {formatMoney(invoice.payerPaidCents)} of {formatMoney(invoice.payerResponsibilityCents)}
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
                    {invoice.payerType !== "SELF_PAY" ? (
                      <select
                        value={invoice.claimStatus}
                        onChange={(event) =>
                          void handleClaimStatusUpdate(
                            invoice,
                            event.target.value as InvoiceRecord["claimStatus"],
                          )
                        }
                        disabled={!canManageFinance}
                      >
                        {claimStatuses.map((status) => (
                          <option key={`${invoice.id}-${status}`} value={status}>
                            {formatStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {invoice.patientBalanceCents > 0 ? (
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
                      {formatStatusLabel(invoice.payerType)}
                      {invoice.payerName ? ` · ${invoice.payerName}` : ""}
                      {invoice.payerType !== "SELF_PAY"
                        ? ` · Claim ${formatStatusLabel(invoice.claimStatus)}`
                        : ""}
                    </small>
                    <small>
                      Patient outstanding {formatMoney(invoice.patientBalanceCents)} of{" "}
                      {formatMoney(invoice.patientResponsibilityCents)}
                    </small>
                  </div>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="ghost-action small"
                      onClick={() =>
                        handlePrepareInvoiceCollection(
                          invoice,
                          invoice.patientBalanceCents,
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

        <div className="bordered-top">
          <div className="section-head">
            <div>
              <h3>Claims worklist</h3>
              <p>Filter third-party invoices by payer type and current claim state.</p>
            </div>
          </div>
          <div className="metric-cluster">
            <div className="metric-mini">
              <span>Claims in view</span>
              <strong>{filteredClaimSummary.invoicesCount}</strong>
            </div>
            <div className="metric-mini">
              <span>Covered value</span>
              <strong>{formatMoney(filteredClaimSummary.coveredCents)}</strong>
            </div>
            <div className="metric-mini">
              <span>Pending action</span>
              <strong>{filteredClaimSummary.pendingCount}</strong>
            </div>
            <div className="metric-mini">
              <span>Settled claims</span>
              <strong>{filteredClaimSummary.settledCount}</strong>
            </div>
          </div>
          <div className="form-grid bordered-top">
            <label>
              <span>Payer type</span>
              <select
                value={billingPayerTypeFilter}
                onChange={(event) =>
                  setBillingPayerTypeFilter(
                    event.target.value as "ALL" | InvoiceRecord["payerType"],
                  )
                }
              >
                <option value="ALL">All third-party payers</option>
                {payerTypes
                  .filter((type) => type !== "SELF_PAY")
                  .map((type) => (
                    <option key={`billing-payer-${type}`} value={type}>
                      {formatStatusLabel(type)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Claim status</span>
              <select
                value={billingClaimStatusFilter}
                onChange={(event) =>
                  setBillingClaimStatusFilter(
                    event.target.value as "ALL" | InvoiceRecord["claimStatus"],
                  )
                }
              >
                <option value="ALL">All claim states</option>
                {claimStatuses
                  .filter((status) => status !== "NOT_APPLICABLE")
                  .map((status) => (
                    <option key={`billing-claim-${status}`} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="list-stack compact-scroll">
            {filteredClaimInvoices.length === 0 ? (
              <div className="list-row user-admin-row">
                <div>
                  <strong>No claims match the current filters</strong>
                  <span>Try a broader payer type or claim status selection.</span>
                </div>
              </div>
            ) : null}
            {filteredClaimInvoices.slice(0, 8).map((invoice) => (
              <div key={`claim-${invoice.id}`} className="list-row user-admin-row">
                <div>
                  <strong>{invoice.traceCode}</strong>
                  <span>
                    {invoice.payerName || formatStatusLabel(invoice.payerType)} · {formatStatusLabel(invoice.claimStatus)}
                  </span>
                  <small>
                    Covered {formatMoney(invoice.payerResponsibilityCents)} · Remittance outstanding {formatMoney(invoice.payerBalanceCents)}
                  </small>
                </div>
                <div className="inline-actions">
                  <small>{invoice.accessionNumber}</small>
                  {invoice.payerBalanceCents > 0 ? (
                    <button
                      type="button"
                      className="primary-action small"
                      onClick={() => handlePreparePayerRemittance(invoice)}
                      disabled={!canManageFinance}
                    >
                      Prepare remittance
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost-action small"
                    onClick={() => handlePreviewInvoice(invoice.id)}
                    disabled={!canManageFinance}
                  >
                    Print invoice
                  </button>
                </div>
              </div>
            ))}
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
            <span>Applied to</span>
            <select
              value={paymentForm.responsibility}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  responsibility:
                    event.target.value as PaymentInput["responsibility"],
                  method:
                    event.target.value === "PAYER"
                      ? "BANK_TRANSFER"
                      : current.method === "BANK_TRANSFER"
                        ? "CASH"
                        : current.method,
                }))
              }
              disabled={!canManageFinance}
            >
              {paymentResponsibilities.map((responsibility) => (
                <option key={responsibility} value={responsibility}>
                  {formatStatusLabel(responsibility)}
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

  const analyticsRangeSummaryLabel =
    financeAnalytics.range === "CUSTOM"
      ? `${analyticsCustomDateRange.startDate || "Start"} to ${analyticsCustomDateRange.endDate || "End"}`
      : analyticsRangeLabels[financeAnalytics.range];
  const analyticsFacilityName =
    bootstrap.facility.name.trim() || "Facility";

  const analyticsSection = (
    <section className="content-grid">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>{analyticsFacilityName} financial overview</h2>
            <p>
              Six core figures for revenue, profit, expenses, collections,
              payer cover, and referral obligations.
            </p>
            <div className="inline-actions">
              {analyticsQuickRangeKeys.map((rangeKey) => (
                <button
                  key={rangeKey}
                  type="button"
                  onClick={() => setAnalyticsRange(rangeKey)}
                  disabled={analyticsRange === rangeKey}
                >
                  {analyticsRangeLabels[rangeKey]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAnalyticsRange("CUSTOM")}
                disabled={analyticsRange === "CUSTOM"}
              >
                {analyticsRangeLabels.CUSTOM}
              </button>
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
        {analyticsRange === "CUSTOM" ? (
          <div className="inline-form-grid two-up">
            <label>
              <span>Start date</span>
              <input
                type="date"
                value={analyticsCustomDateRange.startDate}
                onChange={(event) =>
                  setAnalyticsCustomDateRange((current) => ({
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
                value={analyticsCustomDateRange.endDate}
                onChange={(event) =>
                  setAnalyticsCustomDateRange((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        ) : null}
        <p className="section-note">
          Range: {analyticsRangeSummaryLabel} · Generated{" "}
          {new Date(financeAnalytics.generatedAt).toLocaleString()}
        </p>
        <div className="metric-cluster">
          <div className="metric-mini">
            <span>Revenue</span>
            <strong>
              {formatMoney(financeAnalytics.summary.grossBilledCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Profit</span>
            <strong>
              {formatMoney(financeAnalytics.summary.netProfitCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Expenses</span>
            <strong>
              {formatMoney(financeAnalytics.summary.expenseCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Collected</span>
            <strong>
              {formatMoney(financeAnalytics.summary.collectedCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Payer cover</span>
            <strong>
              {formatMoney(financeAnalytics.summary.insuranceCoveredCents)}
            </strong>
          </div>
          <div className="metric-mini">
            <span>Referral payments</span>
            <strong>
              {formatMoney(financeAnalytics.summary.referralCommissionDueCents)}
            </strong>
          </div>
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>Tests and services</h2>
            <p>
              Revenue generated by the studies and services billed in the
              selected date window.
            </p>
          </div>
        </div>
        <p className="section-note">Range: {analyticsRangeSummaryLabel}</p>
        <div className="list-stack compact-scroll">
          {financeAnalytics.topServices.length === 0 ? (
            <div className="list-row user-admin-row">
              <div>
                <strong>No services billed in range</strong>
                <span>
                  Revenue by test or service will appear after invoices are
                  posted in this period.
                </span>
              </div>
            </div>
          ) : null}
          {financeAnalytics.topServices.map((service) => (
            <div key={service.description} className="list-row user-admin-row">
              <div>
                <strong>{service.description}</strong>
                <span>
                  {service.quantity} service item(s) · {service.invoicesCount} invoice(s)
                </span>
              </div>
              <small>{formatMoney(service.revenueCents)}</small>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>User performance</h2>
            <p>
              Amount generated by each user in the same reporting range,
              alongside expense and activity impact.
            </p>
          </div>
        </div>
        <p className="section-note">Range: {analyticsRangeSummaryLabel}</p>
        <div className="list-stack compact-scroll">
          {financeAnalytics.userPerformance.length === 0 ? (
            <div className="list-row user-admin-row">
              <div>
                <strong>No user activity in range</strong>
                <span>
                  User performance will appear after collections, expenses, or
                  inventory actions are recorded.
                </span>
              </div>
            </div>
          ) : null}
          {financeAnalytics.userPerformance.map((entry) => (
            <div key={entry.actorName} className="list-row user-admin-row">
              <div>
                <strong>{entry.actorName}</strong>
                <span>
                  Generated {formatMoney(entry.generatedCents)} · Net{" "}
                  {formatMoney(entry.netCents)}
                </span>
                <small>
                  {entry.paymentsCount} payment(s) · {entry.expensesCount} expense entry(ies) · {entry.inventoryActions} inventory action(s)
                </small>
              </div>
              <small>{formatMoney(entry.generatedCents)}</small>
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
              Record day-to-day expenses like utilities, transport, consumables,
              or maintenance from one front-desk page.
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
        <form
          className="form-grid"
          onSubmit={(event) => event.preventDefault()}
        >
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
            <span>Entry type</span>
            <select
              value={expenseEntryType}
              onChange={(event) =>
                setExpenseEntryType(event.target.value as "EXPENSE" | "REFUND")
              }
            >
              <option value="EXPENSE">Expense</option>
              <option value="REFUND">Patient refund</option>
            </select>
          </label>
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
              disabled={expenseEntryType === "REFUND"}
              required
            />
          </label>
          {expenseEntryType === "REFUND" ? (
            <>
              <label className="full-width">
                <span>Search patient or trace code</span>
                <input
                  value={refundPatientQuery}
                  onChange={(event) =>
                    setRefundPatientQuery(event.target.value)
                  }
                  placeholder="Search by patient name or trace code"
                  required
                />
              </label>
              <label className="full-width">
                <span>Patient receiving funds</span>
                <select
                  value={refundPatientId}
                  onChange={(event) => setRefundPatientId(event.target.value)}
                  required
                >
                  <option value="">Select patient</option>
                  {refundPatientMatches.map((patient) => (
                    <option key={`refund-${patient.id}`} value={patient.id}>
                      {patient.traceCode} · {patient.firstName}{" "}
                      {patient.lastName}
                    </option>
                  ))}
                </select>
              </label>
              {selectedRefundPatient ? (
                <div className="summary-panel full-width">
                  <span>Patient refund context</span>
                  <strong>
                    {selectedRefundPatient.traceCode} ·{" "}
                    {selectedRefundPatient.firstName}{" "}
                    {selectedRefundPatient.lastName}
                  </strong>
                  <p className="muted-copy">
                    {(
                      patientTestsById.get(selectedRefundPatient.id) ?? []
                    ).join(", ") || "No tests or scans ordered yet."}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
          <label>
            <span>
              {expenseEntryType === "REFUND" ? "Refund reason" : "Description"}
            </span>
            <input
              value={expenseForm.description}
              onChange={(event) =>
                setExpenseForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder={
                expenseEntryType === "REFUND"
                  ? "Reason for returning funds"
                  : "Generator fuel top-up"
              }
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
            <p>The latest expense entries that match the current filters.</p>
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
              <div className="inline-actions">
                <small>{formatMoney(expense.amountCents)}</small>
                <button
                  type="button"
                  className="ghost-action small"
                  onClick={() =>
                    void handleDeleteExpense(expense.id, expense.description)
                  }
                  disabled={!canManageFinance}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );

  const servicesSection = (
    <section className="content-grid">
      <article className="surface-card workspace-table-card">
        <div className="section-head compact-head">
          <div>
            <h2>Services and tests</h2>
            <p>
              Review the catalog, filter services or tests, and open the editor only when you need to add or update one.
            </p>
          </div>
          {canManageServices ? (
            <div className="inline-actions">
              <button type="button" onClick={startNewServiceEditor}>
                Add new service or test
              </button>
            </div>
          ) : null}
        </div>
        {serviceEditorOpen ? (
          <div className="bordered-top">
            <div className="section-head stacked-head">
              <div>
                <h3>{selectedServiceId ? "Edit service or test" : "Add service or test"}</h3>
                <p>
                  Enter the code, type, pricing, and turnaround time, then save it to the live catalog.
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
                  {selectedServiceId ? "Update service" : "Save new service"}
                </button>
                <button
                  type="button"
                  className="ghost-action"
                  onClick={resetServiceEditor}
                  disabled={!canManageServices}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}
        <div className="audit-log-toolbar">
          <label className="audit-log-search">
            <span>Search services</span>
            <input
              value={serviceSearchQuery}
              onChange={(event) => setServiceSearchQuery(event.target.value)}
              placeholder="Search code, service name, modality, or specimen"
            />
          </label>
          <div className="study-filter-row audit-log-filter-row">
            <div className="pill-filter-group">
              {([
                { key: "ALL", label: "All types" },
                { key: "TEST", label: "Lab tests" },
                { key: "IMAGING", label: "Imaging" },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`pill-filter${selectedServiceKind === option.key ? " active" : ""}`}
                  onClick={() => setSelectedServiceKind(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="pill-filter-group">
              {([
                { key: "ALL", label: "All states" },
                { key: "ACTIVE", label: "Active" },
                { key: "ARCHIVED", label: "Archived" },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`pill-filter${selectedServiceState === option.key ? " active" : ""}`}
                  onClick={() => setSelectedServiceState(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="audit-log-metrics">
            <div className="metric-mini audit-log-metric">
              <span>Visible services</span>
              <strong>{filteredServiceRows.length}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Active services</span>
              <strong>{activeServiceCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Imaging services</span>
              <strong>{imagingServiceCount}</strong>
            </div>
          </div>
        </div>
        {filteredServiceRows.length === 0 ? (
          <div className="chart-empty audit-log-empty-state">
            No services match the current filters.
          </div>
        ) : (
          <div className="audit-log-table-shell compact-scroll admin-table-shell">
            <table className="audit-log-table admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>TAT</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServiceRows.map((service) => (
                  <tr key={service.id ?? service.code}>
                    <td>
                      <strong>{service.name}</strong>
                      <div className="admin-table-subcopy">
                        {service.kind === "IMAGING"
                          ? service.modality ?? "Imaging"
                          : service.specimenType ?? "Lab test"}
                      </div>
                    </td>
                    <td>{service.code}</td>
                    <td>{service.kind === "IMAGING" ? "Imaging" : "Lab test"}</td>
                    <td>{formatMoney(service.priceCents)}</td>
                    <td>{service.tatMinutes} min</td>
                    <td>
                      <span
                        className={`tag ${service.isActive === false ? "tag-critical" : "tag-good"}`}
                      >
                        {service.isActive === false ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td>
                      <div className="inline-actions admin-table-actions">
                        <button
                          type="button"
                          className="ghost-action small"
                          onClick={() =>
                            service.id
                              ? startEditServiceEditor(service.id)
                              : setStatusText("This service cannot be edited yet.")
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-action small"
                          onClick={() => handleToggleServiceActive(service)}
                          disabled={!canManageServices}
                        >
                          {service.isActive === false ? "Reactivate" : "Archive"}
                        </button>
                        <button
                          type="button"
                          className="ghost-action small"
                          onClick={() => void handleDeleteService(service)}
                          disabled={!canManageServices}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
      currentUsername={authSession?.user.username ?? ""}
      userForm={userForm}
      setUserForm={setUserForm}
      passwordVisibility={passwordVisibility}
      togglePasswordVisibility={togglePasswordVisibility}
      handleUserCreate={handleUserCreate}
      pinRecovery={pinRecovery}
      setPinRecovery={setPinRecovery}
      handleRecoverPin={handleRecoverPin}
      selfPinChange={selfPinChange}
      setSelfPinChange={setSelfPinChange}
      handleChangeOwnPin={handleChangeOwnPin}
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
      canEditPrintSettings={canEditPrintSettings}
      logoSrc={logoSrc}
      fallbackFacilityName={bootstrap.facility.name}
      canManageBackups={canManageBackups}
      canManageIntegrations={canManageIntegrations}
      handleBackupCreate={handleBackupCreate}
      handleBackupExport={handleBackupExport}
      handleBackupImport={handleBackupImport}
      handleBackupImportPrompt={handleBackupImportPrompt}
      backupImportInputRef={backupImportInputRef}
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
    patientRecords: patientRecordsSection,
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
    if (setupStatus?.requiresSetup && showInitialSetupForm) {
      return (
        <div className="login-shell">
          <div className="login-backdrop" aria-hidden="true">
            <div className="login-dna login-dna-left" />
            <div className="login-dna login-dna-right" />
          </div>
          <section
            className="login-glass-card"
            aria-label="Set up MediLab Nexus"
          >
            <div className="login-brand-heading">
              <h1>MediLab</h1>
              <p>First administrator setup</p>
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className="ghost-action small"
                onClick={() => setShowInitialSetupForm(false)}
              >
                Back to sign in
              </button>
            </div>
            <form className="login-glass-form" onSubmit={handleInitialSetup}>
              <label className="login-field">
                <span>Full name</span>
                <input
                  value={setupForm.admin.displayName}
                  onChange={(event) =>
                    setSetupForm((current) => ({
                      ...current,
                      admin: {
                        ...current.admin,
                        displayName: event.target.value,
                      },
                    }))
                  }
                  placeholder="Administrator full name"
                  required
                />
              </label>
              <label className="login-field">
                <span>Username</span>
                <input
                  value={setupForm.admin.username}
                  onChange={(event) =>
                    setSetupForm((current) => ({
                      ...current,
                      admin: {
                        ...current.admin,
                        username: event.target.value,
                      },
                    }))
                  }
                  placeholder="Choose a username"
                  required
                />
              </label>
              <label className="login-field">
                <span>PIN</span>
                <div className="password-field">
                  <input
                    type={passwordVisibility.login ? "text" : "password"}
                    inputMode="numeric"
                    value={setupForm.admin.pin}
                    onChange={(event) =>
                      setSetupForm((current) => ({
                        ...current,
                        admin: {
                          ...current.admin,
                          pin: event.target.value,
                        },
                      }))
                    }
                    placeholder="Create a secure PIN"
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
              <button
                type="submit"
                className="primary-action full-width login-submit"
              >
                Create administrator and open workspace
              </button>
            </form>
            <p className="login-status glass-status">
              This first registration creates the initial administrator account
              and uses the configured facility defaults for the workspace.
            </p>
            {statusText !== "Ready to connect" && statusText !== "Signed out" ? (
              <p className="login-status glass-status">{statusText}</p>
            ) : null}
          </section>
        </div>
      );
    }

    return (
      <div className="login-shell">
        <div className="login-backdrop" aria-hidden="true">
          <div className="login-dna login-dna-left" />
          <div className="login-dna login-dna-right" />
        </div>
        <section
          className="login-glass-card"
          aria-label="Sign in to MediLab Nexus"
        >
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
                  setStatusText(
                    "Contact your administrator to reset or rotate your PIN.",
                  )
                }
              >
                Forgot PIN?
              </button>
            </div>
            <button
              type="submit"
              className="primary-action full-width login-submit"
            >
              Login
            </button>
            <button
              type="button"
              className="ghost-action full-width"
              onClick={() => {
                if (setupStatus?.requiresSetup) {
                  setShowInitialSetupForm(true);
                  return;
                }

                if (!setupStatus) {
                  setStatusText(
                    "Database setup is not ready. Confirm the PostgreSQL connection and run the schema push before registering the first administrator.",
                  );
                  return;
                }

                setStatusText(
                  "Initial administrator setup is already complete. Sign in as an administrator to create or manage user accounts.",
                );
              }}
            >
              Sign up
            </button>
          </form>
          {statusText !== "Ready to connect" && statusText !== "Signed out" ? (
            <p className="login-status glass-status">{statusText}</p>
          ) : null}
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
            aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={sidebarOpen}
            aria-controls="portal-sidebar"
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
              aria-label="Search patients, trace codes, or phone numbers"
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
              aria-label={bellOpen ? "Close alerts panel" : "Open alerts panel"}
              aria-expanded={bellOpen}
              aria-controls="alerts-panel"
              aria-haspopup="dialog"
              onClick={() => setBellOpen((current) => !current)}
            >
              Bell
              {incomingAlerts.length > 0 ? (
                <span className="bell-count">{incomingAlerts.length}</span>
              ) : null}
            </button>
            {bellOpen ? (
              <InternalBellPanel
                panelId="alerts-panel"
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
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
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
        <aside id="portal-sidebar" className={`sidebar ${sidebarOpen ? "open" : ""}`}>
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
                      aria-current={activeNav === item.key ? "page" : undefined}
                      onClick={() => {
                        setActiveNav(item.key);
                        setSidebarOpen(false);
                      }}
                    >
                      <span className="nav-icon">{item.short}</span>
                      <span>{item.label}</span>
                      {item.key === "alerts" && incomingAlerts.length > 0 ? (
                        <span className="nav-count">
                          {incomingAlerts.length}
                        </span>
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
      </div>
    </div>
  );
}
