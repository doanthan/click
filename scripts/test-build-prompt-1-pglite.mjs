// Behavioural checks for build prompt 1 (photo gate, test accounts, member
// status, admin Run-now gate, LGBTQ+ and the belonging line, picks order, Click
// Radar) on real SQL with NO database: PGlite applies every migration in
// database/ (001-077), and the REAL src/lib/event-repository.ts runs on it
// through jiti. One in-process session, so it proves query behaviour, never
// concurrency or advisory-lock contention.
//
//   npm i --no-save @electric-sql/pglite@0.5.8
//   node scripts/test-build-prompt-1-pglite.mjs
//
// Nothing here can touch a real database: DATABASE_URL is set to a dummy and
// the pool is replaced before anything loads. Exits 1 on any failed check.
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const REPO = process.cwd();

async function freshDatabase({ upTo = "999" } = {}) {
  const db = await PGlite.create({ extensions: { citext, pgcrypto } });
  const dir = path.join(REPO, "database");
  const files = readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f) && f.slice(0, 3) <= upTo).sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(path.join(dir, file), "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
  }
  return { db, files };
}

// node-postgres turns a JS array into a Postgres array literal before sending it
// (prepareValue); PGlite only does that for types it knows, not enum arrays.
function arrayLiteral(value) {
  return `{${value
    .map((item) => (item === null || item === undefined ? "NULL" : `"${String(item).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`))
    .join(",")}}`;
}
function poolFor(db) {
  const query = async (text, params) => {
    const prepared = (params ?? []).map((value) => (Array.isArray(value) ? arrayLiteral(value) : value));
    const result = await db.query(text, prepared);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  return { query, connect: async () => ({ query, release() {} }), end: async () => {} };
}


const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `  -- ${detail}` : ""}`);
};
const expectThrow = async (label, fn, pattern) => {
  try {
    await fn();
    check(label, false, "did not throw");
  } catch (error) {
    const text = `${error?.name ?? ""}: ${error?.message ?? error}`;
    check(label, pattern ? pattern.test(text) : true, text);
  }
};

const { db } = await freshDatabase();
const pool = poolFor(db);
globalThis.clickPostgresPool = pool;
process.env.DATABASE_URL = "postgres://pglite.invalid/click";
process.env.CLICK_MECHANIC_ENABLED = "true";
process.env.ADMIN_EMAILS = "admin.real@example.com";
process.chdir(REPO);

const requireFromRepo = createRequire(path.join(REPO, "package.json"));
const { createJiti } = requireFromRepo("jiti");
const stubs = mkdtempSync(path.join(tmpdir(), "bp1-"));
const emptyModule = path.join(stubs, "empty.cjs");
writeFileSync(emptyModule, "module.exports = {};");
// The 03 §10 hooks ask Auth.js who is behind the request: here, a real admin.
// Only dev-pair-hooks.ts imports these two; the repository imports neither.
const authStub = path.join(stubs, "auth.cjs");
writeFileSync(authStub, `module.exports = {
  auth: async () => ({ user: { email: "admin.real@example.com" }, expires: new Date(Date.now() + 3600e3).toISOString() }),
  isAdminEmail: (email) => email === "admin.real@example.com",
};`);
const switcherStub = path.join(stubs, "test-switcher.cjs");
writeFileSync(switcherStub, "module.exports = { adminQaGrantEmail: async () => null };");
const jiti = createJiti(path.join(REPO, "src/lib/x.ts"), {
  alias: {
    "@/auth": authStub,
    "@/lib/test-switcher": switcherStub,
    "@": path.join(REPO, "src"),
    "server-only": emptyModule,
  },
  interopDefault: true,
});
const repo = await jiti.import(path.join(REPO, "src/lib/event-repository.ts"));
const fomo = await jiti.import(path.join(REPO, "src/lib/attendee-fomo.ts"));
const features = await jiti.import(path.join(REPO, "src/lib/matching/feature-store.ts"));
const candidates = await jiti.import(path.join(REPO, "src/lib/matching/candidates.ts"));
const score = await jiti.import(path.join(REPO, "src/lib/matching/score.ts"));
const jobs = await jiti.import(path.join(REPO, "src/lib/scheduled-jobs.ts"));

const q = (text, params) => pool.query(text, params);
const session = (email) => ({ user: { email }, expires: new Date(Date.now() + 3600e3).toISOString() });

