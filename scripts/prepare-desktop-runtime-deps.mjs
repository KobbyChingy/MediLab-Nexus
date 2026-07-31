import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const sourceNodeModulesRoot = path.join(repoRoot, "node_modules");
const stagingNodeModulesRoot = path.join(
  repoRoot,
  "dist-desktop",
  "runtime-node_modules",
);

const copiedPackages = new Set();

function getPackageDir(packageName) {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    return path.join(sourceNodeModulesRoot, scope, name);
  }

  return path.join(sourceNodeModulesRoot, packageName);
}

function getStagingPackageDir(packageName) {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    return path.join(stagingNodeModulesRoot, scope, name);
  }

  return path.join(stagingNodeModulesRoot, packageName);
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function copyPackage(packageName) {
  if (copiedPackages.has(packageName)) {
    return;
  }

  const sourceDir = getPackageDir(packageName);
  const packageJson = await readJson(path.join(sourceDir, "package.json"));

  copiedPackages.add(packageName);

  const dependencyNames = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ]);

  for (const dependencyName of dependencyNames) {
    await copyPackage(dependencyName);
  }

  const targetDir = getStagingPackageDir(packageName);
  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });
}

async function copyExplicitPath(relativePath) {
  const sourcePath = path.join(sourceNodeModulesRoot, relativePath);
  const targetPath = path.join(stagingNodeModulesRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true });
}

const workspacePackageJsonPaths = [
  path.join(repoRoot, "apps", "api", "package.json"),
  path.join(repoRoot, "packages", "db", "package.json"),
  path.join(repoRoot, "packages", "shared", "package.json"),
];

await rm(stagingNodeModulesRoot, { recursive: true, force: true });
await mkdir(stagingNodeModulesRoot, { recursive: true });

for (const packageJsonPath of workspacePackageJsonPaths) {
  const workspacePackageJson = await readJson(packageJsonPath);
  for (const dependencyName of Object.keys(workspacePackageJson.dependencies ?? {})) {
    if (dependencyName.startsWith("@medilab/")) {
      continue;
    }

    await copyPackage(dependencyName);
  }
}

for (const relativePath of [".prisma", "@prisma"]) {
  await copyExplicitPath(relativePath);
}