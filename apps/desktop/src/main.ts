import { app, BrowserWindow, dialog } from "electron";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

type DesktopConfig = {
  hostedUrl?: string;
};

function getDesktopConfigPath() {
  return path.join(app.getAppPath(), "desktop.config.json");
}

async function loadDesktopConfig() {
  const envHostedUrl = process.env.MEDILAB_DESKTOP_HOSTED_URL?.trim();
  if (envHostedUrl) {
    return { hostedUrl: envHostedUrl } satisfies DesktopConfig;
  }

  try {
    const raw = await readFile(getDesktopConfigPath(), "utf8");
    return JSON.parse(raw) as DesktopConfig;
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

async function resolveDesktopTarget() {
  const desktopConfig = await loadDesktopConfig();
  const hostedUrl = normalizeHostedUrl(desktopConfig.hostedUrl);

  if (!hostedUrl) {
    throw new Error(
      "Hosted desktop URL is required. Set MEDILAB_DESKTOP_HOSTED_URL or apps/desktop/desktop.config.json hostedUrl to your deployed MediLab Nexus app. The legacy local SQLite desktop runtime is no longer supported.",
    );
  }

  return { url: hostedUrl } as const;
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