async function person(name, opts = {}) {
  const email = opts.email ?? `${name.toLowerCase()}@${opts.test ? "click.local" : "example.com"}`;
  const row = (
    await q(
      `insert into profiles (email, display_name, role, age, birth_date, suburb, photo_url, is_test,
                             member_onboarded_at, last_active_at, connection_intents)
       values ($1, $2, $3::user_role, $8, $9::date, $4, $5, $6, $7, now(), '{friendship}')
       returning id::text`,
      [
        email,
        name,
        opts.role ?? "attendee",
        opts.suburb ?? "2000",
        opts.photo === null ? null : `https://media.letsclick.app/${name}.jpg`,
        Boolean(opts.test),
        opts.member === false ? null : new Date(Date.now() - 86400e3).toISOString(),
        opts.age ?? 30,
        `${new Date().getFullYear() - (opts.age ?? 30) - 1}-01-01`,
      ],
    )
  ).rows[0].id;
  // The photo check's verdict, recorded the way recordProfilePhotoCheck does.
  const status = opts.photoStatus ?? "ok";
  if (opts.photo !== null && status !== "pending") {
    await q(`update profiles set photo_status = $2 where id = $1::uuid`, [row, status]);
  }
  if (opts.role === "merchant") {
    await q(
      `insert into merchant_profiles (profile_id, business_name, contact_email, verification_status)
       values ($1::uuid, $2, $3, 'approved')`,
      [row, `${name} Events`, email],
    );
  }
  return { id: row, email, name };
}
async function tag(slug, type = "interest") {
  const r = await q(
    `insert into tags (label, slug, tag_type) values ($1, $1, $2) on conflict (slug) do update set slug = excluded.slug returning id::text`,
    [slug, type],
  );
  return r.rows[0].id;
}
async function give(profile, ...slugs) {
  for (const slug of slugs) {
    await q(`insert into user_tags (profile_id, tag_id, source) values ($1::uuid, $2::uuid, 'user') on conflict do nothing`, [profile.id, await tag(slug)]);
  }
}
async function event(slug, opts = {}) {
  const days = Number(opts.inDays ?? 10);
  const times = opts.past
    ? "now() - interval '6 hours', now() - interval '3 hours'"
    : `now() + interval '${days} days', now() + interval '${days} days' + interval '3 hours'`;
  const host = opts.host ?? null;
  const merchant = host ? (await q(`select id::text from merchant_profiles where profile_id = $1::uuid`, [host.id])).rows[0]?.id ?? null : null;
  const r = await q(
    `insert into events (slug, title, description, group_name, host_name, category, starts_at, ends_at,
                         location_name, suburb, city, capacity, status, timezone, price_cents,
                         host_profile_id, merchant_profile_id)
     values ($1, $1, 'Harness event.', 'Harness', 'Harness', 'Social', ${times}, 'Venue', 'Sydney', 'Sydney',
             $2, 'live', 'Australia/Sydney', 0, $3::uuid, $4::uuid)
     returning id::text`,
    [slug, opts.capacity ?? 60, host?.id ?? null, merchant],
  );
  return { id: r.rows[0].id, slug };
}
async function book(evt, profile, createdAgo = "1 hour") {
  await q(
    `insert into event_attendees (event_id, profile_id, status, created_at)
     values ($1::uuid, $2::uuid, 'confirmed', now() - $3::interval)`,
    [evt.id, profile.id, createdAgo],
  );
}

/* ------------------------------------------------------------------ fixtures */
const V = await person("Viewer");
const R = [];
for (let i = 1; i <= 4; i += 1) R.push(await person(`Real${i}`));
const RF = await person("PhotoFailed", { photoStatus: "failed" });
const RP = await person("PhotoPending", { photoStatus: "pending" });
const RN = await person("NotMember", { member: false });
const RA = await person("AdminMember", { role: "admin" });
const RM = await person("HostMember", { role: "merchant" });
const RMN = await person("HostNotMember", { role: "merchant", member: false });
const RX = await person("ExpiredMutual");
const T1 = await person("Test1", { test: true });
const T2 = await person("Test2", { test: true });
const TV = await person("TestViewer", { test: true });
const TNP = await person("TestNoPhoto", { test: true, photo: null });

// Slugs no seed migration uses ("jazz" is a seeded MUSIC tag, which never counts
// as an interest), so the three overlaps are strictly 3/3, 2/3 and 1/3.
await give(V, "bp1-hiking", "bp1-pottery", "bp1-cooking");
await give(R[0], "bp1-hiking", "bp1-pottery", "bp1-cooking");
await give(R[1], "bp1-hiking", "bp1-pottery");
await give(R[2], "bp1-hiking");
// An active mutual past its 7 days that the sweep has not reached yet.
const [lo, hi] = [V.id, RX.id].sort();
await q(`insert into mutual_clicks (user_a_id, user_b_id, intent_a, intent_b, status, coord_state, mutual_at, expires_at)
         values ($1::uuid, $2::uuid, 'friendship', 'friendship', 'active', 'open', now() - interval '9 days', now() - interval '2 days')`, [lo, hi]);

/* ------------------------------------------------------------------ 1-3 picks pool */
const poolIds = new Set((await repo.getSuggestedPeople(V.id)).map((c) => c.id));
const expectIn = [...R, RA, RM];
check("14.7 photo/member/test gates: a real member's pool is real members with a passing photo, any role",
  expectIn.every((p) => poolIds.has(p.id)) && poolIds.size === expectIn.length,
  `got ${[...poolIds].length}`);
check("14.7 / 14.8: a failed or pending photo is never in anyone's picks", !poolIds.has(RF.id) && !poolIds.has(RP.id));
check("14.7: no account without completed user onboarding (attendee or host)", !poolIds.has(RN.id) && !poolIds.has(RMN.id));
check("14.7: no test accounts in a real member's pool", ![T1, T2, TV].some((p) => poolIds.has(p.id)));
check("09 §3 / prompt 6: an active mutual past expires_at (unswept) is still excluded", !poolIds.has(RX.id));
const testPool = (await repo.getSuggestedPeople(TV.id)).map((c) => c.id);
check("14.7: a test account's pool contains only test accounts (with a passing photo)",
  testPool.length === 2 && testPool.includes(T1.id) && testPool.includes(T2.id));

