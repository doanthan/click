import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
    // profile-click-button.tsx used to sit here. It is deleted, not renamed: a
    // profile is read-only (runbook Part A invariant 1). The two-surface test
    // below is what keeps it deleted.
    ["click-with-someone-user-card", read("src/components/click-with-someone-user-card.tsx")],
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

// ── C6 ship gate - the click button lives on exactly two surfaces ────────────────

// A whole-tree walk rather than a fixed file list: the rule this pins is about
// where a control may APPEAR, and a hardcoded list only ever proves things about
// the files someone remembered to add to it.
const sourceFiles = [];
{
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      // src/app/md is generated audit data - prose about the code, not the code.
      if (entry.isDirectory()) {
        if (full.endsWith(path.join("src", "app", "md"))) continue;
        walk(full);
      } else if (/\.(tsx?|mjs)$/.test(entry.name)) {
        sourceFiles.push(full);
      }
    }
  };
  walk(path.join(root, "src"));
  assert.ok(sourceFiles.length > 200, `expected the whole of src/, found ${sourceFiles.length}`);
}
const rel = (full) => path.relative(root, full).split(path.sep).join("/");

test("the click send lives on the two click surfaces and nowhere else", () => {
  // Part A invariant 1, and the C6 checkbox that gates the ship: "No click button
  // lives on a profile, ever, nor on an event's attendee list - a profile you open
  // is read-only." It shipped on /profile/[userId] anyway, behind a component whose
  // own docblock argued the case for it, and no test noticed - the C4 grep for it
  // ran nowhere. This is that grep, written as the assertion it should always have
  // been: the two server actions that SEND a click may be imported by exactly the
  // discovery card and the post-event card.
  //
  // Asserted on the import, not on the copy. "click with" is a phrase the product
  // says in prose all over the place (and must keep saying); what makes a surface
  // a click surface is that it can post the send.
  const senders = sourceFiles.filter((file) =>
    /import[^;]*\b(clickPersonAction|clickCoAttendeeAction)\b[^;]*from/.test(
      readFileSync(file, "utf8"),
    ),
  );
  assert.deepEqual(
    senders.map(rel).sort(),
    [
      "src/components/click-with-someone-user-card.tsx",
      "src/components/post-event-click-card.tsx",
    ],
    "a third surface can send a click - the two-surface rule is the ship gate",
  );

  // The deleted component, by name: it is the one that came back before, and a
  // re-add would otherwise only trip the list above once it was also mounted.
  assert.ok(
    !existsSync(path.join(root, "src/components/profile-click-button.tsx")),
    "profile-click-button.tsx is deleted on purpose - a profile is read-only",
  );

  // And the surface it lived on. A profile may LINK to a mutual you already have
  // (that is not a send), but it may not hold a submit that creates one.
  for (const file of sourceFiles.filter((f) => rel(f).startsWith("src/app/profile/"))) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(
      src,
      /clickPersonAction|clickCoAttendeeAction|ProfileClickButton/,
      `${rel(file)} puts a click send on a profile`,
    );
  }
});

// ── C4.19 - the notification ledger ─────────────────────────────────────────────

// The four paths C4.19 names, sliced from their own function bodies. Each is a
// place the product deliberately does nothing visible to the other person, which
// is exactly the kind of guarantee that regresses the first time somebody adds a
// well-meant "let them know" line.
const silentPaths = [
  ["a decline", sliceFn(repo, "export async function declineProposalForSession(", "// The soft release - B1's")],
  ["a release", sliceFn(repo, "export async function softReleaseMutualForSession(", "// \"Not feeling it\" (B7.1)")],
  ["a removal", sliceFn(repo, "export async function releaseMutualForSession(", "export async function suggestPlanForMutual(")],
  ["a window close", sliceFn(repo, "export async function expireClickLifecycles(", "type WaitlistPromotion = {")],
];

