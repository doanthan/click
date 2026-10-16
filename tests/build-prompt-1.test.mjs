// Build prompt 1 (Cindy 2026-10-15), items 2-7. Source assertions pin the clause
// that would have to be deleted to bring each old behaviour back; the pure
// helpers run for real. Behaviour on real rows was run on PGlite through the real
// repository (the build report lists those checks). Item 1 is photo-gate.test.mjs,
// the test hooks are dev-pair-hooks.test.mjs.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  BELONGING_LINE,
  BELONGING_MIN_OTHERS,
  FOMO_FLOOR,
  SHARED_INTEREST_MIN,
  TRENDING_LINE,
  TRENDING_LINE_MIN_SCORE,
  attendeeFomoSignals,
  trendingScore,
} from "../src/lib/attendee-fomo.ts";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");
// SQL and TS comments removed, so a comment explaining a rule never satisfies it.
const code = (src) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/--[^\n]*/g, "");
const repo = read("src/lib/event-repository.ts");
const fn = (start, end = "\nexport ") => {
  const at = repo.indexOf(start);
  assert.ok(at > -1, `${start} not found`);
  return code(repo.slice(at, repo.indexOf(end, at + 1)));
};
const pool = fn("export async function getSuggestedPeople(", "\nfunction strongestPickSignal(");
const ensure = fn("async function ensureDailyPicks(", "\nexport async function getDailyPicks(");
const daily = fn("export async function getDailyPicks(", "\nexport async function generateDailyPicksForAll(");
const job = fn("export async function generateDailyPicksForAll(");
const prompts = fn("export async function getPostEventClickPrompts(", "export async function getPostEventClickPromptForEvent(");
const forEvent = fn("export async function getPostEventClickPromptForEvent(", "export async function answerPostEventWindowForSession(");
const push = fn("export async function notifyPostEventClickPrompts(", "\n}\n");
const send = fn("async function sendClickInner(", "export async function createUserClickForSession(");
const preview = fn("export async function getEventAttendeePreview(");
const migration076 = read("database/076_member_photo_test_flags.sql");
const migration077 = read("database/077_member_photo_test_enforcement.sql");

/* ---------------- 2. Test accounts (22A §4.5) ---------------- */

