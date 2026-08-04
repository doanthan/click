import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Pool } from "pg";

const root = process.cwd();
const requestedEnv = process.argv.find((arg) => arg.startsWith("--env="))?.slice(6);
const envFile = requestedEnv || ".env.production.local";

const duplicateKeys = [];

function loadEnv(filename) {
  const absolute = path.resolve(root, filename);
  if (!existsSync(absolute)) return false;
  // A key already present in the real environment wins over the file - that
  // mirrors how a deploy resolves. But WITHIN the file the LAST occurrence must
  // win, because that is what @next/env does and therefore what `next build`
  // inlines. This parser used to be first-wins, so a stale duplicate at the
  // bottom of the file shipped to production while this gate happily validated
  // the good value at the top: the file carried pk_live_ on line 20 and
  // pk_test_ on line 45, the gate passed, and the build inlined the test key.
  const preexisting = new Set(Object.keys(process.env));
  const seenInFile = new Set();
  for (const line of readFileSync(absolute, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1];
    if (seenInFile.has(key)) duplicateKeys.push(key);
    seenInFile.add(key);
    if (preexisting.has(key)) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}

const loaded = loadEnv(envFile);
const errors = [];
const warnings = [];

// A duplicate key is never intentional in a production env file, and it is
// invisible in every "did I set that?" grep that stops at the first hit.
for (const key of [...new Set(duplicateKeys)]) {
  errors.push(
    `${key} is defined more than once in ${envFile}; the last occurrence wins. Delete the stale one.`,
  );
}
const value = (name) => process.env[name]?.trim() || "";
const requireValue = (name) => {
  if (!value(name)) errors.push(`${name} is missing.`);
};

[
  "AUTH_SECRET",
  "AUTH_URL",
  "CLICK_MECHANIC_ENABLED",
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_MAPBOX_TOKEN",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PLATFORM_FEE_BPS",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "ADMIN_EMAILS",
  "SAFETY_INBOX_EMAIL",
].forEach(requireValue);

if (!value("SUPABASE_SECRET_KEY") && !value("SUPABASE_SERVICE_ROLE_KEY")) {
  errors.push("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing.");
}

const r2Names = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];
for (const name of r2Names) requireValue(name);
if (!value("R2_PUBLIC_URL") && !value("R2_TEMP_PUBLIC")) {
  errors.push("R2_PUBLIC_URL is missing.");
}

if (value("AUTH_SECRET").length < 32) errors.push("AUTH_SECRET must be at least 32 characters.");
if (value("CRON_SECRET").length < 32) errors.push("CRON_SECRET must be at least 32 characters.");
if (value("AUTH_URL") !== "https://www.letsclick.app") {
  errors.push("AUTH_URL must be https://www.letsclick.app.");
}
if (value("NEXT_PUBLIC_APP_URL") !== "https://www.letsclick.app") {
  errors.push("NEXT_PUBLIC_APP_URL must be https://www.letsclick.app.");
}
if (value("CLICK_MECHANIC_ENABLED") && value("CLICK_MECHANIC_ENABLED") !== "true") {
  errors.push("CLICK_MECHANIC_ENABLED must be true after the staging Click QA flow passes.");
}
if (value("STRIPE_SECRET_KEY") && !value("STRIPE_SECRET_KEY").startsWith("sk_live_")) {
  errors.push("STRIPE_SECRET_KEY must be a live-mode key.");
}
if (
  value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") &&
  !value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY").startsWith("pk_live_")
) {
  errors.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live-mode key.");
}
if (value("STRIPE_WEBHOOK_SECRET") && !value("STRIPE_WEBHOOK_SECRET").startsWith("whsec_")) {
  errors.push("STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret.");
}
if (value("STRIPE_WEBHOOK_SECRET_V2")) {
  if (!value("STRIPE_WEBHOOK_SECRET_V2").startsWith("whsec_")) {
    errors.push("STRIPE_WEBHOOK_SECRET_V2 must be a Stripe webhook signing secret.");
  }
  if (value("STRIPE_WEBHOOK_SECRET_V2") === value("STRIPE_WEBHOOK_SECRET")) {
    errors.push(
      "STRIPE_WEBHOOK_SECRET_V2 must be the v2 destination's own secret, not a copy of the v1 one.",
    );
  }
} else {
  warnings.push(
    "STRIPE_WEBHOOK_SECRET_V2 is unset: v2 account notifications are refused, so merchant payout status only refreshes on the onboarding return page.",
  );
}
if (value("RESEND_API_KEY") && !value("RESEND_API_KEY").startsWith("re_")) {
  errors.push("RESEND_API_KEY does not look like a Resend API key.");
}
// Resend verifies send.letsclick.app, not the root. A from address on the root
// is accepted by this file but rejected by Resend with a 403, which silently
// kills every magic link — so the check pins the actual verified subdomain.
if (
  value("RESEND_FROM_EMAIL") &&
  !/@send\.letsclick\.app[>\s]*$/i.test(value("RESEND_FROM_EMAIL"))
) {
  errors.push(
    "RESEND_FROM_EMAIL must send from the verified send.letsclick.app subdomain.",
  );
}
if (
  value("ADMIN_EMAILS") &&
  value("SAFETY_INBOX_EMAIL") &&
  /example\.com|click\.local/i.test(`${value("ADMIN_EMAILS")},${value("SAFETY_INBOX_EMAIL")}`)
) {
  errors.push("ADMIN_EMAILS and SAFETY_INBOX_EMAIL must use real monitored inboxes.");
}
if (value("NEXT_PUBLIC_MODE").toUpperCase() === "DEVELOPMENT") {
  errors.push("NEXT_PUBLIC_MODE must be unset in production.");
}

