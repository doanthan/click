// READ-ONLY. Builds the three account lists build prompt 1 needs confirmed
// before scripts/backfill-build-prompt-1.mjs may write anything:
//
//   1. photo  - every stored photo_url, checked exactly as the app checks one
//               (src/lib/photo-verify.ts: public fetch with 3 retries, then the
//               placeholder / stock / default rules). Which fail, and why.
//   2. is_test - every account a script or the QA tools made, with the rule that
//               caught it: the @click.local namespace (QA personas, e2e
//               fixtures), the demo seed's @seed.letsclick.app profiles
//               (scripts/seed-demo-events.mjs), @test.local leftovers from the
//               rolled-back test scripts, and qa:/seed: auth subjects.
//   3. member_onboarded_at - real accounts that look like they finished the user
//               onboarding flow, with the evidence. Admins and hosts in their
//               own table. The "UAT fingerprint" scripts/seed-click-uat.mjs
//               wrote (birth date 1990-01-01 + suburb Surry Hills + its
//               placeholder bio) never counts as onboarding.
//
// Everything runs inside BEGIN READ ONLY and is rolled back; the photo checks
// are plain GETs of public URLs. Nothing is written to the database.
//
//   node --env-file=<path to .env with DATABASE_URL> \
//     scripts/prepare-build-prompt-1-lists.mjs --out <dir outside git>
//
// Writes <dir>/lists.json (ids - the input the backfill takes) and
// <dir>/lists.md (the tables for the report). The repo is public: keep <dir>
// out of git (context/ is fine while the files stay untracked).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { verifyPhotoUrl } from "../src/lib/photo-verify.ts";

const outIndex = process.argv.indexOf("--out");
const outDir = outIndex > -1 ? process.argv[outIndex + 1] : null;
if (!outDir) {
  console.error("Usage: node --env-file=<.env> scripts/prepare-build-prompt-1-lists.mjs --out <dir>");
  process.exit(1);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// The fingerprint scripts/seed-click-uat.mjs wrote (its PLACEHOLDER_* values).
const UAT_BIRTH_DATE = "1990-01-01";
const UAT_SUBURB = "Surry Hills";
const UAT_BIO_PREFIX = "Testing the click flow. Placeholder profile";

const pool = new pg.Pool({
  connectionString,
  max: 1,
  ssl: /supabase\.(co|com)/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});
const db = await pool.connect();
let profiles;
let lifeTags;
let crossClicks;
let adminEmails;
try {
  await db.query("begin read only");
  profiles = (
    await db.query(`
      select p.id::text, p.email::text, p.display_name, p.role::text, p.auth_subject,
             p.created_at, p.last_active_at, p.deleted_at, p.is_banned, p.suspended_at,
             p.suburb, p.birth_date::text as birth_date, p.bio, p.photo_url,
             cardinality(p.connection_intents) as intent_count,
             -- The form starts on {friendship}, so step 1 alone stores exactly that.
             p.connection_intents <> array['friendship']::connection_intent[] as intents_changed,
             (select count(*)::int from user_tags ut join tags t on t.id = ut.tag_id
               where ut.profile_id = p.id and t.tag_type = 'interest'
                 and ut.source = 'user') as interest_tags,
             exists (select 1 from merchant_profiles mp where mp.profile_id = p.id) as has_host_account,
             (select count(*)::int from event_attendees ea
               where ea.profile_id = p.id and ea.status = 'confirmed') as confirmed_bookings
        from profiles p
       order by p.created_at
    `)
  ).rows;
  // Aggregate only - no member is named against a life tag (08 §7).
  lifeTags = (
    await db.query(`
      select t.slug, t.label, count(ut.profile_id)::int as holders
        from tags t left join user_tags ut on ut.tag_id = t.id
       where t.tag_type = 'life'
       group by t.slug, t.label
       order by holders desc, t.slug
    `)
  ).rows;
  crossClicks = (
    await db.query(`
      select count(*)::int as n
        from clicks c
        join profiles s on s.id = c.sender_id
        join profiles r on r.id = c.receiver_id
       where c.status = 'pending'
         and (s.email::text like '%@click.local') <> (r.email::text like '%@click.local')
    `)
  ).rows[0].n;
} finally {
  await db.query("rollback").catch(() => {});
  db.release();
  await pool.end();
}
adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

// ---- 2. is_test -------------------------------------------------------------
function testReason(p) {
  const email = (p.email ?? "").toLowerCase();
  if (email.endsWith("@click.local")) {
    if (email.startsWith("e2e-")) return "e2e fixture (@click.local, scripts/e2e-verify-production.mjs)";
    return "QA namespace (@click.local - QA personas / test-login)";
  }
  if (email.endsWith("@seed.letsclick.app")) return "demo seed (scripts/seed-demo-events.mjs)";
  if (email.endsWith("@test.local")) return "test-script leftover (@test.local)";
  if ((p.auth_subject ?? "").startsWith("qa:")) return "QA provisioner (auth_subject qa:)";
  if ((p.auth_subject ?? "").startsWith("seed:")) return "seed migration host (auth_subject seed:)";
  return null;
}
const isTest = profiles
  .map((p) => ({ p, reason: testReason(p) }))
  .filter((row) => row.reason);
const testIds = new Set(isTest.map((row) => row.p.id));

// ---- 3. member_onboarded_at --------------------------------------------------
function bioState(bio) {
  if (bio === null) return "NULL";
  if (bio.trim() === "") return "empty";
  if (bio.startsWith(UAT_BIO_PREFIX)) return "UAT placeholder";
  return "written";
}
function uatFingerprint(p) {
  return (
    p.birth_date === UAT_BIRTH_DATE &&
    (p.suburb ?? "").trim().toLowerCase() === UAT_SUBURB.toLowerCase() &&
    (p.bio ?? "").startsWith(UAT_BIO_PREFIX)
  );
}
const realProfiles = profiles.filter((p) => !testIds.has(p.id) && !p.deleted_at);
const memberRows = realProfiles.map((p) => {
  const kind =
    p.role === "admin" || adminEmails.includes((p.email ?? "").toLowerCase())
      ? "admin"
      : p.role === "merchant" || p.has_host_account
        ? "host"
        : "attendee";
  const step1 = Boolean(p.suburb && p.birth_date);
  const fingerprint = uatFingerprint(p);
  // Nothing in the database records reaching the done screen. The form sends
  // the WHOLE form on step 1's Continue and again on Finish, so a skipped bio
  // is "" either way, and step 1's "Back to the event" button finishes with
  // nothing after step 1 saved - the same row as someone who pressed Continue
  // and left. Answers from the later screens (a written bio, interest tags the
  // person chose, intents other than the form's starting {friendship}) show
  // they went further, but /profile/edit can write those too. So only the two
  // excludes are certain; every other row is for Cindy and Doan to decide.
  const laterScreens =
    bioState(p.bio) === "written" || p.interest_tags > 0 || p.intents_changed;
  let proposal;
  if (fingerprint) proposal = "exclude - seed-click-uat.mjs fingerprint, never onboarded";
  else if (!step1) proposal = "exclude - step 1 never saved (no postcode or birth date)";
  else if (laterScreens) proposal = "confirm - likely: answers past step 1 saved (bio, interests or intents)";
  else proposal = "confirm - unknown: step 1 only, the same as a 'Back to the event' finish";
  return { p, kind, step1, fingerprint, proposal };
});

// ---- 1. photos ----------------------------------------------------------------
const withPhoto = profiles.filter((p) => !p.deleted_at && (p.photo_url ?? "").trim());
const photoResults = [];
for (const p of withPhoto) {
  const check = await verifyPhotoUrl(p.photo_url, p.id, { retries: 3, backoffMs: 700 });
  let host;
  try {
    host = p.photo_url.startsWith("/") ? "(site path)" : new URL(p.photo_url).hostname;
  } catch {
    host = "(unparseable)";
  }
  photoResults.push({ id: p.id, name: p.display_name, test: testIds.has(p.id), host, ...check });
  process.stdout.write(check.status === "ok" ? "." : "x");
}
process.stdout.write("\n");

// ---- output -------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
const safeEmail = (p) => (testReason(p) ? p.email : "(real address, not shown)");
const day = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "-");
const json = {
  generatedAt: new Date().toISOString(),
  photo: {
    ok: photoResults.filter((r) => r.status === "ok").map((r) => r.id),
    failed: photoResults.filter((r) => r.status !== "ok").map((r) => ({ id: r.id, reason: r.reason })),
  },
  isTest: isTest.map((row) => ({ id: row.p.id, reason: row.reason })),
  member: memberRows.map((row) => ({ id: row.p.id, kind: row.kind, proposal: row.proposal })),
};
writeFileSync(path.join(outDir, "lists.json"), JSON.stringify(json, null, 2));