test("2: profiles.is_test exists, defaults to a real account, and replaces the email split", () => {
  assert.match(migration076, /add column if not exists is_test boolean not null default false/);
  // No surface reads the @click.local domain any more.
  assert.doesNotMatch(code(repo), /qaNamespaceScope|QA_NAMESPACE_SUFFIX|QA_VIEWER_EMAIL_BY_ID/);
  assert.match(repo, /function sameTestSideSql\(candidateAlias: string\) \{\s*return `\$\{candidateAlias\}\.is_test = \(select test_viewer\.is_test from profiles test_viewer where test_viewer\.id = \$1::uuid\)`;/);
  for (const [name, src, alias] of [["pool", pool, "p"], ["picks read", daily, "p"], ["who-was-there", prompts, "other"], ["who-was-there, one event", forEvent, "other"]]) {
    assert.ok(src.includes(`\${sameTestSideSql("${alias}")}`), `${name} must keep test accounts apart`);
  }
  assert.match(push, /and other\.is_test = me\.is_test/);
  // The send refuses across the line, neutrally (09 §4 step 2).
  assert.match(send, /if \(clickedProfile\.is_test !== Boolean\(sender\?\.is_test\)\) \{\s*throw notEligibleError/);
  // ...and so does the database, for anything that skips the app (077).
  assert.match(migration077, /select a\.is_test = b\.is_test/);
});

test("2: radar and who's-going counts are the viewer's side of the test line; trending never counts a test booking", () => {
  assert.match(preview, /and profile\.is_test = \$\{viewerTestSideSql\("\$3::uuid"\)\}/);
  assert.equal((preview.match(/holder\.is_test = \$\{viewerTestSideSql\("\$2::uuid"\)\}/g) ?? []).length, 2, "both seat kinds");
  assert.match(preview, /and purchaser\.is_test = \$\{viewerTestSideSql\("\$2::uuid"\)\}/);
  const trending = fn("async function recentNonTestBookingsBySlug(", "\n// The click radar's line");
  assert.match(trending, /and attendee\.status = 'confirmed'\s*and attendee\.created_at > now\(\) - interval '24 hours'\s*and not booker\.is_test/);
});

test("2: admin numbers leave test accounts out by default, with an Include toggle (03 §9)", () => {
  const metrics = fn("export async function getAdminMetrics(", "\n// A claimed guest");
  assert.match(metrics, /\{ includeTest = false \}: \{ includeTest\?: boolean \} = \{\}/);
  for (const piece of ['realOnlySql(includeTest, "member")', 'realOnlySql(includeTest, "owner")', 'eventIsRealSql(includeTest, "e")', 'realOnlySql(includeTest, "booker")', 'realOnlySql(includeTest, "a", "b")']) {
    assert.ok(metrics.includes(piece), piece);
  }
  assert.match(fn("export async function getAdminWeeklyTrend("), /realOnlySql\(includeTest, "payer"\)/);
  const page = read("src/app/admin/page.tsx");
  assert.match(page, /const includeTest = \(await searchParams\)\?\.test === "1";/);
  assert.match(page, /href=\{includeTest \? "\/admin" : "\/admin\?test=1"\}/);
  // Every tile carries its definition on hover; the three 03 §9 names are there.
  for (const label of ["Onboarded members", "Attendees", "Confirmed RSVPs"]) {
    assert.match(page, new RegExp(`label="${label}"[\\s\\S]{0,260}definition=\\{`), label);
  }
  assert.match(read("src/components/click-ui.tsx"), /title=\{definition\}/);
});

test("2: every script that creates an account marks it a test account; the cross-line seeder is retired", () => {
  const scripts = readdirSync("scripts").filter((file) => file.endsWith(".mjs"));
  for (const file of scripts) {
    const src = read(`scripts/${file}`);
    for (const match of src.matchAll(/insert into profiles \(([^)]*)\)/g)) {
      assert.match(match[1], /is_test/, `${file} creates a profile without is_test`);
    }
  }
  assert.match(read("src/lib/qa-provision.ts"), /connection_intents, email_verified_at, is_test/);
  // A brand-new account in the QA namespace starts as a test account.
  assert.match(repo, /values \(\$1, \$2::user_role, \$3, \$4, now\(\), \$5::boolean\)/);
  assert.match(repo, /\[`auth:\$\{email\}`, initialRole, email, displayName, email\.endsWith\("@click\.local"\)\]/);
  const uat = read("scripts/seed-click-uat.mjs");
  assert.match(uat, /process\.exit\(1\);/);
  assert.doesNotMatch(code(uat), /insert into clicks|update profiles/);
});

/* ---------------- 3. Member onboarding (01 §1.4, 21 §B7.4) ---------------- */

test("3: member_onboarded_at is written only by finishing the onboarding flow", () => {
  assert.match(migration076, /add column if not exists member_onboarded_at timestamptz/);
  const writers = [];
  for (const dir of ["src", "scripts"]) {
    const walk = (folder) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (/\.(ts|tsx|mjs)$/.test(entry.name) && /member_onboarded_at\s*=(?!=)/.test(code(read(file)))) {
          writers.push(file);
        }
      }
    };
    walk(dir);
  }
  assert.deepEqual(writers.sort(), ["scripts/backfill-build-prompt-1.mjs", "src/lib/event-repository.ts"]);
  const save = fn("export async function saveOnboarding(");
  assert.match(save, /member_onboarded_at = case when \$9::boolean\s*then coalesce\(member_onboarded_at, now\(\)\) else member_onboarded_at end/);
  assert.match(save, /input\.complete === true,/);
  assert.equal((code(repo).match(/member_onboarded_at = /g) ?? []).length, 1, "saveOnboarding is the only writer");
  assert.match(read("src/app/api/onboarding/route.ts"), /complete: payload\.complete === true,/);
  // The backfill names explicit ids and is a dry run unless told otherwise.
  const backfill = read("scripts/backfill-build-prompt-1.mjs");
  assert.match(backfill, /const apply = process\.argv\.includes\("--apply"\);/);
  assert.match(backfill, /set member_onboarded_at = created_at\s*where id = \$1::uuid and member_onboarded_at is null/);
  // ...and never from database/, where run-migrations would apply it unasked.
  for (const file of readdirSync("database")) {
    assert.doesNotMatch(read(`database/${file}`), /member_onboarded_at\s*=\s*(now|created_at)/, file);
  }
});