const fee = Number(value("PLATFORM_FEE_BPS"));
if (value("PLATFORM_FEE_BPS") && (!Number.isInteger(fee) || fee <= 0 || fee > 5_000)) {
  errors.push("PLATFORM_FEE_BPS must be an integer from 1 to 5000.");
}
if (!value("AUTH_GOOGLE_ID") || !value("AUTH_GOOGLE_SECRET")) {
  warnings.push("Google OAuth is disabled until AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set.");
}

const vercel = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8"));
for (const cron of vercel.crons ?? []) {
  const target = path.join(root, "src/app", cron.path, "route.ts");
  if (!existsSync(target)) errors.push(`Cron target does not exist: ${cron.path}`);
}

if (value("DATABASE_URL")) {
  const databaseUrl = value("DATABASE_URL");
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    ssl: /supabase\.(co|com)/.test(databaseUrl)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  try {
    const ledger = await pool.query("select filename, checksum from schema_migrations");
    const applied = new Map(ledger.rows.map((row) => [row.filename, row.checksum]));
    const migrationFiles = readdirSync(path.join(root, "database"))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort();
    for (const filename of migrationFiles) {
      if (!applied.has(filename)) {
        errors.push(`Database migration is not applied: ${filename}`);
        continue;
      }
      const sql = readFileSync(path.join(root, "database", filename), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      if (applied.get(filename) !== checksum) {
        warnings.push(`Migration file changed after apply: ${filename}`);
      }
    }
    const objects = await pool.query(
      `select to_regclass('public.clicks')::text as clicks,
              to_regclass('public.mutual_clicks')::text as mutual_clicks,
              to_regclass('public.click_proposals')::text as click_proposals,
              to_regclass('public.event_capacity_v')::text as event_capacity_v`,
    );
    for (const [name, present] of Object.entries(objects.rows[0] ?? {})) {
      if (!present) errors.push(`Required database object is missing: ${name}`);
    }
  } catch {
    errors.push("Could not verify the production database migration ledger.");
  } finally {
    await pool.end();
  }
}

console.log(`Release environment: ${loaded ? envFile : "process environment"}`);
for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const error of errors) console.error(`FAIL  ${error}`);

if (errors.length > 0) {
  console.error(`\nRelease check failed with ${errors.length} blocker(s).`);
  process.exit(1);
}

console.log("PASS  Production configuration is ready for deployment.");
