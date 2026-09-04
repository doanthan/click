import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The /test-click harness signs in AS a QA persona to drive both sides of a click
// from one page. That is the same power the QA persona switcher hands out, so it
// carries the same boundary - and unlike the switcher, this one is reachable by a
// server action, which is every bit as callable as a page.
//
// These are source assertions rather than behavioural ones on purpose: the thing
// worth pinning is that the gates EXIST at the places a future edit would route
// around, and no reachable database has an unlocked harness on it to prove that
// against.

const root = process.cwd();
const read = (p) => readFileSync(path.join(root, p), "utf8");

const harness = read("src/lib/click-test-harness.ts");
const fixtures = read("src/lib/click-test-fixtures.ts");
const actions = read("src/app/test-click/actions.ts");
const page = read("src/app/test-click/page.tsx");
const runtimeMode = read("src/lib/runtime-mode.ts");

test("the harness cannot mint a session for anything but the QA namespace", () => {
  const mint = harness.slice(harness.indexOf("export async function harnessSession"));
  assert.match(
    mint,
    /if \(!address\.endsWith\(QA_NAMESPACE\)\)/,
    "harnessSession must refuse any address outside @click.local - a real Google " +
      "account must not be impersonable even by an unlocked admin.",
  );
  assert.match(
    mint,
    /await assertHarnessAllowed\(\)/,
    "harnessSession must run the production + QA-unlock gate before it mints anything.",
  );
  assert.match(
    mint,
    /select display_name, photo_url from profiles where email = \$1/,
    "harnessSession must require the profile to already exist - ensureProfileForSession " +
      "is an upsert, so a typo'd address would otherwise CREATE an account.",
  );
});

test("the harness is closed on a production deployment and behind the QA unlock", () => {
  assert.match(
    harness,
    /if \(isProductionDeployment\(\)\) return false;\s*\n\s*return isTestSwitcherUnlocked\(\);/,
    "isHarnessAllowed must fail closed on production AND require the same unlock " +
      "cookie as the persona switcher.",
  );
  assert.match(page, /if \(isProductionDeployment\(\)\) notFound\(\);/);
});

test("every harness action runs the gate, not just the ones that need a session", () => {
  const body = actions.slice(actions.indexOf("export async function harnessAction"));
  const gateAt = body.indexOf("await assertHarnessAllowed()");
  const switchAt = body.indexOf("switch (step)");
  assert.ok(gateAt > -1, "harnessAction must call assertHarnessAllowed().");
  assert.ok(
    gateAt < switchAt,
    "the gate must run BEFORE the switch. run_sweep calls the lifecycle cron body " +
      "with no session of its own, so a per-case gate is one forgotten case away " +
      "from an unauthenticated write.",
  );
});

test("the destructive helpers are scoped to a resolved QA pair", () => {
  for (const fn of ["resetPair", "windBackClock"]) {
    const body = harness.slice(harness.indexOf(`export async function ${fn}`));
    assert.match(
      body.slice(0, 900),
      /const people = await listHarnessPeople\(\)/,
      `${fn} must resolve both ids from the @click.local roster first, so a pair ` +
        `containing a real account can never be passed in.`,
    );
  }
  assert.match(
    harness,
    /if \(!slug\.startsWith\("qa-"\)\)/,
    "fillEventToCapacity must refuse any event that is not a QA fixture - it takes " +
      "seats, and taking them on a real event is not a test.",
  );
});

test("winding a clock only moves the deadline - the sweep still does the expiring", () => {
  const body = harness.slice(harness.indexOf("export async function windBackClock"));
  assert.doesNotMatch(
    body,
    /set status = '(expired|released|suppressed)'/,
    "windBackClock must never write a lapsed state directly. That produces a state " +
      "the app never actually makes and skips expireClickLifecycles, which is the " +
      "thing under test.",
  );
  assert.match(body, /set expires_at = now\(\) - interval '1 minute'/);
});

