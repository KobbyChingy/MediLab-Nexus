import { z } from "zod";

export const catalogKinds = ["TEST", "IMAGING"] as const;
export const departments = ["LAB", "IMAGING"] as const;
export const priorities = ["ROUTINE", "URGENT", "STAT"] as const;
export const appointmentStatuses = [
  "SCHEDULED",
  "ARRIVED",
  "SCANNING",
  "REPORTED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const paymentMethods = [
  "CASH",
  "MOBILE_MONEY_MTN",
  "MOBILE_MONEY_VODAFONE",
  "CARD",
  "NHIS",
] as const;
export const notificationChannels = [
  "SMS",
  "EMAIL",
  "WHATSAPP",
  "INTERNAL",
] as const;
export const inventoryTxnTypes = [
  "RECEIPT",
  "ISSUE",
  "ADJUSTMENT",
  "EXPIRY",
  "RETURN",
] as const;
export const userRoles = [
  "RECEPTION",
  "PHLEBOTOMIST",
  "SONOGRAPHER",
  "DOCTOR",
  "LAB_TECH",
  "RADIOLOGIST",
  "MANAGER",
  "FINANCE",
  "QA",
  "ADMIN",
] as const;
export const reportTemplateKinds = [
  "LAB_STANDARD",
  "ULTRASOUND_STANDARD",
  "ULTRASOUND_ABDOMINAL",
  "ULTRASOUND_PELVIC",
  "ULTRASOUND_OBSTETRIC",
  "ULTRASOUND_ECHOCARDIOGRAPHY",
] as const;
export const analyticsRangeKeys = ["7D", "30D", "90D", "365D", "ALL"] as const;

export const patientInputSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  middleName: z.string().optional().default(""),
  traceCode: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(
      (value) => value === "" || /^[A-Za-z]{2,3}\d+$/.test(value),
      "Trace code must use initials followed by digits, for example ML1205.",
    ),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().min(6),
  nhisId: z.string().optional(),
  allergies: z.string().optional(),
  medicalHistory: z.string().optional(),
  referralDoctorId: z.string().optional().default(""),
  referralName: z.string().optional().default(""),
  referralCommissionPercent: z.number().int().min(0).max(100).optional(),
  consentAccepted: z.boolean().default(false),
  photoPath: z.string().optional(),
});

export const referralDoctorInputSchema = z.object({
  fullName: z.string().min(3),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  commissionPercent: z.number().int().min(0).max(100),
  isActive: z.boolean().default(true),
});

export const patientReferralUpdateInputSchema = z.object({
  referralDoctorId: z.string().optional().default(""),
});

export const expenseInputSchema = z.object({
  category: z.string().min(2),
  description: z.string().min(3),
  amountCents: z.number().int().positive(),
  incurredAt: z.string().min(4),
  recordedBy: z.string().min(2),
  notes: z.string().optional().default(""),
});

export const orderInputSchema = z.object({
  patientId: z.string().min(1),
  itemIds: z.array(z.string()).min(1),
  orderedBy: z.string().min(2),
  priority: z.enum(priorities).default("ROUTINE"),
  insuranceProvider: z.string().optional(),
  insuranceAuthorized: z.boolean().default(false),
  notes: z.string().optional(),
  referringClinic: z.string().optional(),
  scheduledFor: z.string().optional(),
  sonographerName: z.string().optional().default(""),
  priorStudyReference: z.string().optional().default(""),
  radiologistName: z.string().optional().default(""),
});

export const imagingStudyUpdateInputSchema = z.object({
  appointmentStatus: z.enum(appointmentStatuses),
  scheduledAt: z.string().optional().default(""),
  sonographerName: z.string().optional().default(""),
  radiologistName: z.string().optional().default(""),
  priorStudyReference: z.string().optional().default(""),
  criticalFlag: z.boolean().default(false),
});

export const reportInputSchema = z.object({
  patientId: z.string().min(1),
  orderId: z.string().min(1),
  title: z.string().min(3),
  medicalHistory: z.string().optional().default(""),
  summary: z.string().min(3),
  findings: z.string().min(3),
  impression: z.string().min(3),
  signedBy: z.string().min(3),
  templateKind: z.enum(reportTemplateKinds).default("LAB_STANDARD"),
  criticalFlag: z.boolean().default(false),
  imagePaths: z.array(z.string()).default([]),
});

