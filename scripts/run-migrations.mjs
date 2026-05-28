// One-off migration runner. Applies the given SQL files in order against
// DATABASE_URL, using the same connection settings as the app (Supabase pooler
// + relaxed TLS). Each file is sent as a single simple query, so Postgres runs
// it as one implicit transaction — a mid-file error rolls that file back.
//
//   node scripts/run-migrations.mjs database/001_schema.sql database/002_seed.sql ...
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
      if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
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

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/run-migrations.mjs <file.sql> [...]");
  process.exit(1);
}

const needsSsl = /supabase\.(co|com)/.test(connectionString);
const pool = new Pool({
  connectionString,
  max: 1,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

try {
  for (const file of files) {
    const sql = readFileSync(path.join(root, file), "utf8");
    process.stdout.write(`Applying ${file} ... `);
    try {
      await pool.query(sql);
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

if (process.exitCode !== 1) console.log("All migrations applied.");
