import type { PrismaClient } from "@medilab/db";
import type { ActorContext } from "./security.js";
import { recordAudit } from "./audit.js";

type DispatchAuditPayload = {
  processedEvents: number;
  syncedEvents: number;
  failedEvents: number;
  conflictedEvents: number;
  deferredEvents: number;
  sentNotifications: number;
  deferredNotifications: number;
};

function getIntegrationEndpoint() {
  return (
    process.env.MEDILAB_INTEGRATION_ENDPOINT ??
    process.env.MEDILAB_SYNC_REMOTE_URL ??
    null
  );
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getIntegrationWorkerConfig() {
  const enabled = !["0", "false", "no"].includes(
    (process.env.MEDILAB_DISPATCH_WORKER_ENABLED ?? "true").toLowerCase(),
  );

  return {
    enabled,
    intervalMs: readPositiveInt(
      process.env.MEDILAB_DISPATCH_INTERVAL_MS,
      30000,
    ),
    batchSize: readPositiveInt(process.env.MEDILAB_DISPATCH_BATCH_SIZE, 25),
  };
}

export function hasIntegrationDispatchTargets() {
  return Boolean(
    getIntegrationEndpoint() || process.env.MEDILAB_NOTIFICATION_WEBHOOK_URL,
  );
}

function parseDispatchAuditPayload(payloadJson: string | null) {
  if (!payloadJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadJson) as Partial<DispatchAuditPayload>;
    if (
      typeof parsed.processedEvents !== "number" ||
      typeof parsed.syncedEvents !== "number" ||
      typeof parsed.failedEvents !== "number" ||
      typeof parsed.conflictedEvents !== "number" ||
      typeof parsed.deferredEvents !== "number" ||
      typeof parsed.sentNotifications !== "number" ||
      typeof parsed.deferredNotifications !== "number"
    ) {
      return null;
    }

    return parsed as DispatchAuditPayload;
  } catch {
    return null;
  }
}