test("a decline, a release, a removal and a window close all enqueue nothing", () => {
  // C4.19 verbatim: "after a decline, a release, a removal and a window close,
  // assert ZERO notifications enqueued." B4 puts all four on the never-emitted
  // list "at any layer", which is why the email side is asserted too - moving a
  // wind-down notice from the bell to the inbox is not compliance.
  for (const [name, body] of silentPaths) {
    assert.ok(body.length > 400, `failed to slice ${name}`);
    assert.doesNotMatch(body, /insert into notifications/, `${name} taps the other person on the shoulder`);
    assert.doesNotMatch(body, /logEmailEvent\(/, `${name} reaches the inbox instead`);
    assert.doesNotMatch(body, /sendTransactionalEmail\(/, `${name} reaches the inbox instead`);
  }
});

test("a one-way click produces no notification and no trace the receiver can read", () => {
  // C4.2. The two notification inserts in the send path are BOTH inside the
  // freshly-formed-mutual arm; a click that lands on nobody's reciprocal row must
  // leave the receiver's world byte-identical to a click that was never sent.
  const send = sliceFn(
    repo,
    "async function sendClickInner(",
    "export async function createUserClickForSession(",
  );
  const mutualArm = send.slice(send.indexOf("if (reciprocalClick) {"));
  const inserts = (send.match(/insert into notifications/g) ?? []).length;
  assert.equal(inserts, 2, "the send path notifies exactly the two sides of a mutual");
  assert.equal(
    (mutualArm.match(/insert into notifications/g) ?? []).length,
    2,
    "every notification in the send path must sit inside the reciprocal-click arm",
  );
  assert.match(mutualArm, /if \(mutualClickId\) \{/, "and inside the mutual that just formed");

  // ...and it appears in zero API responses for the recipient. Every read of the
  // clicks table on a viewer's behalf is scoped to what THEY sent: a projection
  // keyed on receiver_id = the viewer is the shape that leaks "someone clicked
  // you", which is the one fact the whole mechanic exists to withhold.
  const viewerState = sliceFn(
    repo,
    "export async function getViewerClickState(",
    "export async function getSafetyState(",
  );
  assert.match(viewerState, /c\.sender_id = \$1::uuid and c\.receiver_id = \$2::uuid/);
  assert.doesNotMatch(
    viewerState,
    /c\.receiver_id = \$1::uuid/,
    "the viewer's own id must never sit on the receiver side of a click read",
  );
  // The send's own response says only that it landed - §6.1's byte-identical reply.
  const returned = send.slice(send.lastIndexOf("return {"), send.lastIndexOf("};") + 2);
  assert.match(returned, /outcome: "ok" as SendClickOutcome/);
  assert.doesNotMatch(
    returned,
    /mutual/i,
    "the synchronous send response must not tell the caller a mutual formed",
  );
});

test("passing on a plan returns it to open and tells nobody", () => {
  // C4.5. "Not this one" is the recipient's no and the drawer returns to suggest;
  // §B6 is explicit that no rejection is rendered anywhere, on either side, so the
  // decline both reopens the mutual and stays silent.
  const decline = silentPaths[0][1];
  assert.match(decline, /update click_proposals set status = 'declined'/);
  assert.match(decline, /update mutual_clicks set coord_state = 'open', updated_at = now\(\)/);
  // Only the recipient may decline - a proposer withdrawing their own plan and
  // re-proposing was an unbounded ping into the other person's tray.
  assert.match(decline, /if \(row\.proposed_by && row\.proposed_by === profile\.id\)/);
  // The drawer agrees: "Not this one" renders only on a plan the viewer did not
  // propose, so the two sides cannot disagree about whose move it is.
  assert.match(drawer, /\{step === "proposed" && !entry\.proposedByMe \? \(\s*\n\s*<form action=\{declineAction\}>/);
});

// ── C4.18 - what a coordination response may carry ──────────────────────────────

test("a coordination response carries no clock, no ranking and nobody else's state", () => {
  // C4.18 snapshots every coordination response and asserts the absence of
  // closes_at, one-way click data, suggestion scores, the other user's seen_at,
  // and venue for an unbooked event. Source-shaped here for the reason the header
  // gives, and asserted on the TYPE plus its projection, which together are the
  // response: a field that is not on the type cannot be on the wire.
  const entryType = sliceFn(repo, "export type ProposalEntry = {", "\n};");
  const promptType = sliceFn(repo, "export type PostEventClickPrompt = {", "\n};");
  const coAttendeeType = sliceFn(repo, "export type PostEventCoAttendee = {", "\n};");
  const proposals = sliceFn(
    repo,
    "export async function getProposalsForSession(",
    "export async function getMutualRevealState(",
  );

  // The FIELDS, not the prose around them. Every one of these types explains in a
  // docblock why the banned field is banned ("a boolean, never the remaining
  // count"), and a naive grep reads its own rationale as the violation.
  const fieldsOf = (shape) =>
    shape
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return t && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");

  for (const [name, shape] of [
    ["ProposalEntry", fieldsOf(entryType)],
    ["PostEventClickPrompt", fieldsOf(promptType)],
    ["PostEventCoAttendee", fieldsOf(coAttendeeType)],
  ]) {
    // No countdown, in any of its spellings (invariant 9 / C4.14).
    assert.doesNotMatch(shape, /closesAt|closes_at|remaining|secondsLeft|timeLeft|windowEndsAt/i, `${name} carries a clock`);
    // No ranking. The post-event roster IS ordered by commonality, and that rank
    // is a SQL expression that never becomes a column - see POST_EVENT_ROSTER_RANK.
    assert.doesNotMatch(shape, /\bscore\b|\brank\b|\bweight\b|\baffinity\b/i, `${name} carries a ranking`);
    // No venue. A coordination payload names WHICH event, never where it is - the
    // address is the event API's to release, and only to somebody holding a seat
    // (tests/release-config.test.mjs pins viewerCanSeeVenue on that route).
    assert.doesNotMatch(shape, /venue|address|\blat\b|\blng\b|latitude|longitude/i, `${name} carries a venue`);
    // No one-way click data about the other person. `alreadyClicked` on a
    // co-attendee is the VIEWER's own outgoing click, which is theirs to know.
    assert.doesNotMatch(shape, /clickedYou|theyClicked|incoming|pendingFromThem/i, `${name} leaks a one-way click`);
  }

  // The reveal flag is sided in SQL, so the other user's seen_at never leaves the
  // database at all - not even as a field the client is trusted to ignore.
  assert.match(
    proposals,
    /case when m\.user_a_id = \$1::uuid then m\.seen_at_a is not null else m\.seen_at_b is not null end as reveal_seen/,
  );
  assert.doesNotMatch(
    proposals,
    /m\.seen_at_a as|m\.seen_at_b as|seen_at_a,|seen_at_b,/,
    "the other side's seen_at must never be projected",
  );
  // `expiresAt` is gone from ProposalEntry now (B5.1 / C4.14 / C4.18 ban a
  // remaining-time field on a coordination payload outright). Nothing had ever
  // rendered it, which is exactly why it survived so long - so assert on the wire
  // shape, not on a component: a clock the client is trusted to ignore is still a
  // clock on the wire. The deadline stays in SQL, driving `expired` and the order.
  assert.doesNotMatch(fieldsOf(entryType), /expiresAt/, "ProposalEntry carries the plan's deadline");
  assert.doesNotMatch(proposals, /as expires_at\b/, "the deadline is projected onto the entry");
  // And no coordination surface renders a remaining time either.
  for (const file of ["src/components/coordination-drawer.tsx", "src/components/clicks-left.tsx", "src/components/clicks-list.tsx"]) {
    if (!existsSync(path.join(root, file))) continue;
    assert.doesNotMatch(
      read(file),
      /entry\.expiresAt|closesAt|remainingMs|timeLeft/,
      `${file} renders the coordination clock`,
    );
  }
});

// ── C5 - the four regressions this flow actually shipped ────────────────────────

test("the reveal fires once because a column says so, not because a component remembers", () => {
  // C5.2 / C4.3, and C5.2 is explicit about the layer: "Assert on the persisted
  // seen_at, not on component state." The only existing reveal test asserts drawer
  // wiring, which is exactly the thing that cannot survive a reload - and a reload
  // is C3 row 7.
  const mark = sliceFn(repo, "export async function markMutualSeen(", "\n}\n");

  // Per user AND per pair: two columns on the pair's own row, each written by a
  // CASE on which side the caller is. A single shared boolean would have let one
  // person's dismissal eat the other's reveal.
  assert.match(mark, /set seen_at_a = case when user_a_id = \$2::uuid then now\(\) else seen_at_a end/);
  assert.match(mark, /seen_at_b = case when user_b_id = \$2::uuid then now\(\) else seen_at_b end/);

  // Idempotent under double-submit: the WHERE matches only while the CALLER's own
  // column is still null, so the second write updates zero rows. That is also what
  // makes the return value honest - true on the first view and never again, which
  // is what the drawer plays the reveal off.
  assert.match(
    mark,
    /\(user_a_id = \$2::uuid and seen_at_a is null\)\s*\n\s*or \(user_b_id = \$2::uuid and seen_at_b is null\)/,
  );
  assert.match(mark, /returning id::text/);
  assert.match(mark, /return result\.rows\.length > 0;/);

  // Persisted across sessions means the READ is sided too, so a fresh page load
  // asks the pair's row rather than a store the reload just threw away.
  const revealState = sliceFn(repo, "export async function getMutualRevealState(", "\n}\n");
  assert.match(revealState, /when user_a_id = \$2::uuid then seen_at_a is not null/);
  assert.match(revealState, /else seen_at_b is not null/);

  // And the drawer gates on the persisted flag FIRST. The in-session Set beside it
  // covers same-session re-entry before revalidation catches up (C3 row 5, three
  // entry points); it is an addition to the column, never a substitute.
  assert.match(drawer, /!entry\.revealSeen && !revealDismissed/);
  assert.match(drawer, /void markMutualSeenAction\(entry\.mutualId\);/);
  const dismiss = sliceFn(drawer, "const dismissReveal = useCallback(", "}, [entry.mutualId]);");
  assert.match(dismiss, /markMutualSeenAction/, "dismissing without persisting is the re-fire bug");
});

test("the picker asks the server once the typing stops, and never for nothing", () => {
  // C5.3. The regression was a picker that filtered the whole catalogue on every
  // keystroke; the runbook's test is "debounced >= 250ms and capped at 20, and with
  // an empty query no catalogue request is made at all".
  assert.match(drawer, /const PICKER_DEBOUNCE_MS = (2[5-9]\d|[3-9]\d\d);/, "the debounce floor is 250ms");
  const picker = sliceFn(drawer, "function PlanPicker(", "\n}\n");
  // The fetch is inside the timer, not beside it - a request issued first and
  // cancelled later is still a request per keystroke.
  const timer = picker.indexOf("window.setTimeout(");
  const fetchCall = picker.indexOf("fetch(`/api/events/suggestions");
  assert.ok(timer > -1 && fetchCall > timer, "the catalogue fetch must sit inside the debounce timer");
  assert.match(picker, /\}, PICKER_DEBOUNCE_MS\);/);
  // The empty-query arm returns BEFORE anything is scheduled. This is the half the
  // runbook calls out by name, and the curated sections it falls back to are
  // already in hand from the server render.
  assert.match(picker, /if \(!q\) return;/);
  assert.ok(picker.indexOf("if (!q) return;") < timer, "an empty query must return before the timer is set");
  // Server-side cap. 20, from one constant both arms of the catalogue read.
  assert.match(repo, /const PROPOSAL_CATALOGUE_LIMIT = 20;/);
  assert.equal(
    (repo.match(/limit \$\{PROPOSAL_CATALOGUE_LIMIT\}/g) ?? []).length,
    2,
    "both the search and the curated arm must be capped",
  );
  // And the route the picker calls answers an empty q with an empty list rather
  // than the whole catalogue, so the cap cannot be walked around.
  const route = read("src/app/api/events/suggestions/route.ts");
  assert.match(route, /if \(!q\) return NextResponse\.json\(\{ events: \[\] \}\);/);
});

test("the waiting step never offers to take money for a plan nobody accepted", () => {
  // C5.4 / C3 row 8: S6 must contain no element matching /rsvp|save my spot|book/i.
  // The booking control and the waiting face are mutually exclusive by construction
  // - one needs !proposedByMe, the other needs proposedByMe - so the assertion is
  // that the construction holds, plus a sweep of the arm for a stray control.
  assert.match(
    drawer,
    /const waitingAsProposer =\s*\n?\s*step === "proposed" && entry\.proposedByMe && !entry\.suggestionUnavailable;/,
  );
  const openOrProposed = sliceFn(
    drawer,
    "// open / proposed - a plan is (or can be) on the table.",
    "const headingClass =",
  );
  // Comments out first - this file explains every gate at length, and the prose
  // quotes the very labels being searched for ("`Save my spot` books, `I'm in`
  // does not re-book"). Block form too: a JSX `{/* ... */}` spans lines whose
  // middles start with neither `//` nor `*`.
  const rendered = openOrProposed
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .split("\n")
    .filter((line) => line.trim())
    .join("\n");
  // Every booking-shaped control in this arm must sit behind the recipient gate.
  for (const match of rendered.matchAll(/rsvp|save my spot|\bbook\b/gi)) {
    const before = rendered.slice(Math.max(0, match.index - 600), match.index);
    assert.match(
      before,
      /!entry\.proposedByMe/,
      `S6 offers "${match[0]}" to the person who is only waiting`,
    );
  }
  // The gate itself, verbatim, so the slice above cannot pass by being empty.
  assert.match(
    drawer,
    /\{step === "proposed" &&\s*\n\s*!entry\.proposedByMe &&\s*\n\s*\(entry\.viewerHasSeat \|\| entry\.suggestedEventJoinable\) \? \(/,
  );
  // S6's own controls are a way out and a way to re-pick - neither takes money.
  assert.match(openOrProposed, /Back to your clicks/);
});

// ── Stage 0.5 - answering the post-event window ─────────────────────────────────

test("only one of the two dismissals answers the window", () => {
  // C4.13: "`Maybe later` does not mark the window answered; `No one this time`
  // does." Both live on the same component, one line apart, which is precisely why
  // this is worth pinning: they look interchangeable and are not.
  const card = read("src/components/post-event-click-card.tsx");

  // "Maybe later" is the banner's dismissal and calls NOTHING. Session-scoped, so
  // the question comes back next visit - the window is still unanswered.
  const banner = sliceFn(card, "export function PostEventMomentBanner(", "\n}\n");
  assert.match(banner, /Maybe later/);
  assert.match(banner, /sessionStorage\.setItem\(key, "1"\)/);
  assert.doesNotMatch(
    banner,
    /answerPostEventWindowAction|clickCoAttendeeAction|localStorage/,
    "`Maybe later` must not answer the window, and must not outlive the session",
  );

  // "No one this time" is the answer, and it posts.
  const noOne = sliceFn(card, "function NoOneThisTime(", "\n}\n");
  assert.match(noOne, /useActionState\(answerPostEventWindowAction, null\)/);
  assert.match(noOne, /No one this time/);
  assert.match(noOne, /<input type="hidden" name="source_event"/);

  // Server side: the answer is a row, so it survives the session either dismissal
  // is scoped to. Two kinds, one per way of answering (Stage 0.5: "the user clicked
  // at least one person, OR explicitly tapped `No one this time`").
  const answer = sliceFn(repo, "export async function answerPostEventWindowForSession(", "\n}\n");
  assert.match(answer, /insert into post_event_click_answers \(profile_id, event_id, kind\)/);
  assert.match(answer, /'none'/);
  assert.match(answer, /on conflict \(profile_id, event_id\) do nothing/);
  // Only somebody who was actually there may answer for that event.
  assert.match(answer, /join event_participants_v mine on mine\.event_id = e\.id/);
  // The other kind: a landed click answers it too, written on the duplicate path
  // as well so a replay cannot leave a window it already answered unanswered.
  const send = sliceFn(
    repo,
    "async function sendClickInner(",
    "export async function createUserClickForSession(",
  );
  assert.match(send, /values \(\$1::uuid, \$2::uuid, 'clicked'\)/);
});

// ── C4.8 - the two processes never cross-match ──────────────────────────────────

test("a discovery click and a post-event click between the same pair never pair up", () => {
  // C4.8, a ship-gate checkbox of its own. Rule 3: the two processes are separate
  // mechanics that happen to share a table, so a mutual may only form between two
  // clicks on the SAME surface - discovery with discovery (both event_id null), or
  // post-event with post-event on the SAME event.
  const send = sliceFn(
    repo,
    "async function sendClickInner(",
    "export async function createUserClickForSession(",
  );
  // One predicate, built once, used by BOTH the duplicate check and the reciprocal
  // lookup - so the two can never drift into disagreeing about what a pair is.
  assert.match(
    send,
    /const surfaceMatch = surface === "discovery" \? "event_id is null" : "event_id = \$3::uuid";/,
  );
  const reciprocal = send.slice(send.indexOf("const reciprocalResult = await client.query"));
  assert.match(
    reciprocal.slice(0, reciprocal.indexOf("for update")),
    /and \$\{surfaceMatch\}/,
    "the reciprocal lookup must be scoped to the sending surface",
  );
  // A bare event-agnostic reciprocal read is the shape of the bug - it would pair a
  // discovery click with a post-event one and mint a mutual neither person made.
  assert.doesNotMatch(
    reciprocal.slice(0, reciprocal.indexOf("for update")),
    /event_id is not null|coalesce\(event_id/,
    "the reciprocal lookup must not widen across surfaces",
  );
  // And the post-event arm carries the event id, so "same surface" means "same
  // night" rather than "any night".
  assert.match(send, /\? \[clickedProfile\.id, profile\.id, eventId\]/);
});
