import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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