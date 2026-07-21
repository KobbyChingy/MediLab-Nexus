import { PrismaClient } from "@prisma/client";

declare global {
  var medilabPrisma: PrismaClient | undefined;
}

if (process.platform === "win32" && !process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
}

export const prisma = globalThis.medilabPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.medilabPrisma = prisma;
}

export * from "@prisma/client";
