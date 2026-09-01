import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The post-mutual coordination flow (START_HERE_CLICK.md / 21_CLICK_MECHANIC Part B
// / CLICK_COORDINATION_SCREENS v2.1). Same reason as click-mechanic.test.mjs for
// being source assertions: the only database this repo can reach is production.
//
// Every test here pins a defect the spec calls launch-blocking. They are all of the
// same shape - a rule that lives in the WIRING (which call sites run a helper, which
// field a projection reads) rather than in a return value, which is exactly why they
// were all silently absent while every existing test passed.

const root = process.cwd();
const read = (p) => readFileSync(path.join(root, p), "utf8");

const repo = read("src/lib/event-repository.ts");
const teardown = read("src/lib/clicks/teardown.ts");
const drawer = read("src/components/coordination-drawer.tsx");
const list = read("src/components/clicks-list.tsx");
const actions = read("src/app/proposals/actions.ts");

const sliceFn = (src, start, end) => {
  const a = src.indexOf(start);
  assert.ok(a > -1, `failed to find ${start}`);
  const b = src.indexOf(end, a);
  assert.ok(b > a, `failed to find ${end} after ${start}`);
  return src.slice(a, b);
};

// ── §B5.3 - the win condition fires on ANY both-booked path ──────────────────────

test("every booking-confirm path runs the both-booked detection", () => {
  // C10: this fired only inside the proposal-accept handler, and even there on the
  // accept TAP - before either side held a seat. Two people who each booked the same
  // night independently stayed at coord_state='open' forever, which is the product's
  // win condition silently never landing. §B5.3: "on ANY booking confirm".
  assert.match(repo, /async function detectConfirmedTogether\(/);

  // The free reserve path, the paid webhook path, waitlist promotion, and a claimed
  // guest +1 - §B5.3 counts "a confirmed booking (or claimed guest spot)".
  const calls = repo.match(/detectConfirmedTogether\(pool,/g) ?? [];
  assert.ok(
    calls.length >= 4,
    `expected the detection on all four confirm paths, found ${calls.length}`,
  );

  const detect = sliceFn(
    repo,
    "async function detectConfirmedTogether(",
    "async function notifyProposalPartnerOfRsvp(",
  );
  // Idempotent, or every re-run re-congratulates the pair.
  assert.match(detect, /coord_state <> 'confirmed_together'/);
  // Both sides read the canonical roster, so a claimed guest +1 counts as a seat.
  assert.ok(
    (detect.match(/event_participants_v/g) ?? []).length >= 2,
    "both seat checks must read event_participants_v, not event_attendees",
  );
  // "mutual renewed (clock extended past the event)".
  assert.match(detect, /expires_at = greatest\(/);
  // Never celebrate across a block, never wake a banned/suspended account.
  assert.match(detect, /user_blocks/);
  assert.match(detect, /is_banned or pf\.suspended_at is not null/);
});

// ── §B5.6 - partner cancels during confirmed_together ────────────────────────────

test("every seat-removing path runs the partner-cancel teardown", () => {
  // S18 existed in NO form: not one cancel path touched mutual_clicks, so the
  // survivor kept a "you're both going" plan pointing at somebody who had cancelled.
  assert.match(teardown, /export async function severConfirmedTogetherForCancel\(/);

  const calls = repo.match(/severConfirmedTogetherForCancel\(/g) ?? [];
  assert.ok(
    calls.length >= 3,
    `expected the teardown on cancelRegistration, the guest-seat release and the ` +
      `refund settle path, found ${calls.length}`,
  );

  const sever = sliceFn(
    teardown,
    "export async function severConfirmedTogetherForCancel(",
    "\n}\n",
  );
  // Step 1: re-point before tearing down - a pair with another shared future event
  // keeps confirmed_together and is told nothing.
  assert.match(sever, /and not exists \(\s*select 1\s*from events e2/);
  // Step 2: the mutual is UNTOUCHED. status must never be written here.
  // The mutual_clicks UPDATE must set coord_state (and timestamps) only. Writing
  // status here would end a mutual that §B5.6 says survives.
  const mutualUpdate = /update mutual_clicks m\s*\n\s*set ([^\n]*(?:\n(?!\s*from)[^\n]*)*)/.exec(sever);
  assert.ok(mutualUpdate, "expected an update on mutual_clicks");
  assert.match(mutualUpdate[1], /coord_state = 'open'/);
  assert.doesNotMatch(
    mutualUpdate[1],
    /\bstatus\s*=/,
    "§B5.6 leaves status='active' - a cancelled attempt is a failed attempt, not an ending",
  );
  // Step 3: the plan retires to the terminal the drawer reads for S18.
  assert.match(sever, /status = 'partner_cancelled'/);
  // Step 4 (§6.2): pending clicks only - an already-formed mutual is never unmade.
  assert.match(sever, /update clicks set status = 'invalidated'[\s\S]*?status = 'pending'/);
});

test("the survivor gets the locked string and the canceller gets nothing", () => {
  const notify = sliceFn(
    repo,
    "async function notifyPartnerCancelled(",
    "async function notifyProposalPartnerOfRsvp(",
  );
  // Cindy-signed, verbatim, and it never says why.
  assert.match(notify, /'s plans changed - they won't make \$\{s\.eventTitle\} this time\./);
  assert.match(notify, /Your spot's still yours\. Want to line up something else together\?/);
  assert.match(notify, /'Plans changed'/);
  // One notification, not one per render: deduped on the action_url.
  assert.match(notify, /where not exists \(/);

  // Step 7: the canceller is never prompted to re-plan. That falls out of retiring
  // the proposal, so assert the drawer's S18 step is keyed on the SURVIVOR's flag
  // and that both locked action labels are present.
  assert.match(drawer, /Find another together/);
  assert.match(drawer, /Keep my spot - all good/);
});

test("the survivor is never left on the both-going peak", () => {
  // The ghost plan §B0 exists to prevent: viewerHasSeat true / otherHasSeat false
  // rendered "You're in ✨ ... you'll be going together the moment they do" at a
  // partner who had already cancelled.
  assert.match(drawer, /if \(entry\.partnerCancelled\) return "partner-cancelled";/);
  // Read BEFORE the clock, because §B5.6 deliberately leaves the mutual active.
  const project = sliceFn(drawer, "function projectStep(", "\n}\n");
  assert.ok(
    project.indexOf("entry.partnerCancelled") < project.indexOf("entry.isExpired"),
    "S18 must be read before isExpired or the survivor falls through to the shelf",
  );
  // And the list row must stop claiming a live plan too.
  assert.match(list, /partnerCancelled/);
});

// ── Part 7 - the drawer binds to BOTH axes ───────────────────────────────────────

test("the drawer reads mutual status before coord_state", () => {
  // "Do not collapse them into one enum - that is the exact bug this table exists
  // to prevent." It had been collapsed onto the click_proposals row.
  const project = sliceFn(drawer, "function projectStep(", "\n}\n");
  assert.match(project, /entry\.mutualStatus === "connected"/);
  assert.match(project, /entry\.mutualStatus !== "active"/);
  assert.ok(
    project.indexOf("mutualStatus") < project.indexOf("coordState"),
    "AXIS 1 (status) must be read before AXIS 2 (coord_state)",
  );
  // The win state comes off coord_state, not only off an accepted proposal.
  assert.match(project, /entry\.coordState === "confirmed_together"/);
  assert.match(repo, /m\.status as mutual_status/);
});

test("connected and released are two different terminals", () => {
  // Both used to render the release copy, telling a pair who had demonstrably gone
  // out together that it "didn't turn into a night out".
  assert.match(drawer, /Love that\./);
  assert.match(drawer, /That&apos;s what Click&apos;s for\. This one rests in your past clicks/);
  assert.match(drawer, /Still out there/);
  // The rendered form specifically: JSX escapes the apostrophe, so this targets
  // the copy without failing on the comments that explain why it was removed.
  assert.doesNotMatch(
    drawer,
    /didn&apos;t turn into a night out/,
    "the release verdict copy is banned - CLICK_LANGUAGE §5a",
  );
});

test("the closure ritual has a writer", () => {
  // §B7.1 names three controls on every mutual; "We clicked 👍" had no
  // implementation anywhere, so status='connected' had no user-facing writer.
  assert.match(repo, /export async function markMutualConnectedForSession\(/);
  assert.match(repo, /connected_reason = coalesce\(connected_reason, 'we_clicked'\)/);
  assert.match(drawer, /We clicked 👍/);
});

// ── S3 - the reveal fires exactly once ───────────────────────────────────────────

test("every way out of the reveal persists reveal_seen", () => {
  // The #1 behaviour bug class. markMutualSeen was wired ONLY to the primary CTA,
  // so ✕ / scrim / Escape left it firing again on every entry point, forever.
  assert.match(drawer, /const closeStep = useCallback\(\(\) => \{\s*if \(step === "reveal"\) dismissReveal\(\);/);
  // All three exits must funnel through it.
  assert.ok(
    (drawer.match(/onClick=\{closeStep\}/g) ?? []).length >= 2,
    "the ✕ and the scrim must both use the reveal-persisting close",
  );
  assert.match(drawer, /closeStepRef\.current\(\);/, "Escape must use it too");
});

test("the reveal uses its locked strings", () => {
  assert.match(drawer, /Suggest a plan/);
  assert.doesNotMatch(
    drawer,
    /Suggest something to do/,
    "CLICK_LANGUAGE §5 locks the reveal CTA to 'Suggest a plan'",
  );
  assert.match(drawer, /Find a thing you&apos;d both enjoy, and just show up\./);
  assert.match(drawer, /Maybe later/);
});

test("a mixed-intent pair is never rounded into one frame", () => {
  // CLICK_LANGUAGE §5 is binding here: a friends-intent user must never be rendered
  // as romantic. The old helper returned the same bland line for every mixed pair.
  const fn = sliceFn(repo, "function intentLine(", "\n}\n");
  assert.match(fn, /You're both here for/);
  assert.match(fn, /You're here for \$\{mine\} - they're open to \$\{theirs\}/);
});

test("the dating pill reads the live opt-in, not one slot of a snapshot", () => {
  // intent_a/intent_b hold ONE value each, so '{friendship,dating}' never qualified
  // and the pill silently never rendered for those users.
  assert.match(repo, /\(me\.dating_visible and other\.dating_visible\) as both_dating/);
});

// ── Calm recovery + banned language ──────────────────────────────────────────────

test("a lost seat race is never an error state", () => {
  // §B5.5 / CLICK_LANGUAGE §5: "NOT an error state - never red/coral."
  assert.match(drawer, /That one just filled up\./);
  assert.match(drawer, /No drama - there&apos;s always another\. Find one you&apos;ll both like\./);
  // The danger alert must stand down once the plan is unavailable.
  assert.match(drawer, /confirmError && !entry\.suggestionUnavailable/);
  // ...and the drawer only re-projects into that copy if a failed confirm
  // revalidates. Without this the entry stays stale and the throw is all you see.
  const confirmAction = sliceFn(
    actions,
    "export async function confirmProposalAction(",
    "\n}\n",
  );
  assert.ok(
    (confirmAction.match(/revalidatePath\("\/proposals"\)/g) ?? []).length >= 2,
    "a failed confirm must revalidate too, or the S14 recovery never renders",
  );
});

test("a lapsed plan is not reported as a failure", () => {
  // S15: nobody is told they were ignored, and no timer was ever displayed, so
  // nothing "ran out". COORDINATION_MODAL_SYSTEM §8 bans exposing the window.
  assert.doesNotMatch(repo, /locked it in before the window closed/);
  assert.match(repo, /'Still keen to meet ' \|\| them\.display_name/);
});

test("the mechanic never calls a click a connection", () => {
  // CLICK_LANGUAGE §3 bans connect/connection for the mechanic.
  assert.doesNotMatch(drawer, /End this connection/);
  assert.doesNotMatch(actions, /find that connection/);
});

test("a one-way click is never framed as a pending rejection", () => {
  // §5b: "if they click you back" plants the could-be-no on the click surfaces.
  for (const [name, src] of [
    ["clicks-list", list],
    ["post-event-click-card", read("src/components/post-event-click-card.tsx")],
    ["profile-click-button", read("src/components/profile-click-button.tsx")],
    ["people/actions", read("src/app/people/actions.ts")],
    ["dashboard/actions", read("src/app/dashboard/actions.ts")],
  ]) {
    assert.doesNotMatch(src, /click you back/, `${name} still plants the could-be-no`);
  }
});

// ── §B5.3 - the durable half of the moment ───────────────────────────────────────

test("the going-with badge exists and tears down with the seat", () => {
  // "The drawer moment fires once; the badge lives until the event passes."
  assert.match(repo, /export async function getGoingWithNames\(/);
  assert.match(read("src/components/event-card.tsx"), /Going with \{goingWith\}/);
  // Reading live seats is what makes the §B5.6 teardown automatic: a cancelled
  // partner stops being a participant, so there is no marker to forget to remove.
  const fn = sliceFn(repo, "export async function getGoingWithNames(", "\n}\n");
  assert.match(fn, /event_participants_v/);
  assert.match(fn, /user_blocks/);
});
