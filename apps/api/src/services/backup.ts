import type { PrismaClient } from "@medilab/db";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { decryptText, encryptText, type ActorContext } from "./security.js";
import { recordAudit } from "./audit.js";

const storageRoot =
  process.env.MEDILAB_STORAGE_ROOT?.trim() ||
  path.resolve(process.cwd(), "storage");
const backupDir = path.join(storageRoot, "backups");

const requiredSnapshotCollections = [
  "facilities",
  "users",
  "sessions",
  "catalogItems",
  "patients",
  "orders",
  "orderItems",
  "samples",
  "imagingStudies",
  "reports",
  "invoices",
  "invoiceLines",
  "inventoryItems",
  "inventoryTransactions",
  "qualityControlEvents",
  "instruments",
  "maintenanceEvents",
  "paymentRecords",
  "notifications",
  "syncEvents",
  "auditLogs",
] as const;

function normalizeBackupLabel(label: string | undefined) {
  const sanitized = label
    ?.trim()
    .replace(/\.enc$/iu, "")
    .replace(/[^a-z0-9._-]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 90);

  if (sanitized) {
    return sanitized;
  }

  return "medilab-import";
}

function assertBackupSnapshotShape(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Backup file is malformed.");
  }

  const record = payload as Record<string, unknown>;
  for (const key of requiredSnapshotCollections) {
    if (!Array.isArray(record[key])) {
      throw new Error("Backup file is incomplete.");
    }
  }
}

function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item)) as T;
  } else if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (typeof entry === "string" && /(At|Date|Birth|For)$/u.test(key)) {
          return [key, new Date(entry)];
        }

        return [key, reviveDates(entry)];
      }),
    ) as T;
  }

  return value;
}

