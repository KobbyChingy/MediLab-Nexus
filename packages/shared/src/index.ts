import { z } from "zod";

export const catalogKinds = ["TEST", "IMAGING"] as const;
export const departments = ["LAB", "IMAGING"] as const;
export const priorities = ["ROUTINE", "URGENT", "STAT"] as const;
export const payerTypes = ["SELF_PAY", "NHIS", "INSURANCE", "CORPORATE"] as const;
export const sampleStatuses = [
  "PENDING",
  "COLLECTED",
  "RECEIVED",
  "PROCESSING",
  "STORED",
  "REJECTED",
  "DISPOSED",
] as const;
export const appointmentStatuses = [
  "SCHEDULED",
  "ARRIVED",
  "SCANNING",
  "REPORTED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const reportStatuses = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "RELEASED",
  "AMENDED",
] as const;
export const claimStatuses = [
  "NOT_APPLICABLE",
  "PENDING",
  "SUBMITTED",
  "PARTIAL",
  "SETTLED",
  "REJECTED",
] as const;
export const paymentResponsibilities = ["PATIENT", "PAYER"] as const;
export const paymentMethods = [
  "CASH",
  "MOBILE_MONEY_MTN",
  "MOBILE_MONEY_VODAFONE",
  "CARD",
  "NHIS",
  "BANK_TRANSFER",
  "EMPLOYEE_DISCOUNT",
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
export const printFontSizes = ["SMALL", "MEDIUM", "LARGE"] as const;
export const analyticsRangeKeys = [
  "TODAY",
  "YESTERDAY",
  "7D",
  "30D",
  "CUSTOM",
  "ALL",
] as const;

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
  location: z.string().optional().default(""),
  nhisId: z.string().optional(),
  allergies: z.string().optional(),
  medicalHistory: z.string().optional(),
  referralDoctorId: z.string().optional().default(""),
  referralName: z.string().optional().default(""),
  referralAmountCents: z.number().int().min(0).optional(),
  consentAccepted: z.boolean().default(false),
  photoPath: z.string().optional(),
});

export const referralDoctorInputSchema = z.object({
  fullName: z.string().min(3),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  referralAmountCents: z.number().int().min(0),
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
  payerType: z.enum(payerTypes).default("SELF_PAY"),
  payerName: z.string().optional().default(""),
  payerCoveragePercent: z.number().int().min(0).max(100).default(0),
  payerMemberId: z.string().optional().default(""),
  payerAuthorizationCode: z.string().optional().default(""),
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

export const sampleUpdateInputSchema = z.object({
  status: z.enum(sampleStatuses),
  collectedBy: z.string().optional().default(""),
  rejectionReason: z.string().optional().default(""),
  note: z.string().optional().default(""),
});

export const reportInputSchema = z.object({
  patientId: z.string().min(1),
  orderId: z.string().min(1),
  title: z.string().min(3),
  medicalHistory: z.string().optional().default(""),
  summary: z.string().min(3),
  findings: z.string().min(3),
  impression: z.string().optional().default(""),
  signedBy: z.string().min(3),
  status: z.enum(reportStatuses).default("DRAFT"),
  templateKind: z.enum(reportTemplateKinds).default("LAB_STANDARD"),
  criticalFlag: z.boolean().default(false),
  imagePaths: z.array(z.string()).default([]),
});

export const reportStatusUpdateInputSchema = z.object({
  status: z.enum(reportStatuses),
  signedBy: z.string().optional().default(""),
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
  expiryDate: z.string().optional().default(""),
  preferredVendor: z.string().optional().default(""),
  storageLocation: z.string().optional().default(""),
});

export const paymentInputSchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  method: z.enum(paymentMethods),
  responsibility: z.enum(paymentResponsibilities).default("PATIENT"),
  reference: z.string().optional(),
  receivedBy: z.string().min(2),
  traceCode: z.string().optional(),
  notes: z.string().optional(),
});

export const claimStatusUpdateInputSchema = z.object({
  claimStatus: z.enum(claimStatuses),
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

export const importBackupInputSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  encryptedPayload: z.string().trim().min(32),
});

export const loginInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .refine(
      (value) => /^[a-z0-9._-]+$/iu.test(value),
      "Username must use letters, numbers, dots, underscores, or hyphens.",
    ),
  pin: z.string().min(4).max(12),
});

export const adminUserInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .refine(
      (value) => /^[a-z0-9._-]+$/iu.test(value),
      "Username must use letters, numbers, dots, underscores, or hyphens.",
    ),
  displayName: z.string().trim().min(3),
  role: z.enum(userRoles),
  pin: z.string().min(4).max(12),
});

export const rotatePinInputSchema = z.object({
  newPin: z.string().min(4).max(12),
});

export const changeOwnPinInputSchema = z.object({
  currentPin: z.string().min(4).max(12),
  newPin: z.string().min(4).max(12),
});

