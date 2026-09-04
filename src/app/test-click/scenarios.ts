import type { PairState } from "@/lib/click-test-harness";

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

export function buildScenarios(pair: PairState): Scenario[] {
  const { a, b, clicks, mutual, proposal, viewA, viewB, suppressedUntil, blocked } = pair;
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

  rows.push({
    id: "duplicate-send",
    stage: "1 · Private send",
    title: "Re-sending the same click is a quiet no-op",
    expectation: "A second click at the same person on the same surface spends no budget and errors on nothing.",
    state: "drive",
    detail: "Press the same send button twice - the second must succeed and add no second row.",
  });

  // ---- Stage 2: the mutual --------------------------------------------------
  const mutualActive = mutual?.status === "active";
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

  rows.push({
    id: "reveal-once",
    stage: "2 · Mutual",
    title: "The reveal is once per person, forever",
    expectation: "Marking it seen is permanent for that side and does not touch the other side's.",
    state: !mutual ? "waiting" : mutual.seenByA || mutual.seenByB ? "done" : "waiting",
    detail: mutual
      ? `seen by ${a.displayName}: ${mutual.seenByA ? "yes" : "no"} · seen by ${b.displayName}: ${mutual.seenByB ? "yes" : "no"}`
      : "Form a mutual first.",
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

  const bothSeated = seat(entryA?.viewerHasSeat) && seat(entryB?.viewerHasSeat);
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
    state:
      mutual?.status === "released"
        ? suppressedUntil
          ? "broken"
          : "done"
        : "waiting",
    detail:
      mutual?.status === "released"
        ? `released / ${mutual.coordState}; suppression row: ${suppressedUntil ? "present - it should not be" : "none, correct"}.`
        : "Form a mutual, then press 'Set it down' on one side.",
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
    expectation: "The mutual leaves 'active' on its own clock without either side doing anything.",
    state: mutual && (mutual.status === "expired" || mutual.status === "released") ? "done" : "waiting",
    detail: mutual
      ? `mutual is ${mutual.status}.`
      : "Form a mutual, wind the mutual clock back, then run the sweep.",
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
    expectation: "The mutual leaves 'active' and any live plan goes with it.",
    state: blocked ? (mutual && mutual.status === "active" ? "broken" : "done") : "waiting",
    detail: blocked
      ? `blocked; mutual is ${mutual?.status ?? "gone"}.`
      : "Form a mutual and a plan, then block from one side.",
  });

  return rows;
}
