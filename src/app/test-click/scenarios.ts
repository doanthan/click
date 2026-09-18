import type { PairState } from "@/lib/click-test-harness";
import {
  MUTUAL_CLOCK_DAYS,
  POST_EVENT_CLICK_CAP,
  PROPOSAL_ALTERNATIVES_CAP,
} from "@/lib/clicks/constants";

/**
 * The scenario board.
 *
 * Every row is derived from live rows - never from "the harness pressed the
 * button, so it must have worked". Three states, and the third one is the
 * important one:
 *
 *   done    - the state the scenario produces is present in the database now
 *   waiting - not reached yet from where this pair currently stands
 *   drive   - can only be observed by pressing the control and reading the
 *             refusal (a closed window, a suppressed pair). There is no row that
 *             records "the send was correctly refused", so claiming a pass for
 *             one would be a lie the board tells itself.
 *
 * `broken` is separate from all three: an invariant that is actively violated
 * right now. Those are the ones worth looking at.
 */

export type ScenarioState = "done" | "waiting" | "drive" | "broken";

export type Scenario = {
  id: string;
  stage: string;
  title: string;
  expectation: string;
  state: ScenarioState;
  detail: string;
};

function seat(value: boolean | undefined) {
  return value === true;
}

/**
 * PairState's timestamps are Postgres `::text` casts - "2026-09-06 04:12:33.123+00",
 * a space and a two-digit offset rather than ISO 8601. V8 happens to accept that,
 * but nothing promises it will, and every clock comparison on this board is load-
 * bearing: read a lapse as live and the row scores the wrong colour silently.
 */
function ts(value: string): number {
  return Date.parse(value.replace(" ", "T") + (/[+-]\d\d$/.test(value) ? ":00" : ""));
}