test("the fixtures are all relative to now(), which is the whole point of them", () => {
  // The bug this module exists to fix: the QA events were seeded at absolute
  // timestamps, drifted out of every window the mechanic reads, and the post-event
  // surface plus the entire coordination half went quiet in a way that reads as a
  // broken mechanic rather than stale data.
  assert.doesNotMatch(
    fixtures,
    /startsIn: "\d{4}-\d{2}-\d{2}/,
    "a fixture pinned to a calendar date will go stale again.",
  );
  const offsets = [...fixtures.matchAll(/startsIn: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(offsets.length >= 5, "expected at least five fixture events");
  assert.ok(
    offsets.some((o) => o.startsWith("-")),
    "one fixture must be in the PAST or the post-event surface has nothing to open on.",
  );
  assert.ok(
    offsets.some((o) => /^\d+ days$/.test(o)),
    "one fixture must be far enough ahead to be suggestible as a plan.",
  );
  assert.match(
    fixtures,
    /now\(\) \+ \$7::interval/,
    "the timestamps must be computed by the database from now(), not by the caller.",
  );
});

test("the fixtures only ever touch their own slugs and QA people", () => {
  assert.match(fixtures, /where e\.slug = any\(\$1::text\[\]\)/);
  for (const sql of fixtures.matchAll(/delete from (\w+) where event_id = \$1::uuid/g)) {
    assert.ok(
      ["event_attendees", "event_waitlists"].includes(sql[1]),
      `unexpected delete from ${sql[1]} - the fixture builder must not clear anything ` +
        `beyond its own events' seats.`,
    );
  }
  assert.match(
    fixtures,
    /email like '%@click\.local'/,
    "the fixture seats must come from the QA namespace only.",
  );
});

test("the harness drives the real repository functions, never its own SQL", () => {
  // A harness that writes the rows itself tests the harness.
  assert.doesNotMatch(
    actions,
    /insert into (clicks|mutual_clicks|click_proposals)/i,
    "the driver must go through event-repository, not hand-write the outcome.",
  );
  for (const fn of [
    "createUserClickForSession",
    "suggestPlanForMutual",
    "confirmProposal",
    "declineProposalForSession",
    "proposeAlternativeForProposal",
    "softReleaseMutualForSession",
    "releaseMutualForSession",
    "joinWaitlistTogetherForMutual",
    "expireClickLifecycles",
  ]) {
    assert.ok(actions.includes(fn), `the harness should exercise ${fn}`);
  }
});

test("the two release doors are wired to the controls the product actually shows", () => {
  // The repository names are the opposite way round from what they suggest:
  // releaseMutualForSession is the drawer's "Not feeling it" (90-day suppression)
  // and softReleaseMutualForSession is the quieter "set it down". Getting these
  // backwards on the harness would have a tester sign off the wrong door.
  const board = read("src/app/test-click/harness-board.tsx");
  const notFeeling = board.indexOf('label="Not feeling it"');
  const setDown = board.indexOf('label="Set it down"');
  assert.ok(notFeeling > -1 && setDown > -1, "both endings must be drivable");
  assert.match(
    board.slice(notFeeling, notFeeling + 200),
    /step: "release"/,
    '"Not feeling it" must fire releaseMutualForSession - the arm that writes the ' +
      "90-day pair_suppressions row.",
  );
  assert.match(
    board.slice(setDown, setDown + 200),
    /step: "soft_release"/,
    '"Set it down" must fire softReleaseMutualForSession - the arm that writes NO ' +
      "suppression row.",
  );
});

test("the send result never claims to know whether a mutual formed", () => {
  // 6.1 makes the send response byte-identical either way, so the harness must not
  // become the oracle the endpoint refuses to be. The pair state panel is where an
  // outcome is read from.
  const send = actions.slice(actions.indexOf('case "send_discovery"'));
  const message = send.slice(0, send.indexOf("case \"send_post_event\""));
  assert.doesNotMatch(message, /\bit'?s mutual\b/i);
  assert.match(message, /says nothing about whether it was mutual/);
});

test("the fixture builder never upserts a live event by slug", () => {
  // The bug this pins, found by pressing Rebuild twice:
  //
  // `events` carries prevent_merchant_event_overlap (database/001_schema.sql:295),
  // a BEFORE INSERT OR UPDATE trigger refusing two overlapping live events for one
  // merchant. It excludes the row being written with `existing.id <> new.id`. On an
  // UPDATE that works - new.id is the row's own id. On the INSERT half of an
  // `insert ... on conflict (slug) do update`, new.id is a freshly generated uuid,
  // and Postgres fires the BEFORE INSERT trigger BEFORE ON CONFLICT resolves. So
  // the statement sees the very row it is about to update as a *different* event
  // occupying the same window, and raises "merchant has an overlapping live event".
  //
  // The upsert therefore works exactly once - on the run that creates the row - and
  // every rebuild after that is silently refused, which is precisely the "my
  // fixtures are stale" failure this module exists to end.
  // Comment lines stripped first: the comment above this very code says the words
  // "on conflict (slug)" while explaining why it must not be used, and a check that
  // its own explanation trips is a check nobody keeps.
  const code = fixtures
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*|--)/.test(line))
    .join("\n");
  assert.doesNotMatch(
    code,
    /on conflict \(slug\)/,
    "an upsert on a live event's slug cannot survive prevent_merchant_event_overlap - " +
      "update first, then insert only when no row came back.",
  );
  const updateAt = fixtures.indexOf("update events set");
  const insertAt = fixtures.indexOf("insert into events (");
  assert.ok(updateAt > -1 && insertAt > -1, "both halves must be present");
  assert.ok(updateAt < insertAt, "the UPDATE must be attempted before the INSERT");
  assert.match(
    fixtures,
    /const event = updated\.rowCount\s*\n?\s*\? updated/,
    "the insert must run only when the update matched nothing.",
  );
});

test("a fixture rebuild re-homes the events, so it cannot collide later", () => {
  const update = fixtures.slice(fixtures.indexOf("update events set"));
  assert.match(
    update.slice(0, 900),
    /merchant_profile_id = \$7::uuid/,
    "a fixture left on a merchant who has since taken on real events is exactly the " +
      "state that makes the NEXT rebuild collide with one of them.",
  );
  assert.match(
    fixtures,
    /order by \(\s*\n\s*select count\(\*\) from events e/,
    "the host must be the approved QA merchant with the fewest other live events - " +
      "every rebuild slides these five forward, so they need room to move.",
  );
});

test("the driver is not a third click surface, because the route never ships", () => {
  // Part A's hardest invariant is that there are EXACTLY TWO click surfaces and a
  // profile is never one of them - it is why src/components/profile-click-button.tsx
  // was deleted. The driver plainly renders click controls, so the only thing making
  // that legal is that /test-click cannot be reached by a user at all.
  //
  // scripts/click-greps.mjs does not catch this on its own: grep 1 only inspects
  // lines that also mention "profile" or "attendee", and the driver's buttons name
  // a person. So the guarantee is pinned here instead of being left to a filter that
  // happens not to look.
  assert.match(
    runtimeMode,
    /"\/test-click"/,
    "/test-click must be listed in isInternalRoute so src/proxy.ts 404s it - the page " +
      "AND its server actions, which POST to the same path.",
  );
  const list = runtimeMode.slice(0, runtimeMode.indexOf("isProductionDeployment"));
  assert.ok(
    list.includes('"/test-click"'),
    "/test-click must be in the INTERNAL route list, not merely mentioned somewhere.",
  );
});
