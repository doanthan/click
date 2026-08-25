// Proves the QA personas can actually do the things the switcher advertises.
//
// Everything happens inside ONE transaction that is ALWAYS rolled back, so it is
// safe to point at the production database this repo's .env.local already uses.
// The SQL is EXTRACTED from src/lib/qa-provision.ts rather than retyped, so this
// cannot pass against a copy that has drifted from what ships.
//
// Run: node scripts/verify-qa-personas.mjs
//
// Why it exists: the personas used to be provisioned with no birth_date, no age
// and no photo, and every one of those is a hard gate somewhere - birth_date at
// assertBookingEligible (every RSVP and checkout), age at the click layer's
// independent 18+ check, photo at the discovery pool. The personas looked fine
// and could not book or click. This is the check that fails if that returns.
import { readFileSync } from "node:fs";
import pg from "pg";

const src = readFileSync("src/lib/qa-provision.ts", "utf8");
const blocks = [...src.matchAll(/`\s*\n?\s*(insert into [\s\S]*?|update events[\s\S]*?|delete from [\s\S]*?)\s*`/g)].map(m => m[1]);
const pick = (needle) => {
  const hit = blocks.filter(b => b.includes(needle));
  if (hit.length !== 1) throw new Error(`expected 1 block for "${needle}", got ${hit.length}`);
  return hit[0];
};
const SQL_PROFILE = pick("insert into profiles");
const SQL_MERCHANT = pick("insert into merchant_profiles");
const SQL_EVENT_UPDATE = pick("update events set");
const SQL_EVENT_INSERT = pick("insert into events");
const SQL_ATTENDEE = pick("insert into event_attendees");
console.log("extracted 5 SQL blocks from qa-provision.ts");

