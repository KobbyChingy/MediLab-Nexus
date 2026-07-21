import { app, BrowserWindow, dialog } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

let mainWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;
let workerProcess: ChildProcess | null = null;
let quitting = false;

type DesktopConfig = {
  hostedUrl?: string;
};

function getRuntimeRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "runtime")
    : repoRoot;
}

function getDesktopConfigPath() {
  return path.join(app.getAppPath(), "desktop.config.json");
}

function getApiEntry(runtimeRoot: string) {
  return path.join(runtimeRoot, "apps", "api", "dist", "server.js");
}

function getWorkerEntry(runtimeRoot: string) {
  return path.join(runtimeRoot, "apps", "api", "dist", "worker.js");
}

function getWebDist(runtimeRoot: string) {
  return path.join(runtimeRoot, "apps", "web", "dist");
}

function getSchemaPath(runtimeRoot: string) {
  return path.join(runtimeRoot, "packages", "db", "prisma", "schema.prisma");
}

function getPrismaCliPath(runtimeRoot: string) {
  return path.join(runtimeRoot, "node_modules", "prisma", "build", "index.js");
}

function toSqliteUrl(filePath: string) {
  return `file:${filePath.replace(/\\/gu, "/")}`;
}

function onceClosed(child: ChildProcess | null) {
  if (!child) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    child.once("close", () => resolve());
  });
}

async function findAvailablePort(startPort: number) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.unref();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
    });

    if (available) {
      return port;
    }
  }

  throw new Error("No available desktop port was found.");
}

function buildRuntimeEnv(runtimeRoot: string, dataRoot: string, port: number) {
  const isWindows = process.platform === "win32";

  return {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DATABASE_URL: toSqliteUrl(path.join(dataRoot, "medilab-nexus.db")),
    MEDILAB_STORAGE_ROOT: path.join(dataRoot, "storage"),
    MEDILAB_WEB_DIST: getWebDist(runtimeRoot),
    MEDILAB_ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
    MEDILAB_TRUST_PROXY: "false",
    MEDILAB_SESSION_COOKIE_SECURE: "false",
    MEDILAB_SESSION_COOKIE_DOMAIN: "",
    MEDILAB_SESSION_COOKIE_SAMESITE: "Lax",
    MEDILAB_DISPATCH_INTERVAL_MS:
      process.env.MEDILAB_DISPATCH_INTERVAL_MS ?? "30000",
    MEDILAB_DISPATCH_BATCH_SIZE:
      process.env.MEDILAB_DISPATCH_BATCH_SIZE ?? "25",
    PRISMA_HIDE_UPDATE_MESSAGE: "1",
    ...(isWindows ? { PRISMA_CLIENT_ENGINE_TYPE: "binary" } : {}),
    ...(isWindows ? { PRISMA_CLI_QUERY_ENGINE_TYPE: "binary" } : {}),
  };
}

async function loadDesktopConfig() {
  const envHostedUrl = process.env.MEDILAB_DESKTOP_HOSTED_URL?.trim();
  if (envHostedUrl) {
    return { hostedUrl: envHostedUrl } satisfies DesktopConfig;
  }

  try {
    const raw = await readFile(getDesktopConfigPath(), "utf8");
    const parsed = JSON.parse(raw) as DesktopConfig;
    return parsed;
  } catch {
    return {} satisfies DesktopConfig;
  }
}

function normalizeHostedUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MEDILAB hosted URL must use http or https.");
  }

  return url.toString();
}

function spawnNodeScript(
  runtimeRoot: string,
  entryPath: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) {
  const child = spawn(process.execPath, [entryPath, ...args], {
    cwd: runtimeRoot,
    env: {
      ...env,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "pipe",
    windowsHide: true,
  });

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(chunk.toString());
  });

  child.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk.toString());
  });

  return child;
}

async function runPrismaDbPush(
  runtimeRoot: string,
  runtimeEnv: NodeJS.ProcessEnv,
) {
  const prismaCliPath = getPrismaCliPath(runtimeRoot);
  const schemaPath = getSchemaPath(runtimeRoot);
  const child = spawnNodeScript(
    runtimeRoot,
    prismaCliPath,
    ["db", "push", "--schema", schemaPath, "--skip-generate"],
    runtimeEnv,
  );

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`Prisma db push failed with exit code ${exitCode}.`);
  }
}

async function waitForServer(url: string, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function handleChildExit(name: string, child: ChildProcess) {
  child.once("close", (code) => {
    if (quitting) {
      return;
    }

    void dialog.showErrorBox(
      "MediLab Nexus",
      `${name} stopped unexpectedly with exit code ${code ?? 1}.`,
    );
    app.quit();
  });
}

async function stopChild(child: ChildProcess | null) {
  if (!child || child.killed) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    onceClosed(child),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);

  if (!child.killed) {
    child.kill("SIGKILL");
    await onceClosed(child);
  }
}

async function startDesktopRuntime() {
  const runtimeRoot = getRuntimeRoot();
  const dataRoot = path.join(app.getPath("userData"), "runtime-data");
  const port = await findAvailablePort(4540);

  await mkdir(path.join(dataRoot, "storage", "reports"), { recursive: true });
  await mkdir(path.join(dataRoot, "storage", "backups"), { recursive: true });

  const runtimeEnv = buildRuntimeEnv(runtimeRoot, dataRoot, port);
  await runPrismaDbPush(runtimeRoot, runtimeEnv);

  apiProcess = spawnNodeScript(runtimeRoot, getApiEntry(runtimeRoot), [], {
    ...runtimeEnv,
    MEDILAB_DISPATCH_WORKER_ENABLED: "false",
  });
  handleChildExit("API server", apiProcess);

  workerProcess = spawnNodeScript(runtimeRoot, getWorkerEntry(runtimeRoot), [], {
    ...runtimeEnv,
    MEDILAB_DISPATCH_WORKER_ENABLED: "true",
  });
  handleChildExit("Integration worker", workerProcess);

  await waitForServer(`http://127.0.0.1:${port}/ready`);
  return { port };
}

async function resolveDesktopTarget() {
  const desktopConfig = await loadDesktopConfig();
  const hostedUrl = normalizeHostedUrl(desktopConfig.hostedUrl);

  if (hostedUrl) {
    return { url: hostedUrl, hosted: true } as const;
  }

  const { port } = await startDesktopRuntime();
  return { url: `http://127.0.0.1:${port}`, hosted: false } as const;
}

async function createMainWindow() {
  const target = await resolveDesktopTarget();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1200,
    minHeight: 820,
    autoHideMenuBar: true,
    backgroundColor: "#f3efe7",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(target.url);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(() => createMainWindow()).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("MediLab Nexus", message);
    app.quit();
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", (event) => {
  if (quitting) {
    return;
  }

  event.preventDefault();
  quitting = true;
  Promise.all([stopChild(workerProcess), stopChild(apiProcess)])
    .catch(() => undefined)
    .finally(() => {
      app.exit(0);
    });
});