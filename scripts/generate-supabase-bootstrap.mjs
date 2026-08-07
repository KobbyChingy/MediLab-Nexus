import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const outputPath = path.resolve("deploy", "supabase.bootstrap.sql");
const prismaArgs = [
  "prisma",
  "migrate",
  "diff",
  "--from-empty",
  "--to-schema-datamodel",
  "packages/db/prisma/schema.postgres.prisma",
  "--script",
];

const rowLevelSecurityBlock = `

DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
    SELECT format('%I.%I', table_schema, table_name) AS qualified_table_name
       , table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
    LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_record.table_name
        AND policyname = 'medilab_block_all_api_access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY medilab_block_all_api_access ON %s AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        table_record.qualified_table_name
      );
    END IF;
    END LOOP;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
`;

const createEnumPattern = /^CREATE TYPE ("[^"]+") AS ENUM \((.*)\);$/gmu;
const createTablePattern = /^CREATE TABLE ("[^"]+") \(/gmu;
const createUniqueIndexPattern = /^CREATE UNIQUE INDEX ("[^"]+") ON /gmu;
const createIndexPattern = /^CREATE INDEX ("[^"]+") ON /gmu;
const addConstraintPattern = /^ALTER TABLE ("[^"]+") ADD CONSTRAINT ("[^"]+") (.*);$/gmu;

function runPrismaDiff() {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    };
    const child =
      process.platform === "win32"
        ? spawn(`npx ${prismaArgs.join(" ")}`, {
            shell: true,
            env,
            stdio: ["inherit", "pipe", "pipe"],
          })
        : spawn("npx", prismaArgs, {
            shell: false,
            env,
            stdio: ["inherit", "pipe", "pipe"],
          });

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Prisma diff exited with code ${code ?? 1}.`));
        return;
      }

      resolve(stdout);
    });
  });
}

function injectInlineRowLevelSecurity(sql) {
  return sql.replace(
    /CREATE TABLE ("[^"]+") \([\s\S]*?\n\);/gu,
    (statement, tableName) =>
      `${statement}\n\nALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`,
  );
}

function makeBootstrapIdempotent(sql) {
  return sql
    .replace(createEnumPattern, (_statement, typeName, values) => {
      const typeLiteral = typeName.slice(1, -1);
      return [
        `DO $$`,
        `BEGIN`,
        `    IF NOT EXISTS (`,
        `        SELECT 1`,
        `        FROM pg_type type_info`,
        `        JOIN pg_namespace namespace_info ON namespace_info.oid = type_info.typnamespace`,
        `        WHERE type_info.typname = '${typeLiteral}'`,
        `          AND namespace_info.nspname = 'public'`,
        `    ) THEN`,
        `        CREATE TYPE ${typeName} AS ENUM (${values});`,
        `    END IF;`,
        `END`,
        `$$;`,
      ].join("\n");
    })
    .replace(createTablePattern, 'CREATE TABLE IF NOT EXISTS $1 (')
    .replace(createUniqueIndexPattern, 'CREATE UNIQUE INDEX IF NOT EXISTS $1 ON ')
    .replace(createIndexPattern, 'CREATE INDEX IF NOT EXISTS $1 ON ')
    .replace(
      addConstraintPattern,
      (_statement, tableName, constraintName, constraintBody) => {
        const tableLiteral = tableName.slice(1, -1).replaceAll("'", "''");
        const constraintLiteral = constraintName
          .slice(1, -1)
          .replaceAll("'", "''");

        return [
          `DO $$`,
          `BEGIN`,
          `    IF NOT EXISTS (`,
          `        SELECT 1`,
          `        FROM pg_constraint constraint_info`,
          `        JOIN pg_class table_info ON table_info.oid = constraint_info.conrelid`,
          `        JOIN pg_namespace namespace_info ON namespace_info.oid = table_info.relnamespace`,
          `        WHERE constraint_info.conname = '${constraintLiteral}'`,
          `          AND table_info.relname = '${tableLiteral}'`,
          `          AND namespace_info.nspname = 'public'`,
          `    ) THEN`,
          `        ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${constraintBody};`,
          `    END IF;`,
          `END`,
          `$$;`,
        ].join("\n");
      },
    );
}

const bootstrapSql = await runPrismaDiff();
const hardenedBootstrapSql =
  injectInlineRowLevelSecurity(makeBootstrapIdempotent(bootstrapSql)).trimEnd();
await writeFile(outputPath, `${hardenedBootstrapSql}${rowLevelSecurityBlock}`);

console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