export function buildScenarios(pair: PairState): Scenario[] {
  const {
    a,
    b,
    clicks,
    mutual,
    proposal,
    viewA,
    viewB,
    suppressedUntil,
    blocked,
    postEventSpend,
    sharedFutureSeat,
  } = pair;
  const aToB = clicks.filter((c) => c.direction === "a_to_b");
  const bToA = clicks.filter((c) => c.direction === "b_to_a");
  const pendingAtoB = aToB.some((c) => c.status === "pending");
  const pendingBtoA = bToA.some((c) => c.status === "pending");
  const oneWayOnly = (pendingAtoB && !pendingBtoA) || (pendingBtoA && !pendingAtoB);
  const sender = pendingAtoB && !pendingBtoA ? a : b;
  const receiver = pendingAtoB && !pendingBtoA ? b : a;
  const receiverView = receiver.id === a.id ? viewA : viewB;
  const postEvent = clicks.filter((c) => c.surface === "who_was_there");
  const entryA = viewA.proposal;
  const entryB = viewB.proposal;
  const entry = entryA ?? entryB;

  // ---- shared derivations ---------------------------------------------------
  // Read once here rather than per row, because several rows are only correct
  // RELATIVE to each other - "released with the clock elapsed" is the sweep's
  // door and "released with the clock still live" is set-it-down's, and a row
  // that checks only the status claims the other one's pass.
  const mutualActive = mutual?.status === "active";
  const livePlan = proposal?.status === "pending" || proposal?.status === "accepted";
  const anyPending = clicks.some((c) => c.status === "pending");
  const clockRanOut = !!mutual && ts(mutual.expiresAt) <= Date.now();
  // A ban writes the same 'expired' terminal a block does but leaves NO
  // user_blocks row, so `blocked` alone would read a banned pair as a wrong
  // terminal. listHarnessPeople already surfaces the ban as a blocker string.
  const bannedEither = a.blockers.includes("banned") || b.blockers.includes("banned");

  const rows: Scenario[] = [];

  // ---- Stage 1: the private send ------------------------------------------
  rows.push({
    id: "one-way-invisible",
    stage: "1 · Private send",
    title: "A one-way click is invisible to the person it is about",
    expectation:
      "The receiver's own view shows no click, no mutual and no notification. Nothing is ever sent to them.",
    state: !oneWayOnly
      ? "waiting"
      : receiverView.seesClicked || receiverView.seesMutual
        ? "broken"
        : "done",
    detail: !oneWayOnly
      ? "Send exactly one click, from one side only, to test this."
      : receiverView.seesClicked || receiverView.seesMutual
        ? `LEAK: ${receiver.displayName} can see ${sender.displayName}'s pending click.`
        : `${sender.displayName} → ${receiver.displayName} is pending, and ${receiver.displayName}'s view is clean.`,
  });

  // Two pending rows in the same direction on the same surface and event is the
  // duplicate guard having missed. Keyed on surface + event because the guard is
  // surface-scoped: a pending discovery click alongside a pending who_was_there
  // one is two different processes, not a duplicate.
  const twinPending = (["a_to_b", "b_to_a"] as const).some((direction) => {
    const pending = clicks.filter((c) => c.direction === direction && c.status === "pending");
    return new Set(pending.map((c) => `${c.surface}:${c.eventTitle ?? ""}`)).size < pending.length;
  });
  rows.push({
    id: "duplicate-send",
    stage: "1 · Private send",
    title: "Re-sending the same click is a quiet no-op",
    expectation: "A second click at the same person on the same surface spends no budget and errors on nothing.",
    // Still 'drive' - no row records that the second press was made, so a clean
    // board cannot tell a working guard from a button nobody pressed. The added
    // arm only catches the guard having actually failed, which a row CAN prove.
    state: twinPending ? "broken" : "drive",
    detail: twinPending
      ? "LEAK: two pending clicks in the same direction on the same surface and event - the second send wrote a row and spent a second budget slot."
      : "Press the same send button twice - the second must succeed and add no second row.",
  });

  rows.push({
    id: "send-refusals-that-write-nothing",
    stage: "1 · Private send",
    title: "Self-click and a spent budget are refused, and neither leaves a row",
    expectation:
      "A self-click is refused in the sender's own plain words - it discloses nobody, so it must never collapse into the neutral not-eligible string - and a fourth post-event click at one event is refused on the budget without ever naming the number. Neither writes a clicks row.",
    // Never 'done' and never 'waiting': no row records a refusal, and the self
    // half is drivable from a cold pair, so 'drive' is the floor. The one
    // row-derived fact is the negative one - a sender holding MORE than the
    // budget at a single event is a cap that did not hold.
    state: (() => {
      const overspent = postEventSpend.find((s) => s.count > POST_EVENT_CLICK_CAP);
      return overspent ? "broken" : "drive";
    })(),
    detail: (() => {
      const overspent = postEventSpend.find((s) => s.count > POST_EVENT_CLICK_CAP);
      if (overspent) {
        const who = overspent.senderId === a.id ? a.displayName : b.displayName;
        return `CAP BREACHED: ${who} holds ${overspent.count} clicks at ${overspent.eventSlug}; the budget is ${POST_EVENT_CLICK_CAP}.`;
      }
      const spent = postEventSpend.find((s) => s.count >= POST_EVENT_CLICK_CAP);
      return spent
        ? `Budget spent at ${spent.eventSlug} (${spent.count}/${POST_EVENT_CLICK_CAP}). Send from that window again - it must refuse without naming the number. The self-click control refuses at any time, and in plain words.`
        : "Press the self-click control and read the refusal - it must name the self-click plainly, never the neutral not-eligible string. For the budget half, reset the pair, rebuild the fixtures, then spend the budget from the open window first.";
    })(),
  });

  // ---- Stage 2: the mutual --------------------------------------------------
  rows.push({
    id: "mutual-forms",
    stage: "2 · Mutual",
    title: "Reciprocating forms exactly one mutual",
    expectation: "Both click rows flip to 'mutual' and a single active mutual row appears for the pair.",
    state: !mutual
      ? "waiting"
      : mutual.status === "active" && aToB.some((c) => c.status === "mutual") && bToA.some((c) => c.status === "mutual")
        ? "done"
        : mutual.status === "active"
          ? "broken"
          : "waiting",
    detail: !mutual
      ? "Both sides need a live click at each other."
      : `mutual ${mutual.status} / ${mutual.coordState}; click rows: ${aToB[0]?.status ?? "none"} + ${bToA[0]?.status ?? "none"}.`,
  });

  rows.push({
    id: "both-told",
    stage: "2 · Mutual",
    title: "Both sides are told, not just the one who completed it",
    expectation: "The mutual shows up in BOTH people's own reads.",
    state: !mutualActive
      ? "waiting"
      : viewA.mutual && viewB.mutual
        ? "done"
        : "broken",
    detail: !mutualActive
      ? "Form a mutual first."
      : viewA.mutual && viewB.mutual
        ? "Both sides carry the mutual."
        : `Only ${viewA.mutual ? a.displayName : b.displayName} can see it.`,
  });

  // Two real presses land in two different transactions, so they can never share
  // a timestamp. Equal-and-non-null is therefore one side's exit having stamped
  // the other side's column - the regression that dropping markMutualSeen's
  // per-column CASE would cause, and the booleans alone cannot see it.
  const revealLeak = !!mutual && mutual.seenAtA !== null && mutual.seenAtA === mutual.seenAtB;

  rows.push({
    id: "reveal-once",
    stage: "2 · Mutual",
    title: "The reveal is once per person, forever",
    expectation: "Marking it seen is permanent for that side and does not touch the other side's.",
    state: !mutual
      ? "waiting"
      : revealLeak
        ? "broken"
        : mutual.seenByA || mutual.seenByB
          ? "done"
          : "waiting",
    detail: !mutual
      ? "Form a mutual first."
      : revealLeak
        ? `LEAK: both sides carry the same seen_at (${mutual.seenAtA}) - one person's exit stamped the other's.`
        : `seen by ${a.displayName}: ${mutual.seenByA ? "yes" : "no"} · seen by ${b.displayName}: ${mutual.seenByB ? "yes" : "no"}`,
  });

  rows.push({
    id: "reveal-stamped-by-every-exit",
    stage: "2 · Mutual",
    title: "Every way out of the reveal stamps seen_at - including the one that navigates",
    expectation:
      "Suggest a plan, Maybe later, the close control, the scrim and Escape each stamp THIS side's seen_at, and so must the 'How clicking works' link - it is an exit like any other. None of them may touch the other side's.",
    // Never 'done', deliberately. The harness's own mark_seen calls markMutualSeen
    // directly and exercises no drawer exit at all, so a stamped column is not
    // evidence that an EXIT stamped it. Only a person leaving the drawer six
    // different ways can settle that, which is what 'drive' means here.
    state: !mutual ? "waiting" : revealLeak ? "broken" : mutualActive ? "drive" : "waiting",
    detail: !mutual
      ? "Form a mutual first."
      : revealLeak
        ? `LEAK: both sides carry the same seen_at (${mutual.seenAtA}) - one person's exit stamped the other's.`
        : !mutualActive
          ? `mutual is ${mutual.status} - the reveal is skipped on a dead mutual. Reset the pair and form a fresh one.`
          : `seen ${a.displayName}: ${mutual.seenAtA ?? "no"} · ${b.displayName}: ${mutual.seenAtB ?? "no"}. Open this mutual on /proposals as one side, tap "How clicking works", come back and re-open it - the reveal must not fire again, and that side's seen_at must be set.`,
  });

  // Every send between a pair inside a live mutual is a duplicate - the guard is
  // pair-wide, not surface-scoped like the one above - so NO click row may be
  // created after mutual_at. A pending row OLDER than mutual_at is legitimate:
  // the flip to 'mutual' at formation IS surface-scoped, so a discovery click can
  // survive a post-event mutual. Strict `>` because the mutual-forming send
  // inserts its own row in the same transaction, sharing the timestamp exactly.
  const postMutualPending = mutualActive
    ? clicks.filter((c) => c.status === "pending" && ts(c.createdAt) > ts(mutual.mutualAt))
    : [];

  rows.push({
    id: "already-mutual-noop",
    stage: "2 · Mutual",
    title: "Clicking back at someone you are already mutual with is a silent no-op",
    expectation:
      "A send into a live mutual writes no second click row, spends no budget, forms no second mutual and re-sends no notification - and the reply is indistinguishable from any other send.",
    state: !mutualActive ? "waiting" : postMutualPending.length > 0 ? "broken" : "drive",
    detail: !mutualActive
      ? "Form a mutual first."
      : postMutualPending.length > 0
        ? `LEAK: a ${postMutualPending[0].surface} click was inserted at ${postMutualPending[0].createdAt.slice(0, 19)}, after the pair went mutual at ${mutual.mutualAt.slice(0, 19)} - the already-mutual guard did not fire and a budget slot was spent.`
        : "Press either side's discovery send again and read the LOG, not the reply: the step must land as 'noop' with zero changes. The reply is identical to a landed send by design, so it proves nothing.",
  });

  // ---- Stage 3: coordination ------------------------------------------------
  rows.push({
    id: "suggest",
    stage: "3 · Coordinate",
    title: "Either side can put a plan on the table",
    expectation: "A pending proposal exists and the mutual moves to coord_state 'proposed'.",
    // Any proposal row at all proves this step ran - a plan that has since been
    // accepted, declined or lapsed was still put on the table. Only a LIVE plan
    // is held to the coord_state check, because that is the only moment
    // 'proposed' is the correct value.
    state: !proposal
      ? "waiting"
      : proposal.status !== "pending"
        ? "done"
        : mutual?.coordState === "proposed"
          ? "done"
          : "broken",
    detail: proposal
      ? `plan "${proposal.eventTitle ?? "-"}" is ${proposal.status}, coord_state ${mutual?.coordState ?? "-"}`
      : "No plan suggested yet.",
  });

  rows.push({
    id: "counter",
    stage: "3 · Coordinate",
    title: "A counter-proposal re-points the plan rather than ending it",
    expectation:
      "The single plan row moves to the new event and spends one of the pair's three alternatives. It stays pending, and the mutual survives.",
    state: (proposal?.alternativesCount ?? 0) > 0 ? "done" : "waiting",
    detail:
      (proposal?.alternativesCount ?? 0) > 0
        ? `${proposal?.alternativesCount} of 3 alternatives used; the plan now points at "${proposal?.eventTitle ?? "-"}".`
        : "Suggest one plan, then counter with the other from the opposite side.",
  });

  // The budget is joint and lives on the pending proposal row, so a decline
  // resets it: the next suggest INSERTs a fresh proposal at the column default.
  const alts = proposal?.alternativesCount ?? 0;
  const capReached = alts >= PROPOSAL_ALTERNATIVES_CAP;
  const pendingPlan = proposal?.status === "pending";
  const openA = entryA?.canSuggestAlternative;
  const openB = entryB?.canSuggestAlternative;
  // Mirrors the writer's own liveness test. When the plan is NOT joinable the
  // writer takes the recovery branch instead, which adds nothing to the count -
  // so a fourth counter there is correctly accepted and this row must not call
  // that a breach.
  const planJoinable = (entryA ?? entryB)?.suggestedEventJoinable === true;

  rows.push({
    id: "counter-cap",
    stage: "3 · Coordinate",
    title: `The pair get ${PROPOSAL_ALTERNATIVES_CAP} alternatives, and the next one is refused`,
    expectation: `At ${PROPOSAL_ALTERNATIVES_CAP} the suggest-alternative control is closed to BOTH sides and a further counter is refused - without ever putting the remaining count on the wire.`,
    state:
      alts > PROPOSAL_ALTERNATIVES_CAP
        ? "broken"
        : !pendingPlan
          ? "waiting"
          : capReached && (openA === true || openB === true)
            ? "broken"
            : !capReached && (openA === false || openB === false)
              ? "broken"
              : capReached && planJoinable
                ? "drive"
                : "waiting",
    detail:
      alts > PROPOSAL_ALTERNATIVES_CAP
        ? `BREACH: alternatives_count is ${alts}, over the cap of ${PROPOSAL_ALTERNATIVES_CAP}.`
        : !pendingPlan
          ? "Suggest a plan, then counter it - the budget lives on the pending proposal row, and a decline resets it."
          : capReached && (openA === true || openB === true)
            ? `At ${alts} alternatives but ${openA === true ? a.displayName : b.displayName} still reports the control open - it is live over a cap that will refuse them.`
            : !capReached && (openA === false || openB === false)
              ? `Only ${alts} of ${PROPOSAL_ALTERNATIVES_CAP} spent and the control is already closed for ${openA === false ? a.displayName : b.displayName}.`
              : capReached && planJoinable
                ? `${alts} of ${PROPOSAL_ALTERNATIVES_CAP} spent and the control is closed for both. Counter once more - it must refuse, and the log must show zero row changes.`
                : capReached
                  ? `${alts} of ${PROPOSAL_ALTERNATIVES_CAP} spent, but the plan is no longer joinable - a counter here is a recovery and is meant to be accepted.`
                  : `${alts} of ${PROPOSAL_ALTERNATIVES_CAP} alternatives spent; counter ${PROPOSAL_ALTERNATIVES_CAP - alts} more time(s) to reach the cap. Do not decline in between - that resets the budget.`,
  });

  rows.push({
    id: "decline",
    stage: "3 · Coordinate",
    title: "Declining a plan never ends the mutual",
    expectation: "The proposal goes to 'declined' and the pair returns to coord_state 'open' - still mutual.",
    state:
      proposal?.status === "declined"
        ? mutual?.status === "active" && (mutual.coordState === "open" || mutual.coordState === "dormant")
          ? "done"
          : "broken"
        : "waiting",
    detail:
      proposal?.status === "declined"
        ? `after the decline: mutual ${mutual?.status ?? "gone"} / ${mutual?.coordState ?? "-"}`
        : "Suggest a plan, then decline it from the other side.",
  });

  // The third clock, and the only one with no control of its own: a plan nobody
  // answers lapses on its own 48 hours while the mutual's 7 days keep running.
  // `isExpired` is Postgres's own now() comparison, so it goes true the moment
  // the deadline passes - an HOUR before the hourly sweep acts on it in
  // production, which is exactly the window the broken arm below catches.
  const shelved = Boolean(entryA?.isExpired || entryB?.isExpired);

  rows.push({
    id: "proposal-lapse",
    stage: "3 · Coordinate",
    title: "An unanswered plan lapses on its own clock, and the mutual outlives it",
    expectation:
      "Past its deadline the plan flips to 'expired', the mutual stays active and falls back to coord_state 'dormant', and the pair land back on the suggest step - never on the read-only ending screen.",
    state:
      !proposal || (proposal.status !== "pending" && proposal.status !== "expired")
        ? "waiting"
        : proposal.status === "pending"
          ? shelved && mutualActive
            ? "broken"
            : "waiting"
          : !mutualActive
            ? "waiting"
            : mutual?.coordState === "dormant" && !shelved
              ? "done"
              : "broken",
    detail: !proposal
      ? "Form a mutual and suggest a plan first."
      : proposal.status === "pending" && shelved && mutualActive
        ? "LIVE PAIR ON THE ENDING SCREEN: the plan's deadline has passed but the sweep has not run, and the read still reports it expired on an ACTIVE mutual - so both sides are being shown the read-only closure card. Press Run sweep. In production this gap is up to an hour."
        : proposal.status === "pending"
          ? "Wind the PROPOSAL clock back, then run the sweep. Do not wind the mutual clock in the same run - that ends the mutual too and this row correctly falls back to waiting."
          : !mutualActive
            ? `the mutual ended too (${mutual?.status ?? "gone"}) - reset the pair and wind only the plan clock.`
            : mutual?.coordState === "dormant" && !shelved
              ? `plan lapsed; mutual ${mutual.status} / ${mutual.coordState} - the pair are back on the suggest step.`
              : `plan is 'expired' but the pair sit at coord_state ${mutual?.coordState ?? "-"}${shelved ? " and the read still reports it shelved" : ""} - the dormancy flip missed.`,
  });

  rows.push({
    id: "outsider-refused",
    stage: "Safety",
    title: "Only the two people in a mutual can act on its plan",
    expectation:
      'A third account\'s confirm is refused as an absence - "Proposal not found." - never as "not yours", and it writes nothing: the plan stays pending and confirmed_by stays empty.',
    // Only confirmProposal writes confirmed_by, and only through the membership
    // join, so an id outside the pair is proof that join was bypassed. NOT
    // confirmedAt - every legitimate confirm sets that too, and this row would
    // then contradict the `confirm` row above.
    state: (() => {
      const by = proposal?.confirmedById ?? null;
      if (by && by !== a.id && by !== b.id) return "broken";
      return entry && pendingPlan ? "drive" : "waiting";
    })(),
    detail: (() => {
      const by = proposal?.confirmedById ?? null;
      if (by && by !== a.id && by !== b.id) {
        return `LEAK: confirmed_by is ${by}, which is neither ${a.displayName} nor ${b.displayName}.`;
      }
      if (!entry || !pendingPlan) return "Form a mutual and get a pending plan on the table first.";
      return proposal?.proposedBy
        ? `Press "Let an outsider confirm it" - it must fail with "Proposal not found." and change nothing. Then confirm as ${proposal.proposedBy}, whose suggestion it is: that must refuse too.`
        : 'Press "Let an outsider confirm it" - it must fail with "Proposal not found." and change nothing. (This plan has no proposer, so it is the system suggestion and the self-confirm guard is exempt on it by design - decline it and suggest again from one side to test that arm.)';
    })(),
  });

  // ---- Stage 4/5: confirm and go -------------------------------------------
  rows.push({
    id: "confirm",
    stage: "4 · Confirm",
    title: "One tap by either side confirms the plan",
    expectation:
      "The plan becomes 'accepted' and the mutual stays active. It deliberately does NOT reach confirmed_together yet - confirming is agreeing, not booking, so the win state waits until both people actually hold a seat.",
    state:
      proposal?.status !== "accepted"
        ? "waiting"
        : mutual?.status === "active"
          ? "done"
          : "broken",
    detail:
      proposal?.status === "accepted"
        ? `accepted by ${proposal.proposedBy ? "one side" : "someone"}; mutual ${mutual?.status ?? "gone"} / ${mutual?.coordState ?? "-"} - confirmed_together is written by the booking detector, not by this tap.`
        : "Suggest a plan, then confirm it.",
  });

  const aSeated = seat(entryA?.viewerHasSeat);
  const bSeated = seat(entryB?.viewerHasSeat);
  const bothSeated = aSeated && bSeated;

  rows.push({
    id: "one-seat-waypoint",
    stage: "5 · Both going",
    title: "One person has a seat and the other does not",
    expectation:
      "Between the accept and the second booking the two sides are on different screens - the seated one already in, the seatless one being told their spot is still there to take - and coord_state must still NOT be confirmed_together.",
    // The two sides' seat reads come from the same roster check, so a
    // disagreement is one side's roster leaking into the other's. The
    // both-entries guard is load-bearing, not padding: with one entry null the
    // null side reads as false-and-matching and would score a pass off half the
    // pair.
    state: (() => {
      if (!entryA || !entryB || aSeated === bSeated) return "waiting";
      const agree = seat(entryA.otherHasSeat) === bSeated && seat(entryB.otherHasSeat) === aSeated;
      if (!agree || mutual?.coordState === "confirmed_together") return "broken";
      return "done";
    })(),
    detail: (() => {
      if (!entryA || !entryB) return "Both sides need a live mutual with a plan on it.";
      if (aSeated === bSeated) {
        return aSeated
          ? "Both seated - both-going owns this one."
          : "Neither side has taken a seat yet. Rebuild the fixtures (reset does not give the seats back), then suggest, confirm, and book from ONE side.";
      }
      const agree = seat(entryA.otherHasSeat) === bSeated && seat(entryB.otherHasSeat) === aSeated;
      return `${aSeated ? a.displayName : b.displayName} is seated, ${aSeated ? b.displayName : a.displayName} is not; coord_state ${mutual?.coordState ?? "-"}${agree ? "" : " - and the two sides DISAGREE about who is seated"}.`;
    })(),
  });

  rows.push({
    id: "both-going",
    stage: "5 · Both going",
    title: "Confirming is not booking - both still take a seat",
    expectation:
      "Both sides hold a confirmed seat on the agreed event, and only THEN does the mutual reach coord_state 'confirmed_together'.",
    state: !entry
      ? "waiting"
      : bothSeated
        ? mutual?.coordState === "confirmed_together" || mutual?.status === "connected"
          ? "done"
          : "broken"
        : "waiting",
    detail: entry
      ? `${a.displayName}: ${seat(entryA?.viewerHasSeat) ? "seated" : "no seat"} · ${b.displayName}: ${seat(entryB?.viewerHasSeat) ? "seated" : "no seat"} · coord_state ${mutual?.coordState ?? "-"}`
      : "No plan on the table.",
  });

  rows.push({
    id: "connected-terminal",
    stage: "6 · Win",
    title: "'We clicked' is the one terminal that is a success",
    expectation:
      "The mutual lands on 'connected' carrying the reason it got there, and any live plan is withdrawn with it - a settled pair must not still be rendering a coordination step. coord_state is deliberately NOT asserted: the tap does not write it.",
    // Reads connectedReason rather than hard-coding 'we_clicked', so a pair the
    // co-attendance sweep settled still reads done and names its own reason.
    // Nullness is the real invariant here: the column is nullable at the DB level
    // and only a check constraint on the VALUE set exists, so nothing but a row
    // can catch something reaching the success terminal anonymously.
    state:
      mutual?.status !== "connected"
        ? "waiting"
        : !mutual.connectedReason
          ? "broken"
          : livePlan
            ? "broken"
            : "done",
    detail:
      mutual?.status !== "connected"
        ? mutualActive
          ? "Suggest a plan so there is something to withdraw, then press 'Mark as connected' on either side."
          : mutual
            ? `mutual is ${mutual.status} - only an active mutual can reach the win state. Reset the pair.`
            : "Form a mutual first."
        : !mutual.connectedReason
          ? "BROKEN: connected with no reason recorded - nothing may reach the success terminal anonymously."
          : livePlan
            ? `BROKEN: the plan is still ${proposal?.status} on a settled mutual - it should have been withdrawn with it.`
            : `connected via ${mutual.connectedReason}; plan ${proposal?.status ?? "none"}; coord_state ${mutual.coordState}, untouched by design.`,
  });

  // ---- Off-path -------------------------------------------------------------
  rows.push({
    id: "sold-out",
    stage: "Off-path",
    title: "A plan that fills up is a recovery, not a dead end",
    expectation:
      "The entry reports suggestionUnavailable, and the pair are offered another plan or the waitlist together - never an error.",
    state: entry?.suggestionUnavailable ? "done" : "waiting",
    detail: entry?.suggestionUnavailable
      ? "The agreed event is no longer joinable and the pair still hold a live plan to recover from."
      : "Suggest the capacity-2 fixture, then fill it from the fixtures panel.",
  });

  // Who cancelled is derived from rows, never from "the button was pressed": the
  // retired plan keeps pointing at its event, so both sides' seat reads are still
  // computed against it and only the survivor still holds one.
  const planRetired = proposal?.status === "partner_cancelled";
  const mutualHeldOpen = mutualActive && mutual?.coordState === "open";
  const survivorEntry = aSeated ? entryA : bSeated ? entryB : null;
  const survivorName = aSeated ? a.displayName : b.displayName;
  const bothToldTheyLost = Boolean(entryA?.partnerCancelled && entryB?.partnerCancelled);

  rows.push({
    id: "partner-cancel-s18",
    stage: "Off-path · partner cancel",
    title: "A partner gives up their seat, and only the other one is told",
    expectation:
      "The plan retires to 'partner_cancelled' and the mutual survives, active, back on coord_state 'open'. Only the side still holding a seat is shown the recovery card - the one who walked must never be told their own plans changed.",
    state: !planRetired
      ? "waiting"
      : !mutualHeldOpen
        ? "broken"
        : bothToldTheyLost
          ? "broken"
          : !survivorEntry
            ? "broken"
            : survivorEntry.partnerCancelled
              ? "done"
              : "broken",
    detail: !planRetired
      ? "Rebuild the fixtures, reset the pair, then suggest, confirm, take a seat on BOTH sides, and give one seat up. The rebuild matters: a leftover shared seat on any other future night makes the teardown skip itself."
      : !mutualHeldOpen
        ? `The plan retired but the mutual is ${mutual?.status ?? "gone"} / ${mutual?.coordState ?? "-"} - it is meant to stay active on 'open'.`
        : bothToldTheyLost
          ? "BOTH sides are being told the plan fell through, so the person who cancelled is reading \"your spot's still yours\" about their own decision. The flag is derived per proposal ROW rather than per viewer, and the drawer picks the recovery card off it alone."
          : !survivorEntry
            ? "The plan retired but neither side holds a seat - nobody is a survivor, and the recovery card is still being served."
            : survivorEntry.partnerCancelled
              ? `${survivorName} still holds the seat and is the only side told the plan fell through.`
              : `${survivorName} holds the seat but is not being told the plan retired at all.`,
  });

  // Deliberately NOT asserted on the row above: the "canceller's pending clicks
  // go to invalidated" leg. That update is event-scoped while this board's click
  // query is pair-scoped, and at confirmed_together the pair's own clicks are
  // already 'mutual' anyway - so no pair-visible row can move, and claiming a
  // pass for it would be exactly the lie this board exists not to tell.

  const entryCancelled = Boolean(
    entryA?.suggestedEventCancelled || entryB?.suggestedEventCancelled,
  );
  const parkedOnDeadNight = mutualActive && mutual?.coordState === "confirmed_together";

  rows.push({
    id: "merchant-cancels-agreed-event",
    stage: "Off-path · the night dies",
    title: "The host calls off the night the pair agreed on",
    expectation:
      "The plan retires to 'event_cancelled' and the pair drop back to coord_state 'open' - still mutual, still able to suggest something else. They must not stay parked at confirmed_together on a night that will not happen.",
    // Order matters. Once this behaves, the retired status is no longer picked up
    // by the read the entries come from, so suggestedEventCancelled falls back to
    // false and the first arm stops firing on its own. The raw proposal row is
    // what carries the terminal after that - which is also how a half-fix (plan
    // retired, pair still parked) is still caught, by the nested check below.
    state:
      entryCancelled && (parkedOnDeadNight || livePlan)
        ? "broken"
        : proposal?.status === "event_cancelled"
          ? mutualActive && (mutual?.coordState === "open" || mutual?.coordState === "dormant")
            ? "done"
            : "broken"
          : "waiting",
    detail:
      entryCancelled && (parkedOnDeadNight || livePlan)
        ? `"${proposal?.eventTitle ?? "-"}" is cancelled, but the plan is still ${proposal?.status} and the pair sit at coord_state ${mutual?.coordState ?? "-"}.`
        : proposal?.status === "event_cancelled"
          ? `plan retired to event_cancelled; mutual ${mutual?.status ?? "gone"} / ${mutual?.coordState ?? "-"}.`
          : "Suggest a plan, confirm it, book both sides, then press 'Call off' on that fixture. Rebuild the fixtures to undo it - resetting the pair will not.",
  });

  rows.push({
    id: "not-feeling-it",
    stage: "Off-path",
    title: "'Not feeling it' is silent, and holds the pair apart for 90 days",
    expectation:
      "The mutual lands on 'suppressed', a 90-day pair_suppressions row is written, and the other side is told nothing at all.",
    state:
      mutual?.status === "suppressed"
        ? suppressedUntil
          ? "done"
          : "broken"
        : suppressedUntil
          ? "done"
          : "waiting",
    detail: suppressedUntil
      ? `held apart until ${suppressedUntil.slice(0, 10)}; mutual is ${mutual?.status ?? "gone"}.`
      : "Form a mutual, then press 'Not feeling it' on one side.",
  });

  rows.push({
    id: "set-it-down",
    stage: "Off-path",
    title: "Setting it down is the quieter exit, and is NOT the same door",
    expectation:
      "The mutual lands on 'released' / 'dormant' with NO suppression row - a deliberate no is meant to buy more distance than simply putting it down.",
    // The sweep writes the identical released/dormant row, so status alone cannot
    // tell this door from that one - a LIVE clock is the only difference, and
    // without it this row and mutual-expiry both claim the same pass.
    state:
      mutual?.status !== "released"
        ? "waiting"
        : suppressedUntil
          ? "broken"
          : clockRanOut
            ? "waiting"
            : "done",
    detail:
      mutual?.status !== "released"
        ? "Form a mutual, then press 'Set it down' on one side - on a FRESH clock, or the sweep's door is indistinguishable from this one."
        : suppressedUntil
          ? `released / ${mutual.coordState}, but a suppression row is present and should not be.`
          : clockRanOut
            ? "released with the clock already elapsed - that is the sweep's door, not this one. Reset and set it down on a fresh mutual."
            : `released / ${mutual.coordState} with the clock still live, and no suppression row - correct.`,
  });

  rows.push({
    id: "suppressed-refuses",
    stage: "Off-path",
    title: "A suppressed pair cannot re-click",
    expectation: "A send inside the suppression window is refused with the neutral not-eligible string.",
    state: suppressedUntil ? "drive" : "waiting",
    detail: suppressedUntil
      ? "Press a send button now - it must refuse without naming the suppression."
      : "Press 'Not feeling it' first.",
  });

  rows.push({
    id: "click-expiry",
    stage: "Off-path",
    title: "An unreciprocated click expires quietly",
    expectation: "After its window, the click is 'expired' and nobody was ever told.",
    state: clicks.some((c) => c.status === "expired") ? "done" : "waiting",
    detail: clicks.some((c) => c.status === "expired")
      ? "An expired click row is on file for this pair."
      : "Send one click, wind the click clock back, then run the sweep.",
  });

  rows.push({
    id: "mutual-expiry",
    stage: "Off-path",
    title: "A mutual nobody acts on winds down",
    expectation:
      "The mutual leaves 'active' on its own clock without either side doing anything - and it lands on 'released', the 30-day door. 'expired' is the block-and-ban door and is permanent; the sweep must never use it.",
    // 'expired' with no block and no ban is the exact regression the terminal
    // rotation migration exists to repair, so name it rather than accepting
    // either terminal as a pass.
    state: !mutual
      ? "waiting"
      : mutual.status === "released" && clockRanOut
        ? "done"
        : mutual.status === "expired" && !blocked && !bannedEither
          ? "broken"
          : "waiting",
    detail: !mutual
      ? "Form a mutual, wind the mutual clock back, then run the sweep."
      : mutual.status === "expired" && !blocked && !bannedEither
        ? "BROKEN: the mutual wound down onto 'expired', which is the permanent block-and-ban terminal. Silence is meant to land on 'released'."
        : mutual.status === "released" && clockRanOut
          ? "mutual wound down to 'released' with its clock elapsed - the sweep's own door."
          : `mutual is ${mutual.status}.${sharedFutureSeat ? " The pair hold a shared upcoming seat, so the sweep extends instead of winding down - see shared-seat-defeats-expiry." : ""}`,
  });

  // The sweep's extension is the only writer left once the other two are ruled
  // out: the booking detector stamps confirmed_together when IT extends, and the
  // confirm path only fires off an accepted plan. So a clock pushed past
  // formation + the mutual's own window, with neither fingerprint, is the guard.
  const seatedNight = viewA.mutual?.bothGoingEventSlug ?? viewB.mutual?.bothGoingEventSlug ?? null;
  const clockPushed =
    !!mutual &&
    ts(mutual.expiresAt) - (ts(mutual.mutualAt) + MUTUAL_CLOCK_DAYS * 86_400_000) > 60_000;
  const otherClockWriter =
    mutual?.coordState === "confirmed_together" || proposal?.status === "accepted";

  rows.push({
    id: "shared-seat-defeats-expiry",
    stage: "Off-path",
    title: "A pair with a night already in the diary is extended, not wound down",
    expectation:
      "The sweep must not end an active mutual whose two people both hold a seat on the same upcoming night. It pushes the clock out to past that night instead, so the pair are still a pair when they get there.",
    state: !sharedFutureSeat || !mutual
      ? "waiting"
      : mutualActive
        ? clockPushed && !otherClockWriter && !!seatedNight
          ? "done"
          : "waiting"
        : (mutual.status === "released" || mutual.status === "expired") && clockRanOut
          ? "broken"
          : "waiting",
    detail: !sharedFutureSeat
      ? "Both sides need a seat on the same upcoming night before there is anything for the sweep to spare."
      : !mutual
        ? "Form a mutual too - the seats alone are not the scenario."
        : !mutualActive
          ? (mutual.status === "released" || mutual.status === "expired") && clockRanOut
            ? `BROKEN: the pair hold a night together and the mutual is ${mutual.status} with its clock in the past. Note the one false positive: winding the clock back and THEN setting it down produces the same row by hand.`
            : `mutual is ${mutual.status} - that is the not-feeling-it or connected door, not the sweep's.`
          : clockPushed && !otherClockWriter && seatedNight
            ? `clock pushed out past ${seatedNight} - the sweep spared them.`
            : otherClockWriter
              ? "The clock was extended by the booking detector or the confirm, not by the sweep - reset the pair, re-form the mutual off the seats they already hold, then wind and sweep."
              : "Wind the mutual clock back and run the sweep. The clock must move forward, not the mutual out.",
  });

  rows.push({
    id: "post-event",
    stage: "Process 2",
    title: "The post-event surface is a separate process",
    expectation:
      "A who_was_there click is event-bound and can only be sent inside the event's 48-hour window.",
    state: postEvent.length > 0 ? "done" : "waiting",
    detail:
      postEvent.length > 0
        ? `${postEvent.length} post-event click row(s): ${postEvent.map((c) => `${c.status} @ ${c.eventTitle ?? "?"}`).join(", ")}`
        : "Use the post-event send on the fixture that ended 3 hours ago.",
  });

  rows.push({
    id: "post-event-closed",
    stage: "Process 2",
    title: "A closed window refuses, and says only that it is closed",
    expectation:
      "The refusal names the window and never the other person - it must not reveal who was there.",
    state: "drive",
    detail: "Send on the fixture that ended 4 days ago and read the refusal.",
  });

  rows.push({
    id: "no-cross-process",
    stage: "Process 2",
    title: "The two processes never cross-match",
    expectation:
      "A discovery click and a post-event click at the same person do NOT form a mutual with each other.",
    state:
      pendingAtoB && postEvent.some((c) => c.direction === "b_to_a" && c.status === "pending")
        ? mutual?.status === "active"
          ? "broken"
          : "done"
        : "waiting",
    detail:
      "Send a discovery click one way and a post-event click the other way; no mutual may form.",
  });

  rows.push({
    id: "block-teardown",
    stage: "Safety",
    title: "A block tears the pair down completely",
    expectation:
      "The mutual lands on 'expired' - the one permanent door - and any live plan is withdrawn with it in the same transaction.",
    // Assert the ABSENCE of a pending click, never the presence of an invalidated
    // one: after a mutual forms every pair click is already 'mutual' and the
    // teardown matches only 'pending', so a correct block invalidates zero rows
    // here and "no invalidated rows" would fail a working teardown.
    state:
      !blocked || !mutual
        ? "waiting"
        : mutual.status === "expired" && !livePlan && !anyPending
          ? "done"
          : "broken",
    detail: !blocked
      ? "Form a mutual and a plan, then block from one side."
      : `blocked; mutual ${mutual?.status ?? "gone"} (must be 'expired') · plan ${proposal?.status ?? "none"} (must not be pending or accepted) · pending clicks ${anyPending ? "YES - there should be none" : "none"}.`,
  });

  rows.push({
    id: "terminal-is-the-right-one",
    stage: "Safety",
    title: "Each ending lands on its own terminal - the three cooldowns are not interchangeable",
    expectation:
      "Silence winds down to 'released' and its 30-day rediscovery cooldown. 'Not feeling it' lands on 'suppressed' and holds the pair apart for 90 days. A block or a ban lands on 'expired', which is permanent. A wrong terminal is a wrong cooldown, so each is asserted by name.",
    // The board cannot know which door was used, but it can cross-check the
    // terminal against the evidence each door leaves behind - a suppression row,
    // a block row, a ban flag - which is the whole invariant.
    state:
      !mutual || mutual.status === "active" || mutual.status === "connected"
        ? "waiting"
        : blocked || bannedEither
          ? mutual.status === "expired" && !livePlan && !anyPending
            ? "done"
            : "broken"
          : suppressedUntil
            ? mutual.status === "suppressed"
              ? "done"
              : "broken"
            : mutual.status === "released" && !anyPending
              ? "done"
              : "broken",
    detail:
      !mutual || mutual.status === "active" || mutual.status === "connected"
        ? "No ending reached yet. Drive each door on a fresh pair - the terminals only mean anything against the evidence beside them."
        : `mutual ${mutual.status} / ${mutual.coordState} · suppression ${suppressedUntil ? suppressedUntil.slice(0, 10) : "none"} · block ${blocked ? "yes" : "no"} · ban ${bannedEither ? "yes" : "no"} · clock ${clockRanOut ? "elapsed" : "live"}`,
  });

  return rows;
}
