import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/prisma-safe.mjs <prisma args...>");
  process.exit(1);
}

const isWindows = process.platform === "win32";
const prismaArgs = ["prisma", ...args];
const maxAttempts = isWindows ? 3 : 1;
const prismaClientDir = path.resolve("node_modules", ".prisma", "client");
const canFallbackToNoEngine =
  isWindows && args[0] === "generate" && !args.includes("--no-engine");
const prismaEnv = {
  ...process.env,
  PRISMA_HIDE_UPDATE_MESSAGE: "1",
  ...(isWindows && !process.env.PRISMA_CLIENT_ENGINE_TYPE
    ? { PRISMA_CLIENT_ENGINE_TYPE: "binary" }
    : {}),
  ...(isWindows && !process.env.PRISMA_CLI_QUERY_ENGINE_TYPE
    ? { PRISMA_CLI_QUERY_ENGINE_TYPE: "binary" }
    : {}),
};

function looksLikeWindowsEngineLock(output) {
  return (
    output.includes("EPERM: operation not permitted, rename") &&
    (
      output.includes("query_engine-windows.dll.node") ||
      output.includes("query-engine-windows.exe")
    )
  );
}

async function cleanupStaleEngineTemps() {
  const entries = await readdir(prismaClientDir).catch(() => []);
  const targets = entries
    .filter(
      (entry) =>
        (entry.startsWith("query_engine-windows") ||
          entry.startsWith("query-engine-windows")) &&
        entry.includes(".tmp"),
    )
    .map((entry) => path.join(prismaClientDir, entry));

  await Promise.all(
    targets.map((target) => rm(target, { force: true }).catch(() => undefined)),
  );
}

function runOnce(commandArgs = prismaArgs) {
  return new Promise((resolve) => {
    const command = isWindows
      ? `npx ${commandArgs.map((arg) => `"${arg.replace(/"/gu, '\\"')}"`).join(" ")}`
      : "npx";
    const child = isWindows
      ? spawn(command, {
          shell: true,
          env: prismaEnv,
          stdio: ["inherit", "pipe", "pipe"],
        })
      : spawn("npx", commandArgs, {
          shell: false,
          env: prismaEnv,
          stdio: ["inherit", "pipe", "pipe"],
        });

    let combinedOutput = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, combinedOutput });
    });
  });
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  if (attempt > 1) {
    console.warn(
      `[medilab-prisma] Retry ${attempt}/${maxAttempts} after Windows engine lock during prisma ${args[0]}.`,
    );
    await cleanupStaleEngineTemps();
  }

  const result = await runOnce();
  if (result.code === 0) {
    process.exit(0);
  }

  if (!isWindows || !looksLikeWindowsEngineLock(result.combinedOutput)) {
    process.exit(result.code);
  }

  if (canFallbackToNoEngine) {
    console.warn(
      "[medilab-prisma] Windows engine file is locked; retrying prisma generate with --no-engine.",
    );
    await cleanupStaleEngineTemps();
    const noEngineResult = await runOnce([...prismaArgs, "--no-engine"]);
    if (noEngineResult.code === 0) {
      process.exit(0);
    }
  }

  if (attempt === maxAttempts) {
    console.error(
      "[medilab-prisma] Prisma query engine is locked on Windows. Stop running API, worker, or editor tasks that may be holding the engine DLL, then retry.",
    );
    process.exit(result.code);
  }
}
