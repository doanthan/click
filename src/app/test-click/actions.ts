"use server";

import { revalidatePath } from "next/cache";
import {
  blockUser,
  confirmProposal,
  createUserClickForSession,
  declineProposalForSession,
  expireClickLifecycles,
  joinWaitlistTogetherForMutual,
  markMutualConnectedForSession,
  markMutualSeen,
  proposeAlternativeForProposal,
  registerForEvent,
  releaseMutualForSession,
  softReleaseMutualForSession,
  suggestPlanForMutual,
} from "@/lib/event-repository";
import {
  assertHarnessAllowed,
  fillEventToCapacity,
  harnessSession,
  leaveFixtureEvent,
  listHarnessPeople,
  otherPeopleFor,
  pickOutsider,
  resetPair,
  windBackClock,
  type ClockTarget,
} from "@/lib/click-test-harness";
import { refreshClickFixtures } from "@/lib/click-test-fixtures";
import {
  appendHarnessLog,
  clearHarnessLog,
  diffSnapshots,
  ruleFor,
  snapshotPair,
  type PairSnapshot,
} from "@/lib/click-test-log";
import { POST_EVENT_CLICK_CAP } from "@/lib/clicks/constants";

/**
 * Every button on the harness lands here.
 *
 * One action, one `step` string, because the harness is a driver and not a
 * product surface: a dozen near-identical server actions would be a dozen places
 * to forget the gate. `harnessSession()` runs the production check, the
 * QA-unlock check and the `@click.local` namespace check on EVERY call, so the
 * gate cannot be lost by adding a case to the switch below.
 *
 * Deliberately calls the repository functions the real surfaces call - not
 * hand-written SQL. A harness that writes its own rows tests the harness.
 *
 * Every step is bracketed by a snapshot of the pair's rows, so the log can say
 * what the step actually wrote. That is not decoration: §6.1 makes a send's reply
 * identical whether it formed a mutual click or did nothing at all, so the reply
 * can never be the record of what happened.
 */

export type HarnessResult = { ok: boolean; message: string };

function message(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === "string" && value) return value;
  }
  return "Something went wrong.";
}

/**
 * The gate that actually closed. Every §6.1 receiver-state refusal throws the same
 * sentence on purpose and hangs the real cause on the error as `auditReason`
 * (notEligibleError, event-repository.ts:8756), where only the server can read it.
 */
