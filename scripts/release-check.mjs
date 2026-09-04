import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Pool } from "pg";

const root = process.cwd();
const requestedEnv = process.argv.find((arg) => arg.startsWith("--env="))?.slice(6);
const envFile = requestedEnv || ".env.production.local";
// UAT deliberately runs on the production domain with Stripe test mode and QA
// personas. Keep `release:check` useful there, but make the final launch gate
// refuse every piece of UAT-only state via `npm run launch:check`.
const launchMode = process.argv.includes("--launch");

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

// Public media (avatars, galleries, event images) has two interchangeable
// backends. readR2Config() in src/lib/public-media-storage.ts is all-or-
// nothing: miss any one value and every upload helper silently falls back to
// the public Supabase `avatars` bucket. So the gate blocks only when NEITHER
// backend can serve. A half-configured R2 is a warning, not a blocker - the
// app still works, it just isn't on R2 yet.
const r2Names = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];
const missingR2 = r2Names.filter((name) => !value(name));
if (!value("R2_PUBLIC_URL") && !value("R2_TEMP_PUBLIC")) missingR2.push("R2_PUBLIC_URL");
// Mirrors getSupabaseAdmin(), which takes the new sb_secret_ key or the legacy
// service-role JWT, plus readPublicBase() for the resulting <img src>.
const supabaseMediaReady =
  Boolean(value("NEXT_PUBLIC_SUPABASE_URL")) &&
  Boolean(value("SUPABASE_SECRET_KEY") || value("SUPABASE_SERVICE_ROLE_KEY"));

