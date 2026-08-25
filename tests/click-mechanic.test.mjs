import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The click mechanic's guarantees are privacy guarantees, and every one of them is
// a property of SQL and control flow rather than of a return value - which is why
// they kept regressing quietly. These are source assertions for the same reason the
// rest of tests/ is: the only database this repo can reach is production.

const root = process.cwd();
const read = (p) => readFileSync(path.join(root, p), "utf8");

const repo = read("src/lib/event-repository.ts");
const constants = read("src/lib/clicks/constants.ts");
const clicksRoute = read("src/app/api/clicks/route.ts");
const drawer = read("src/components/coordination-drawer.tsx");
const settingsPage = read("src/app/account-settings/page.tsx");

// Everything between `async function sendClickInner(` and the wrapper that follows.
const sendClickInner = repo.slice(
  repo.indexOf("async function sendClickInner("),
  repo.indexOf("export async function createUserClickForSession("),
);
assert.ok(sendClickInner.length > 2000, "failed to slice sendClickInner");

test("a mutual click costs no extra response time", () => {
  // logEmailEvent awaits a Resend fetch with no timeout. Awaited inside the send,
  // only the mutual path paid for it, so response latency answered "did they click
  // me back?" - the one question the constant-time floor exists to refuse.
  assert.match(repo, /function afterResponse\(/);
  assert.match(repo, /afterResponse\(async \(\) => \{/);
  // Every logEmailEvent in the send must sit INSIDE the afterResponse callback -
  // i.e. none of them can appear before the wrapper opens.
  const firstAfter = sendClickInner.indexOf("afterResponse(async");
  const firstLog = sendClickInner.indexOf("logEmailEvent({");
  assert.ok(firstAfter > -1, "sendClickInner must hand its email work to afterResponse");
  assert.ok(
    firstLog > firstAfter,
    "an email logged before afterResponse opens is awaited inside the timed send",
  );
});

test("the mutual email fires only for a mutual that just formed", () => {
  // Gated on `reciprocalClick` it also fired for a reciprocal click arriving while
  // a mutual was already live - a no-op by spec, and a second copy of the email.
  assert.match(repo, /let freshMutualId: string \| null = null;/);
  assert.match(repo, /freshMutualId = mutualClickId;/);
  assert.match(repo, /if \(freshMutualId\) \{\s*\n\s*const origin = emailOrigin\(\);/);
});

test("every receiver-state refusal is the same refusal", () => {
  assert.match(repo, /function notEligibleError\(\)/);
  // No send-path check may mint its own wording, and none may raise a NotFoundError:
  // a 404 for an unknown id turns the endpoint into a profile-existence oracle.
  assert.doesNotMatch(
    sendClickInner,
    /NotFoundError/,
    "an unknown profile id must refuse exactly like an ineligible one",
  );
  const inlineNeutral = sendClickInner.match(
    /new Error\("This person isn't available to click with right now\."\)/g,
  );
  assert.equal(inlineNeutral, null, "use notEligibleError(), never a fresh copy of the string");
  // Age, ban/opt-out/pause, block, suppression, not-at-the-event, hidden attendee.
  const uses = sendClickInner.match(/throw notEligibleError\(\)/g) ?? [];
  assert.ok(uses.length >= 5, `expected >=5 neutral refusals, found ${uses.length}`);
});

test("the post-event surface answers the public clock and the private roster separately", () => {
  // Fused, the two leaked into each other: on an event the sender knows is open and
  // knows they attended, "window closed" could only mean the receiver wasn't there.
  const windowMessage = /The window to click people from this event has closed/;
  assert.match(sendClickInner, windowMessage);
  // The SQL only - the prose around it names both tables on purpose.
  const windowSqlStart = sendClickInner.indexOf("const windowResult");
  const windowQuery = sendClickInner.slice(
    sendClickInner.indexOf("`", windowSqlStart),
    sendClickInner.indexOf("`,", windowSqlStart),
  );
  assert.ok(windowQuery.length > 200, "windowResult query not found");
  assert.doesNotMatch(
    windowQuery,
    /event_participants_v|event_attendees/,
    "the window check must not join attendance - that is what makes it safe to explain",
  );
  // Attendance is decided separately, and refuses neutrally.
  assert.match(
    sendClickInner,
    /if \(!pairResult\.rows\[0\]\?\.ok \|\| !clickedProfile\.default_attend_visibility\) \{\s*\n\s*throw notEligibleError\(\);/,
  );
});

test("the send-click ceiling binds the server actions, not just the API route", () => {
  // Both real surfaces (/people, the post-event card) are server actions; /api/clicks
  // is the one send path nothing in the product calls.
  assert.match(constants, /export const SEND_CLICK_HOURLY_LIMIT = \d+;/);
  const wrapper = repo.slice(repo.indexOf("export async function createUserClickForSession("));
  assert.match(wrapper, /scope: "send-click"/);
  assert.match(wrapper, /limit: SEND_CLICK_HOURLY_LIMIT/);
  assert.match(wrapper, /RateLimitedError/);
  // And the route must not count a second time against the same scope.
  assert.doesNotMatch(clicksRoute, /checkRateLimit/);
  assert.match(clicksRoute, /error\.name === "RateLimitedError"/);
  assert.match(clicksRoute, /status: 429/);
  assert.doesNotMatch(clicksRoute, /status: 404/);
});

test("attendance is never public by face", () => {
  // migration 049 added the opt-out columns and nothing read them, so the toggle
  // existed in the schema and did nothing in the product.
  const avatarPreviews = repo.match(/and profile\.default_attend_visibility/g) ?? [];
  assert.ok(
    avatarPreviews.length >= 3,
    `the who's-going previews must honour the opt-out (found ${avatarPreviews.length})`,
  );
  assert.match(repo, /and ea\.visible_to_attendees/);
  // The signed-out event-card preview also excludes banned accounts.
  assert.match(repo, /and profile\.is_banned = false\s*\n\s*and ea\.visible_to_attendees/);
});

test("a post-event roster only offers people the send path will accept", () => {
  // A roster that lists someone you cannot click is a dead button AND a disclosure:
  // the refusal that follows confirms their state.
  const rosterGuards = repo.match(/and other\.default_attend_visibility/g) ?? [];
  assert.equal(rosterGuards.length, 3, "both pull rosters and the push cron need the guard");
  const socialGuards = repo.match(/and other\.social_visible = true/g) ?? [];
  assert.equal(socialGuards.length, 3);
  const pauseGuards = repo.match(/and \(other\.paused_until is null or other\.paused_until <= now\(\)\)/g) ?? [];
  assert.equal(pauseGuards.length, 3);
});

test("a banned or suspended profile is not publicly readable", () => {
  const publicProfile = repo.slice(
    repo.indexOf("export async function getPublicProfileById("),
    repo.indexOf("export type ProfileUpdateInput"),
  );
  assert.ok(publicProfile.length > 500, "failed to slice getPublicProfileById");
  assert.match(publicProfile, /and is_banned = false/);
  assert.match(publicProfile, /and suspended_at is null/);
});

test("a guest +1 counts as holding a seat", () => {
  // event_attendees has no row for a claimed guest seat (it hangs off the
  // purchaser's booking), so the drawer told them to RSVP to their own event and
  // "Both going" could never appear for that pair. Migration 056's whole point.
  const proposals = repo.slice(
    repo.indexOf("      viewer_has_seat: boolean;"),
    repo.indexOf("alternativesRemaining: Math.max"),
  );
  assert.ok(proposals.length > 1000, "failed to slice getProposalsForSession");
  assert.match(proposals, /from event_participants_v pv\s*\n\s*where pv\.event_id = e\.id and pv\.profile_id = \$1::uuid\s*\n\s*\) as viewer_has_seat/);
  assert.match(proposals, /\) as other_has_seat/);
  assert.doesNotMatch(
    proposals.slice(proposals.indexOf("viewer_has_seat,") - 400, proposals.indexOf("other_has_seat,")),
    /event_attendees/,
  );
});

test("a plan that died under a pair can always be re-picked", () => {
  // The 3-alternative budget stops endless re-pointing of a LIVE plan. A cancelled
  // or sold-out event is not a counter-proposal, and a pair who had spent their
  // three alternatives had no move left at all: the recovery button posted straight
  // into "You've reached the limit of 3".
  const propose = repo.slice(
    repo.indexOf("export async function proposeAlternativeForProposal("),
    repo.indexOf("export async function proposeAlternativeForProposal(") + 6000,
  );
  assert.match(propose, /const planStillLive = Boolean\(stillLive\.rows\[0\]\?\.ok\);/);
  assert.match(propose, /const recovering = !planStillLive;/);
  assert.match(propose, /if \(\s*\n?\s*!recovering &&/);
  assert.match(propose, /alternatives_count \+ \$\{recovering \? 0 : 1\}/);
  // The UI must agree with the server, or the button lies in one direction or the other.
  assert.match(
    drawer,
    /const capReached = entry\.alternativesRemaining === 0 && !entry\.suggestionUnavailable;/,
  );
  assert.match(drawer, /disabled=\{capReached\}/);
});

test("the coordination drawer survives being rendered on the server", () => {
  // /proposals?open=<id> is what every mutual notification and the "it's mutual"
  // email link to, and ClicksList opens that row on the first (server) render.
  // createPortal(_, document.body) threw there and the route silently fell back to
  // client rendering through its Suspense boundary.
  assert.match(drawer, /export function CoordinationDrawer\(props: CoordinationDrawerProps\) \{\s*\n\s*if \(typeof document === "undefined"\) return null;/);
  assert.match(drawer, /function CoordinationDrawerPanel\(/);
  // The guard has to precede every hook, or hook order differs between renders.
  const wrapper = drawer.slice(
    drawer.indexOf("export function CoordinationDrawer(props"),
    drawer.indexOf("function CoordinationDrawerPanel("),
  );
  assert.doesNotMatch(wrapper, /use[A-Z]/);
});

test("the attendee-list opt-out is reachable from settings", () => {
  // A column nobody can write is not a privacy control.
  assert.match(repo, /showOnAttendeeLists: boolean;/);
  assert.match(repo, /\| "showOnAttendeeLists"/);
  assert.match(repo, /showOnAttendeeLists: "default_attend_visibility",/);
  assert.match(repo, /showOnAttendeeLists: row\.default_attend_visibility,/);
  assert.match(settingsPage, /settingKey="showOnAttendeeLists"/);
  assert.match(settingsPage, /showOnAttendeeLists: true,/);
});