/* ------------------------------------------------------------------ 6 rank + determinism */
await features.refreshAllUserFeatures(pool);
await repo.getDailyPicks(session(V.email));
const firstBuild = (await q(`select picked_profile_id::text as id, rank from daily_picks where profile_id = $1::uuid order by rank`, [V.id])).rows;
const ranked = (await repo.getSuggestedPeople(V.id)).map((c) => c.id);
check("prompt 6: three picks stored with ranks 1..3", firstBuild.length === 3 && firstBuild.map((r) => r.rank).join() === "1,2,3");
const chosenOrder = ranked.filter((id) => firstBuild.some((r) => r.id === id));
check("14.8: picks show best-scored first (rank order = score order)", chosenOrder.join() === firstBuild.map((r) => r.id).join(),
  `${chosenOrder} vs ${firstBuild.map((r) => r.id)}`);
const rankedDetail = await repo.getSuggestedPeople(V.id);
check("14.8: featured = rank 1 is the best-scoring pick (shares the most with the viewer)", firstBuild[0].id === R[0].id,
  JSON.stringify(rankedDetail.map((c) => ({ who: [V, ...R, RA, RM].find((p) => p.id === c.id)?.name, key: c.rankKey, reason: c.reason }))));
const readOrder = (await repo.getDailyPicks(session(V.email))).map((p) => p.id);
check("14.8: the read returns the picks in rank order", readOrder.join() === firstBuild.map((r) => r.id).join());
await q(`delete from daily_picks where profile_id = $1::uuid`, [V.id]);
await repo.getDailyPicks(session(V.email));
const secondBuild = (await q(`select picked_profile_id::text as id, rank from daily_picks where profile_id = $1::uuid order by rank`, [V.id])).rows;
check("14.8: re-running the build with the same inputs gives the same picks in the same order",
  JSON.stringify(secondBuild) === JSON.stringify(firstBuild));
// Ties: three candidates with identical features tie on score; the hash decides, the same way every time.
const tieOrder1 = (await repo.getSuggestedPeople(TV.id)).map((c) => c.id).join();
const tieOrder2 = (await repo.getSuggestedPeople(TV.id)).map((c) => c.id).join();
check("09: a tie is broken by the per-viewer-per-day hash, identically on every run", tieOrder1 === tieOrder2);

/* ------------------------------------------------------------------ 3 members-only picks */
const nmPicks = await repo.getDailyPicks(session(RN.email));
const nmRows = (await q(`select count(*)::int as n from daily_picks where profile_id = $1::uuid`, [RN.id])).rows[0].n;
check("14.7: an account without completed user onboarding gets no suggestions", nmPicks.length === 0 && nmRows === 0);
const hostPicks = await repo.getDailyPicks(session(RMN.email));
check("14.7: a host without completed user onboarding gets no suggestions", hostPicks.length === 0);
await repo.generateDailyPicksForAll();
const nonMemberRows = (await q(`select count(*)::int as n from daily_picks dp join profiles p on p.id = dp.profile_id where p.member_onboarded_at is null`)).rows[0].n;
check("14.7: the daily cron gives no picks to non-members", nonMemberRows === 0);

/* ------------------------------------------------------------------ send path */
const seedPick = (from, to) =>
  q(`insert into daily_picks (profile_id, picked_profile_id, pool_date, reason) values ($1::uuid, $2::uuid, (now() at time zone 'Australia/Sydney')::date, 'harness') on conflict do nothing`, [from.id, to.id]);