export const qcEventInputSchema = z.object({
  module: z.string().min(2),
  instrumentName: z.string().min(2),
  analyte: z.string().min(2),
  controlLevel: z.string().min(1),
  lotNumber: z.string().optional(),
  observedValue: z.number(),
  meanValue: z.number(),
  standardDeviation: z.number().positive(),
  expectedRange: z.string().min(3),
  performedBy: z.string().min(2),
  notes: z.string().optional(),
  traceCode: z.string().optional(),
});

export const inventoryTransactionInputSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(inventoryTxnTypes),
  quantity: z.number().positive(),
  reason: z.string().optional(),
  traceCode: z.string().optional(),
  actor: z.string().min(2),
});

export const paymentInputSchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: z.number().int().positive(),
  method: z.enum(paymentMethods),
  reference: z.string().optional(),
  receivedBy: z.string().min(2),
  traceCode: z.string().optional(),
  notes: z.string().optional(),
});

export const notificationInputSchema = z.object({
  patientId: z.string().optional(),
  traceCode: z.string().optional(),
  recipient: z.string().min(4),
  channel: z.enum(notificationChannels),
  message: z.string().min(4),
  scheduledFor: z.string().optional(),
  createdBy: z.string().min(2),
});

export const internalAlertInputSchema = z.object({
  recipientUsername: z.string().min(3),
  message: z.string().min(4),
});

export const restoreBackupInputSchema = z.object({
  snapshotId: z.string().min(1),
});

export const loginInputSchema = z.object({
  username: z.string().min(3),
  pin: z.string().min(4).max(12),
});

export const adminUserInputSchema = z.object({
  username: z.string().min(3),
  displayName: z.string().min(3),
  role: z.enum(userRoles),
  pin: z.string().min(4).max(12),
});

export const rotatePinInputSchema = z.object({
  newPin: z.string().min(4).max(12),
});

export const userStatusInputSchema = z.object({
  isActive: z.boolean(),
});

export const facilitySettingsInputSchema = z.object({
  name: z.string().min(3),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  location: z.string().optional().default(""),
  logoDataUrl: z.string().optional().default(""),
  footerMessage: z.string().optional().default(""),
});

