import { prisma } from "@medilab/db";
import { buildActorContext } from "./services/security.js";
import {
  getIntegrationWorkerConfig,
  hasIntegrationDispatchTargets,
  runIntegrationDispatchCycle,
} from "./services/sync.js";

const workerConfig = getIntegrationWorkerConfig();
const intervalMs = workerConfig.intervalMs;
const batchSize = workerConfig.batchSize;

const actor = buildActorContext({
  id: "integration-worker",
  facilityId: process.env.MEDILAB_FACILITY_ID ?? "system",
  username: "integration.worker",
  displayName: "Integration Worker",
  role: "ADMIN",
});

let stopping = false;
let cycleRunning = false;

async function runCycleOnce() {
  if (stopping || cycleRunning) {
    return;
  }

  if (!workerConfig.enabled) {
    return;
  }

  if (!hasIntegrationDispatchTargets()) {
    console.log(
      "[medilab-worker] No integration targets configured; worker idle.",
    );
    return;
  }

  cycleRunning = true;
  try {
    const result = await runIntegrationDispatchCycle(prisma, actor, batchSize);
    if (result.processedEvents > 0 || result.sentNotifications > 0) {
      console.log(
        `[medilab-worker] processed=${result.processedEvents} synced=${result.syncedEvents} failed=${result.failedEvents} notifications=${result.sentNotifications}`,
      );
    }
  } catch (error) {
    console.error("[medilab-worker] Dispatch cycle failed", error);
  } finally {
    cycleRunning = false;
  }
}

async function shutdown(signal: string) {
  if (stopping) {
    return;
  }
  stopping = true;
  console.log(`[medilab-worker] Received ${signal}, shutting down.`);
  clearInterval(timer);
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

console.log(
  `[medilab-worker] Starting integration worker enabled=${workerConfig.enabled} interval=${intervalMs}ms batchSize=${batchSize}`,
);

void runCycleOnce();
const timer = setInterval(() => {
  void runCycleOnce();
}, intervalMs);

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