export const ownProfileInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .refine(
      (value) => /^[a-z0-9._-]+$/iu.test(value),
      "Username must use letters, numbers, dots, underscores, or hyphens.",
    ),
  displayName: z.string().trim().min(3),
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
  printFontSize: z.enum(printFontSizes).default("MEDIUM"),
});

export const attendanceHolidayInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().trim().min(2).max(80),
});

export const attendanceSettingsInputSchema = z.object({
  offDays: z.array(z.number().int().min(0).max(6)).default([]),
  holidays: z.array(attendanceHolidayInputSchema).default([]),
});

export const initialSetupInputSchema = z.object({
  admin: z.object({
    displayName: z.string().min(3),
    username: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .refine(
        (value) => /^[a-z0-9._-]+$/iu.test(value),
        "Username must use letters, numbers, dots, underscores, or hyphens.",
      ),
    pin: z.string().min(4).max(12),
  }),
});

export const reportTemplateAssistInputSchema = z.object({
  sonographerName: z.string().optional().default(""),
  technique: z.string().optional().default(""),
  measurementsText: z.string().optional().default(""),
  recommendation: z.string().optional().default(""),
  echoWorksheetJson: z.string().optional().default(""),
  gestationalAge: z.string().optional().default(""),
  fetalHeartRate: z.string().optional().default(""),
  placentaLocation: z.string().optional().default(""),
  amnioticFluid: z.string().optional().default(""),
  liverSpan: z.string().optional().default(""),
  gallbladder: z.string().optional().default(""),
  biliaryTree: z.string().optional().default(""),
  renalSurvey: z.string().optional().default(""),
  uterineSize: z.string().optional().default(""),
  endometriumThickness: z.string().optional().default(""),
  rightAdnexa: z.string().optional().default(""),
  leftAdnexa: z.string().optional().default(""),
  ejectionFraction: z.string().optional().default(""),
  chamberAssessment: z.string().optional().default(""),
  valveAssessment: z.string().optional().default(""),
  pericardium: z.string().optional().default(""),
});