await seedPick(V, RF);
await expectThrow("14.7: clicking someone whose photo failed is a neutral not-eligible",
  () => repo.createUserClickForSession({ clickedProfileId: RF.id, source: "explore" }, session(V.email)), /NotEligible|isn't available/i);
const VF = await person("ViewerFailedPhoto", { photoStatus: "failed" });
await seedPick(VF, R[0]);
await expectThrow("14.7 / 21 S9: a sender whose photo failed gets R_PHOTO, named as failed",
  () => repo.createUserClickForSession({ clickedProfileId: R[0].id, source: "explore" }, session(VF.email)), /photo didn't work/);
await seedPick(RN, R[0]);
await expectThrow("14.7: a click from an account without completed onboarding returns not-eligible",
  () => repo.createUserClickForSession({ clickedProfileId: R[0].id, source: "explore" }, session(RN.email)), /NotEligible|isn't available/i);
await seedPick(V, T1);
await expectThrow("22A §4.5: a click across the test line is a neutral not-eligible",
  () => repo.createUserClickForSession({ clickedProfileId: T1.id, source: "explore" }, session(V.email)), /NotEligible|isn't available/i);
await seedPick(V, R[1]);
let okSend = true;
try {
  await repo.createUserClickForSession({ clickedProfileId: R[1].id, source: "explore" }, session(V.email));
} catch (error) {
  okSend = String(error?.message);
}
check("a member with a passing photo can click a picked member (control)", okSend === true, String(okSend));
const featured = (await repo.getDailyPicks(session(V.email))).find((p) => p.id === R[1].id);
check("14.7 / 09 §3: a pick clicked in the last ~6h is listed, not featured", featured ? featured.featureHold === true : "not in today's picks");
await q(`update clicks set created_at = now() - interval '7 hours' where sender_id = $1::uuid and receiver_id = $2::uuid`, [V.id, R[1].id]);
const later = (await repo.getDailyPicks(session(V.email))).find((p) => p.id === R[1].id);
check("09 §3: ...and featured again once the 6 hours pass", later ? later.featureHold === false : "not in today's picks");

/* ------------------------------------------------------------------ who-was-there + host */
const night = await event("harness-night", { past: true, host: RM });
for (const p of [V, R[2], RM, RN, RF]) await book(night, p, "1 day");
const prompt = (await repo.getPostEventClickPrompts(session(V.email))).find((p) => p.eventSlug === night.slug);
const rosterIds = new Set((prompt?.coAttendees ?? []).map((c) => c.id));
check("14.7: a host never appears on their own event's Who-was-there", !rosterIds.has(RM.id));
check("21 §B7.4: who-was-there lists members with a passing photo only", rosterIds.has(R[2].id) && !rosterIds.has(RN.id) && !rosterIds.has(RF.id));
const hostPrompts = (await repo.getPostEventClickPrompts(session(RM.email))).filter((p) => p.eventSlug === night.slug);
check("14.7: a host gets no Who-was-there for an event they host", hostPrompts.length === 0);
await expectThrow("14.7: a host cannot click from their own event's Who-was-there",
  () => repo.createUserClickForSession({ clickedProfileId: R[2].id, source: "post_event", sourceEventId: night.slug }, session(RM.email)), /NotEligible|isn't available/i);
await expectThrow("14.7: nobody can click the host from their own event's Who-was-there",
  () => repo.createUserClickForSession({ clickedProfileId: RM.id, source: "post_event", sourceEventId: night.slug }, session(V.email)), /NotEligible|isn't available/i);

/* ------------------------------------------------------------------ 077 triggers */
await expectThrow("prompt 1: a script cannot insert a click to a real member whose photo failed",
  () => q(`insert into clicks (sender_id, receiver_id, intent_mode, surface, status, expires_at) values ($1::uuid, $2::uuid, 'friendship', 'discovery', 'pending', now() + interval '7 days')`, [R[0].id, RF.id]), /not an eligible pair/);
await expectThrow("prompt 1: a script cannot insert a click from a test account to a real member",
  () => q(`insert into clicks (sender_id, receiver_id, intent_mode, surface, status, expires_at) values ($1::uuid, $2::uuid, 'friendship', 'discovery', 'pending', now() + interval '7 days')`, [T1.id, R[0].id]), /not an eligible pair/);
let testPairOk = true;
try {
  await q(`insert into clicks (sender_id, receiver_id, intent_mode, surface, status, expires_at) values ($1::uuid, $2::uuid, 'friendship', 'discovery', 'pending', now() + interval '7 days')`, [T1.id, TNP.id]);
} catch (error) {
  testPairOk = error.message;
}
check("prompt 1: scripts can still seed a TEST pair directly", testPairOk === true, String(testPairOk));
await expectThrow("prompt 1: a script cannot insert a mutual between real members without passing photos",
  () => q(`insert into mutual_clicks (user_a_id, user_b_id, status) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid), 'active')`, [R[3].id, RF.id]), /not an eligible pair/);
await q(`update profiles set photo_url = 'https://media.letsclick.app/new.jpg' where id = $1::uuid`, [R[3].id]);
let st = (await q(`select photo_status from profiles where id = $1::uuid`, [R[3].id])).rows[0].photo_status;
check("01 §2: a changed photo is 'pending' until checked", st === "pending", st);
await q(`update profiles set photo_url = null where id = $1::uuid`, [R[3].id]);
st = (await q(`select photo_status from profiles where id = $1::uuid`, [R[3].id])).rows[0].photo_status;
check("01 §2: removing the photo sets 'none'", st === "none", st);
await q(`update profiles set photo_status = 'ok' where id = $1::uuid`, [R[3].id]);
st = (await q(`select photo_status from profiles where id = $1::uuid`, [R[3].id])).rows[0].photo_status;
check("01 §2: nothing is 'ok' without a photo", st === "none", st);
const recorded = await repo.recordProfilePhotoCheck(R[2].id, "https://media.letsclick.app/other.jpg", { status: "ok", reason: "x" });
check("01 §2: a verdict is recorded only on the photo that was checked", recorded === false);

/* ------------------------------------------------------------------ 5 LGBTQ+ */
const L1 = await person("Lgbt1");
const L2 = await person("Lgbt2");
const L3 = await person("Plain3");
for (const p of [L1, L2]) await repo.saveClickQuiz(session(p.email), { answers: { lgbtq: "yes" }, step: 5, finish: true });
await repo.saveClickQuiz(session(L3.email), { answers: { lgbtq: "no" }, step: 5, finish: true });
const lgbtRow = (await q(`select is_sensitive, fomo_only from tags where slug = 'lgbtq-plus'`)).rows[0];
check("08 §3: a quiz-created lgbtq-plus tag is born sensitive", lgbtRow?.is_sensitive === true, JSON.stringify(lgbtRow));
await features.refreshAllUserFeatures(pool);
const f1 = await candidates.loadUserFeatures(pool, L1.id);
const f2 = await candidates.loadUserFeatures(pool, L2.id);
const f3 = await candidates.loadUserFeatures(pool, L3.id);
check("08 §4.1: lgbtq-plus never reaches the feature store", !f1.lifeTags.includes("lgbtq-plus"), JSON.stringify(f1.lifeTags));
const both = score.scorePair(f1, f2);
const one = score.scorePair(f1, f3);
check("14.8: two members who both said yes to LGBTQ+ score exactly as otherwise (no pair boost)",
  Math.abs(both.score - one.score) < 1e-9 && score.buildPairFeatures(f1, f2).life_tag_overlap === 0,
  `${both.score} vs ${one.score}`);
check("14.8: ...no cohort change", f1.cohortId === f3.cohortId);
// Even a stale features row that still holds the tag is read back without it.
await q(`update user_features set life_tags = array['lgbtq-plus'] where profile_id = $1::uuid`, [L1.id]);
check("08 §4.1: a stale features row is filtered on the way out", !(await candidates.loadUserFeatures(pool, L1.id)).lifeTags.includes("lgbtq-plus"));
const detail = await repo.getAdminMemberDetail(L1.id);
check("14.8: the admin member page never lists lgbtq-plus against a named member", !(detail?.tags ?? []).some((t) => t.slug === "lgbtq-plus"));

/* ------------------------------------------------------------------ belonging */
const proud = await event("harness-proud");
const others = [];
for (let i = 1; i <= 4; i += 1) {
  const p = await person(`Proud${i}`);
  await repo.saveClickQuiz(session(p.email), { answers: { lgbtq: "yes" }, step: 5, finish: true });
  others.push(p);
}
await book(proud, L1);
for (const p of others.slice(0, 3)) await book(proud, p);
let preview = await repo.getEventAttendeePreview(proud.slug, session(L1.email), 8);
check("14.8: belonging needs 4 OTHERS - with 3 it stays off", preview.belonging === false);
await book(proud, others[3]);
preview = await repo.getEventAttendeePreview(proud.slug, session(L1.email), 8);
check("14.8: an LGBTQ+ member sees the belonging line once 4 others are confirmed", preview.belonging === true);
const line = fomo.attendeeFomoSignals({ confirmed: preview.totalConfirmed, topSharedInterest: null, datingCount: 0, viewerOpenToDating: false, belonging: preview.belonging });
check("14.8: never a number, never a name", line.includes(fomo.BELONGING_LINE) && !/\d/.test(fomo.BELONGING_LINE));
const plainPreview = await repo.getEventAttendeePreview(proud.slug, session(L3.email), 8);
check("14.8: a non-LGBTQ+ member never sees it", plainPreview.belonging === false);
const radarProud = await repo.getRadarSignals([{ id: proud.slug }], session(L1.email));
check("08 §10.5: the radar never carries the belonging line", !String(radarProud[proud.slug] ?? "").includes("not the only one"));

/* ------------------------------------------------------------------ 7 radar */
// Spread ages so no decade holds the room (the age line is a richer line and
// would rightly win), and a viewer who shares no interest with anyone.
const RV = await person("RadarViewer", { age: 29 });
const ages = [22, 25, 33, 36, 44, 47, 55, 61];
const small = await event("harness-small");
const s1 = await person("Small1", { age: 23 });
const s2 = await person("Small2", { age: 41 });
const s3 = await person("Small3", { age: 58 });
await book(small, s1);
await book(small, s2);
let radar = await repo.getRadarSignals([{ id: small.slug }], session(RV.email));
check("14.8: no attendee count or social line below 3 confirmed attendees", radar[small.slug] === undefined, radar[small.slug]);
for (const t of [T1, T2, TV]) await book(small, t);
radar = await repo.getRadarSignals([{ id: small.slug }], session(RV.email));
check("14.8: test bookings never lift a real viewer past the floor", radar[small.slug] === undefined, radar[small.slug]);
await book(small, s3);
radar = await repo.getRadarSignals([{ id: small.slug }], session(RV.email));
check("09 §9: at 3 real confirmed attendees the count line may show", radar[small.slug] === "3 going so far", radar[small.slug]);
await give(RV, "climbing");
await give(s1, "climbing");
radar = await repo.getRadarSignals([{ id: small.slug }], session(RV.email));
check("14.8 / 09 §9 rule 2: one attendee sharing an interest is never a line", radar[small.slug] === "3 going so far", radar[small.slug]);
await give(s2, "climbing");
radar = await repo.getRadarSignals([{ id: small.slug }], session(RV.email));
check("09 §9 rule 2: two sharing it is", radar[small.slug] === "2 going also like climbing", radar[small.slug]);
const testView = await repo.getRadarSignals([{ id: small.slug }], session(TV.email));
check("22A §4.5: a test viewer's count is test bookings only", testView[small.slug] === "3 going so far", testView[small.slug]);
const hot = await event("harness-hot");
const bookers = [];
for (const age of ages) bookers.push(await person(`Booker${age}`, { age }));
for (const p of bookers.slice(0, 7)) await book(hot, p, "2 hours");
for (const t of [T1, T2, TV, TNP]) await book(hot, t, "1 hour");
radar = await repo.getRadarSignals([{ id: hot.slug }], session(L3.email));
check("14.8: 7 real bookings in 24h (plus 4 test) is not trending - test bookings never count", radar[hot.slug] === "7 going so far", radar[hot.slug]);
await book(hot, bookers[7], "3 hours");
radar = await repo.getRadarSignals([{ id: hot.slug }], session(L3.email));
check("14.8: 'Trending near you' at trending_score >= 80 (8 real bookings in 24h)", radar[hot.slug] === "Trending near you", radar[hot.slug]);
const old = await event("harness-old");
for (const p of bookers) await book(old, p, "3 days");
radar = await repo.getRadarSignals([{ id: old.slug }], session(L3.email));
check("09 §10: bookings older than 24h are not trending", radar[old.slug] === "8 going so far", radar[old.slug]);

/* ------------------------------------------------------------------ admin numbers */
const realOnly = await repo.getAdminMetrics([], { includeTest: false });
const withTest = await repo.getAdminMetrics([], { includeTest: true });
const counts = (await q(`select count(*) filter (where not is_test)::int as real, count(*)::int as all from profiles where member_onboarded_at is not null`)).rows[0];
check("14.7: onboarded counts exclude test accounts by default", realOnly.totalMembers === counts.real, `${realOnly.totalMembers} vs ${counts.real}`);
check("14.7: ...and change when Include test is toggled", withTest.totalMembers === counts.all && withTest.totalMembers > realOnly.totalMembers);
const rsvps = (await q(`select count(*) filter (where not p.is_test)::int as real, count(*)::int as all from event_attendees ea join profiles p on p.id = ea.profile_id where ea.status = 'confirmed'`)).rows[0];
check("14.7: confirmed RSVPs exclude test bookings unless included", realOnly.confirmedRsvps === rsvps.real && withTest.confirmedRsvps === rsvps.all);
check("03 §9: Attendees = members with a confirmed booking", realOnly.attendees > 0 && realOnly.attendees <= realOnly.totalMembers);

/* ------------------------------------------------------------------ run-now gate */
const admin = await person("RealAdmin", { email: "admin.real@example.com", role: "admin" });
const client = await pool.connect();
const first = await jobs.runNowGate("build_daily_picks", admin.id)(client);
const second = await jobs.runNowGate("build_daily_picks", admin.id)(client);
const auditRows = (await q(`select count(*)::int as n from audit_logs where action = 'run_now.build_daily_picks'`)).rows[0].n;
check("14.7: Run now - the first press runs and is audited", first === null && auditRows === 1);
check("14.7: Run now - a second press inside 2 minutes is refused", typeof second === "string" && /2 minutes/.test(second));

/* ------------------------------------------------------------------ onboarding writes member */
const fresh = await person("Fresh", { member: false });
await repo.saveOnboarding({ displayName: "Fresh", suburb: "2000", bio: "", intents: [], tags: [], birthDate: "1995-05-05" }, session(fresh.email));
let member = (await q(`select member_onboarded_at from profiles where id = $1::uuid`, [fresh.id])).rows[0].member_onboarded_at;
check("01 §1.4: saving step 1 does not make a member", member === null);
await repo.saveOnboarding({ displayName: "Fresh", suburb: "2000", bio: "", intents: [], tags: [], birthDate: "1995-05-05", complete: true }, session(fresh.email));
member = (await q(`select member_onboarded_at from profiles where id = $1::uuid`, [fresh.id])).rows[0].member_onboarded_at;
check("01 §1.4: finishing the flow does", member !== null);
const status = await repo.getProfileStatus(session(fresh.email));
check("01 §1.4: ProfileStatus.onboardingComplete reads member status", status.onboardingComplete === true);

/* ------------------------------------------------------------------ 14.7 extras */
// After finishing onboarding, a former non-member appears and can be clicked.
await repo.saveOnboarding({ displayName: "NotMember", suburb: "2000", bio: "", intents: [], tags: [], birthDate: "1996-01-01", complete: true }, session(RN.email));
const poolAfter = new Set((await repo.getSuggestedPeople(V.id)).map((c) => c.id));
check("14.7: after finishing onboarding they appear like any member", poolAfter.has(RN.id));
const noBio = (await q(`select count(*)::int as n from profiles where id = any($1::uuid[]) and bio is null`, [[...poolAfter]])).rows[0].n;
check("14.7: a member with no bio but a passing photo appears", noBio > 0);

// Dating fail-safe (075, live since 2026-10-14) - still holding.
await expectThrow("14.7: set_romantic_visible(true) raises without a gender",
  () => q(`select set_romantic_visible($1::uuid, true)`, [V.id]), /gender_required/);
const dA = await person("DateA");
const dB = await person("DateB");
await q(`update profiles set gender = 'non-binary', dating_preference = 'everyone', connection_intents = '{dating}' where id = $1::uuid`, [dA.id]);
await q(`update profiles set gender = 'female', dating_preference = 'men', connection_intents = '{dating}' where id = $1::uuid`, [dB.id]);
await q(`select set_romantic_visible($1::uuid, true)`, [dA.id]);
await q(`select set_romantic_visible($1::uuid, true)`, [dB.id]);
let compatible = (await q(`select is_romantically_compatible($1::uuid, $2::uuid) as ok`, [dA.id, dB.id])).rows[0].ok;
check("14.7: non-binary satisfies only an 'everyone' preference", compatible === false);
await q(`update profiles set dating_preference = 'everyone' where id = $1::uuid`, [dB.id]);
compatible = (await q(`select is_romantically_compatible($1::uuid, $2::uuid) as ok`, [dA.id, dB.id])).rows[0].ok;
check("14.7 (control): two 'everyone' members who are both dating-visible are compatible", compatible === true);
await q(`update profiles set gender = '' , dating_visible = false where id = $1::uuid`, [dB.id]);
compatible = (await q(`select is_romantically_compatible($1::uuid, $2::uuid) as ok`, [dA.id, dB.id])).rows[0].ok;
check("14.7: a blank gender is never compatible", compatible === false);
const label = await jiti.import(path.join(REPO, "src/lib/intent-label.ts"));
check("14.7: no card shows 'Open to dating' unless the pair is compatible",
  label.soloIntentLabel(["dating"], false) === null &&
  label.soloIntentLabel(["dating", "friendship"], false) === "Here for friends" &&
  label.soloIntentLabel(["dating"], true) === "Open to dating");

/* ------------------------------------------------------------------ rollout window: 076 alone */
// Between 076 and the deploy the OLD code still runs, and it never sets
// photo_status or the tag flags. 076's two triggers must keep both right anyway.
{
  const { db: early } = await freshDatabase({ upTo: "076" });
  const e = async (text, params) => (await early.query(text, params)).rows;
  const status = async (id) => (await e(`select photo_status from profiles where id = $1::uuid`, [id]))[0].photo_status;
  const [{ id }] = await e(
    // is_test false: what the old code's own inserts leave by default.
    `insert into profiles (email, display_name, role, photo_url, is_test)
     values ('old.code@example.com', 'Old', 'attendee', 'https://media.letsclick.app/a.jpg', false) returning id::text`,
  );
  check("rollout (076 only): a photo the old code saves is 'pending'", (await status(id)) === "pending");
  await e(`update profiles set photo_status = 'ok' where id = $1::uuid`, [id]); // the backfill's verdict
  await e(`update profiles set photo_url = 'https://media.letsclick.app/b.jpg' where id = $1::uuid`, [id]);
  check("rollout (076 only): a checked photo the old code replaces is 'pending' again, never a stale 'ok'",
    (await status(id)) === "pending");
  await e(`update profiles set photo_url = null where id = $1::uuid`, [id]);
  check("rollout (076 only): a photo the old code removes is 'none'", (await status(id)) === "none");
  // The old quiz writer creates life tags with neither flag.
  await e(`delete from tags where slug in ('lgbtq-plus', 'sober-curious')`);
  await e(`insert into tags (label, slug, tag_type, admin_managed)
           values ('LGBTQ+', 'lgbtq-plus', 'life', false), ('Sober curious', 'sober-curious', 'life', false)`);
  const flags = await e(`select slug, is_sensitive, fomo_only from tags where slug in ('lgbtq-plus', 'sober-curious') order by slug`);
  check("rollout (076 only): a sensitive tag the old code creates is born sensitive", flags[0].is_sensitive === true, JSON.stringify(flags));
  check("rollout (076 only): ...and a FOMO-only one FOMO-only", flags[1].fomo_only === true, JSON.stringify(flags));
  await e(`update tags set is_sensitive = false where slug = 'lgbtq-plus'`);
  const still = (await e(`select is_sensitive from tags where slug = 'lgbtq-plus'`))[0].is_sensitive;
  check("08 §3: lgbtq-plus can never be made non-sensitive", still === true);
  await early.close();
}

/* ------------------------------------------------------------------ a test pair's plans */
const sailing = await tag("bp1-sailing");
const TM = await person("TestHost", { test: true, role: "merchant" });
const testNight = await event("bp1-test-night", { host: TM, inDays: 9 });
const realNight = await event("bp1-real-night", { host: RM, inDays: 5 });
for (const evt of [testNight, realNight]) {
  await q(`insert into event_tags (event_id, tag_id) values ($1::uuid, $2::uuid)`, [evt.id, sailing]);
}
const planOf = async (x, y) =>
  (await q(
    `select e.slug, p.proposed_by::text as by, p.status from click_proposals p
       join mutual_clicks m on m.id = p.mutual_click_id
       join events e on e.id = p.suggested_event_id
      where m.user_a_id = least($1::uuid, $2::uuid) and m.user_b_id = greatest($1::uuid, $2::uuid)`,
    [x.id, y.id],
  )).rows;
async function mutualFromPicks(x, y) {
  await seedPick(x, y);
  await seedPick(y, x);
  await repo.createUserClickForSession({ clickedProfileId: y.id, source: "explore" }, session(x.email));
  await repo.createUserClickForSession({ clickedProfileId: x.id, source: "explore" }, session(y.email));
}
const PA = await person("PairA", { test: true });
const PB = await person("PairB", { test: true });
const QA_ = await person("RealPairA");
const QB_ = await person("RealPairB");
for (const p of [PA, PB, QA_, QB_]) await give(p, "bp1-sailing");
await mutualFromPicks(PA, PB);
await mutualFromPicks(QA_, QB_);
const testPlan = await planOf(PA, PB);
check("22A §4.5: a test pair's mutual opens on a test-created event, never a real host's",
  testPlan.length === 1 && testPlan[0].slug === testNight.slug, JSON.stringify(testPlan));
const realPlan = await planOf(QA_, QB_);
check("control: a real pair's plan is unchanged (the soonest match - here the real night)",
  realPlan.length === 1 && realPlan[0].slug === realNight.slug, JSON.stringify(realPlan));

/* ------------------------------------------------------------------ 03 §10 hooks on real rows */
const hooks = await jiti.import(path.join(REPO, "src/lib/dev-pair-hooks.ts"));
const HA = await person("HookA", { test: true });
const HB = await person("HookB", { test: true });
for (const p of [HA, HB]) await give(p, "bp1-sailing");
const pair = await hooks.guardDevPair(HA.id, HB.id);
const pastReal = await event("bp1-past-real", { past: true, host: RM });
const pastTest = await event("bp1-past-test", { past: true, host: TM });
for (const evt of [pastReal, pastTest]) {
  await q(`insert into post_event_click_answers (profile_id, event_id, kind) values ($1::uuid, $2::uuid, 'none')`, [HA.id, evt.id]);
}
await hooks.resetDevPair(pair);
const answersLeft = (await q(
  `select e.slug from post_event_click_answers a join events e on e.id = a.event_id where a.profile_id = $1::uuid`,
  [HA.id],
)).rows.map((r) => r.slug);
check("03 §10: reset clears the pair's post-event answers on test events only",
  answersLeft.join() === pastReal.slug, answersLeft.join());
let walk = true;
try {
  await hooks.setDevPairStage(pair, "suggest", testNight.slug);
} catch (error) {
  walk = error.message;
}
const suggested = await planOf(HA, HB);
check("03 §10: a 'suggest' jump over Click's own pick re-points it - one plan, on the named test event, by A",
  walk === true && suggested.length === 1 && suggested[0].slug === testNight.slug && suggested[0].by === HA.id
    && suggested[0].status === "pending",
  `${walk} ${JSON.stringify(suggested)}`);
walk = true;
try {
  await hooks.setDevPairStage(pair, "both_going", testNight.slug);
} catch (error) {
  walk = error.message;
}
const going = (await q(
  `select count(*)::int as n from event_attendees where event_id = $1::uuid and profile_id = any($2::uuid[]) and status = 'confirmed'`,
  [testNight.id, [HA.id, HB.id]],
)).rows[0].n;
check("03 §10: a 'both going' jump agrees the plan and books both on the test night", walk === true && going === 2, `${walk} ${going}`);
let guardAfter = true;
try {
  await hooks.guardDevPair(HA.id, HB.id);
} catch (error) {
  guardAfter = error.message;
}
check("03 §10: after the jumps the pair touches test events only - the guard still clears it", guardAfter === true, String(guardAfter));
const hookAudits = (await q(`select count(*)::int as n from audit_logs where action like 'dev.%'`)).rows[0].n;
await hooks.runGuardedDevHook("coord.reset", { via: "harness" }, () => ({
  a: HA.id,
  b: HB.id,
  events: [],
  run: (context) => hooks.resetDevPair(context).then((r) => r.join()),
}));
const outcomes = (await q(
  `select metadata->>'outcome' as outcome from audit_logs where action = 'dev.coord.reset' order by created_at, metadata->>'outcome' desc`,
)).rows.map((r) => r.outcome);
check("03 §10: a hook call is audited before it runs, then with its outcome",
  hookAudits === 0 && outcomes.join() === "started,ok", outcomes.join());
await expectThrow("03 §10: a pair with a real member is refused",
  () => hooks.runGuardedDevHook("coord.reset", { a: HA.id, b: V.id }, () => ({ a: HA.id, b: V.id, events: [], run: async () => "ran" })),
  /Both people must be test accounts/);
await expectThrow("03 §10: an unknown stage is refused",
  () => hooks.runGuardedDevHook("coord.set", { via: "harness", stage: "nope" }, () => {
    throw new hooks.DevHookRefusedError("Unknown stage");
  }),
  /Unknown stage/);
const refusals = (await q(
  `select metadata->>'actor' as actor, metadata->'request'->>'b' as b, metadata->'request'->>'stage' as stage
     from audit_logs where action in ('dev.coord.reset', 'dev.coord.set') and metadata->>'outcome' = 'refused'
    order by created_at`,
)).rows;
check("03 §10: every refusal is audited with the admin and what was asked",
  refusals.length === 2 && refusals.every((r) => r.actor === "admin.real@example.com")
    && refusals[0].b === V.id && refusals[1].stage === "nope",
  JSON.stringify(refusals));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length > 0 ? 1 : 0);
