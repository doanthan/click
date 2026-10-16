// 03 §10 Test pairs hooks - /dev/coord/reset, /dev/coord/set,
// /dev/coord/reveal_seen, /dev/clock/advance. The guard is run for real against a
// stand-in database (src/lib/dev-pair-hooks.ts loaded with mocked imports, the
// way tests/account-switch.test.mjs loads the switch): admin AND both people test
// accounts AND every touched event test-created, else 403, and every admin's
// call audited.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as policy from "../src/lib/account-switch-policy.ts";

const realRequire = createRequire(import.meta.url);
function load(file, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", source)(
    (name) => (name in mocks ? mocks[name] : realRequire(name)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

const ADMIN = "owner@example.com";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const REAL = "33333333-3333-4333-8333-333333333333";
const people = {
  [A]: { id: A, email: "maya@click.local", name: "Maya", is_test: true },
  [B]: { id: B, email: "ruby@click.local", name: "Ruby", is_test: true },
  [REAL]: { id: REAL, email: "member@example.com", name: "Member", is_test: false },
};

function harness({ session = null, grant = null, events = [], auditFails = false } = {}) {
  const queries = [];
  const answer = async (sql, values = []) => {
    queries.push({ sql, values });
    if (auditFails && sql.includes("insert into audit_logs")) throw new Error("audit_logs unavailable");
    if (/from profiles where id = any/.test(sql)) {
      return { rows: values[0].filter((id) => people[id]).map((id) => people[id]) };
    }
    if (/from events e/.test(sql)) return { rows: events };
    if (/select id::text from profiles where email/.test(sql)) return { rows: [{ id: "admin-profile" }] };
    return { rows: [], rowCount: 0 };
  };
  const client = { query: answer, release() {} };
  const hooks = load("../src/lib/dev-pair-hooks.ts", {
    "server-only": {},
    "@/auth": { auth: async () => session, isAdminEmail: (email) => email === ADMIN },
    "@/lib/account-switch-policy": policy,
    "@/lib/event-repository": { testCreatedEventSql: (alias) => `test_created(${alias})` },
    "@/lib/postgres": { getPostgresPool: () => ({ query: answer, connect: async () => client }) },
    "@/lib/runtime-mode": { isLocalDevelopment: () => false },
    "@/lib/test-switcher": { adminQaGrantEmail: async () => grant },
  });
  const audits = () => queries.filter((q) => q.sql.includes("insert into audit_logs"));
  return { hooks, queries, audits };
}

const adminSession = { user: { email: ADMIN }, expires: new Date(Date.now() + 3_600_000).toISOString() };
const post = (body) => new Request("https://www.letsclick.app/dev/coord/reset", { method: "POST", body: JSON.stringify(body) });
const resetPlan = (hooks) => () => ({ events: [], run: async (context) => (await hooks.resetDevPair(context)).join(" ") });

test("no admin behind the request: 403, nothing read, nothing written - not even an audit row", async () => {
  for (const session of [null, { user: { email: "member@example.com" } }, { user: { email: "maya@click.local" } }]) {
    const h = harness({ session });
    const response = await h.hooks.runDevHook(post({ a: A, b: B }), "coord.reset", resetPlan(h.hooks));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Admin only." });
    assert.equal(h.queries.length, 0);
  }
});

test("the shared tester key is not an admin; an admin's QA grant or own session is", async () => {
  // A persona session with no admin grant (the TEST_SWITCHER_KEY path) is refused.
  let h = harness({ session: { user: { email: "maya@click.local" } }, grant: null });
  assert.equal((await h.hooks.runDevHook(post({ a: A, b: B }), "coord.reset", resetPlan(h.hooks))).status, 403);
  // An admin's signed grant, even from inside a persona session, passes the admin check.
  h = harness({ session: { user: { email: "maya@click.local" } }, grant: ADMIN });
  assert.equal((await h.hooks.runDevHook(post({ a: A, b: B }), "coord.reset", resetPlan(h.hooks))).status, 200);
  // So does an admin viewing an account (the actor is the admin).
  h = harness({ session: { user: { email: "maya@click.local" }, impersonation: { actor: { email: ADMIN }, expiresAt: Date.now() + 60_000, readOnly: false } } });
  assert.equal((await h.hooks.runDevHook(post({ a: A, b: B }), "coord.reset", resetPlan(h.hooks))).status, 200);
});

test("a pair with a real member in it is refused (403) and the refusal is audited", async () => {
  const h = harness({ session: adminSession });
  const response = await h.hooks.runDevHook(post({ a: A, b: REAL }), "coord.reset", resetPlan(h.hooks));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Both people must be test accounts." });
  assert.ok(!h.queries.some((q) => /delete from|update /.test(q.sql)), "nothing was touched");
  assert.equal(h.audits().length, 1);
  assert.equal(h.audits()[0].values[1], "dev.coord.reset");
  const row = JSON.parse(h.audits()[0].values[3]);
  assert.equal(row.outcome, "refused");
  // Who asked, and for which pair - even though the guard never cleared one.
  assert.equal(row.actor, ADMIN);
  assert.deepEqual([row.request.a, row.request.b], [A, REAL]);
});

test("a request the hook can't use is still a call: refused and audited, naming the admin", async () => {
  // An unknown stage, checked by the route's own plan.
  let h = harness({ session: adminSession });
  let response = await h.hooks.runDevHook(post({ a: A, b: B, stage: "nope" }), "coord.set", () => {
    throw new h.hooks.DevHookRefusedError("stage must be one of reveal, suggest.");
  });
  assert.equal(response.status, 403);
  assert.equal(h.audits().length, 1);
  let row = JSON.parse(h.audits()[0].values[3]);
  assert.deepEqual([row.outcome, row.actor, row.request.stage], ["refused", ADMIN, "nope"]);
  // A body that isn't JSON.
  h = harness({ session: adminSession });
  response = await h.hooks.runDevHook(
    new Request("https://www.letsclick.app/dev/coord/reset", { method: "POST", body: "not json" }),
    "coord.reset",
    resetPlan(h.hooks),
  );
  assert.equal(response.status, 400);
  assert.equal(h.audits().length, 1);
  row = JSON.parse(h.audits()[0].values[3]);
  assert.deepEqual([row.outcome, row.actor], ["refused", ADMIN]);
});

test("any touched event not created by a test account is refused", async () => {
  const h = harness({ session: adminSession, events: [{ slug: "real-night", test_created: false }] });
  const response = await h.hooks.runDevHook(post({ a: A, b: B, event: "real-night" }), "coord.set", () => ({
    events: ["real-night"],
    run: async () => "should not run",
  }));
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /Not a test-created event: real-night/);
  // An unknown event is refused too, never skipped.
  const missing = harness({ session: adminSession, events: [] });
  const second = await missing.hooks.runDevHook(post({ a: A, b: B }), "coord.set", () => ({
    events: ["no-such-night"],
    run: async () => "should not run",
  }));
  assert.equal(second.status, 403);
});

test("admin + two test accounts + test events: the hook runs on that pair only, and is audited", async () => {
  const h = harness({ session: adminSession, events: [{ slug: "qa-click-plan-a", test_created: true }] });
  const response = await h.hooks.runDevHook(post({ a: A, b: B }), "coord.reset", resetPlan(h.hooks));
  assert.equal(response.status, 200);
  const deletes = h.queries.filter((q) => q.sql.includes("delete from"));
  assert.ok(deletes.length > 0);
  for (const q of deletes) assert.deepEqual(q.values, [A, B], "pair rows only");
  // Audited BEFORE anything changed, then the outcome.
  const started = h.queries.findIndex((q) => q.sql.includes("insert into audit_logs"));
  assert.ok(started > -1 && started < h.queries.indexOf(deletes[0]), "the audit row comes first");
  assert.deepEqual(h.audits().map((q) => JSON.parse(q.values[3]).outcome), ["started", "ok"]);
  assert.equal(h.audits().at(-1).values[0], "admin-profile");
});

test("a hook whose audit row can't be written does not run", async () => {
  const h = harness({ session: adminSession, auditFails: true });
  const response = await h.hooks.runDevHook(post({ a: A, b: B }), "coord.reset", resetPlan(h.hooks));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /Couldn't write the audit row, so the hook did not run/);
  assert.ok(!h.queries.some((q) => /delete from|update /.test(q.sql)), "nothing was touched");
});

test("reset clears the pair's rows, and post-event answers on test-created events only", async () => {
  const h = harness({ session: adminSession });
  await h.hooks.resetDevPair(await h.hooks.guardDevPair(A, B));
  const deletes = h.queries.filter((q) => q.sql.includes("delete from"));
  assert.ok(!deletes.some((q) => q.sql.includes("click_swaps")), "swaps go with their pair click (cascade)");
  const answers = deletes.find((q) => q.sql.includes("post_event_click_answers"));
  assert.match(answers.sql, /answer\.profile_id in \(\$1::uuid, \$2::uuid\)\s+and test_created\(e\)/);
});

test("advancing the clock moves only the pair's rows, by whole hours inside the cap", async () => {
  const h = harness({ session: adminSession });
  const context = await h.hooks.guardDevPair(A, B);
  await assert.rejects(h.hooks.advanceDevPairClock(context, 0), /whole number/);
  await assert.rejects(h.hooks.advanceDevPairClock(context, h.hooks.DEV_CLOCK_MAX_HOURS + 1), /whole number/);
  await h.hooks.advanceDevPairClock(context, 6);
  const updates = h.queries.filter((q) => q.sql.trim().startsWith("update"));
  assert.equal(updates.length, 4, "clicks, plans, mutual, suppression");
  for (const q of updates) assert.deepEqual(q.values, [A, B, 6]);
});

test("the four routes exist, POST only, and all go through runDevHook", () => {
  for (const [route, hook] of [
    ["src/app/dev/coord/reset/route.ts", "coord.reset"],
    ["src/app/dev/coord/set/route.ts", "coord.set"],
    ["src/app/dev/coord/reveal_seen/route.ts", "coord.reveal_seen"],
    ["src/app/dev/clock/advance/route.ts", "clock.advance"],
  ]) {
    const src = readFileSync(new URL(`../${route}`, import.meta.url), "utf8");
    assert.match(src, /export async function POST\(request: Request\)/, route);
    assert.doesNotMatch(src, /export async function (GET|PUT|DELETE|PATCH)/, route);
    assert.ok(src.includes(`runDevHook(request, "${hook}"`), route);
  }
  // Stage jumps walk the real flow, never a written end state.
  const hooks = readFileSync(new URL("../src/lib/dev-pair-hooks.ts", import.meta.url), "utf8");
  const stage = hooks.slice(hooks.indexOf("export async function setDevPairStage("));
  assert.match(stage, /await createUserClickForSession\(\{ clickedProfileId: context\.b\.id, source: "explore" \}, a\);/);
  assert.doesNotMatch(stage, /update mutual_clicks|insert into mutual_clicks|insert into clicks/);
  // A mutual that opened on Click's own pick is re-pointed, never stacked on.
  assert.match(stage, /if \(systemPick\.rows\[0\]\) \{\s*await proposeAlternativeForProposal\(proposer, systemPick\.rows\[0\]\.id, eventSlug!\);\s*\} else \{\s*await suggestPlanForMutual\(proposer, mutualId, eventSlug!\);/);
});

test("/test-click's hook steps go through the same guard and audit, on the guarded pair", () => {
  const actions = readFileSync(new URL("../src/app/test-click/actions.ts", import.meta.url), "utf8");
  for (const hook of ["coord.reset", "coord.set", "clock.advance", "clock.wind"]) {
    assert.ok(actions.includes(`runGuardedDevHook(`) && actions.includes(`"${hook}"`), hook);
  }
  assert.doesNotMatch(actions, /guardDevPair\(|auditDevHook\(/, "no hand-rolled guard or audit");
  // The clock wind acts on the pair the guard cleared, not the a/b fields.
  assert.match(actions, /windBackClock\(context\.a\.email, context\.b\.email, target\)/);
});