test("3: only a member is shown, gets picks, or clicks - any role", () => {
  assert.match(pool, /and p\.member_onboarded_at is not null/);
  assert.match(daily, /and p\.member_onboarded_at is not null/);
  assert.match(daily, /select 1 from profiles me\s*where me\.id = \$1::uuid and me\.member_onboarded_at is not null/);
  assert.match(ensure, /if \(today\.rows\[0\]\?\.has_picks \|\| !today\.rows\[0\]\?\.is_member\) return;/);
  assert.match(job, /and p\.member_onboarded_at is not null/);
  for (const [name, src] of [["who-was-there", prompts], ["who-was-there, one event", forEvent]]) {
    assert.match(src, /and other\.member_onboarded_at is not null/, name);
    assert.match(src, /select 1 from profiles me\s*where me\.id = \$1::uuid and me\.member_onboarded_at is not null/, name);
  }
  assert.match(push, /and me\.member_onboarded_at is not null/);
  assert.match(push, /and other\.member_onboarded_at is not null/);
  assert.match(send, /if \(!sender\?\.is_member\) \{\s*throw notEligibleError/);
  assert.match(send, /if \(!clickedProfile\.is_member\) \{\s*throw notEligibleError/);
  // Switching to user mode without it lands on /onboarding, whatever the role.
  assert.match(read("src/lib/onboarding-gate.ts"), /if \(status\.merchantProfile && !USER_MODE_HOMES\.has\(here\)\) return;/);
});

test("3: a host is never on, and never clicks from, their own event's who-was-there", () => {
  assert.match(repo, /function eventHostedBySql\(eventAlias: string, profileSql: string\) \{\s*return `\(coalesce\(\$\{eventAlias\}\.host_profile_id = \$\{profileSql\}, false\) or exists \(/);
  for (const [name, src] of [["who-was-there", prompts], ["who-was-there, one event", forEvent]]) {
    assert.ok(src.includes('and not ${eventHostedBySql("e", "other.id")}'), `${name}: host listed`);
    assert.ok(src.includes('and not ${eventHostedBySql("e", "$1::uuid")}'), `${name}: host viewing`);
  }
  assert.ok(push.includes('and not ${eventHostedBySql("e", "me.id")}'));
  assert.ok(push.includes('and not ${eventHostedBySql("e", "other.id")}'));
  assert.ok(send.includes('${eventHostedBySql("e", "$2::uuid")} or ${eventHostedBySql("e", "$3::uuid")} as hosts'));
  assert.match(send, /if \(hostResult\.rows\[0\]\?\.hosts\) \{\s*throw notEligibleError/);
});

/* ---------------- 4. Admin (03 §1, §9, §10) ---------------- */

test("4: Run now - admin only, audited, locked, once per 2 minutes, the cron's own code path", () => {
  const jobs = read("src/lib/scheduled-jobs.ts");
  assert.match(jobs, /select pg_try_advisory_xact_lock\(hashtext\(\$1\)::bigint\) as locked/);
  assert.match(jobs, /return \{ ran: false, reason: "Already running - it will finish on its own\." \};/);
  assert.match(jobs, /export const RUN_NOW_MIN_INTERVAL_MINUTES = 2;/);
  assert.match(jobs, /where action = \$1\s*and created_at > now\(\) - interval '\$\{RUN_NOW_MIN_INTERVAL_MINUTES\} minutes'/);
  assert.match(jobs, /insert into audit_logs \(actor_profile_id, action, entity_table, entity_id, metadata\)/);
  // The refusal and the audit row happen while the lock is held (the gate).
  assert.ok(jobs.indexOf("const refusal = gate ? await gate(client) : null;") > jobs.indexOf("pg_try_advisory_xact_lock"));
  assert.match(read("src/app/api/cron/daily-picks/route.ts"), /runScheduledJob\("build_daily_picks"\)/);
  assert.match(read("src/app/api/cron/refresh-matching-features/route.ts"), /runScheduledJob\("rebuild_suggestion_scores"\)/);
  const action = read("src/app/admin/system/actions.ts");
  assert.match(action, /if \(session\?\.impersonation\) \{\s*return \{ ok: false, message: "Return to your own admin account to run jobs\." \};/);
  assert.match(action, /actorId = \(await requireAdminProfile\(session\)\)\.id;/);
  assert.match(action, /await runScheduledJob\(key, runNowGate\(key, actorId\)\)/);
  assert.match(read("src/app/admin/system/page.tsx"), /<AdminRunNow \/>/);
});

test("4: view-as - a real member opens view only, a test account may act, every start audited", () => {
  const sw = read("src/lib/admin-account-switch.ts");
  assert.match(sw, /impersonation: \{ actor, expiresAt, readOnly: !user\.is_test \}/);
  assert.match(sw, /isTest: backToSelf \? undefined : user\.is_test === true/);
  assert.match(read("src/proxy.ts"), /console\.warn\("\[view-as\] refused a write while viewing a real member"/);
});

/* ---------------- 5. LGBTQ+ and sensitive life tags (08 §4.1, §4.4a, §7) ---------------- */

test("5: sensitive and FOMO-only tags are marked, and never reach a score, a cohort or a pick reason", () => {
  assert.match(migration076, /add column if not exists is_sensitive boolean not null default false,\s*add column if not exists fomo_only boolean not null default false/);
  assert.match(migration076, /slug in \('lgbtq-plus', 'recently-single', 'needs-structure', 'prefers-small-group'\)/);
  assert.match(migration076, /slug in \('returning-to-social', 'sober-curious', 'single-parent', 'career-pivot', 'empty-nester'\)/);
  // Where life tags enter the model: the feature store's writer...
  assert.match(read("src/lib/matching/feature-store.ts"), /join tags t on t\.id = ut\.tag_id and t\.tag_type = 'life'\s*and not t\.is_sensitive and not t\.fomo_only/);
  // ...its reader, for rows written before a tag was marked (cohort + pair + reasons all read this)...
  const candidates = read("src/lib/matching/candidates.ts");
  assert.match(candidates, /and \(sensitive_tag\.is_sensitive or sensitive_tag\.fomo_only\)\s*\)\s*\) as life_tags,/);
  // ...an event's life-tag targets (event scoring), and the v1 event ranker's tags.
  assert.match(candidates, /where t\.tag_type = 'life' and not t\.is_sensitive and not t\.fomo_only/);
  assert.match(repo, /where ut\.profile_id = \$1::uuid and not t\.is_sensitive and not t\.fomo_only`/);
});

test("5: no admin screen lists a sensitive tag against a named member", () => {
  const detail = fn("export async function getAdminMemberDetail(");
  assert.match(detail, /where ut\.profile_id = \$1::uuid\s*and not tag\.is_sensitive/);
  // The scoring lab shows UserFeatures.lifeTags, which the loader has already filtered.
  assert.match(read("src/app/admin/matching-lab/page.tsx"), /member\.lifeTags/);
  assert.match(fn("export async function getCuratedPairToLabel("), /lifeTags: uf\.lifeTags,/);
});

test("5: the belonging line - LGBTQ+ viewers only, at least 4 others, never a number, never who", () => {
  assert.equal(BELONGING_MIN_OTHERS, 4);
  assert.doesNotMatch(BELONGING_LINE, /\d/, "never a number");
  assert.doesNotMatch(BELONGING_LINE, /—|–/, "hyphens, never em-dashes");
  const room = { confirmed: 9, topSharedInterest: null, datingCount: 0, viewerOpenToDating: false };
  assert.deepEqual(attendeeFomoSignals({ ...room, belonging: true }), [BELONGING_LINE]);
  assert.deepEqual(attendeeFomoSignals({ ...room, belonging: false }), []);
  // The query: the viewer must hold the identity tag; others counted, viewer excluded,
  // on the viewer's side of the test line, confirmed seats only; answered as a boolean.
  assert.match(preview, /join tags identity_tag on identity_tag\.id = mine\.tag_id\s*and identity_tag\.tag_type = 'life'\s*and identity_tag\.slug = any\(\$3::text\[\]\)\s*where mine\.profile_id = \$2::uuid/);
  assert.match(preview, /and theirs\.profile_id <> \$2::uuid/);
  assert.match(preview, /\) >= \$4\s*\) as belonging/);
  assert.match(preview, /belonging: belongingResult\?\.rows\[0\]\?\.belonging === true,/);
  assert.match(repo, /const IDENTITY_TAG_SLUGS = \["lgbtq-plus"\];/);
  // The event page shows it; the radar never does (08 §10.5).
  assert.match(read("src/components/event-attendee-preview.tsx"), /belonging: preview\.belonging,/);
  assert.doesNotMatch(fn("export async function getRadarSignals("), /belonging/);
});

/* ---------------- 6. Picks order (09 "Display order and ties") ---------------- */

test("6: each pick's rank is stored, best-scored first, ties broken by a per-viewer-per-day hash", () => {
  assert.match(migration076, /alter table daily_picks\s*add column if not exists rank smallint;/);
  assert.match(repo, /md5\(\$1::text \|\| ':' \|\| \(\$\{DAILY_PICK_DAY_SQL\}\)::text \|\| ':' \|\| \$\{candidateAlias\}\.id::text\)/);
  assert.match(pool, /select p\.id::text, \$\{PICK_TIE_KEY_SQL\("p"\)\} as tie_key,/);
  // The hash is the SQL's last key too, so the 24 cut never depends on row order.
  assert.match(pool, /\$\{PICK_TIE_KEY_SQL\("p"\)\} asc\s*limit 24/);
  assert.match(ensure, /from unnest\(\$2::uuid\[\], \$3::text\[\]\) with ordinality as pick\(picked, reason, rank\)/);
  assert.match(ensure, /\[viewerId, byRank\.map\(\(pick\) => pick\.id\), byRank\.map\(\(pick\) => pick\.reason\)\]/);
  assert.match(daily, /order by dp\.rank nulls last, dp\.created_at, dp\.id/);
});

test("6: an active mutual keeps the partner out of the next build on status alone", () => {
  assert.match(pool, /select 1 from mutual_clicks mc\s*where mc\.status = 'active'\s*and \(\(mc\.user_a_id = \$1::uuid and mc\.user_b_id = p\.id\)/);
  assert.doesNotMatch(pool, /mc\.status = 'active' and mc\.expires_at > now\(\)/);
});

/* ---------------- 7. Click Radar (09 §9, §10, §13) ---------------- */

test("7: trending is real - confirmed bookings in 24h, capped at 10 - and shows only from 80", () => {
  assert.deepEqual([0, 1, 7, 8, 10, 25].map(trendingScore), [0, 10, 70, 80, 100, 100]);
  assert.equal(TRENDING_LINE_MIN_SCORE, 80);
  assert.equal(TRENDING_LINE, "Trending near you");
  const room = { confirmed: 9, topSharedInterest: null, datingCount: 0, viewerOpenToDating: false, countFallback: true };
  assert.deepEqual(attendeeFomoSignals({ ...room, trending: trendingScore(8) }), ["Trending near you"]);
  assert.deepEqual(attendeeFomoSignals({ ...room, trending: trendingScore(7) }), ["9 going so far"]);
  // A richer line wins; trending is the last social line (09 §9 rule 6).
  assert.deepEqual(
    attendeeFomoSignals({ ...room, trending: 100, topSharedInterest: { label: "Hiking", count: 3 } }),
    ["3 going also like Hiking"],
  );
  assert.match(fn("export async function getRadarSignals("), /trending: trendingScore\(recentBookings\.get\(event\.id\) \?\? 0\),/);
});

test("7: no city name on the radar, and no line at all when nothing qualifies", () => {
  const radar = code(read("src/components/click-radar.tsx"));
  assert.doesNotMatch(radar, /Sydney/);
  assert.match(radar, /\{fomoBySlug\[event\.id\] \? \(/);
  for (const file of ["src/lib/attendee-fomo.ts", "src/components/click-radar.tsx"]) {
    assert.doesNotMatch(code(read(file)), /Sydney|Melbourne/, file);
  }
});

test("7: below 3 confirmed (non-test) attendees there is no count and no line; a shared interest needs 2", () => {
  assert.equal(FOMO_FLOOR, 3);
  assert.equal(SHARED_INTEREST_MIN, 2);
  const base = { topSharedInterest: { label: "Hiking", count: 2 }, datingCount: 3, viewerOpenToDating: true, countFallback: true, trending: 100, belonging: true };
  for (const confirmed of [0, 1, 2]) {
    assert.deepEqual(attendeeFomoSignals({ ...base, confirmed }), [], `confirmed ${confirmed}`);
  }
  assert.deepEqual(
    attendeeFomoSignals({ confirmed: 3, topSharedInterest: { label: "Hiking", count: 1 }, datingCount: 0, viewerOpenToDating: false, countFallback: true }),
    ["3 going so far"],
  );
});
