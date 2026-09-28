// Behavioural check for publishEventsHeldForPayouts - the step that puts a
// trusted host's paid event live once their Stripe payouts are, instead of
// leaving it in the admin queue forever.
//
// Everything happens inside ONE transaction that is ALWAYS rolled back, so it
// is safe against the live database .env.local points at - same pattern as
// scripts/test-click-visibility.mjs. The SQL is EXTRACTED from
// src/lib/event-repository.ts rather than retyped (like
// scripts/verify-qa-personas.mjs), so this cannot pass against a copy that has
// drifted from what ships. tests/onboarding-friction.test.mjs asserts the
// guards are still in the source; this asserts they do the right thing.
//
//   node scripts/test-publish-held-events.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv(file) {
  try {
    for (const line of readFileSync(path.join(root, file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}
loadEnv(".env.local");
loadEnv(".env");

const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
const start = repo.indexOf("async function publishEventsHeldForPayouts");
if (start === -1) throw new Error("publishEventsHeldForPayouts not found in event-repository.ts");
const PUBLISH_SQL = repo.slice(start).match(/pool\.query<[^>]*>\(\s*`([\s\S]*?)`/)?.[1];
if (!PUBLISH_SQL?.includes("with published as")) throw new Error("could not extract the publish SQL");
console.log("extracted the publish SQL from event-repository.ts");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const pool = new Pool({
  connectionString,
  max: 1,
  ssl: /supabase\.(co|com)/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   - ${label}`);
  else {
    failures++;
    console.error(`  FAIL - ${label}`);
  }
}

const TAG = `phe-${randomUUID().slice(0, 8)}`;
const LEGACY_FOMO = "Pending admin review before being promoted to members.";

const db = await pool.connect();
try {
  await db.query("begin");

  const mkMerchant = async (name, m) => {
    const owner = await db.query(
      `insert into profiles (email, display_name, age, role)
       values ($1, $2, 30, 'attendee') returning id::text`,
      [`${TAG}-${name}@test.local`, `${TAG} ${name}`],
    );
    const r = await db.query(
      `insert into merchant_profiles (
         profile_id, business_name, contact_email, verification_status,
         stripe_connect_account_id, charges_enabled, payouts_enabled,
         details_submitted, onboarding_completed_at, auto_approve_events
       )
       values ($1::uuid, $2, $3, $4, $5, $6, $7, $6, now(), $8)
       returning id::text`,
      [
        owner.rows[0].id,
        `${TAG} ${name}`,
        `${TAG}-${name}@test.local`,
        m.status,
        `acct_${TAG}_${name}`,
        m.charges,
        m.payouts,
        m.trusted,
      ],
    );
    return r.rows[0].id;
  };

  const mkEvent = async (merchantId, key, e) => {
    const r = await db.query(
      `insert into events (slug, title, description, group_name, host_name, category,
         starts_at, ends_at, location_name, suburb, capacity, status, price_cents,
         merchant_profile_id, fomo)
       values ($1, $2, 'd', 'g', 'h', 'social',
               now() + $3::interval, now() + $3::interval + interval '2 hours',
               'loc', 'Sydney', 20, $4, $5, $6::uuid, $7)
       returning slug`,
      [
        `${TAG}-${key}`,
        `${TAG} ${key}`,
        e.startsIn ?? "10 days",
        e.status ?? "pending",
        e.price ?? 2500,
        merchantId,
        e.fomo ?? null,
      ],
    );
    return r.rows[0].slug;
  };

  const status = async (slug) =>
    (await db.query(`select status::text, fomo from events where slug = $1`, [slug])).rows[0];
  const publish = async (merchantId) =>
    (await db.query(PUBLISH_SQL, [merchantId])).rows.map((row) => row.slug).sort();

  // ── The host this is for: approved, trusted, charges AND payouts on ─────────
  const ready = await mkMerchant("ready", {
    status: "approved",
    trusted: true,
    charges: true,
    payouts: true,
  });
  const held = await mkEvent(ready, "held", {});
  const legacy = await mkEvent(ready, "legacy", { fomo: LEGACY_FOMO });
  const free = await mkEvent(ready, "free", { price: 0 });
  const past = await mkEvent(ready, "past", { startsIn: "-2 days" });
  const rejected = await mkEvent(ready, "rejected", { status: "rejected" });

  console.log("A. a ready, trusted host's held paid events go live");
  const published = await publish(ready);
  check("exactly the held upcoming paid events", JSON.stringify(published) === JSON.stringify([held, legacy].sort()));
  check("the held event is live", (await status(held)).status === "live");
  check("the legacy review sentinel is cleared", (await status(legacy)).fomo === null);
  check("a free pending event is left alone", (await status(free)).status === "pending");
  check("a pending event that already ended is left alone", (await status(past)).status === "pending");
  check("a rejected event is left alone", (await status(rejected)).status === "rejected");
  const audits = await db.query(
    `select count(*)::int as n from audit_logs
     where action = 'publish_event_payouts_ready' and actor_profile_id is null
       and metadata->>'slug' = any($1::text[])`,
    [[held, legacy]],
  );
  check("one audit row per published event, no actor", audits.rows[0].n === 2);
  check("a second sync publishes nothing (no repeat email)", (await publish(ready)).length === 0);

  console.log("B. anyone short of ready and trusted stays in the queue");
  for (const [name, m] of [
    ["untrusted", { status: "approved", trusted: false, charges: true, payouts: true }],
    ["no-payouts", { status: "approved", trusted: true, charges: true, payouts: false }],
    ["not-approved", { status: "pending", trusted: true, charges: true, payouts: true }],
  ]) {
    const merchant = await mkMerchant(name, m);
    const slug = await mkEvent(merchant, `${name}-held`, {});
    check(`${name}: nothing published`, (await publish(merchant)).length === 0);
    check(`${name}: event still pending`, (await status(slug)).status === "pending");
  }
} catch (error) {
  failures++;
  console.error("  FAIL - the check itself threw:", error.message);
} finally {
  await db.query("rollback").catch(() => {});
  const leftovers = await db.query(
    `select (select count(*) from events where slug like $1)::int as events,
            (select count(*) from merchant_profiles where business_name like $2)::int as merchants,
            (select count(*) from audit_logs where metadata->>'slug' like $1)::int as audits`,
    [`${TAG}-%`, `${TAG} %`],
  );
  const left = leftovers.rows[0];
  check(
    "rolled back - nothing left behind",
    left.events === 0 && left.merchants === 0 && left.audits === 0,
  );
  db.release();
  await pool.end();
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