const { QA_PERSONAS, QA_EVENTS } = await import("../src/lib/qa-personas.ts");
const MIN_CLICK_AGE = 18;

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)[1];
const pool = new pg.Pool({ connectionString: url, max: 1, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
let failed = 0;
const check = (ok, label) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failed++; };

try {
  await c.query("begin");

  for (const p of QA_PERSONAS) {
    if (p.suburb === null) continue;
    // isAdminEmail is env-driven; mirror the deployed answer (ADMIN_EMAILS unset here).
    const role = p.role === "admin" ? "attendee" : p.role;
    await c.query(SQL_PROFILE, [
      `qa:${p.email.split("@")[0]}`, role, p.email, p.displayName, p.suburb,
      `QA persona - ${p.exercises}`, p.birthDate, p.photoUrl,
    ]);
    if (p.merchant) {
      await c.query(SQL_MERCHANT, [
        p.email, p.merchant.businessName, p.merchant.verificationStatus,
        p.merchant.stripeAccountId, p.merchant.chargesEnabled, p.merchant.payoutsEnabled,
      ]);
    }
  }
  console.log("provisioned", QA_PERSONAS.filter(p => p.suburb).length, "personas");

  for (const e of QA_EVENTS) {
    const redated = await c.query(SQL_EVENT_UPDATE, [
      e.slug, e.title, String(e.daysFromNow), e.priceCents, e.capacity,
    ]);
    if (redated.rowCount === 0) {
      await c.query(SQL_EVENT_INSERT, [
        e.slug, e.title, e.description, e.ownerEmail, e.category,
        String(e.daysFromNow), e.locationName, e.suburb, e.priceCents, e.capacity,
      ]);
    }
    if (e.attendeeEmails.length > 0) await c.query(SQL_ATTENDEE, [e.slug, e.attendeeEmails]);
  }
  const ev = await c.query(`select slug, starts_at, ends_at, status::text from events where slug like 'qa-%' order by starts_at`);
  console.table(ev.rows);

  // --- the gates the personas previously failed -----------------------------
  // Only the personas the provisioner is meant to FILL. A persona with a null
  // suburb is the deliberately-blank one: it is deleted on every provision so
  // the signup journey stays re-runnable, and ensureProfileForSession recreates
  // it bare. Asserting it has an age would be asserting the opposite of what it
  // is for.
  const filled = new Set(QA_PERSONAS.filter((p) => p.suburb !== null).map((p) => p.email));
  const gate = await c.query(
    `select email::text, age, birth_date is not null as has_dob, photo_url, role::text
       from profiles where email = any($1::citext[]) order by email`, [[...filled]]);
  console.table(gate.rows);
  check(gate.rows.length === filled.size, `every filled persona exists (${gate.rows.length}/${filled.size})`);
  check(gate.rows.every(r => r.age !== null && r.age >= MIN_CLICK_AGE), "every persona clears the 18+ gate (profiles.age)");
  check(gate.rows.every(r => r.has_dob), "every persona has birth_date (assertBookingEligible + onboardingComplete)");
  check(gate.rows.filter(r => r.role === "attendee").every(r => r.photo_url && r.photo_url.startsWith("/")),
        "every attendee persona has a resolvable photo_url");

  // Maya's daily discovery pool, using the real predicates from the shipping query.
  const maya = (await c.query(`select id from profiles where email='maya@click.local'`)).rows[0].id;
  const pool_ = await c.query(
    `select p.email::text, p.display_name,
            (p.suburb is not distinct from (select suburb from profiles where id=$1::uuid)) as nearby
       from profiles p
      where p.id <> $1::uuid and p.role='attendee' and p.suspended_at is null
        and p.age >= ${MIN_CLICK_AGE} and p.is_banned = false and p.social_visible = true
        and (p.paused_until is null or p.paused_until <= now())
        and p.suburb is not null and p.bio is not null
        and p.photo_url is not null and p.photo_url <> ''
      order by p.email`, [maya]);
  console.table(pool_.rows);
  const qaInPool = pool_.rows.filter(r => r.email.endsWith("@click.local"));
  check(qaInPool.length >= 2, `Maya's discovery pool contains the other click personas (${qaInPool.length})`);
  check(qaInPool.some(r => r.email === "ruby@click.local" && r.nearby), "Ruby shows the 'you're both nearby' commonality");

  // The post-event "who was there" roster, using the shipping window predicates.
  const roster = await c.query(
    `select e.slug, other.display_name
       from events e
       join event_participants_v mine on mine.event_id = e.id and mine.profile_id = $1::uuid
       join event_participants_v theirs on theirs.event_id = e.id and theirs.profile_id <> $1::uuid
       join profiles other on other.id = theirs.profile_id
        and other.role='attendee' and other.suspended_at is null and other.is_banned = false
        and other.social_visible = true and other.default_attend_visibility
      where coalesce(e.ends_at,e.starts_at) + interval '2 hours' <= now()
        and coalesce(e.ends_at,e.starts_at) + interval '48 hours' > now()
      order by other.display_name`, [maya]);
  console.table(roster.rows);
  check(roster.rows.length >= 2, `Maya's post-event roster offers co-attendees (${roster.rows.length})`);

  // Both directions of a discovery click on the pair. Counted as a DELTA, not an
  // absolute: by the time anyone runs this the personas may already have clicked
  // each other for real, and an absolute count would fail on a database that is
  // working correctly. Mutual detection itself lives in sendClickInner (app code,
  // covered by tests/click-mechanic.test.mjs); what is proven here is that the
  // seeded pair is one the clicks table accepts.
  const ruby = (await c.query(`select id from profiles where email='ruby@click.local'`)).rows[0].id;
  const onPair = async () => Number((await c.query(
    `select count(*)::int n from clicks
      where (sender_id=$1::uuid and receiver_id=$2::uuid) or (sender_id=$2::uuid and receiver_id=$1::uuid)`,
    [maya, ruby])).rows[0].n);
  const before = await onPair();
  // uq_click_discovery is partial on status='pending', so an existing PENDING
  // click blocks a duplicate send. Clear the pair inside this doomed txn first -
  // it is rolled back either way.
  await c.query(`delete from clicks where (sender_id=$1::uuid and receiver_id=$2::uuid) or (sender_id=$2::uuid and receiver_id=$1::uuid)`, [maya, ruby]);
  for (const [a, b] of [[maya, ruby], [ruby, maya]]) {
    await c.query(
      `insert into clicks (sender_id, receiver_id, event_id, intent_mode, surface, status, expires_at)
       values ($1::uuid,$2::uuid,null,'friendship','discovery','pending', now() + interval '7 days')`, [a, b]);
  }
  const after = await onPair();
  check(after === 2, `both directions of a discovery click land on the pair (${after}, was ${before} before)`);
} finally {
  await c.query("rollback");
  c.release();
  await pool.end();
  console.log("\nROLLED BACK - the database is unchanged.");
}
process.exit(failed ? 1 : 0);
