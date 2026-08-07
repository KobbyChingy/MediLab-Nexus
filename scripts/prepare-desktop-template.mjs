import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(repoRoot, "packages", "db", "prisma", "sqlite", "schema.prisma");
const templatePath = path.join(
  repoRoot,
  "packages",
  "db",
  "prisma",
  "desktop-template.db",
);
const stagingDir = path.join(repoRoot, ".desktop-staging", "template-build");
const stagingDatabasePath = path.join(stagingDir, "medilab-nexus.db");

function toSqliteUrl(filePath) {
  return `file:${filePath.replace(/\\/gu, "/")}`;
}

function runPrismaPush(databasePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(repoRoot, "scripts", "prisma-safe.mjs"),
        "db",
        "push",
        "--schema",
        schemaPath,
        "--skip-generate",
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          SQLITE_DATABASE_URL: toSqliteUrl(databasePath),
          PRISMA_HIDE_UPDATE_MESSAGE: "1",
          ...(process.platform === "win32"
            ? {
                PRISMA_CLIENT_ENGINE_TYPE: "binary",
                PRISMA_CLI_QUERY_ENGINE_TYPE: "binary",
              }
            : {}),
        },
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("close", (code) => {
      if ((code ?? 1) === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`Desktop template prisma db push failed with exit code ${code ?? 1}.`),
      );
    });
  });
}

await mkdir(stagingDir, { recursive: true });
await rm(stagingDatabasePath, { force: true });
await runPrismaPush(stagingDatabasePath);
await copyFile(stagingDatabasePath, templatePath);