if (missingR2.length > 0) {
  if (supabaseMediaReady) {
    warnings.push(
      `R2 is not configured (missing ${missingR2.join(", ")}); public media uses the Supabase 'avatars' bucket.`,
    );
  } else {
    errors.push(
      `No public media backend: R2 is missing ${missingR2.join(", ")} and Supabase Storage is not configured either.`,
    );
  }
} else if (!value("R2_PUBLIC_URL")) {
  // R2 is otherwise complete, so it WILL activate - but the base URL would come
  // from R2_TEMP_PUBLIC, which points at an unrelated project's CDN. Objects
  // would write to R2_BUCKET_NAME while every returned <img src> 404s.
  errors.push(
    "R2 is active but R2_PUBLIC_URL is unset, so image URLs fall back to R2_TEMP_PUBLIC. Set R2_PUBLIC_URL to the domain bound to R2_BUCKET_NAME.",
  );
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
// Production normally demands live keys. STRIPE_ALLOW_TEST_MODE=true opts the
// deployment into a Stripe sandbox for UAT on the real domain, and must match
// isStripeTestModeAllowed() in src/lib/stripe.ts - set it in only one of the
// two and the app refuses the very key this gate just waved through.
const allowStripeTestMode = value("STRIPE_ALLOW_TEST_MODE") === "true";
const stripeKeyIssues = [];
if (value("STRIPE_SECRET_KEY") && !value("STRIPE_SECRET_KEY").startsWith("sk_live_")) {
  stripeKeyIssues.push("STRIPE_SECRET_KEY must be a live-mode key.");
}
if (
  value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") &&
  !value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY").startsWith("pk_live_")
) {
  stripeKeyIssues.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live-mode key.");
}
if (!allowStripeTestMode) {
  errors.push(...stripeKeyIssues);
} else {
  if (launchMode) {
    errors.push(
      "STRIPE_ALLOW_TEST_MODE must be unset for launch; restore a matching live Stripe key pair.",
    );
  }
  if (stripeKeyIssues.length > 0) {
    warnings.push(
      `STRIPE_ALLOW_TEST_MODE=true: this deploy runs against a Stripe sandbox, so no real money moves (${stripeKeyIssues.length} live-key check(s) waived). Unset it and restore live keys before launch.`,
    );
  }
  // A split pair is the one combination that fails silently. Both halves pass
  // their own prefix check, then the server mints a test-mode Session while the
  // browser bundle carries a live pk_, and Stripe.js rejects the client_secret
  // with a mode mismatch - at the payment step, in front of the buyer.
  if (value("STRIPE_SECRET_KEY") && value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")) {
    const secretMode = value("STRIPE_SECRET_KEY").startsWith("sk_live_") ? "live" : "test";
    const publishableMode = value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY").startsWith("pk_live_")
      ? "live"
      : "test";
    if (secretMode !== publishableMode) {
      errors.push(
        `STRIPE_SECRET_KEY is ${secretMode}-mode but NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is ${publishableMode}-mode. Embedded checkout fails on a split pair.`,
      );
    }
  }
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
// kills every magic link - so the check pins the actual verified subdomain.
if (
  value("RESEND_FROM_EMAIL") &&
  !/@send\.letsclick\.app[>\s]*$/i.test(value("RESEND_FROM_EMAIL"))
) {
  errors.push(
    "RESEND_FROM_EMAIL must send from the verified send.letsclick.app subdomain.",
  );
}
const adminEmails = value("ADMIN_EMAILS")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const placeholderInbox = /@(example\.com|click\.local)$/i;
const invalidAdminPlaceholders = adminEmails.filter(
  (email) => placeholderInbox.test(email) && email !== "admin@click.local",
);

// Production needs at least one real operator, but admin@click.local is also
// intentional: it is the seeded Admin persona in the gated QA account switcher.
// Permit only that exact QA address, never the whole namespace and never as the
// sole admin. The QA persona still cannot mint its own long-lived unlock grant
// (src/lib/test-switcher.ts), so this does not widen the switcher's boundary.
if (invalidAdminPlaceholders.length > 0) {
  errors.push("ADMIN_EMAILS contains an unmonitored placeholder address.");
}
if (adminEmails.length > 0 && !adminEmails.some((email) => !placeholderInbox.test(email))) {
  errors.push("ADMIN_EMAILS must include at least one real monitored inbox.");
}
if (launchMode && adminEmails.includes("admin@click.local")) {
  errors.push("ADMIN_EMAILS must not include admin@click.local for launch.");
}
if (value("SAFETY_INBOX_EMAIL") && placeholderInbox.test(value("SAFETY_INBOX_EMAIL"))) {
  errors.push("SAFETY_INBOX_EMAIL must use a real monitored inbox.");
}
if (launchMode && value("TEST_SWITCHER_KEY")) {
  errors.push("TEST_SWITCHER_KEY must be unset for launch.");
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
        const message = `Migration file changed after apply: ${filename}`;
        (launchMode ? errors : warnings).push(message);
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

    if (launchMode) {
      const launchData = await pool.query(
        `select
           (select count(*)::integer
              from profiles
             where email::text like '%@click.local') as qa_profiles,
           (select count(*)::integer
              from events
             where slug like 'qa-%') as qa_events,
           (select count(*)::integer
              from events
             where slug not like 'qa-%'
               and status in ('live', 'featured', 'locked', 'waitlist')
               and coalesce(ends_at, starts_at) > now()) as public_events,
           (select count(*)::integer
              from merchant_profiles merchant
              join profiles profile on profile.id = merchant.profile_id
             where profile.email::text not like '%@click.local'
               and profile.deleted_at is null
               and merchant.verification_status = 'approved') as approved_merchants`,
      );
      const state = launchData.rows[0] ?? {};
      if (Number(state.qa_profiles) > 0) {
        errors.push(`Production still contains ${state.qa_profiles} QA profile(s).`);
      }
      if (Number(state.qa_events) > 0) {
        errors.push(`Production still contains ${state.qa_events} QA event(s).`);
      }
      if (Number(state.public_events) === 0) {
        errors.push("Production has no upcoming non-QA public events.");
      }
      if (Number(state.approved_merchants) === 0) {
        warnings.push("Production has no approved non-QA merchants.");
      }
    }
  } catch {
    errors.push("Could not verify the production database migration ledger.");
  } finally {
    await pool.end();
  }
}

console.log(`Release environment: ${loaded ? envFile : "process environment"}`);
console.log(`Release mode: ${launchMode ? "public launch" : "deployment / UAT"}`);
for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const error of errors) console.error(`FAIL  ${error}`);

if (errors.length > 0) {
  console.error(`\nRelease check failed with ${errors.length} blocker(s).`);
  process.exit(1);
}

console.log(
  launchMode
    ? "PASS  Production configuration and data are ready for public launch."
    : "PASS  Production configuration is ready for deployment / UAT.",
);
