// Migration runner with an applied-migrations ledger (schema_migrations).
//
// Each file is sent as a single simple query, so Postgres runs it as one
// implicit transaction - a mid-file error rolls that file back. Files already
// recorded in schema_migrations are skipped; a file that applies cleanly is
// recorded (basename + sha256). Uses the same connection settings as the app
// (Supabase pooler + relaxed TLS).
//
//   node scripts/run-migrations.mjs database/001_schema.sql database/002_seed.sql ...
//     Apply each not-yet-recorded file in order, recording it on success.
//
//   node scripts/run-migrations.mjs --baseline database/0*.sql
//     Record the given files as applied WITHOUT running their SQL. One-time use
//     to capture a database whose schema predates this ledger, so a subsequent
//     normal run won't try to re-execute already-applied (and possibly
//     non-idempotent) migrations.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env loader so a plain `node` invocation sees the same DATABASE_URL
// Next.js would. .env.local wins over .env, matching Next's precedence.
function loadEnv(file) {
  try {
    const text = readFileSync(path.join(root, file), "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      // Values in .env.local are quoted; strip one matched pair so the URL parses.
      if (match && !(match[1] in process.env))
        process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch {
    /* file is optional */
  }
}
loadEnv(".env.local");
loadEnv(".env");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (.env.local / .env).");
  process.exit(1);
}

const argv = process.argv.slice(2);
const baseline = argv.includes("--baseline");
const files = argv.filter((arg) => arg !== "--baseline");
if (files.length === 0) {
  console.error("Usage: node scripts/run-migrations.mjs [--baseline] <file.sql> [...]");
  process.exit(1);
}

const needsSsl = /supabase\.(co|com)/.test(connectionString);
const pool = new Pool({
  connectionString,
  max: 1,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

const checksum = (sql) => createHash("sha256").update(sql).digest("hex");
const record = (name, sum) =>
  pool.query(
    "insert into schema_migrations (filename, checksum) values ($1, $2) on conflict (filename) do nothing",
    [name, sum]
  );

try {
  // Bootstrap the ledger so the very first run (before 021 is applied) works.
  await pool.query(`create table if not exists schema_migrations (
    filename text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`);

  const { rows } = await pool.query("select filename, checksum from schema_migrations");
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

  for (const file of files) {
    const name = path.basename(file);
    const sql = readFileSync(path.join(root, file), "utf8");
    const sum = checksum(sql);

    if (applied.has(name)) {
      const drift =
        applied.get(name) !== sum ? "  (warning: file changed since it was applied)" : "";
      console.log(`Skipping ${name} - already applied${drift}`);
      continue;
    }

    if (baseline) {
      await record(name, sum);
      console.log(`Baselined ${name} - recorded as applied (SQL not run)`);
      continue;
    }

    process.stdout.write(`Applying ${name} ... `);
    try {
      await pool.query(sql);
      await record(name, sum);
      console.log("OK");
    } catch (error) {
      console.log("FAILED");
      console.error(`  ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await pool.end();
}

if (process.exitCode !== 1) console.log(baseline ? "Baseline complete." : "Migrations up to date.");
