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

test("a sender who cannot click is told why, instead of being told the receiver is unavailable", () => {
  // profiles.age is nullable and ensureProfileForSession never writes it, so every
  // account that signed in by magic link and skipped /onboarding carries age = NULL.
  // `?? 0` makes that fail the 18+ gate on EVERY send. Fused with the receiver's arm
  // it answered with the neutral receiver string, so the whole product read as "the
  // click button is broken" - and the one person who could act on it (the sender, who
  // just has to add a birth date) was told nothing. The receiver's arm must STAY
  // neutral: that one is receiver state and belongs in R_NOT_ELIGIBLE.
  const senderArm = /if \(\(sender\?\.age \?\? 0\) < MIN_CLICK_AGE\) \{\s*\n\s*const error = new Error\(/;
  assert.match(sendClickInner, senderArm, "the sender's own age must raise its own message");
  assert.match(
    sendClickInner,
    /if \(\(clickedProfile\.age \?\? 0\) < MIN_CLICK_AGE\) \{\s*\n\s*throw notEligibleError\(\);/,
    "the receiver's age must stay inside the neutral refusal",
  );
  // The two must not be reachable as one condition again.
  assert.doesNotMatch(
    sendClickInner,
    /\(sender\?\.age \?\? 0\) < MIN_CLICK_AGE \|\|/,
    "re-fusing the arms hides the sender's own fixable state behind the receiver's",
  );
});

// Everything inside expireClickLifecycles - the hourly sweep that ends things.
const lifecycleSweep = repo.slice(
  repo.indexOf("export async function expireClickLifecycles("),
  repo.indexOf("type WaitlistPromotion = {"),
);
assert.ok(lifecycleSweep.length > 2000, "failed to slice expireClickLifecycles");

test("a pair with a night in the diary is never wound down", () => {
  // The mutual's 7-day clock is a DISCOVERY timer - "nothing happened here yet".
  // confirmProposal extends it when a plan is agreed in the drawer, but a pair who
  // simply both RSVP'd to the same event never touch that path, so the sweep expired
  // them while their shared night was still weeks out: the "You're both going to X"
  // card vanished from /people and /proposals and both were notified that nothing
  // came of it. Must run BEFORE the wound-down snapshot, which selects status='active'.
  const extend = lifecycleSweep.indexOf("set expires_at = greatest(");
  const softRelease = lifecycleSweep.indexOf("const softReleased = await client.query");
  assert.ok(extend > 0, "the sweep must extend a mutual that has a shared upcoming event");
  assert.ok(extend < softRelease, "the extension has to land before the soft-release snapshot");
  // event_participants_v, not event_attendees: a claimed guest +1 holds a real seat
  // with no attendee row, and getMutualClicksForSession's celebration already counts
  // it - the two have to agree or the card says they are going while the sweep ends it.
  const extension = lifecycleSweep.slice(extend, softRelease);
  assert.match(extension, /from event_participants_v pv/);
  assert.doesNotMatch(extension.slice(0, extension.indexOf("const connected")), /event_attendees/);
  // greatest(), so a mutual already running long is never shortened by the sweep.
  assert.match(extension, /greatest\(\s*\n\s*m\.expires_at,/);
});

test("a pair who went out together end as connected, not expired", () => {
  // mutual_status has carried 'connected' (+ connected_reason / connected_event_id)
  // since migration 049 and nothing ever wrote it, so a pair whose shared night had
  // already happened landed on 'expired' and were told "nothing came of it before the
  // clock ran out" - about an event they had both been at.
  assert.match(lifecycleSweep, /set status = 'connected',/);
  assert.match(lifecycleSweep, /connected_reason = 'co_attended',/);
  assert.match(lifecycleSweep, /connected_event_id = due\.event_id,/);
  // Ahead of the wound-down snapshot, which is what keeps them out of it.
  assert.ok(
    lifecycleSweep.indexOf("const connected = await client.query") <
      lifecycleSweep.indexOf("const softReleased = await client.query"),
    "the connected transition must run before the soft-release snapshot",
  );
  // Its notification points at /proposals, so the card has to survive to be opened.
  const proposals = repo.slice(
    repo.indexOf("export async function getProposalsForSession("),
    repo.indexOf("// §4 (COORDINATION_MODAL_SYSTEM): the mutual reveal fires exactly ONCE"),
  );
  assert.match(proposals, /m\.status in \('released', 'connected'\)/);
});

test("the system never suggests an event that starts in the next two days", () => {
  // A bare starts_at > now() handed a pair who had just clicked a plan for an event
  // starting in forty minutes - two seats to agree on, book and travel to before the
  // doors shut. The floor binds only what the system offers unprompted; the catalogue
  // picker still lets either of them propose tonight's thing by hand.
  assert.match(constants, /export const SUGGESTION_LEADTIME_FLOOR_HOURS = 48;/);
  assert.match(
    sendClickInner,
    /event\.starts_at > now\(\) \+ interval '\$\{SUGGESTION_LEADTIME_FLOOR_HOURS\} hours'/,
  );
});

const teardown = read("src/lib/clicks/teardown.ts");
const suggestedPeople = repo.slice(
  repo.indexOf("export async function getSuggestedPeople("),
  repo.indexOf("export type MutualClickEntry = {"),
);
assert.ok(suggestedPeople.length > 2000, "failed to slice getSuggestedPeople");

test("the three mutual terminals are not rotated", () => {
  // B2's enum comments and B7.9 pin one meaning each, and for a while the code had
  // them one place out: block wrote 'suppressed', "not feeling it" wrote 'released',
  // and the 7-day lapse wrote 'expired'. Nothing read the difference, so it stayed
  // invisible - right up until a rediscovery cooldown and a past-clicks shelf started
  // deciding, off the status, whether a pair may ever meet again. Rotated, the 7-day
  // fizzle landed on the one permanent door.
  //   released   = 7-day silence, soft, 30d cooldown, re-clickable  (B7.6 / B7.9)
  //   suppressed = "not feeling it", deliberate soft-no, 90d        (B7.1 / B7.5)
  //   expired    = block / account deletion, NEVER resurfaces       (B7.9)
  assert.match(lifecycleSweep, /set status = 'released', coord_state = 'dormant'/);
  const release = repo.slice(
    repo.indexOf("export async function releaseMutualForSession("),
    repo.indexOf("export async function suggestPlanForMutual("),
  );
  assert.ok(release.length > 800, "failed to slice releaseMutualForSession");
  assert.match(release, /set status = 'suppressed', coord_state = 'dormant'/);
  assert.match(release, /'not_feeling_it', now\(\) \+ interval '\$\{PAIR_SUPPRESSION_DAYS\} days'/);
  // Both severs - one pair (block) and every pair (ban) - take the permanent door.
  assert.equal(
    teardown.split("set status = 'expired', coord_state = 'dormant'").length - 1,
    2,
    "block and ban must both end a mutual on 'expired'",
  );
  assert.doesNotMatch(teardown, /status = 'suppressed'/);
});

test("a soft release is never framed as a loss", () => {
  // B7.6 bans "winding down" and "about to expire" by name, and the old sweep copy
  // was the banned phrase verbatim plus a verdict ("nothing came of it") delivered
  // to a pair who were never told a clock was running. Asserted on the notification
  // COPY alone - the function is entitled to say `expires_at` and 'expired' all it
  // likes, those are a column and a status, not something a person reads.
  const block = lifecycleSweep.slice(
    lifecycleSweep.indexOf("if (softReleased.rowCount) {"),
    lifecycleSweep.indexOf("const suppressions = await client.query"),
  );
  assert.ok(block.length > 200, "failed to slice the soft-release notification");
  const copy = block
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  assert.doesNotMatch(copy, /wound down|winding down|ran out|expir|missed|nothing came of/i);
  assert.match(copy, /still out there/i);
});

test("a released pair is not offered back to each other the next day", () => {
  // B7.9: 30 days of distance, then they are simply a candidate again. Only
  // 'released' is on this clock - 'suppressed' is held 90d by pair_suppressions,
  // and 'expired' never resurfaces at all.
  assert.match(constants, /export const REDISCOVERY_COOLDOWN_DAYS = 30;/);
  assert.match(suggestedPeople, /rc\.status = 'released'/);
  assert.match(
    suggestedPeople,
    /rc\.ended_at > now\(\) - interval '\$\{REDISCOVERY_COOLDOWN_DAYS\} days'/,
  );
});

test("an overloaded person is down-ranked in discovery, never removed", () => {
  // B7.2 counts ACTIONABLE mutuals - active + open/proposed. dormant is resting and
  // auto-revived; confirmed_together is already handled; the rest are history.
  assert.match(constants, /export const ACTIVE_MUTUAL_SOFT_CAP = 8;/);
  assert.match(suggestedPeople, /am\.coord_state in \('open', 'proposed'\)/);
  assert.doesNotMatch(suggestedPeople, /am\.coord_state in \([^)]*dormant/);
  // Down-rank, not remove: it orders, it never appears in a WHERE / NOT EXISTS.
  assert.match(suggestedPeople, /\) asc,\n\s*array_length\(/);
  // And it has to survive the v2 re-rank, which re-sorts the whole list by pair
  // score and would otherwise throw the SQL ordering away whenever the flag is on.
  assert.match(suggestedPeople, /rows = \[\.\.\.rows\.filter\(\(r\) => !downRanked\(r\)\), \.\.\.rows\.filter\(downRanked\)\];/);
  assert.ok(
    suggestedPeople.indexOf("downRanked") > suggestedPeople.indexOf("matchingV2Enabled"),
    "the down-rank partition must run after the v2 re-rank, not before it",
  );
});

test("only the recipient can pass on a plan", () => {
  // The drawer has always rendered "Not this one" only on a plan the viewer did not
  // propose; the server did not check, and a server action is as callable as a route.
  // Decline returns the mutual to `open` with a fresh alternatives budget - the escape
  // hatch the cap copy promises the RECIPIENT - so in the proposer's hands it was an
  // unbounded suggest/decline/suggest ping into the other person's tray.
  const decline = repo.slice(
    repo.indexOf("export async function declineProposalForSession("),
    repo.indexOf("// Soft-release a mutual without notifying"),
  );
  assert.ok(decline.length > 500, "failed to slice declineProposalForSession");
  assert.match(decline, /if \(row\.proposed_by && row\.proposed_by === profile\.id\)/);
  // NULL proposed_by is a system suggestion - nobody's plan to withdraw, so it stays
  // passable by both. The && is what keeps that true.
  assert.match(repo, /p\.proposed_by::text/);
  assert.match(
    drawer,
    /step === "proposed" && !entry\.proposedByMe \? \(\s*\n\s*<form action=\{declineAction\}>/,
  );
});

test("the two send processes never cross-match on the discovery surfaces", () => {
  // Rule 3: a discovery click and a post-event click between the same pair do not
  // form a mutual together. So a pending post-event click is not a discovery click
  // "waiting on them" - counting it dropped the person out of the daily set and
  // greyed out the profile button for the whole 48h window, which is exactly the
  // send that could have paired with their discovery click.
  const viewerState = repo.slice(
    repo.indexOf("export async function getViewerClickState("),
    repo.indexOf("export async function getSafetyState("),
  );
  assert.match(viewerState, /and c\.event_id is null\s*\n\s*\) as clicked,/);
  assert.match(suggestedPeople, /and uc\.event_id is null/);
});

const postEventCard = read("src/components/post-event-click-card.tsx");
const emailLib = read("src/lib/email.ts");

test("a post-event swap is atomic, once per event, and silent", () => {
  // §6.9(2). The release runs INSIDE the send transaction, before the cap check -
  // the cap count already excludes 'invalidated', so a release frees exactly one slot
  // with no special-casing, and nothing can spend the one swap on a click that then
  // fails to land. Done as release-then-send across two transactions, a failure in
  // between burns the swap and loses the click.
  const release = sendClickInner.indexOf("input.releaseReceiverId");
  const cap = sendClickInner.indexOf("// Cap check inside the transaction");
  const record = sendClickInner.indexOf("insert into click_swaps");
  const insert = sendClickInner.indexOf("insert into clicks (sender_id");
  assert.ok(release > 0 && cap > 0 && insert > 0 && record > 0, "swap wiring is missing");
  assert.ok(release < cap, "the release has to free its slot before the cap is counted");
  assert.ok(insert < record, "the swap is only recorded once the replacement click exists");
  // (a) only a PENDING click is releasable - a mutual never is.
  assert.match(sendClickInner, /and event_id = \$3::uuid and status = 'pending'\s*\n\s*returning id::text/);
  // (b) one per sender per event, checked up front for a readable refusal and
  //     backed by click_swaps' primary key.
  assert.match(sendClickInner, /select 1 from click_swaps where sender_id = \$1::uuid and event_id = \$2::uuid/);
  // (c) the released receiver is never notified: no notification insert anywhere
  //     in the swap path.
  const swapBlock = sendClickInner.slice(release, sendClickInner.indexOf("if (!isDuplicate) {"));
  assert.doesNotMatch(swapBlock, /insert into notifications/);
  // Discovery has a rolling cap, not an event budget - there is nothing to swap.
  assert.match(sendClickInner, /Swapping only applies to clicks from an event/);
});

test("the post-event surface has a spent state instead of vanishing", () => {
  // §6.9.1: at zero budget the surface opens in a spent state, not a picker. It
  // returned null the moment everyone was clicked, so the card simply stopped
  // existing - no account of where the three went, no sign the swap was on offer.
  assert.doesNotMatch(postEventCard, /if \(clickable\.length === 0\) return null;/);
  assert.match(postEventCard, /const spent = remaining === 0;/);
  assert.match(postEventCard, /You used your \{POST_EVENT_CLICK_CAP\} clicks for this event already/);
  // The swap is offered only when there is a pending click to give up, someone to
  // spend it on, and the one swap is unspent.
  assert.match(
    postEventCard,
    /const canSwap = spent && !prompt\.swapUsed && swappable\.length > 0 && clickable\.length > 0;/,
  );
});

test("repeated free-event no-shows cost the post-event surface, and only on a door list", () => {
  // B7.3. The door-list guard is the load-bearing part: checked_in_at is only written
  // when the merchant runs the optional list, so on an event nobody was checked into,
  // an attendee and a no-show are indistinguishable and we must not invent one.
  assert.match(constants, /export const NO_SHOW_SUPPRESSION_THRESHOLD = 2;/);
  assert.match(lifecycleSweep, /set post_event_click_suppressed_until = now\(\) \+ interval/);
  assert.match(lifecycleSweep, /and e\.price_cents = 0/, "paid no-shows are excluded - payment was the commitment");
  assert.match(lifecycleSweep, /where door\.event_id = e\.id and door\.checked_in_at is not null/);
  // Never rolls a standing suppression forward hour after hour off the same two rows.
  assert.match(lifecycleSweep, /or p\.post_event_click_suppressed_until <= now\(\)\)/);
  // Read on all three surfaces, not just the send - a picker that cannot pick is worse
  // than no picker.
  assert.match(sendClickInner, /sender\?\.post_event_click_suppressed_until &&/);
  assert.equal(
    repo.split("me.post_event_click_suppressed_until > now()").length - 1,
    2,
    "both pull rosters must hide themselves from a suppressed viewer",
  );
  assert.match(repo, /me\.post_event_click_suppressed_until <= now\(\)\)/);
});

test("the liveness column the inactivity rules read is actually written", () => {
  // B7.4b's whole model rests on profiles.last_active_at, and nothing wrote it - the
  // column defaults to now() from migration 049, so every profile was frozen at
  // whenever that ran. Gating discovery on it first would have hidden the entire pool
  // in one go, thirty days later.
  // The uncached implementation sits AFTER its cache() wrapper in the file.
  const ensureStart = repo.indexOf("async function ensureProfileForSessionUncached(");
  const ensure = repo.slice(ensureStart, ensureStart + 4000);
  assert.ok(ensure.length > 1000, "failed to slice ensureProfileForSessionUncached");
  assert.match(ensure, /last_active_at = now\(\),/);
  assert.match(constants, /export const INACTIVE_DOWNRANK_DAYS = 30;/);
  // Quiet 30 days = down-rank (an ORDER BY key). Ignored the nudge for 14 = hidden
  // (a WHERE). The two must not be confused - events are episodic.
  assert.match(suggestedPeople, /< now\(\) - interval '\$\{INACTIVE_DOWNRANK_DAYS\} days'\) asc,/);
  assert.match(suggestedPeople, /p\.reengagement_clicked_at <= now\(\) - interval '\$\{REENGAGEMENT_GRACE_DAYS\} days'/);
  // Un-hides itself when they come back; nothing has to remember to clear it.
  assert.match(suggestedPeople, /coalesce\(p\.last_active_at, p\.created_at\) < p\.reengagement_clicked_at/);
});

test("the re-engagement email never names who clicked", () => {
  // B7.4b: "someone clicked with you," never who. §6.1 anonymity holds until mutual,
  // so a leak here would be a way to reveal yourself to a dormant account on demand.
  assert.match(emailLib, /\| "reengagement-click-attendee"/);
  assert.match(emailLib, /"reengagement-click-attendee": \(\) => "Someone clicked with you on Click"/);
  const template = read("emails/reengagement-click-attendee.html");
  // The only variables the template may carry. No sender name, no event, no initial.
  const vars = new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
  assert.deepEqual(
    [...vars].sort(),
    ["firstName", "peopleUrl", "supportEmail", "unsubscribeUrl"],
    "the template must carry no variable that could identify the sender",
  );
  // Claimed with one conditional UPDATE, so concurrent clicks at the same dormant
  // person cannot both send, and it re-arms only when they actually return.
  assert.match(sendClickInner, /set reengagement_clicked_at = now\(\)/);
  assert.match(
    sendClickInner,
    /or reengagement_clicked_at < coalesce\(last_active_at, created_at\)\)/,
  );
  // Skipped on a mutual (that pair gets the better mail), and off the response path
  // so only-one-outcome-pays never becomes a timing oracle.
  assert.match(sendClickInner, /if \(!freshMutualId\) \{\s*\n\s*const receiverId = clickedProfile\.id;/);
  const reengage = sendClickInner.slice(sendClickInner.indexOf("if (!freshMutualId) {"));
  assert.ok(
    reengage.indexOf("afterResponse(") < reengage.indexOf("reengagement_clicked_at = now()"),
    "the claim + send must run inside afterResponse, never in the response path",
  );
});