export const reportTemplateInputSchema = z.object({
  name: z.string().min(3),
  templateKind: z.enum(reportTemplateKinds).default("LAB_STANDARD"),
  title: z.string().min(3),
  medicalHistory: z.string().optional().default(""),
  summary: z.string().min(3),
  findings: z.string().min(3),
  impression: z.string().optional().default(""),
  assist: reportTemplateAssistInputSchema.default({}),
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
export type SampleUpdateInput = z.infer<typeof sampleUpdateInputSchema>;
export type ReportInput = z.infer<typeof reportInputSchema>;
export type ReportStatusUpdateInput = z.infer<
  typeof reportStatusUpdateInputSchema
>;
export type QcEventInput = z.infer<typeof qcEventInputSchema>;
export type InventoryTransactionInput = z.infer<
  typeof inventoryTransactionInputSchema
>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type ClaimStatusUpdateInput = z.infer<
  typeof claimStatusUpdateInputSchema
>;
export type NotificationInput = z.infer<typeof notificationInputSchema>;
export type InternalAlertInput = z.infer<typeof internalAlertInputSchema>;
export type RestoreBackupInput = z.infer<typeof restoreBackupInputSchema>;
export type ImportBackupInput = z.infer<typeof importBackupInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type AdminUserInput = z.infer<typeof adminUserInputSchema>;
export type RotatePinInput = z.infer<typeof rotatePinInputSchema>;
export type ChangeOwnPinInput = z.infer<typeof changeOwnPinInputSchema>;
export type OwnProfileInput = z.infer<typeof ownProfileInputSchema>;
export type UserStatusInput = z.infer<typeof userStatusInputSchema>;
export type FacilitySettingsInput = z.infer<typeof facilitySettingsInputSchema>;
export type AttendanceHolidayInput = z.infer<typeof attendanceHolidayInputSchema>;
export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsInputSchema>;
export type InitialSetupInput = z.infer<typeof initialSetupInputSchema>;
export type ReportTemplateAssistPayload = z.infer<
  typeof reportTemplateAssistInputSchema
>;
export type ReportTemplateInput = z.infer<typeof reportTemplateInputSchema>;
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
  referralAmountCents: number;
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
  printFontSize: (typeof printFontSizes)[number];
};

export type ReportTemplatePayload = {
  id: string;
  facilityId: string;
  name: string;
  templateKind: (typeof reportTemplateKinds)[number];
  title: string;
  medicalHistory: string;
  summary: string;
  findings: string;
  impression: string;
  assist: ReportTemplateAssistPayload;
  createdByName: string;
  createdByRole: (typeof userRoles)[number];
  createdAt: string;
  updatedAt: string;
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
  PHLEBOTOMIST: ["order:write", "settings:view"],
  SONOGRAPHER: [
    "patient:write",
    "order:write",
    "report:view",
    "report:write",
    "notify:queue",
    "settings:view",
  ],
  DOCTOR: [
    "patient:write",
    "order:write",
    "report:view",
    "report:write",
    "notify:queue",
    "settings:view",
  ],
  LAB_TECH: [
    "order:write",
    "report:view",
    "report:write",
    "qc:manage",
    "inventory:manage",
    "settings:view",
  ],
  RADIOLOGIST: [
    "order:write",
    "report:view",
    "report:write",
    "notify:queue",
    "settings:view",
  ],
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
  FINANCE: ["finance:manage", "notify:queue", "settings:view"],
  QA: [
    "qc:manage",
    "admin:view",
    "notify:queue",
    "integration:manage",
    "settings:view",
  ],
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
    payerType: (typeof payerTypes)[number];
    payerName: string | null;
    payerCoveragePercent: number;
    payerMemberId: string | null;
    payerAuthorizationCode: string | null;
    createdAt: string;
    items: string[];
  }>;
  samples: Array<{
    id: string;
    patientId: string;
    orderId: string;
    patientTraceCode: string;
    patientName: string;
    traceLabel: string;
    specimenType: string;
    status: (typeof sampleStatuses)[number];
    collectedBy: string | null;
    collectedAt: string | null;
    rejectionReason: string | null;
    chainOfCustody: Array<{
      at: string;
      action: string;
      actor: string;
      note: string;
    }>;
    createdAt: string;
  }>;
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
    patientTraceCode: string;
    patientName: string;
    title: string;
    status: (typeof reportStatuses)[number];
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
    referralAmountCents: number | null;
    referralDueCents: number;
    referralOutstandingCents: number;
    payerType: (typeof payerTypes)[number];
    payerName: string | null;
    payerCoveragePercent: number;
    payerMemberId: string | null;
    payerAuthorizationCode: string | null;
    payerResponsibilityCents: number;
    patientResponsibilityCents: number;
    claimStatus: (typeof claimStatuses)[number];
    status: string;
    subtotalCents: number;
    discountCents: number;
    insuranceCoveredCents: number;
    amountDueCents: number;
    amountPaidCents: number;
    patientPaidCents: number;
    payerPaidCents: number;
    totalDueCents: number;
    patientBalanceCents: number;
    payerBalanceCents: number;
    balanceCents: number;
    createdAt: string;
    paymentsCount: number;
  }>;
  payments: Array<{
    id: string;
    invoiceId: string;
    patientId: string;
    traceCode: string;
    accessionNumber: string;
    amountCents: number;
    method: string;
    responsibility: (typeof paymentResponsibilities)[number];
    reference: string | null;
    receivedBy: string | null;
    notes: string | null;
    createdAt: string;
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

export type OwnProfilePayload = {
  id: string;
  facilityId: string;
  username: string;
  displayName: string;
  role: (typeof userRoles)[number];
  pinChangedAt: string;
  lastLoginAt: string | null;
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

export type AttendanceSettingsPayload = AttendanceSettingsInput;

export type AttendanceWorkspacePayload = {
  date: string;
  generatedAt: string;
  settings: AttendanceSettingsPayload;
  summary: {
    presentCount: number;
    closedCount: number;
    absentCount: number;
    offDayCount: number;
    holidayCount: number;
  };
  entries: Array<{
    userId: string;
    username: string;
    displayName: string;
    role: (typeof userRoles)[number];
    status: "PRESENT" | "CLOSED" | "ABSENT" | "OFF_DAY" | "HOLIDAY";
    holidayLabel: string | null;
    firstLoginAt: string | null;
    lastActivityAt: string | null;
    lastLogoutAt: string | null;
  }>;
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
    referralAmountEarnedCents: number;
    referralAmountOutstandingCents: number;
    paymentMix: Array<{
      method: string;
      totalCents: number;
      count: number;
    }>;
    referralLeaders: Array<{
      doctorName: string;
      defaultReferralAmountCents: number;
      invoicesCount: number;
      revenueCents: number;
      referralDueCents: number;
      referralOutstandingCents: number;
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
  customStartDate: string | null;
  customEndDate: string | null;
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
    referralAmountDueCents: number;
    referralAmountOutstandingCents: number;
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
  payerMix: Array<{
    payerType: (typeof payerTypes)[number];
    payerName: string;
    invoicesCount: number;
    coveredCents: number;
    outstandingCents: number;
  }>;
  claimStatus: Array<{
    claimStatus: (typeof claimStatuses)[number];
    invoicesCount: number;
    coveredCents: number;
    outstandingCents: number;
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
    defaultReferralAmountCents: number;
    invoicesCount: number;
    billedCents: number;
    collectedCents: number;
    outstandingCents: number;
    referralDueCents: number;
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

export type SetupStatusPayload = {
  requiresSetup: boolean;
  hasUsers: boolean;
  hasFacility: boolean;
  facility: FacilityProfile;
};