const md = [];
md.push(`Generated ${json.generatedAt} from production, read-only (BEGIN READ ONLY, rolled back).`);
md.push(`Profiles: ${profiles.length}. With a photo: ${withPhoto.length}. Test candidates: ${isTest.length}.`);
md.push("");
md.push("### 1. Photo check results");
md.push("");
md.push("| id | name | test? | host | result | why |");
md.push("|---|---|---|---|---|---|");
for (const r of photoResults) {
  md.push(`| ${r.id} | ${r.name} | ${r.test ? "test" : "real"} | ${r.host} | ${r.status} | ${r.reason} |`);
}
md.push("");
md.push("### 2. is_test candidates");
md.push("");
md.push("| id | email | name | role | created | why |");
md.push("|---|---|---|---|---|---|");
for (const { p, reason } of isTest) {
  md.push(`| ${p.id} | ${safeEmail(p)} | ${p.display_name} | ${p.role} | ${day(p.created_at)} | ${reason} |`);
}
md.push("");
for (const kind of ["attendee", "admin", "host"]) {
  const rows = memberRows.filter((row) => row.kind === kind);
  md.push(`### 3${kind === "attendee" ? "a" : kind === "admin" ? "b" : "c"}. member_onboarded_at - ${kind}s (${rows.length})`);
  md.push("");
  md.push("| id | name | created | step 1 | bio | photo | interest tags chosen | intents changed | bookings | proposal |");
  md.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const { p, step1, proposal } of rows) {
    md.push(
      `| ${p.id} | ${p.display_name} | ${day(p.created_at)} | ${step1 ? "yes" : "no"} | ${bioState(p.bio)} | ${(p.photo_url ?? "").trim() ? "yes" : "no"} | ${p.interest_tags} | ${p.intents_changed ? "yes" : "no"} | ${p.confirmed_bookings} | ${proposal} |`,
    );
  }
  md.push("");
}
md.push("### Life-tag slugs in use (aggregate holders only)");
md.push("");
md.push("| slug | label | holders |");
md.push("|---|---|---|");
for (const t of lifeTags) md.push(`| ${t.slug} | ${t.label} | ${t.holders} |`);
md.push("");
md.push(`Pending clicks that cross the test line today (seed-click-uat.mjs leftovers): ${crossClicks}.`);
writeFileSync(path.join(outDir, "lists.md"), md.join("\n"));
console.log(`Wrote ${path.join(outDir, "lists.json")} and lists.md.`);