function auditReason(error: unknown): string | null {
  const value = (error as { auditReason?: unknown })?.auditReason;
  if (typeof value === "string" && value) return value;
  const name = (error as { name?: unknown })?.name;
  return typeof name === "string" && name && name !== "Error" ? name : null;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function harnessAction(
  _prev: HarnessResult,
  form: FormData,
): Promise<HarnessResult> {
  const step = text(form, "step");
  const actorEmail = text(form, "actor");
  const aEmail = text(form, "a");
  const bEmail = text(form, "b");
  const started = Date.now();

  // The gate, once, before anything - not per case.
  //
  // src/proxy.ts already 404s /test-click on a production deployment, and a
  // server action POSTs to the page's own path, so the edge closes this route to
  // the internet. That is one layer, and it is the layer furthest from the code:
  // every case below writes to the database, and `run_sweep` in particular calls
  // the lifecycle cron body with no session of its own. Put the check here and a
  // case added later cannot be the one that forgets it.
  try {
    await assertHarnessAllowed();
  } catch (error) {
    return { ok: false, message: message(error) };
  }

  if (step === "clear_log") {
    clearHarnessLog();
    revalidatePath("/test-click");
    return { ok: true, message: "Log cleared." };
  }

  // Both ids up front so the before/after snapshots bracket the step itself and
  // not the lookup. A step with no pair loaded still runs; it just logs no diff.
  const people = await listHarnessPeople();
  const a = people.find((person) => person.email === aEmail);
  const b = people.find((person) => person.email === bEmail);
  const names =
    a && b ? { aId: a.id, bId: b.id, aName: a.displayName, bName: b.displayName } : null;
  const before: PairSnapshot | null = names ? await snapshotPair(names.aId, names.bId) : null;

  let result: HarnessResult;
  let reason: string | null = null;
  try {
    result = { ok: true, message: await runStep(step, form) };
  } catch (error) {
    reason = auditReason(error);
    result = { ok: false, message: message(error) };
  }

  const after = names ? await snapshotPair(names.aId, names.bId) : null;
  const changes = before && after && names ? diffSnapshots(before, after, names) : [];
  appendHarnessLog({
    at: started,
    step,
    actor: actorEmail || null,
    // A step that reported success and wrote nothing is a no-op, not a pass, and
    // the mechanic has several deliberate ones (a repeat click, a click at someone
    // this pair is already mutual with). Naming it here is the whole point of the
    // diff - the response cannot say it without breaking §6.1.
    outcome: !result.ok ? "refused" : changes.length === 0 ? "noop" : "ok",
    message: result.message,
    reason,
    rule: ruleFor(reason, result.message),
    changes,
    late: [],
    ms: Date.now() - started,
    pairKey: names ? `${names.aId}:${names.bId}` : "-",
    snapshot: after,
  });

  revalidatePath("/test-click");
  return result;
}

async function runStep(step: string, form: FormData): Promise<string> {
  const actorEmail = text(form, "actor");
  const aEmail = text(form, "a");
  const bEmail = text(form, "b");
  const targetId = text(form, "target_id");
  const mutualId = text(form, "mutual_id");
  const proposalId = text(form, "proposal_id");
  const eventSlug = text(form, "event_slug");

  switch (step) {
    // --- fixtures + pair lifecycle ------------------------------------------
    case "refresh_fixtures": {
      const report = await refreshClickFixtures();
      return `Rebuilt ${report.length} fixture events relative to now.`;
    }
    case "reset_pair": {
      const cleared = await resetPair(aEmail, bEmail);
      return `Reset. ${cleared.join(" · ")}`;
    }
    case "run_sweep": {
      // The real cron body. Expiry, dormancy and the release notifications all
      // happen here - the harness never writes an expired state itself.
      await expireClickLifecycles();
      return "Lifecycle sweep run - clicks, mutual clicks and plans re-evaluated.";
    }
    case "wind_clock": {
      const target = text(form, "clock") as ClockTarget;
      return windBackClock(aEmail, bEmail, target);
    }
    case "fill_event": {
      return fillEventToCapacity(eventSlug, [text(form, "a_id"), text(form, "b_id")]);
    }
    case "leave_event": {
      return leaveFixtureEvent(actorEmail, eventSlug);
    }

    // --- the send layer ------------------------------------------------------
    case "send_discovery": {
      await createUserClickForSession({ clickedProfileId: targetId }, await harnessSession(actorEmail));
      // NOTE the deliberate silence. §6.1 makes this response byte-identical
      // whether or not it completed a mutual click, so the harness cannot report
      // one here either - watch the log's row diff for that, exactly like the real
      // client has to watch its own surfaces.
      return "Click sent. The response says nothing about whether it was mutual - by design. The log shows what was written.";
    }
    case "send_post_event": {
      await createUserClickForSession(
        { clickedProfileId: targetId, sourceEventId: eventSlug },
        await harnessSession(actorEmail),
      );
      // Deliberately does not claim a row was written. A pair who are ALREADY
      // mutual are a documented no-op (rule 6), and the send answers exactly as it
      // would have if it had landed.
      return "Post-event send accepted. The log says whether a row landed - an already-mutual pair is a deliberate no-op.";
    }
    case "send_self": {
      await createUserClickForSession({ clickedProfileId: targetId }, await harnessSession(actorEmail));
      return "A self-click was accepted, which it never should be.";
    }
    case "spend_post_event_budget": {
      // Spends the per-event budget with the REAL send, at other QA people, so the
      // cap refusal that follows is the mechanic's own and not a written row.
      const session = await harnessSession(actorEmail);
      const others = await otherPeopleFor(actorEmail, [aEmail, bEmail], POST_EVENT_CLICK_CAP);
      if (others.length < POST_EVENT_CLICK_CAP) {
        throw new Error(
          `Need ${POST_EVENT_CLICK_CAP} other eligible QA people to spend the budget; found ${others.length}.`,
        );
      }
      for (const person of others) {
        await createUserClickForSession(
          { clickedProfileId: person.id, sourceEventId: eventSlug },
          session,
        );
      }
      return `Budget spent at ${others.map((person) => person.displayName).join(", ")}. The next click at this event must refuse.`;
    }

    // --- the reveal ----------------------------------------------------------
    case "mark_seen": {
      const marked = await markMutualSeen(await harnessSession(actorEmail), mutualId);
      return marked
        ? "Reveal marked seen. It is once per person, forever - it will not show again."
        : "Nothing to mark - this person had already seen it, and seeing it twice is not a thing.";
    }

    // --- coordination --------------------------------------------------------
    case "suggest": {
      await suggestPlanForMutual(await harnessSession(actorEmail), mutualId, eventSlug);
      return `Suggested ${eventSlug}.`;
    }
    case "counter": {
      await proposeAlternativeForProposal(await harnessSession(actorEmail), proposalId, eventSlug);
      return `Countered with ${eventSlug}. The previous plan is re-pointed, not declined.`;
    }
    case "confirm": {
      await confirmProposal(await harnessSession(actorEmail), proposalId);
      return "Plan confirmed. Both sides still have to take a seat.";
    }
    case "outsider_confirm": {
      // A third person tries to act on a mutual click they are not part of.
      const outsider = await pickOutsider(aEmail, bEmail);
      await confirmProposal(await harnessSession(outsider.email), proposalId);
      return `${outsider.displayName} confirmed a plan they are not part of, which must never happen.`;
    }
    case "decline": {
      await declineProposalForSession(await harnessSession(actorEmail), proposalId);
      return "Plan declined. The mutual click is untouched and the pair is back to open.";
    }
    case "rsvp": {
      await registerForEvent(eventSlug, await harnessSession(actorEmail));
      return `Seat taken on ${eventSlug}.`;
    }
    case "waitlist_together": {
      await joinWaitlistTogetherForMutual(await harnessSession(actorEmail), mutualId);
      return "Both people queued on the waitlist together.";
    }
    case "mark_connected": {
      await markMutualConnectedForSession(await harnessSession(actorEmail), mutualId);
      return "Marked connected - the mutual click reached its successful terminal.";
    }

    // --- the endings ---------------------------------------------------------
    // The two exits, and the naming in the repository is the opposite way round
    // from what the names suggest - so these follow the PRODUCT's controls, which
    // is what a tester is here to check:
    //   releaseMutualForSession     = the drawer's "Not feeling it" (B7.1) -
    //                                 status 'suppressed' + a 90-day pair row.
    //   softReleaseMutualForSession = the quieter "set it down" - status
    //                                 'released' / 'dormant', NO suppression row,
    //                                 and only the 30-day rediscovery cooldown.
    case "soft_release": {
      await softReleaseMutualForSession(await harnessSession(actorEmail), mutualId);
      return "Set down quietly. Silent to the other person, no 90-day suppression - just the shorter rediscovery cooldown.";
    }
    case "release": {
      await releaseMutualForSession(await harnessSession(actorEmail), mutualId);
      return "Not feeling it. Silent to the other person, and the pair is held apart for 90 days.";
    }
    case "block": {
      await blockUser(await harnessSession(actorEmail), targetId);
      return "Blocked. The teardown severs the mutual click and any live plan with it.";
    }

    default:
      throw new Error(`Unknown step "${step}".`);
  }
}