export async function getIntegrationDispatchStatus(prisma: PrismaClient) {
  const [
    pending,
    failed,
    conflicts,
    synced,
    queuedNotifications,
    failedNotifications,
    latestEvent,
    latestNotification,
    latestRun,
  ] = await Promise.all([
    prisma.syncEvent.count({ where: { status: "PENDING_SYNC" } }),
    prisma.syncEvent.count({ where: { status: "FAILED" } }),
    prisma.syncEvent.count({ where: { status: "CONFLICT" } }),
    prisma.syncEvent.count({ where: { status: "SYNCED" } }),
    prisma.notificationQueue.count({ where: { status: "QUEUED" } }),
    prisma.notificationQueue.count({ where: { status: "FAILED" } }),
    prisma.syncEvent.findFirst({
      where: { lastAttemptAt: { not: null } },
      orderBy: { lastAttemptAt: "desc" },
    }),
    prisma.notificationQueue.findFirst({
      where: { sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
    }),
    prisma.auditLog.findFirst({
      where: { action: "INTEGRATION_DISPATCH_RUN" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const integrationConfigured = Boolean(getIntegrationEndpoint());
  const notificationGatewayConfigured = Boolean(
    process.env.MEDILAB_NOTIFICATION_WEBHOOK_URL,
  );
  const worker = getIntegrationWorkerConfig();
  const lastAttemptAt =
    latestEvent?.lastAttemptAt?.toISOString() ??
    latestNotification?.sentAt?.toISOString() ??
    null;
  const lastRunPayload = parseDispatchAuditPayload(
    latestRun?.payloadJson ?? null,
  );

  return {
    pending,
    failed,
    conflicts,
    synced,
    queuedNotifications,
    failedNotifications,
    lastAttemptAt,
    integrationConfigured,
    notificationGatewayConfigured,
    mode: integrationConfigured
      ? ("connected" as const)
      : ("standalone" as const),
    worker: {
      ...worker,
      targetsConfigured: hasIntegrationDispatchTargets(),
    },
    lastRun:
      latestRun && lastRunPayload
        ? {
            triggeredAt: latestRun.createdAt.toISOString(),
            triggeredBy: latestRun.actorName,
            processedEvents: lastRunPayload.processedEvents,
            syncedEvents: lastRunPayload.syncedEvents,
            failedEvents: lastRunPayload.failedEvents,
            conflictedEvents: lastRunPayload.conflictedEvents,
            deferredEvents: lastRunPayload.deferredEvents,
            sentNotifications: lastRunPayload.sentNotifications,
            deferredNotifications: lastRunPayload.deferredNotifications,
          }
        : null,
  };
}

export async function runIntegrationDispatchCycle(
  prisma: PrismaClient,
  actor: ActorContext,
  limit = 25,
) {
  const integrationEndpoint = getIntegrationEndpoint();
  const notificationUrl = process.env.MEDILAB_NOTIFICATION_WEBHOOK_URL;
  const events = await prisma.syncEvent.findMany({
    where: { status: { in: ["PENDING_SYNC", "FAILED", "CONFLICT"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const notifications = await prisma.notificationQueue.findMany({
    where: {
      status: "QUEUED",
      recipient: { not: { startsWith: "internal:" } },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let syncedEvents = 0;
  let failedEvents = 0;
  let conflictedEvents = 0;
  let deferredEvents = 0;
  let sentNotifications = 0;
  let deferredNotifications = 0;

  for (const event of events) {
    if (!integrationEndpoint) {
      deferredEvents += 1;
      await prisma.syncEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          conflictNote:
            "Integration endpoint not configured; event retained for later dispatch.",
        },
      });
      continue;
    }

    try {
      const response = await fetch(integrationEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-medilab-origin": actor.username,
        },
        body: JSON.stringify({
          entityType: event.entityType,
          entityId: event.entityId,
          operation: event.operation,
          payload: JSON.parse(event.payload),
        }),
      });

      if (response.status === 409) {
        conflictedEvents += 1;
        await prisma.syncEvent.update({
          where: { id: event.id },
          data: {
            status: "CONFLICT",
            attempts: { increment: 1 },
            lastAttemptAt: new Date(),
            conflictNote: await response.text(),
          },
        });
        continue;
      }

      if (!response.ok) {
        failedEvents += 1;
        await prisma.syncEvent.update({
          where: { id: event.id },
          data: {
            status: "FAILED",
            attempts: { increment: 1 },
            lastAttemptAt: new Date(),
            conflictNote: `${response.status} ${response.statusText}`,
          },
        });
        continue;
      }

      syncedEvents += 1;
      await prisma.syncEvent.update({
        where: { id: event.id },
        data: {
          status: "SYNCED",
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          conflictNote: null,
        },
      });
    } catch (error) {
      failedEvents += 1;
      await prisma.syncEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          conflictNote:
            error instanceof Error ? error.message : "Unknown sync error",
        },
      });
    }
  }

  for (const notification of notifications) {
    if (!notificationUrl) {
      deferredNotifications += 1;
      continue;
    }

    try {
      const response = await fetch(notificationUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channel: notification.channel,
          recipient: notification.recipient,
          message: notification.message,
          traceCode: notification.traceCode,
        }),
      });

      if (!response.ok) {
        await prisma.notificationQueue.update({
          where: { id: notification.id },
          data: { status: "FAILED" },
        });
        continue;
      }

      sentNotifications += 1;
      await prisma.notificationQueue.update({
        where: { id: notification.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    } catch {
      await prisma.notificationQueue.update({
        where: { id: notification.id },
        data: { status: "FAILED" },
      });
    }
  }

  const status = await getIntegrationDispatchStatus(prisma);
  if (events.length > 0 || notifications.length > 0) {
    const auditPayload = {
      processedEvents: events.length,
      syncedEvents,
      failedEvents,
      conflictedEvents,
      deferredEvents,
      sentNotifications,
      deferredNotifications,
    } satisfies DispatchAuditPayload;

    await recordAudit(prisma, actor, {
      action: "INTEGRATION_DISPATCH_RUN",
      entityType: "SyncEvent",
      entityId: "batch",
      summary: `Dispatch cycle processed ${events.length} outbound event(s) and ${notifications.length} notification(s)`,
      payload: auditPayload,
    });
  }

  return {
    ...status,
    processedEvents: events.length,
    syncedEvents,
    failedEvents,
    conflictedEvents,
    deferredEvents,
    sentNotifications,
    deferredNotifications,
  };
}