export const serviceInputSchema = z.object({
  code: z.string().min(3),
  name: z.string().min(3),
  kind: z.enum(catalogKinds),
  specimenType: z.string().optional().default(""),
  modality: z.string().optional().default(""),
  priceCents: z.number().int().nonnegative(),
  tatMinutes: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

export const bulkServiceImportModes = [
  "SKIP_EXISTING",
  "OVERWRITE_EXISTING",
] as const;

export const bulkServiceInputSchema = z.object({
  services: z.array(serviceInputSchema).min(1),
  mode: z.enum(bulkServiceImportModes).default("SKIP_EXISTING"),
});

export type PatientInput = z.infer<typeof patientInputSchema>;
export type ReferralDoctorInput = z.infer<typeof referralDoctorInputSchema>;
export type PatientReferralUpdateInput = z.infer<
  typeof patientReferralUpdateInputSchema
>;
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
export type ImagingStudyUpdateInput = z.infer<
  typeof imagingStudyUpdateInputSchema
>;
export type ReportInput = z.infer<typeof reportInputSchema>;
export type QcEventInput = z.infer<typeof qcEventInputSchema>;
export type InventoryTransactionInput = z.infer<
  typeof inventoryTransactionInputSchema
>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type NotificationInput = z.infer<typeof notificationInputSchema>;
export type InternalAlertInput = z.infer<typeof internalAlertInputSchema>;
export type RestoreBackupInput = z.infer<typeof restoreBackupInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type AdminUserInput = z.infer<typeof adminUserInputSchema>;
export type RotatePinInput = z.infer<typeof rotatePinInputSchema>;
export type UserStatusInput = z.infer<typeof userStatusInputSchema>;
export type FacilitySettingsInput = z.infer<typeof facilitySettingsInputSchema>;
export type ServiceInput = z.infer<typeof serviceInputSchema>;
export type BulkServiceInput = z.infer<typeof bulkServiceInputSchema>;
export type BulkServiceImportMode = z.infer<
  typeof bulkServiceInputSchema
>["mode"];

export type ReferralDoctorSummaryPayload = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  commissionPercent: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseSummaryPayload = {
  id: string;
  category: string;
  description: string;
  amountCents: number;
  incurredAt: string;
  recordedBy: string;
  notes: string | null;
  createdAt: string;
};

export type ExpenseWorkspacePayload = {
  generatedAt: string;
  range: (typeof analyticsRangeKeys)[number];
  availableCategories: string[];
  summary: {
    totalCents: number;
    entryCount: number;
  };
  categories: Array<{
    category: string;
    totalCents: number;
    count: number;
  }>;
  expenses: ExpenseSummaryPayload[];
};

export type FacilityProfile = {
  name: string;
  code: string;
  phone: string;
  email: string;
  location: string;
  logoDataUrl: string;
  footerMessage: string;
};

export type CatalogSeedItem = {
  id?: string;
  code: string;
  name: string;
  kind: "TEST" | "IMAGING";
  department: "LAB" | "IMAGING";
  specimenType: string | null;
  modality: string | null;
  priceCents: number;
  tatMinutes: number;
  rulesJson: string;
  isActive?: boolean;
};

export const catalogSeed: CatalogSeedItem[] = [
  {
    code: "LAB-CBC",
    name: "Complete Blood Count",
    kind: "TEST",
    department: "LAB",
    specimenType: "Whole Blood",
    modality: null,
    priceCents: 6500,
    tatMinutes: 90,
    rulesJson: JSON.stringify({
      reflex: [],
      deltaCheck: true,
      autoValidate: false,
    }),
  },
  {
    code: "LAB-HBA1C",
    name: "HbA1c",
    kind: "TEST",
    department: "LAB",
    specimenType: "Whole Blood",
    modality: null,
    priceCents: 12000,
    tatMinutes: 120,
    rulesJson: JSON.stringify({
      reflex: [],
      deltaCheck: true,
      autoValidate: true,
    }),
  },
  {
    code: "LAB-LFT",
    name: "Liver Function Test",
    kind: "TEST",
    department: "LAB",
    specimenType: "Serum",
    modality: null,
    priceCents: 18500,
    tatMinutes: 180,
    rulesJson: JSON.stringify({
      reflex: ["LAB-BILI"],
      deltaCheck: true,
      autoValidate: false,
    }),
  },
  {
    code: "LAB-URINALYSIS",
    name: "Urinalysis",
    kind: "TEST",
    department: "LAB",
    specimenType: "Urine",
    modality: null,
    priceCents: 5000,
    tatMinutes: 60,
    rulesJson: JSON.stringify({
      reflex: [],
      deltaCheck: false,
      autoValidate: true,
    }),
  },
  {
    code: "LAB-MPCR",
    name: "Malaria Parasite + Rapid Test",
    kind: "TEST",
    department: "LAB",
    specimenType: "Whole Blood",
    modality: null,
    priceCents: 8500,
    tatMinutes: 45,
    rulesJson: JSON.stringify({
      reflex: [],
      deltaCheck: false,
      autoValidate: true,
    }),
  },
  {
    code: "LAB-HPV",
    name: "HPV PCR",
    kind: "TEST",
    department: "LAB",
    specimenType: "Cervical Swab",
    modality: null,
    priceCents: 45000,
    tatMinutes: 1440,
    rulesJson: JSON.stringify({
      reflex: [],
      deltaCheck: false,
      autoValidate: false,
    }),
  },
  {
    code: "IMG-ABD-US",
    name: "Abdominal Ultrasound",
    kind: "IMAGING",
    department: "IMAGING",
    specimenType: null,
    modality: "Ultrasound",
    priceCents: 22000,
    tatMinutes: 60,
    rulesJson: JSON.stringify({
      template: "abdominal",
      dicom: true,
      measurements: true,
    }),
  },
  {
    code: "IMG-PEL-US",
    name: "Pelvic Ultrasound",
    kind: "IMAGING",
    department: "IMAGING",
    specimenType: null,
    modality: "Ultrasound",
    priceCents: 24000,
    tatMinutes: 60,
    rulesJson: JSON.stringify({
      template: "pelvic",
      dicom: true,
      measurements: true,
    }),
  },
  {
    code: "IMG-OBS-US",
    name: "Obstetric Ultrasound",
    kind: "IMAGING",
    department: "IMAGING",
    specimenType: null,
    modality: "Ultrasound",
    priceCents: 28000,
    tatMinutes: 75,
    rulesJson: JSON.stringify({
      template: "obstetric",
      dicom: true,
      measurements: true,
    }),
  },
  {
    code: "IMG-THY-US",
    name: "Thyroid Ultrasound",
    kind: "IMAGING",
    department: "IMAGING",
    specimenType: null,
    modality: "Ultrasound",
    priceCents: 23000,
    tatMinutes: 45,
    rulesJson: JSON.stringify({
      template: "thyroid",
      dicom: true,
      measurements: true,
    }),
  },
  {
    code: "IMG-BRST-US",
    name: "Breast Ultrasound",
    kind: "IMAGING",
    department: "IMAGING",
    specimenType: null,
    modality: "Ultrasound",
    priceCents: 26000,
    tatMinutes: 60,
    rulesJson: JSON.stringify({
      template: "breast",
      dicom: true,
      measurements: true,
    }),
  },
  {
    code: "IMG-DOP-US",
    name: "Vascular Doppler Ultrasound",
    kind: "IMAGING",
    department: "IMAGING",
    specimenType: null,
    modality: "Ultrasound",
    priceCents: 35000,
    tatMinutes: 90,
    rulesJson: JSON.stringify({
      template: "vascular",
      dicom: true,
      measurements: true,
    }),
  },
  {
    code: "IMG-MSK-US",
    name: "Musculoskeletal Ultrasound",
    kind: "IMAGING",
    department: "IMAGING",
    specimenType: null,
    modality: "Ultrasound",
    priceCents: 30000,
    tatMinutes: 60,
    rulesJson: JSON.stringify({
      template: "msk",
      dicom: true,
      measurements: true,
    }),
  },
  {
    code: "IMG-ECHO",
    name: "Echocardiography",
    kind: "IMAGING",
    department: "IMAGING",
    specimenType: null,
    modality: "Ultrasound",
    priceCents: 42000,
    tatMinutes: 90,
    rulesJson: JSON.stringify({
      template: "echo",
      dicom: true,
      measurements: true,
    }),
  },
];

export type BootstrapPayload = {
  facility: FacilityProfile;
  catalog: CatalogSeedItem[];
  metrics: {
    patientsToday: number;
    openOrders: number;
    pendingReviews: number;
    pendingDispatches: number;
  };
  workflow: Array<{
    label: string;
    count: number;
    note: string;
  }>;
  lowStock: Array<{
    name: string;
    quantityOnHand: number;
    reorderLevel: number;
  }>;
  qcAlerts: Array<{
    module: string;
    instrumentName: string;
    status: string;
    occurredAt: string;
  }>;
  recentPatients: Array<{
    id: string;
    traceCode: string;
    fullName: string;
    phone: string;
  }>;
};

export type Capability =
  | "patient:write"
  | "report:view"
  | "order:write"
  | "report:write"
  | "service:view"
  | "service:manage"
  | "qc:manage"
  | "inventory:manage"
  | "finance:manage"
  | "settings:view"
  | "admin:view"
  | "backup:manage"
  | "notify:queue"
  | "user:manage"
  | "integration:manage";

export const roleCapabilities: Record<
  (typeof userRoles)[number],
  Capability[]
> = {
  RECEPTION: [
    "patient:write",
    "report:view",
    "order:write",
    "service:view",
    "finance:manage",
    "settings:view",
    "notify:queue",
  ],
  PHLEBOTOMIST: ["order:write"],
  SONOGRAPHER: ["order:write", "report:view", "report:write", "notify:queue"],
  DOCTOR: ["order:write", "report:view", "report:write", "notify:queue"],
  LAB_TECH: ["order:write", "report:write", "qc:manage", "inventory:manage"],
  RADIOLOGIST: ["order:write", "report:view", "report:write", "notify:queue"],
  MANAGER: [
    "patient:write",
    "order:write",
    "report:view",
    "report:write",
    "service:view",
    "service:manage",
    "qc:manage",
    "inventory:manage",
    "finance:manage",
    "settings:view",
    "admin:view",
    "backup:manage",
    "notify:queue",
    "user:manage",
    "integration:manage",
  ],
  FINANCE: ["finance:manage", "notify:queue"],
  QA: ["qc:manage", "admin:view", "notify:queue", "integration:manage"],
  ADMIN: [
    "patient:write",
    "order:write",
    "report:view",
    "report:write",
    "service:view",
    "service:manage",
    "qc:manage",
    "inventory:manage",
    "finance:manage",
    "settings:view",
    "admin:view",
    "backup:manage",
    "notify:queue",
    "user:manage",
    "integration:manage",
  ],
};

export type WorkflowPayload = {
  orders: Array<{
    id: string;
    accessionNumber: string;
    status: string;
    patientId: string;
    patientTraceCode: string;
    patientName: string;
    createdAt: string;
    items: string[];
  }>;
  samples: Array<Record<string, unknown>>;
  imaging: Array<{
    id: string;
    orderId: string;
    orderItemId: string;
    patientId: string;
    patientTraceCode: string;
    patientName: string;
    serviceName: string;
    modality: string;
    appointmentStatus: (typeof appointmentStatuses)[number];
    scheduledAt: string | null;
    sonographerName: string | null;
    radiologistName: string | null;
    priorStudyReference: string | null;
    criticalFlag: boolean;
    createdAt: string;
  }>;
  reports: Array<{
    id: string;
    patientId: string;
    orderId: string;
    title: string;
    status: string;
    signedBy: string | null;
    signedAt: string | null;
    pdfPath: string | null;
    criticalFlag: boolean;
    createdAt: string;
  }>;
  invoices: Array<{
    id: string;
    patientId: string;
    orderId: string;
    traceCode: string;
    accessionNumber: string;
    referralDoctorName: string | null;
    referralDoctorCommissionPercent: number | null;
    referralCommissionDueCents: number;
    referralCommissionOutstandingCents: number;
    status: string;
    subtotalCents: number;
    discountCents: number;
    insuranceCoveredCents: number;
    amountDueCents: number;
    amountPaidCents: number;
    balanceCents: number;
    createdAt: string;
    paymentsCount: number;
  }>;
  maintenance: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
};

export type PrintableReportPayload = {
  reportId: string;
  fileName: string;
  html: string;
  pdfReady: boolean;
};

export type PrintableReceiptPayload = {
  paymentId: string;
  fileName: string;
  html: string;
};

export type PrintableInvoicePayload = {
  invoiceId: string;
  fileName: string;
  html: string;
};

export type PrintableAnalyticsPayload = {
  fileName: string;
  html: string;
};

export type AdminUserSummaryPayload = {
  id: string;
  username: string;
  displayName: string;
  role: (typeof userRoles)[number];
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  pinChangedAt: string;
  createdAt: string;
};

export type UserDirectoryEntryPayload = {
  id: string;
  username: string;
  displayName: string;
  role: (typeof userRoles)[number];
};

export type InternalAlertPayload = {
  id: string;
  recipientUsername: string;
  message: string;
  createdBy: string;
  createdAt: string;
};

export type IntegrationDispatchStatusPayload = {
  pending: number;
  failed: number;
  conflicts: number;
  synced: number;
  queuedNotifications: number;
  failedNotifications: number;
  lastAttemptAt: string | null;
  integrationConfigured: boolean;
  notificationGatewayConfigured: boolean;
  mode: "standalone" | "connected";
  worker: {
    enabled: boolean;
    intervalMs: number;
    batchSize: number;
    targetsConfigured: boolean;
  };
  lastRun: {
    triggeredAt: string;
    triggeredBy: string;
    processedEvents: number;
    syncedEvents: number;
    failedEvents: number;
    conflictedEvents: number;
    deferredEvents: number;
    sentNotifications: number;
    deferredNotifications: number;
  } | null;
};

export type IntegrationDispatchRunPayload = IntegrationDispatchStatusPayload & {
  processedEvents: number;
  syncedEvents: number;
  failedEvents: number;
  conflictedEvents: number;
  deferredEvents: number;
  sentNotifications: number;
  deferredNotifications: number;
};

export type AdminOverviewPayload = {
  actor: {
    displayName: string;
    role: (typeof userRoles)[number];
    allowedActions: Capability[];
  };
  qc: {
    todayCount: number;
    pendingReview: number;
    breaches: Array<{
      analyte: string;
      instrumentName: string;
      rules: string[];
      observedValue: number;
      meanValue: number;
      standardDeviation: number;
      occurredAt: string;
    }>;
    leveyJennings: Array<{
      label: string;
      value: number;
      mean: number;
      plus1sd: number;
      minus1sd: number;
      plus2sd: number;
      minus2sd: number;
      plus3sd: number;
      minus3sd: number;
    }>;
  };
  maintenance: Array<{
    instrumentName: string;
    category: string;
    nextDueAt: string;
    status: string;
    assignedTo: string | null;
  }>;
  inventory: {
    lowStock: Array<{
      id: string;
      name: string;
      quantityOnHand: number;
      reorderLevel: number;
      unit: string;
    }>;
    expiringSoon: Array<{
      id: string;
      name: string;
      expiryDate: string;
      quantityOnHand: number;
    }>;
    reorderSuggestions: Array<{
      id: string;
      name: string;
      recommendedOrder: number;
      unit: string;
    }>;
  };
  finance: {
    revenueTodayCents: number;
    outstandingCents: number;
    invoicesOpen: number;
    referralCommissionEarnedCents: number;
    referralCommissionOutstandingCents: number;
    paymentMix: Array<{
      method: string;
      totalCents: number;
      count: number;
    }>;
    referralLeaders: Array<{
      doctorName: string;
      commissionPercent: number;
      invoicesCount: number;
      revenueCents: number;
      commissionDueCents: number;
      commissionOutstandingCents: number;
    }>;
  };
  notifications: {
    queued: number;
    items: Array<{
      channel: string;
      recipient: string;
      status: string;
      createdAt: string;
      message: string;
    }>;
  };
  backups: {
    lastSnapshotAt: string | null;
    snapshotCount: number;
    encrypted: boolean;
  };
  auditTrail: Array<{
    action: string;
    entityType: string;
    traceCode: string | null;
    role: string;
    createdAt: string;
    summary: string;
  }>;
  integrations: Array<{
    name: string;
    status: string;
    note: string;
  }>;
  aiFlags: Array<{
    title: string;
    severity: "low" | "medium" | "high";
    note: string;
  }>;
};

export type FinanceAnalyticsPayload = {
  generatedAt: string;
  range: (typeof analyticsRangeKeys)[number];
  summary: {
    grossBilledCents: number;
    netDueCents: number;
    collectedCents: number;
    outstandingCents: number;
    discountCents: number;
    insuranceCoveredCents: number;
    expenseCents: number;
    netProfitCents: number;
    averageInvoiceCents: number;
    averagePaymentCents: number;
    collectionRatePercent: number;
    referralCommissionDueCents: number;
    referralCommissionOutstandingCents: number;
  };
  invoiceStatus: Array<{
    status: string;
    count: number;
    totalDueCents: number;
    outstandingCents: number;
  }>;
  paymentMix: Array<{
    method: string;
    totalCents: number;
    count: number;
  }>;
  agingBuckets: Array<{
    label: string;
    invoiceCount: number;
    balanceCents: number;
  }>;
  monthlyCollections: Array<{
    label: string;
    billedCents: number;
    collectedCents: number;
  }>;
  topServices: Array<{
    description: string;
    quantity: number;
    revenueCents: number;
    invoicesCount: number;
  }>;
  studyPerformance: Array<{
    description: string;
    department: (typeof departments)[number];
    kind: (typeof catalogKinds)[number];
    quantity: number;
    billedCents: number;
    collectedCents: number;
    outstandingCents: number;
    invoicesCount: number;
    averageBilledCents: number;
    growthRatePercent: number;
    trend: Array<{
      label: string;
      quantity: number;
      billedCents: number;
      collectedCents: number;
      outstandingCents: number;
      invoicesCount: number;
    }>;
  }>;
  topReferrers: Array<{
    doctorName: string;
    commissionPercent: number;
    invoicesCount: number;
    billedCents: number;
    collectedCents: number;
    outstandingCents: number;
    commissionDueCents: number;
  }>;
  expenseCategories: Array<{
    category: string;
    totalCents: number;
    count: number;
  }>;
  userPerformance: Array<{
    actorName: string;
    generatedCents: number;
    lossCents: number;
    netCents: number;
    paymentsCount: number;
    expensesCount: number;
    inventoryActions: number;
    stockReceivedQuantity: number;
    stockIssuedQuantity: number;
    stockExpiredQuantity: number;
  }>;
  recentExpenses: ExpenseSummaryPayload[];
};

export type AuthSessionPayload = {
  sessionToken: string;
  expiresAt: string;
  user: {
    id: string;
    facilityId: string;
    username: string;
    displayName: string;
    role: (typeof userRoles)[number];
    allowedActions: Capability[];
  };
};
