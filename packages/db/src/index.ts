import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

declare global {
  var medilabPrisma: PrismaClient | undefined;
}

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const envCandidates = [
    resolve(process.cwd(), ".env"),
    resolve(moduleDir, "..", "..", "..", ".env"),
  ];

  for (const candidate of envCandidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    process.loadEnvFile(candidate);
    if (process.env.DATABASE_URL) {
      break;
    }
  }
}

if (process.platform === "win32" && !process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
}

const databaseUrl = process.env.DATABASE_URL?.trim();

export const prisma =
  globalThis.medilabPrisma ??
  new PrismaClient(
    databaseUrl
      ? {
          datasources: {
            db: {
              url: databaseUrl,
            },
          },
        }
      : undefined,
  );

if (process.env.NODE_ENV !== "production") {
  globalThis.medilabPrisma = prisma;
}

export * from "@prisma/client";
