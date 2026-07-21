import type { Prisma, PrismaClient } from "@medilab/db";
import type { ActorContext } from "./security.js";

type AuditClient = PrismaClient | Prisma.TransactionClient;

export async function recordAudit(
  client: AuditClient,
  actor: ActorContext,
  details: {
    action: string;
    entityType: string;
    entityId: string;
    traceCode?: string | null;
    summary: string;
    payload?: unknown;
  },
) {
  await client.auditLog.create({
    data: {
      actorName: actor.displayName,
      actorRole: actor.role,
      action: details.action,
      entityType: details.entityType,
      entityId: details.entityId,
      traceCode: details.traceCode,
      summary: details.summary,
      payloadJson: details.payload ? JSON.stringify(details.payload) : null,
    },
  });
}