async function collectSnapshot(prisma: PrismaClient) {
  const [
    facilities,
    users,
    sessions,
    catalogItems,
    patients,
    orders,
    orderItems,
    samples,
    imagingStudies,
    reports,
    invoices,
    invoiceLines,
    inventoryItems,
    inventoryTransactions,
    qualityControlEvents,
    instruments,
    maintenanceEvents,
    paymentRecords,
    notifications,
    syncEvents,
    auditLogs,
  ] = await Promise.all([
    prisma.facility.findMany(),
    prisma.appUser.findMany(),
    prisma.appSession.findMany(),
    prisma.catalogItem.findMany(),
    prisma.patient.findMany(),
    prisma.diagnosticOrder.findMany(),
    prisma.orderItem.findMany(),
    prisma.sample.findMany(),
    prisma.imagingStudy.findMany(),
    prisma.report.findMany(),
    prisma.invoice.findMany(),
    prisma.invoiceLine.findMany(),
    prisma.inventoryItem.findMany(),
    prisma.inventoryTransaction.findMany(),
    prisma.qualityControlEvent.findMany(),
    prisma.instrument.findMany(),
    prisma.maintenanceEvent.findMany(),
    prisma.paymentRecord.findMany(),
    prisma.notificationQueue.findMany(),
    prisma.syncEvent.findMany(),
    prisma.auditLog.findMany(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    facilities,
    users,
    sessions,
    catalogItems,
    patients,
    orders,
    orderItems,
    samples,
    imagingStudies,
    reports,
    invoices,
    invoiceLines,
    inventoryItems,
    inventoryTransactions,
    qualityControlEvents,
    instruments,
    maintenanceEvents,
    paymentRecords,
    notifications,
    syncEvents,
    auditLogs,
  };
}

export async function createEncryptedBackup(
  prisma: PrismaClient,
  actor: ActorContext,
) {
  await mkdir(backupDir, { recursive: true });
  const snapshot = await collectSnapshot(prisma);
  const serialized = JSON.stringify(snapshot);
  const encrypted = encryptText(serialized);
  const checksum = createHash("sha256").update(encrypted).digest("hex");
  const label = `medilab-backup-${new Date().toISOString().replace(/[.:]/g, "-")}`;
  const filePath = path.join(backupDir, `${label}.enc`);
  await writeFile(filePath, encrypted, "utf8");

  const snapshotRecord = await prisma.backupSnapshot.create({
    data: {
      label,
      filePath,
      checksum,
      encrypted: true,
      createdBy: actor.displayName,
    },
  });

  await recordAudit(prisma, actor, {
    action: "BACKUP_CREATED",
    entityType: "BackupSnapshot",
    entityId: snapshotRecord.id,
    summary: `Encrypted local backup ${label} created`,
  });

  return snapshotRecord;
}

export async function importEncryptedBackup(
  prisma: PrismaClient,
  actor: ActorContext,
  input: {
    label?: string;
    encryptedPayload: string;
  },
) {
  await mkdir(backupDir, { recursive: true });

  const encryptedPayload = input.encryptedPayload.trim();

  try {
    const decryptedPayload = JSON.parse(decryptText(encryptedPayload));
    assertBackupSnapshotShape(decryptedPayload);
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.startsWith("Backup file")
        ? error.message
        : "Backup file could not be decrypted or verified.",
    );
  }

  const checksum = createHash("sha256").update(encryptedPayload).digest("hex");
  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
  const label = `${normalizeBackupLabel(input.label)}-${timestamp}`;
  const filePath = path.join(backupDir, `${label}.enc`);

  await writeFile(filePath, encryptedPayload, "utf8");

  const snapshotRecord = await prisma.backupSnapshot.create({
    data: {
      label,
      filePath,
      checksum,
      encrypted: true,
      createdBy: actor.displayName,
    },
  });

  await recordAudit(prisma, actor, {
    action: "BACKUP_IMPORTED",
    entityType: "BackupSnapshot",
    entityId: snapshotRecord.id,
    summary: `Encrypted backup ${label} imported`,
  });

  return snapshotRecord;
}

export async function restoreBackup(
  prisma: PrismaClient,
  actor: ActorContext,
  snapshotId: string,
) {
  const snapshot = await prisma.backupSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
  });
  const encryptedPayload = await readFile(snapshot.filePath, "utf8");
  const checksum = createHash("sha256").update(encryptedPayload).digest("hex");

  if (checksum !== snapshot.checksum) {
    throw new Error("Backup checksum verification failed.");
  }

  const restored = reviveDates(JSON.parse(decryptText(encryptedPayload)));

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany();
    await tx.notificationQueue.deleteMany();
    await tx.paymentRecord.deleteMany();
    await tx.invoiceLine.deleteMany();
    await tx.invoice.deleteMany();
    await tx.report.deleteMany();
    await tx.imagingStudy.deleteMany();
    await tx.sample.deleteMany();
    await tx.orderItem.deleteMany();
    await tx.diagnosticOrder.deleteMany();
    await tx.patient.deleteMany();
    await tx.inventoryTransaction.deleteMany();
    await tx.inventoryItem.deleteMany();
    await tx.maintenanceEvent.deleteMany();
    await tx.instrument.deleteMany();
    await tx.qualityControlEvent.deleteMany();
    await tx.syncEvent.deleteMany();
    await tx.appSession.deleteMany();
    await tx.appUser.deleteMany();
    await tx.catalogItem.deleteMany();
    await tx.facility.deleteMany();

    await tx.facility.createMany({ data: restored.facilities });
    await tx.appUser.createMany({ data: restored.users });
    await tx.appSession.createMany({ data: restored.sessions });
    await tx.catalogItem.createMany({ data: restored.catalogItems });
    await tx.patient.createMany({ data: restored.patients });
    await tx.instrument.createMany({ data: restored.instruments });
    await tx.diagnosticOrder.createMany({ data: restored.orders });
    await tx.orderItem.createMany({ data: restored.orderItems });
    await tx.sample.createMany({ data: restored.samples });
    await tx.imagingStudy.createMany({ data: restored.imagingStudies });
    await tx.report.createMany({ data: restored.reports });
    await tx.invoice.createMany({ data: restored.invoices });
    await tx.invoiceLine.createMany({ data: restored.invoiceLines });
    await tx.inventoryItem.createMany({ data: restored.inventoryItems });
    await tx.inventoryTransaction.createMany({
      data: restored.inventoryTransactions,
    });
    await tx.qualityControlEvent.createMany({
      data: restored.qualityControlEvents,
    });
    await tx.maintenanceEvent.createMany({ data: restored.maintenanceEvents });
    await tx.paymentRecord.createMany({ data: restored.paymentRecords });
    await tx.notificationQueue.createMany({ data: restored.notifications });
    await tx.syncEvent.createMany({ data: restored.syncEvents });
    await tx.auditLog.createMany({ data: restored.auditLogs });
    await tx.backupSnapshot.update({
      where: { id: snapshotId },
      data: { restoredAt: new Date() },
    });
  });

  await recordAudit(prisma, actor, {
    action: "BACKUP_RESTORED",
    entityType: "BackupSnapshot",
    entityId: snapshotId,
    summary: `Backup ${snapshot.label} restored`,
  });

  return snapshot;
}
