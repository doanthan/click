"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/ds-client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PAIR_SUPPRESSION_DAYS } from "@/lib/clicks/constants";
import { APP_TIME_ZONE } from "@/lib/datetime";
import { Icon, TagRow } from "./ds";
import { EventImage } from "./event-image";
import {
  confirmProposalAction,
  declineProposalAction,
  joinWaitlistTogetherAction,
  markMutualConnectedAction,
  markMutualSeenAction,
  proposeAlternativeAction,
  releaseMutualAction,
  softReleaseMutualAction,
  suggestPlanAction,
  type ProposalActionState,
} from "@/app/proposals/actions";
import type { ProposalCatalogueEvent, ProposalEntry } from "@/lib/event-repository";
import { RevealStep, revealedThisSession } from "./mutual-reveal";

// COORDINATION_MODAL_SYSTEM: the entire coordination sequence - reveal → suggest →
// waiting → both going, plus recovery/terminal states - is ONE stepped modal over the
// current page (§1). Steps advance IN PLACE, never a route change (§5 QA). The drawer is
// a PURE projection of the live entry's coord_state/proposal (§2): a successful action
// revalidates /proposals and the fresh entry flows back in from ClicksList - or, over
// any other page, MutualRevealHost re-reads the mutual when `onChanged` fires - and the
// step re-projects, so fresh server state DRIVES the advance instead of a local override.
// §5 freeze-safety: every entrance here is transform-only (.ck-coord-enter on the card,
// .ck-coord-step on each step's body, .ck-coord-pop on the reveal disc), so the resting
// state is visible at every frame and nothing is gated on an animation finishing. The
// panel still mounts once per open - both hosts key it on the mutual id. Reduced-motion
// is the global handler.

const INITIAL: ProposalActionState = { ok: false, error: null };

const longDate = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

// The card mini's date line (S5/S7), in the zone every event is authored in - the
// canonical card formats on the server in Sydney time, so this must not drift to
// whatever zone the device happens to be in.
const cardWhen = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

// Google Calendar template link (§8: confirmed_together → Add to calendar). We only
// store a start, so default a 2h block. Client-only; no ics dependency (ponytail).
function gcalUrl(title: string, startIso: string | null): string | null {
  if (!startIso) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) => `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title,
  )}&dates=${fmt(start)}/${fmt(end)}`;
}

// Stage 6: the RSVP control deep-links to the real Event Detail page carrying the
// plan context (`planWith`) and where to come back to, so a confirmed booking
// returns the pair to the drawer at S11 instead of a receipt page. The drawer only
// mints the link; the event page reads it.
function planBookingHref(entry: ProposalEntry): string {
  const back = `/proposals?open=${entry.mutualId}`;
  return `/events/${entry.suggestedEventSlug}?planWith=${entry.otherId}&return=${encodeURIComponent(back)}`;
}

type Step =
  | "reveal"
  | "open"
  | "proposed"
  | "confirmed"
  | "gone"
  | "connected"
  | "released"
  | "partner-cancelled";

// Projection from the entry. CLICK_COORDINATION_SCREENS Part 7 is explicit that a
// mutual has TWO orthogonal fields and that the drawer must read `status` FIRST,
// then `coord_state` only while active - "do not collapse them into one enum, that
// is the exact bug this table exists to prevent".
//
// It had been collapsed. Everything keyed off the click_proposals row, so:
//   - `connected` (the success terminal) and `released` (seven days of silence)
//     both arrived as isExpired and rendered the SAME release copy, telling a pair
//     who had just gone out together that it "didn't turn into a night out";
//   - `confirmed_together` reached any way other than the proposal-accept tap - i.e.
//     every pair who each booked the same night independently, which §B5.3 says
//     must fire "however they both got there" - rendered the suggest step.
//
// `gone` = C12: an agreed event that genuinely died (cancelled, or the row is
// missing). A plan does NOT become `gone` because the night started or the event
// sold out - that used to key off the mere absence of a slug, so every successful
// plan flipped to "that plan fell through" at the moment it was happening.
function projectStep(entry: ProposalEntry): Exclude<Step, "reveal"> {
  // AXIS 1 first.
  if (entry.mutualStatus === "connected") return "connected";
  if (entry.mutualStatus !== "active") return "released";
  // S18 before the clock: the mutual is deliberately still active here (§B5.6 step
  // 2 leaves status alone), so this has to be read before isExpired or the survivor
  // would fall through to the release shelf.
  if (entry.partnerCancelled) return "partner-cancelled";
  if (entry.isExpired) return "released";

  // AXIS 2, within active. coord_state owns the win state - not the proposal row,
  // which does not exist for an independently-booked pair.
  const bothGoing = entry.coordState === "confirmed_together" || entry.status === "confirmed";
  if (bothGoing) {
    return entry.suggestedEventSlug && !entry.suggestedEventCancelled ? "confirmed" : "gone";
  }
  return entry.coordState === "proposed" ? "proposed" : "open";
}

/**
 * The safety exit, and the ONE control here the shared SubmitButton cannot
 * cover: it is a quiet underlined link by design, not a ck-btn, and
 * SubmitButton wraps the DS Button. It still reads the release form's pending
 * state, so it has to live inside that form.
 *
 * Not a submit: it opens the confirm first, and the dialog submits the form.
 */
function ReleaseControl({ onRequest }: { onRequest: () => void }) {
  const { pending } = useFormStatus();
  // inline-flex + min-h-11 is for the thumb only: a bare 13px line box is ~20px tall.
  // The box grows rather than wearing an overlaid .ck-taplink band, because its row-mate
  // (report or block) is the same species of control - wrapped, two bands would overlap.
  return (
    <button
      type="button"
      onClick={() => {
        if (!pending) onRequest();
      }}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)] aria-disabled:opacity-50"
    >
      {/* "Ending…" - this ends the plan on BOTH sides; it still sends nothing to
          them. Not "Sending…", which on the safety exit implied a message had
          gone to the other person: the exact fear that stops people using it.
          Not "Hiding…" either - that implied the plan lived on for them, which
          releaseMutualForSession has never done. It writes only to clicks,
          mutual_clicks and pair_suppressions: no seat, no payment, which is why
          the dialog can promise the booking survives. */}
      {pending ? "Ending…" : "Not feeling it"}
    </button>
  );
}

/**
 * The OTHER exit, and the quieter one. "Not feeling it" above holds the pair
 * apart for PAIR_SUPPRESSION_DAYS and keeps them off every shelf; this one just
 * sets the click down - status='released', which lands the pair on Past clicks
 * as S16 "Still out there", neutral accent, still re-clickable. Both are silent:
 * softReleaseMutualForSession writes no pair_suppressions row and emits nothing,
 * so the other side is told nothing either way.
 *
 * A plain submit, unlike ReleaseControl, which opens a confirm first. A rest is
 * picked back up; a 90-day suppression is not, so only the harder door asks.
 */
function SoftReleaseControl() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)] disabled:opacity-50"
    >
      {/* "Resting…", never "Ending…": S16 is not a terminal verdict, and it is
          not a peak either - no ✨, no confetti, no blame anywhere on this path. */}
      {pending ? "Resting…" : "Let this one rest"}
    </button>
  );
}

type CoordinationDrawerProps = {
  entry: ProposalEntry;
  catalogue: ProposalCatalogueEvent[];
  onClose: () => void;
  // Fired when any action lands. Only a drawer opened OFF /proposals needs it: every
  // action revalidates that one path, so anywhere else the host has to re-read.
  onChanged?: () => void;
};

// Never emits: "is this the client" does not change once hydration is over.
const subscribeNever = () => () => {};

// The panel mounts only once the page is hydrated. ClicksList seeds its open row
// from ?open=<mutualId>, so a deep link into /proposals - which is exactly what
// every mutual notification and the "it's mutual" email link to - renders this on
// the server, where createPortal's document.body target does not exist.
//
// A `typeof document` guard fixed the server throw and broke hydration instead: the
// server sent nothing here, the first client render sent the portal, and React
// tried to hydrate the drawer against the list's <ul> - "Hydration failed", the
// whole route regenerated on the client. The server snapshot below is what React
// also reads while hydrating, so that first pass matches the server's null and the
// panel mounts on the very next one. An open from a row tap reads the client
// snapshot straight away. One unconditional hook, so hook order never changes.
export function CoordinationDrawer(props: CoordinationDrawerProps) {
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (!hydrated) return null;
  return <CoordinationDrawerPanel {...props} />;
}

function CoordinationDrawerPanel({
  entry,
  catalogue,
  onClose,
  onChanged,
}: CoordinationDrawerProps) {
  const [confirmState, confirmAction] = useActionState(confirmProposalAction, INITIAL);
  const [declineState, declineAction] = useActionState(declineProposalAction, INITIAL);
  const [proposeState, proposeAction] = useActionState(proposeAlternativeAction, INITIAL);
  const [suggestState, suggestAction] = useActionState(suggestPlanAction, INITIAL);
  const [releaseState, releaseAction] = useActionState(releaseMutualAction, INITIAL);
  const [softReleaseState, softReleaseAction] = useActionState(softReleaseMutualAction, INITIAL);
  const [connectedState, connectedAction] = useActionState(markMutualConnectedAction, INITIAL);
  // S14's second exit. The success flag lives HERE rather than in the projection
  // because joining the list changes no server state the drawer projects - the
  // event is still full, so a revalidated entry still reads as S14. The panel
  // mounts once per mutual (ClicksList keys it), so S14w holds until it closes.
  const [waitlistState, waitlistAction] = useActionState(joinWaitlistTogetherAction, INITIAL);

  // Off /proposals nothing revalidates this entry, so the host is told when any action
  // lands and re-reads the mutual. Through a ref, so a fresh callback on every host
  // render can never re-fire the effect on its own.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });
  useEffect(() => {
    const landed = [
      confirmState,
      declineState,
      proposeState,
      suggestState,
      releaseState,
      softReleaseState,
      connectedState,
      waitlistState,
    ].some((state) => state.ok);
    if (landed) onChangedRef.current?.();
  }, [
    confirmState,
    declineState,
    proposeState,
    suggestState,
    releaseState,
    softReleaseState,
    connectedState,
    waitlistState,
  ]);

  // S5 as a sub-flow: "Suggest something else" (S7), "Find another together" (S14,
  // S18) and "Suggest another plan" drop into the suggest card in place of the face
  // they came from. On `open` the card IS the step, so it needs no flag.
  const [planning, setPlanning] = useState(false);

  // S7's one tap (CLICK_COORDINATION_SCREENS S7 -> S8): "I'm in · RSVP" agrees the plan
  // AND carries on to the real event page to book - the RSVP is half the label, so it
  // must not wait behind a second tap. Only when THIS tap agreed it (a plan that
  // lapsed as it waited agrees nothing) and only for someone still without a seat:
  // "I'm in" on a ticket they already hold goes nowhere. Both hosts close the drawer
  // on the way out (ClicksList unmounts, MutualRevealHost resets on the new path).
  const router = useRouter();
  const rsvpHandled = useRef<ProposalActionState | null>(null);
  useEffect(() => {
    if (!confirmState.confirmed || rsvpHandled.current === confirmState) return;
    rsvpHandled.current = confirmState;
    if (!entry.viewerHasSeat && entry.suggestedEventSlug) router.push(planBookingHref(entry));
  }, [confirmState, entry, router]);

  // §4: the reveal is decided ONCE, as the drawer opens, and then held until the person
  // moves on from it. Latched rather than re-derived from entry.revealSeen: the stamp
  // below lands while the reveal is on screen, and a revalidation carrying it must not
  // yank the moment out from under them mid-read. Never on a terminal mutual.
  const [revealOpen, setRevealOpen] = useState(() => {
    const opening = projectStep(entry);
    return (
      !entry.revealSeen &&
      !revealedThisSession.has(entry.mutualId) &&
      opening !== "released" &&
      opening !== "connected"
    );
  });
  // Seen the moment it SHOWS, not when it closes. Stamping on the way out left one
  // hole: a reload, a closed tab or a dropped connection with the reveal up played it
  // all over again. markMutualSeen is idempotent (its WHERE only matches while the
  // viewer's seen_at is null), so Strict Mode's double effect is a no-op.
  useEffect(() => {
    if (!revealOpen) return;
    revealedThisSession.add(entry.mutualId);
    void markMutualSeenAction(entry.mutualId); // persist for reload / other devices
  }, [revealOpen, entry.mutualId]);

  const [confirmRelease, setConfirmRelease] = useState(false);
  // The Escape/Tab handler below is document-level and mount-scoped, so it would
  // fight the ConfirmDialog that portals ON TOP of this drawer: Escape would
  // close the whole drawer instead of the confirm, and Tab would yank focus back
  // out of it. A ref rather than state, so the handler never needs re-binding.
  const confirmOpenRef = useRef(false);
  function openReleaseConfirm(next: boolean) {
    confirmOpenRef.current = next;
    setConfirmRelease(next);
  }

  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const releaseFormRef = useRef<HTMLFormElement>(null);
  // Escape has to run the SAME close as ✕ and the scrim (which stamps reveal_seen),
  // but the handler below is deliberately mount-scoped - rebinding it on every step
  // change would re-run the focus grab and re-capture previouslyFocused. So the
  // handler reads the current close from a ref instead of closing over it.
  const closeStepRef = useRef<() => void>(() => {});

  // When a successful action revalidates /proposals, close the suggest card after the
  // fresh server state renders so local UI never fights the server truth.
  const sig = `${entry.status}|${entry.coordState}|${entry.suggestedEventSlug ?? ""}|${entry.suggestedEventJoinable}`;
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlanning(false));
    return () => window.cancelAnimationFrame(frame);
  }, [sig]);

  // Focus, Escape, scroll-lock, focus-trap - mount-scoped (panel mounts once per open,
  // ClicksList keys it on the mutual id). Same proven shell as confirm-dialog.tsx.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const raf = window.requestAnimationFrame(() => cardRef.current?.focus());

    function onKey(e: KeyboardEvent) {
      // While the release confirm is up it owns the keyboard - see openReleaseConfirm.
      if (confirmOpenRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeStepRef.current();
        return;
      }
      if (e.key === "Tab") {
        const card = cardRef.current;
        if (!card) return;
        const focusables = Array.from(
          card.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!card.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
    // Genuinely empty, and it has to stay that way. `onClose` is never read in
    // here - Escape routes through closeStepRef precisely so this effect can be
    // mount-scoped - but it sat in the dep array anyway, and ClicksList hands
    // down a fresh inline arrow every render. Every step-advancing action
    // revalidates /proposals, so each advance re-ran the effect: the cleanup
    // fired `previouslyFocused.focus()`, parking focus on the ClickRow trigger
    // BEHIND an open aria-modal dialog, and flipped body overflow back and
    // forth. Part C6's "focus returns to the trigger" is an on-CLOSE promise,
    // not a per-render one.
  }, []);

  const base = projectStep(entry);
  // Reveal fires once per user per mutual (§4). Skip on a dead/terminal mutual.
  const step: Step = revealOpen && base !== "released" && base !== "connected" ? "reveal" : base;

  // "Suggest a plan" on the reveal carries on to the suggest step, in place (§1).
  const dismissReveal = useCallback(() => setRevealOpen(false), []);

  // THE #1 behaviour bug class (§4) was a reveal that only its primary CTA persisted,
  // so anyone who closed it instead - "Maybe later", ✕, the scrim, Escape - had it
  // fired at them again on every entry point, on every device. The stamp now lands as
  // the reveal shows (above), so every way out is simply the close.
  const closeStep = onClose;
  // In an effect, not during render: a ref write during render is a lint error and
  // genuinely unsafe under concurrent rendering. The keydown listener only ever
  // fires after paint, so an effect is early enough for it.
  useEffect(() => {
    closeStepRef.current = closeStep;
  }, [closeStep]);

  const firstName = entry.otherName.split(/\s+/)[0];
  // An open mutual with no live plan → a FRESH suggestion keyed on the mutual
  // (suggestPlanAction). A live pending plan is re-pointed instead (proposeAlternative,
  // which owns the 3-alt cap).
  // A FRESH suggestion keyed on the mutual (suggestPlanAction) vs re-pointing a
  // LIVE plan (proposeAlternative, which owns the 3-alt cap). S18 belongs to the
  // first group: §B5.6 put the pair back at coord_state='open' and retired the
  // proposal, so there is no live plan to re-point - passing its terminal id to
  // proposeAlternative would just fail.
  const freshSuggest = (step === "open" && !entry.id) || step === "partner-cancelled";

  // What the suggest card opens on. On `open` that is Click's pick for the pair, while
  // it can still be joined; from any other step the plan on the table is the one being
  // replaced, so the card opens on Click's matched picks instead.
  const suggestIsStep = step === "open" && !entry.suggestionUnavailable;
  const planner =
    suggestIsStep || planning ? (
      <SuggestPlan
        entry={entry}
        catalogue={catalogue}
        titleId={titleId}
        firstName={firstName}
        initial={suggestIsStep && entry.suggestedEventJoinable ? entry.suggestedEventCard : null}
        leadIn={suggestIsStep && entry.planLapsed}
        formAction={freshSuggest ? suggestAction : proposeAction}
        hidden={
          freshSuggest ? (
            <input type="hidden" name="mutual_id" value={entry.mutualId} />
          ) : (
            <input type="hidden" name="proposal_id" value={entry.id} />
          )
        }
        error={(freshSuggest ? suggestState : proposeState).error}
        onBack={suggestIsStep ? undefined : () => setPlanning(false)}
      />
    ) : null;

  // z-110, not 130. The drawer is the BASE surface here, and its own safety confirm
  // goes through ModalShell at 120 - as siblings under body, a drawer at 130 painted
  // over the very dialog it had just opened. The confirm was there (focus was in it,
  // Escape reached it) but invisible, and a click on anything you could see landed on
  // the drawer's scrim and closed the whole thing - on the "Not feeling it" control,
  // the most loaded one on the screen. Scale in use: explorer 70, booking/detail 100,
  // drawer 110, confirm 120, checkout 140, login 200.
  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={closeStep}
        className="absolute inset-0 cursor-default bg-[color:var(--surface-deep)]/45 backdrop-blur-[2px]"
      />
      <div
        ref={cardRef}
        tabIndex={-1}
        className="ck-coord-enter relative z-10 max-h-[92dvh] w-full max-w-[540px] overflow-y-auto rounded-t-[24px] bg-[color:var(--paper)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] outline-none sm:rounded-[24px] sm:p-7"
      >
        <button
          type="button"
          onClick={closeStep}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lav-bg)] hover:text-[color:var(--ink)]"
        >
          <span aria-hidden className="text-lg leading-none">
            ✕
          </span>
        </button>

        {/* key={step} gives each step its own body, so every advance arrives with a
            small rise - the one flow in this surface that genuinely steps was the
            one that never felt like it was stepping. It is that step's MOUNT, not
            a replay on a re-render, and .ck-coord-step moves it without ever
            touching opacity, so no step can be caught invisible (§5). */}
        <div key={step} className="ck-coord-step">
          {step === "reveal" ? (
            <RevealStep
              entry={entry}
              titleId={titleId}
              onSuggest={dismissReveal}
              onLater={closeStep}
            />
          ) : (
            <CoordinationBody
              entry={entry}
              step={step}
              titleId={titleId}
              firstName={firstName}
              confirmAction={confirmAction}
              declineAction={declineAction}
              confirmError={confirmState.error}
              declineError={declineState.error}
              onPlan={() => setPlanning(true)}
              onDone={closeStep}
              planner={planner}
              waitlistAction={waitlistAction}
              waitlistError={waitlistState.error}
              waitlistJoined={waitlistState.ok}
            />
          )}
        </div>

        {/* SAFE-08: an in-flow safety exit at every step that still HAS a plan to
            end - block always remains. Not on either TERMINAL step: there is nothing
            left to release there, releaseMutualForSession matches status='active'
            only, and the confirm had already promised a 90-day suppression that
            the throw meant was never written. Report or block stays, and is the
            control that actually does something on a click that has run out.

            And not under the REVEAL: it is the one-time moment, not the click detail
            view §B7.1 puts these controls in, and §4 gives it one action - "Suggest a
            plan" - plus the quiet "Maybe later" / "How clicking works". Every one of
            these is a step away, and the reveal reads the same wherever it plays. */}
        {step !== "reveal" ? (
          <div className="mt-6 border-t border-[color:var(--line-soft)] pt-4">
            {/* §B7.1: the closure ritual sits beside the two exits, and it is the
                only one of the three that is a WIN - so it leads, and it is a real
                button rather than a quiet link. There is deliberately no "it didn't
                work" counterpart: Click never shows a verdict.

                S12: it is the AFTER-the-night affordance for a pair who had a plan
                (CLICK_COORDINATION_SCREENS S12; state table row "post-event"). Offered
                from the first step, it let either of them close a live mutual as
                "connected" before the two had ever met - so it waits until the
                plan's night has started. */}
            {step === "confirmed" && entry.suggestedEventStarted ? (
              <form action={connectedAction} className="mb-4">
                <input type="hidden" name="mutual_id" value={entry.mutualId} />
                <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
                  We clicked 👍
                </SubmitButton>
                {connectedState.error ? (
                  <p role="alert" className="mt-2 text-xs font-medium text-[color:var(--danger)]">
                    {connectedState.error}
                  </p>
                ) : null}
              </form>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {step !== "released" && step !== "connected" ? (
                // Two doors out, deliberately unequal in weight and both quiet: the
                // 90-day removal, and the neutral rest that leaves the pair
                // re-clickable. Same gate as the release - there is nothing left to
                // set down on either terminal step, and softReleaseMutualForSession
                // matches status='active' only.
                <div className="flex flex-wrap items-center gap-4">
                  <form ref={releaseFormRef} action={releaseAction}>
                    <input type="hidden" name="mutual_id" value={entry.mutualId} />
                    <ReleaseControl onRequest={() => openReleaseConfirm(true)} />
                  </form>
                  <form action={softReleaseAction}>
                    <input type="hidden" name="mutual_id" value={entry.mutualId} />
                    <SoftReleaseControl />
                  </form>
                </div>
              ) : null}
              <Link
                href={`/profile/${entry.otherId}#safety`}
                className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]"
              >
                Report or block {firstName}
              </Link>
            </div>
            {releaseState.error || softReleaseState.error ? (
              <p role="alert" className="mt-2 text-xs font-medium text-[color:var(--danger)]">
                {releaseState.error ?? softReleaseState.error}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* A native window.confirm used to land an OS-chrome grey box on top of
            this card, in a font the DS does not own, inside an active focus
            trap - on the most emotionally loaded control on the screen. */}
        <ConfirmDialog
          open={confirmRelease}
          title={`End this click with ${firstName}?`}
          description={
            `This ends the plan for both of you. ${firstName} isn't told, and no message is sent - ` +
            `the plan simply stops showing for you both. Click won't suggest either of you to the ` +
            `other for the next ${PAIR_SUPPRESSION_DAYS} days. Any seat you've already booked ` +
            `stays booked.`
          }
          confirmLabel="End this click"
          cancelLabel="Keep it"
          tone="rose"
          onConfirm={() => {
            openReleaseConfirm(false);
            // requestSubmit fires a real submit event, so React runs the form's
            // server action exactly as a click on a submit button would.
            releaseFormRef.current?.requestSubmit();
          }}
          onCancel={() => openReleaseConfirm(false)}
        />
      </div>
    </div>,
    document.body,
  );
}

// S5b - the own-event picker, a sub-step rather than a second modal. Runbook C5
// regression 3 is the one this screen actually shipped: it filtered the whole
// catalogue on every keystroke. So the two arms are binding, and they are:
//
//   * NO query - the three curated sections (`Events you're going to` / `Saved` /
//     `You'd both like`) the page already fetched with getProposalCatalogue(session).
//     Zero requests. Not "a request we happen to cache" - none is issued at all.
//   * A query - one debounced GET to /api/events/suggestions, capped at 20 rows by
//     the server, rendered as the flat list a search is.
//
// Never the whole catalogue in either arm: picking a night for two people out of a
// scroll of sixty is not a decision anyone makes well.
const PICKER_DEBOUNCE_MS = 250;

// The section labels are locked (CLICK_UIUX_SPEC §6.2 / S5b) and this array is
// also their order - the picker opens on the events the viewer is already going to.
const CURATED_SECTIONS = ["Events you're going to", "Saved", "You'd both like"] as const;

function PlanPicker({
  catalogue,
  firstName,
  titleId,
  onPick,
  onBack,
}: {
  catalogue: ProposalCatalogueEvent[];
  firstName: string;
  titleId: string;
  onPick: (event: ProposalCatalogueEvent) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  // ONE piece of search state: the rows, and the query they answer. "The list on
  // screen is stale" is then derivable, instead of a second in-flight flag that
  // can disagree with it mid-keystroke.
  const [found, setFound] = useState<{ q: string; rows: ProposalCatalogueEvent[] } | null>(null);
  const searchId = useId();
  const q = query.trim();

  useEffect(() => {
    // C5 regression 3, the load-bearing half: an empty query issues NO request.
    // The curated sections below are already in hand from the server render.
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/events/suggestions?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { events: [] }))
        .then((body: { events?: ProposalCatalogueEvent[] }) =>
          setFound({ q, rows: Array.isArray(body.events) ? body.events : [] }),
        )
        // Aborted by the next keystroke (the next fetch answers), or the network
        // is out. Swallowed either way: the row stays in its searching state
        // rather than the picker claiming no events match, which would be a
        // dead end invented out of a dropped request.
        .catch(() => {});
    }, PICKER_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const results = q && found?.q === q ? found.rows : null;
  const searching = Boolean(q) && !results;
  const sections = q
    ? null
    : CURATED_SECTIONS.map((label) => ({
        label,
        // The locked screen caps the general shelf at 4; the other two are the
        // viewer's own bookings and saves, which are theirs to see in full.
        rows: catalogue
          .filter((e) => e.section === label)
          .slice(0, label === "You'd both like" ? 4 : undefined),
      })).filter((section) => section.rows.length > 0);

  // A row is a CHOICE, not a send (S5b: "Picking a row returns to S5 with that event
  // in the card"). The card is where a plan gets looked at - photo, price, the full
  // details one tap away - before "Suggest this to [Name]" sends it; sending straight
  // out of a list of titles skipped the one look the spec builds S5 around.
  const row = (event: ProposalCatalogueEvent) => (
    <button
      key={event.slug}
      type="button"
      onClick={() => onPick(event)}
      className="flex w-full min-w-0 items-start gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left hover:bg-[color:var(--cream)] focus-visible:bg-[color:var(--lav-bg)]"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[color:var(--ink)]">
          {event.title}
        </span>
        <span className="block text-xs font-medium text-[color:var(--slate)]">
          {event.suburb} · {longDate.format(new Date(event.startsAt))}
        </span>
      </span>
    </button>
  );

  return (
    <div className="ck-coord-step">
      {/* S5b's back link - this is a sub-step of the suggest card, not a modal of
          its own, so the way out is back rather than cancel. */}
      <button
        type="button"
        onClick={onBack}
        className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
      >
        ‹ Back
      </button>
      <span className="eyebrow mt-2 block">Suggest a plan</span>
      <h2 id={titleId} className={headingClass}>
        Choose an event for {firstName}
      </h2>
      <label htmlFor={searchId} className="eyebrow mt-3 block">
        Search events
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search events"
        className="mt-2 h-11 w-full rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
      />

      <div className="mt-3 grid gap-3">
        {sections?.map((section) => (
          <div key={section.label}>
            <p className="eyebrow">{section.label}</p>
            <div className="mt-1 grid gap-1">{section.rows.map(row)}</div>
          </div>
        ))}
        {/* An empty catalogue is a normal launch-week state (nothing upcoming with
            room for two), not a broken picker - and search stays reachable, because
            "nothing curated" and "nothing at all" are different things. */}
        {sections?.length === 0 ? (
          <div>
            <p className="eyebrow">Nothing to suggest yet</p>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--slate)]">
              There&apos;s nothing upcoming with room for two right now. Search above, or
              have a look around - new events land all the time.
            </p>
            <Link href="/discover" className="ck-btn ck-btn--sm ck-btn--primary mt-3">
              <span className="ck-btn__label">Browse events</span>
            </Link>
          </div>
        ) : null}
        {searching ? (
          <p className="text-sm font-medium text-[color:var(--slate)]">Searching…</p>
        ) : null}
        {results ? <div className="grid gap-1">{results.map(row)}</div> : null}
        {/* The locked no-results line (S5b), verbatim. The banned "match" is the
            people one - "you and Mia matched"; this is a search reporting on a
            query string, and the lock spells it out this way on purpose. */}
        {results?.length === 0 ? (
          <p className="text-sm font-medium text-[color:var(--slate)]">
            No events match &quot;{q}&quot; - try another search.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// S5 - Suggest a plan (CLICK_COORDINATION_SCREENS S5 / S5b). The card IS the preview:
// one event at a time, drawn the way the canonical Event Card draws it, and sent with
// "Suggest this to [Name]". "Show another" cycles Click's matched picks for the pair -
// read once, from the same ranking the mutual's first pick came from - and "Suggest
// your own →" opens S5b, which comes BACK here with the chosen event in the card. With
// nothing to show, the same card stays actionable ("Pick something you'd both enjoy"),
// never an empty "nothing fits" screen (S17).
function SuggestPlan({
  entry,
  catalogue,
  titleId,
  firstName,
  initial,
  leadIn,
  formAction,
  hidden,
  error,
  onBack,
}: {
  entry: ProposalEntry;
  catalogue: ProposalCatalogueEvent[];
  titleId: string;
  firstName: string;
  initial: ProposalCatalogueEvent | null;
  leadIn: boolean;
  formAction: (payload: FormData) => void;
  hidden: React.ReactNode;
  error: string | null;
  onBack?: () => void;
}) {
  const [choosing, setChoosing] = useState(false);
  // The S5b choice, shown until "Show another" hands the card back to Click's picks.
  const [chosen, setChosen] = useState<ProposalCatalogueEvent | null>(null);
  // Click's matched picks: null until the one read lands.
  const [picks, setPicks] = useState<ProposalCatalogueEvent[] | null>(null);
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/clicks/picks?mutual=${encodeURIComponent(entry.mutualId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((body: { events?: ProposalCatalogueEvent[] }) =>
        setPicks(Array.isArray(body.events) ? body.events : []),
      )
      // A dropped read means no more picks, not an error: the card still sends what it
      // has, and "Suggest your own →" is always there.
      .catch(() => {
        if (!controller.signal.aborted) setPicks([]);
      });
    return () => controller.abort();
  }, [entry.mutualId]);

  // Click's pick first, then the rest of its matched picks - each night once.
  const pool = [initial, ...(picks ?? [])].filter(
    (event, index, all): event is ProposalCatalogueEvent =>
      event != null && all.findIndex((other) => other?.slug === event.slug) === index,
  );
  const current = chosen ?? (pool.length > 0 ? pool[turn % pool.length] : null);
  const loading = !current && picks === null;
  // Only when there IS another: from an S5b choice, any of Click's picks is one.
  const canShowAnother = chosen ? pool.length > 0 : pool.length > 1;

  function showAnother() {
    if (chosen) {
      setChosen(null);
      return;
    }
    setTurn((value) => (value + 1) % pool.length);
  }

  if (choosing) {
    return (
      <PlanPicker
        catalogue={catalogue}
        firstName={firstName}
        titleId={titleId}
        onPick={(event) => {
          setChosen(event);
          setChoosing(false);
        }}
        onBack={() => setChoosing(false)}
      />
    );
  }

  return (
    <div>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
        >
          ‹ Back
        </button>
      ) : null}
      <span className={`eyebrow block${onBack ? " mt-2" : ""}`}>Suggest a plan</span>
      {leadIn ? (
        // S15's soft lead-in, from §B4.2's own no-response nudge: the last plan ran
        // out unanswered, and this says so without saying so - no "expired", no
        // "missed", nothing about who didn't answer.
        <p className="mt-2 text-sm font-semibold text-[color:var(--ink-soft)]">
          Still keen to meet {firstName}? Here&apos;s what&apos;s on.
        </p>
      ) : null}
      {/* The suggest-STEP header (locked, S5) - a different element from the reveal's
          CTA, which is "Suggest a plan". */}
      <h2 id={titleId} className={headingClass}>
        Suggest something to do with {firstName}
      </h2>
      <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
        Pick something you&apos;d both enjoy - no back-and-forth, just a plan.
      </p>

      {current ? (
        <div className="mt-4">
          <PlanEventCard event={current} />
          {/* The reason line. Only ever what is true: "You're going to this" off the
              viewer's own seat, "You're both into this" only when the event carries
              an interest tag EACH of them holds - never on a pick of their own that
              Click knows nothing about. A plain dot, not a ✨ (peaks only). */}
          {current.viewerGoing ? (
            <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-[color:var(--sage-ink)]">
              <Icon name="check" size={14} stroke={2.6} className="mt-[3px] shrink-0" />
              You&apos;re going to this - once {firstName}&apos;s in, only they need to RSVP.
            </p>
          ) : current.bothInto ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--ink-soft)]">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--sage)]" />
              You&apos;re both into this - and it&apos;s nearby.
            </p>
          ) : null}
          {/* Previewable (S5): the real event page, with the way back to this drawer. */}
          <Link
            href={`/events/${current.slug}?planWith=${entry.otherId}&return=${encodeURIComponent(
              `/proposals?open=${entry.mutualId}`,
            )}`}
            className="ck-taplink mt-2 inline-flex text-[13px] font-semibold text-[color:var(--purple)] underline decoration-dotted underline-offset-2"
          >
            See full details →
          </Link>
          <form action={formAction} className="mt-5">
            {hidden}
            <input type="hidden" name="event_slug" value={current.slug} />
            {/* S5's primary. Naming the person is the point: it says plainly that
                this goes TO them and that they get to answer. */}
            <SubmitButton full pendingLabel="Sending…">
              Suggest this to {firstName}
            </SubmitButton>
          </form>
        </div>
      ) : loading ? (
        // The picks are one read away: hold the card's place, never a spinner.
        <div aria-hidden className="skeleton mt-4 h-[210px] rounded-[var(--radius-lg)]" />
      ) : (
        // S17 - nothing Click can pick yet, and still no dead end: the SAME card,
        // actionable, straight into S5b.
        <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-[color:var(--mist)] bg-[color:var(--cream)] p-5">
          <p className="font-display text-base font-semibold tracking-[-0.01em] text-[color:var(--ink)]">
            Pick something you&apos;d both enjoy
          </p>
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="ck-btn ck-btn--md ck-btn--primary mt-3 max-sm:w-full"
          >
            Suggest a plan →
          </button>
        </div>
      )}

      {current ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {canShowAnother ? (
            <button type="button" onClick={showAnother} className="ck-btn ck-btn--md ck-btn--secondary">
              Show another
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="ck-taplink text-[13px] font-semibold text-[color:var(--purple)] hover:text-[color:var(--ink)]"
          >
            Suggest your own →
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// The canonical Event Card, mini (S5/S7): the real photo, date, title, suburb and
// distance, price and tags - the same facts in the same form as every other card
// (the repository resolves them the way eventFromRow does), so a plan never looks
// unlike the event it points at.
function PlanEventCard({ event }: { event: ProposalCatalogueEvent }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
      <div className="relative h-[110px] w-full bg-[color:var(--champagne-deep)]">
        <EventImage
          src={event.image}
          alt={event.imageAlt}
          category={event.category}
          fill
          sizes="(min-width: 640px) 480px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--slate)]">
          <Icon name="calendar" size={13} stroke={2.1} />
          {cardWhen.format(new Date(event.startsAt))}
        </p>
        <p className="font-display mt-1 text-[1.05rem] font-semibold leading-snug tracking-[-0.01em] text-[color:var(--ink)]">
          {event.title}
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13.5px] font-medium text-[color:var(--slate)]">
          <Icon name="pin" size={13} stroke={2.1} />
          <span className="truncate">
            {event.suburb}
            {event.distanceKm != null ? ` · ${event.distanceKm}km` : ""} · {event.price}
          </span>
        </p>
        {event.tags.length > 0 ? (
          <div className="mt-2.5">
            <TagRow tags={event.tags} max={3} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CoordinationBody({
  entry,
  step,
  titleId,
  firstName,
  confirmAction,
  declineAction,
  confirmError,
  declineError,
  onPlan,
  onDone,
  planner,
  waitlistAction,
  waitlistError,
  waitlistJoined,
}: {
  entry: ProposalEntry;
  step: Exclude<Step, "reveal">;
  titleId: string;
  firstName: string;
  confirmAction: (payload: FormData) => void;
  declineAction: (payload: FormData) => void;
  confirmError: string | null;
  declineError: string | null;
  onPlan: () => void;
  onDone: () => void;
  planner: React.ReactNode;
  waitlistAction: (payload: FormData) => void;
  waitlistError: string | null;
  waitlistJoined: boolean;
}) {
  // S5: on `open` the suggest card IS the step, and every "find another" route
  // (S7, S14, S18, a dead plan) drops into it in place of the face it came from.
  if (planner) return <div>{planner}</div>;

  const eventTitle = entry.suggestedEventTitle ?? "the event";
  const cal = step === "confirmed" ? gcalUrl(eventTitle, entry.suggestedEventStartsAt) : null;
  // Mirrors proposeAlternativeForProposal exactly: the budget is joint, and a plan
  // that can no longer be joined is recovered from rather than countered, so it
  // neither spends the budget nor is stopped by it.
  //
  // A BOOLEAN, never a remainder. Part A invariant 9 - "no timers, caps, rankings
  // or refresh cadence shown, ever" - is a back-end obligation too (Part B), so
  // the count no longer crosses the wire at all: the server sends only whether one
  // more suggestion is available.
  const capReached = !entry.canSuggestAlternative && !entry.suggestionUnavailable;
  // S14 proper - the seat filled first. A cancelled or already-started event is a
  // different disappointment and keeps its own line, so it is deliberately excluded.
  const seatRace =
    entry.suggestionUnavailable && !entry.suggestedEventCancelled && !entry.suggestedEventStarted;
  // S6 - the proposer's waiting face. Never while a seat race is on: that arm owns
  // the screen and has its own disc and lead line.
  const waitingAsProposer = step === "proposed" && entry.proposedByMe && !entry.suggestionUnavailable;
  // S7 - the other side of the same state: asked, not reassured.
  const deciding = step === "proposed" && !entry.proposedByMe && !entry.suggestionUnavailable;

  return (
    <div>
      {/* pr-10 keeps a long name's first line out from under the corner ✕. */}
      <span className="eyebrow block pr-10">
        {deciding ? `From ${firstName}` : `You + ${entry.otherName}`}
      </span>

      {step === "confirmed" ? (
        entry.viewerHasSeat ? (
          // S11 / C11: already-booked side - never a live RSVP, partner-focused
          // status. Copy is locked verbatim (CLICK_LANGUAGE §5 "Both-going
          // confirmation"); the ✨ sits on the disc, never inside the headline.
          <>
            {entry.otherHasSeat ? (
              <div
                aria-hidden
                className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--lav-bg)] text-2xl leading-none text-[color:var(--purple)]"
              >
                ✨
              </div>
            ) : null}
            <h2 id={titleId} className={headingClass}>
              {entry.otherHasSeat ? "You're both going." : "You're in."}
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
              {entry.otherHasSeat ? (
                <>
                  You and {firstName} are set for {eventTitle}. See you there.
                </>
              ) : (
                <>
                  Your seat&apos;s locked in. {firstName} hasn&apos;t grabbed one yet - you&apos;ll
                  be going together the moment they do.
                </>
              )}
            </p>
            <div className={`mt-5 flex flex-wrap gap-2 ${stackOnPhone}`}>
              {cal && !entry.suggestedEventStarted ? (
                <a
                  href={cal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ck-btn ck-btn--md ck-btn--primary"
                >
                  Add to calendar
                </a>
              ) : null}
              {/* The locked second action. Closing a peak should be a real button,
                  not a hunt for the corner ✕. */}
              <button type="button" onClick={onDone} className="ck-btn ck-btn--md ck-btn--secondary">
                Done
              </button>
            </div>
            {entry.suggestedEventSlug ? (
              <div className="mt-3">
                <Link
                  href={`/events/${entry.suggestedEventSlug}`}
                  className="ck-taplink text-[13px] font-semibold text-[color:var(--purple)] underline decoration-dotted underline-offset-2"
                >
                  {eventTitle} →
                </Link>
              </div>
            ) : null}
          </>
        ) : entry.suggestedEventJoinable ? (
          // Viewer still needs a seat, and can still get one - keep the live RSVP.
          // With the OTHER side already seated this is S9, whose headline, sub-line
          // and both controls are locked verbatim (Stage 6 / CLICK_UIUX_SPEC §9).
          // Without their seat it is not S9 yet - "they've saved their spot" would
          // simply be untrue - so that face keeps its own honest line.
          <>
            <h2 id={titleId} className={headingClass}>
              {entry.otherHasSeat
                ? `${firstName}'s keen - save your spot`
                : entry.confirmedByMe
                  ? "You're in - now lock in your seat."
                  : `${firstName} confirmed this plan`}
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
              {entry.otherHasSeat ? (
                <>
                  {firstName}&apos;s saved their spot - grab yours and you&apos;re both set.
                </>
              ) : (
                <>RSVP to lock in your seat. You&apos;re both going once you each have a spot.</>
              )}
            </p>
            {/* The event mini row - the locked screen names the plan beside the CTA
                rather than welding the title into the button label. */}
            {entry.suggestedEventStartsAt ? (
              <p className="mt-3 text-xs font-semibold tracking-[0.04em] text-[color:var(--slate)]">
                {eventTitle} · {longDate.format(new Date(entry.suggestedEventStartsAt))}
              </p>
            ) : null}
            {entry.suggestedEventSlug ? (
              <div className={`mt-5 flex flex-wrap items-center gap-2 ${stackOnPhone}`}>
                {/* Stage 6: the booking control deep-links to the REAL event page
                    carrying the plan context, and hands it the drawer to come back
                    to - a confirmed RSVP belongs at S11, not on a receipt page. */}
                <Link
                  href={planBookingHref(entry)}
                  className="ck-btn ck-btn--md ck-btn--primary"
                >
                  Save my spot · RSVP
                </Link>
                {/* Ghost, not secondary: the locked S9 row is "primary `Save my
                    spot - RSVP` - ghost `Back to your clicks`"
                    (CLICK_UIUX_SPEC §6.4). A filled secondary reads as a second
                    equal-weight action beside the Deep Purple primary; this exit
                    is meant to be the quiet one. */}
                <button
                  type="button"
                  onClick={onDone}
                  className="ck-btn ck-btn--md ck-btn--ghost"
                >
                  Back to your clicks
                </button>
              </div>
            ) : null}
          </>
        ) : (
          // Confirmed, no seat, and no seat left to take. Name the reason - a
          // started event and a sold-out one are different disappointments - and
          // never leave the person with a dead RSVP button as their only control.
          <>
            <h2 id={titleId} className={headingClass}>
              {entry.suggestedEventStarted
                ? `${eventTitle} has already started.`
                : `${eventTitle} filled up before you got a seat.`}
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
              {entry.otherHasSeat ? (
                <>
                  {firstName} has a seat, you don&apos;t - so this one got away. Pick something
                  else together and you&apos;re back on.
                </>
              ) : (
                <>Neither of you got a seat. Pick something else together and you&apos;re back on.</>
              )}
            </p>
            <div className={`mt-5 flex flex-wrap items-center gap-2 ${stackOnPhone}`}>
              <button
                type="button"
                onClick={onPlan}
                className="ck-btn ck-btn--md ck-btn--primary"
              >
                Suggest another plan
              </button>
              {entry.suggestedEventSlug ? (
                // The title truncates: .ck-btn never wraps, so a long one pushed the
                // button out past the card and the whole sheet scrolled sideways.
                <Link
                  href={`/events/${entry.suggestedEventSlug}`}
                  className="ck-btn ck-btn--md ck-btn--secondary max-w-full"
                >
                  <span className="min-w-0 truncate">View {eventTitle}</span>→
                </Link>
              ) : null}
            </div>
          </>
        )
      ) : step === "gone" ? (
        // C12 recovery: a dead agreed event is a failed attempt, not a terminal.
        <>
          <h2 id={titleId} className={headingClass}>
            That plan fell through - pick another together.
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
            The event you two agreed on isn&apos;t available anymore, so nothing&apos;s booked - pick
            another plan together and you&apos;re back on.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={onPlan}
              className="ck-btn ck-btn--md ck-btn--primary max-sm:w-full"
            >
              Suggest another plan
            </button>
          </div>
        </>
      ) : step === "partner-cancelled" ? (
        // S18 (§B5.6, Cindy-signed 2026-07-05). Neutral disc, NO ✨: this is neither
        // a peak nor a failure. It never says WHY - a refund, an emergency and cold
        // feet all read identically, by design - and it routes forward.
        <>
          {/* --cream is white paper here, so a cream disc vanished into the card and
              left the glyph floating. --lavender-100 is the palest tint, the one the
              DS keeps for icon circles (its mockup's neutral disc). */}
          <div
            aria-hidden
            className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--lavender-100)] text-2xl leading-none text-[color:var(--mauve)]"
          >
            📍
          </div>
          <h2 id={titleId} className={headingClass}>
            Plans changed
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
            {firstName}&apos;s plans changed - they won&apos;t make {eventTitle} this time. Your
            spot&apos;s still yours. Want to line up something else together?
          </p>
          <div className={`mt-5 flex flex-wrap items-center gap-2 ${stackOnPhone}`}>
            <button
              type="button"
              onClick={onPlan}
              className="ck-btn ck-btn--md ck-btn--primary"
            >
              Find another together
            </button>
            <button type="button" onClick={onDone} className="ck-btn ck-btn--md ck-btn--secondary">
              Keep my spot - all good
            </button>
          </div>
        </>
      ) : step === "connected" ? (
        // S13 - the closure peak. This is the SUCCESS terminal: these two
        // demonstrably went out together, or one of them said so. It used to render
        // the release copy below, which told them it "didn't turn into a night out"
        // - a verdict, and a false one, on the single best outcome the product has.
        <>
          <div
            aria-hidden
            className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--lav-bg)] text-2xl leading-none text-[color:var(--purple)]"
          >
            ✨
          </div>
          <h2 id={titleId} className={headingClass}>
            Love that.
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
            That&apos;s what Click&apos;s for. This one rests in your past clicks - pick it back up
            anytime.
          </p>
          <button type="button" onClick={onDone} className="ck-btn ck-btn--md ck-btn--primary mt-5 max-sm:w-full">
            Back to your clicks
          </button>
        </>
      ) : step === "released" ? (
        // S16 - soft release. NOT a peak: no ✨, no verdict, no loss frame. Copy is
        // the CLICK_LANGUAGE §5 lock verbatim - "Still out there - if you cross paths
        // again, you can pick it back up." - set as headline + line, and nothing
        // added to it (§8: do not paraphrase).
        <>
          <div
            aria-hidden
            className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--lavender-100)] text-2xl leading-none text-[color:var(--mauve)]"
          >
            🕐
          </div>
          <h2 id={titleId} className={headingClass}>
            Still out there
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
            If you cross paths again, you can pick it back up.
          </p>
          <button type="button" onClick={onDone} className="ck-btn ck-btn--md ck-btn--secondary mt-5 max-sm:w-full">
            Back to your clicks
          </button>
        </>
      ) : waitlistJoined ? (
        // S14w - both on the list. The holding face after S14's second exit, and
        // like S14 it is not a peak: lavender clock disc, no ✨, no loss framing,
        // nothing about being too slow. It is not a state the server holds either -
        // the pair sit exactly where the runbook leaves them (`open`), and the
        // 30-minute claim, if a seat frees up, arrives through the normal waitlist
        // promotion every waitlister gets.
        <>
          <div
            aria-hidden
            className="mb-1 grid h-16 w-16 place-items-center rounded-full bg-[color:var(--lav-bg)] text-2xl leading-none text-[color:var(--purple)]"
          >
            🕐
          </div>
          <h2 id={titleId} className={headingClass}>
            You&apos;re both on the list
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
            If a spot opens at {eventTitle}, you&apos;re first in line - together. We&apos;ll let
            you both know.
          </p>
          <div className={`mt-5 flex flex-wrap items-center gap-3 ${stackOnPhone}`}>
            <button type="button" onClick={onDone} className="ck-btn ck-btn--md ck-btn--secondary">
              Back to your clicks
            </button>
            {entry.suggestedEventSlug ? (
              <Link
                href={`/events/${entry.suggestedEventSlug}`}
                className="ck-taplink text-[13px] font-semibold text-[color:var(--purple)] underline decoration-dotted underline-offset-2"
              >
                {eventTitle} →
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        // open / proposed - a plan is (or can be) on the table.
        <>
          {/* S14 - the seat filled first: lavender compass disc, calm copy, never
              coral. S6 - the proposer waiting: lavender clock disc. Neither is a
              peak, so neither gets a ✨ (invariant 8). */}
          {seatRace || waitingAsProposer ? (
            <div
              aria-hidden
              className="mb-1 grid h-16 w-16 place-items-center rounded-full bg-[color:var(--lav-bg)] text-2xl leading-none text-[color:var(--purple)]"
            >
              {seatRace ? "⊙" : "🕐"}
            </div>
          ) : null}
          <h2 id={titleId} className={headingClass}>
            {entry.suggestionUnavailable ? (
              entry.suggestedEventCancelled ? (
                <>{eventTitle} was called off - pick another together.</>
              ) : entry.suggestedEventStarted ? (
                <>{eventTitle} has already started - pick another together.</>
              ) : (
                // Locked (CLICK_LANGUAGE §5, "Seat-race-lost").
                <>That one just filled up.</>
              )
            ) : waitingAsProposer ? (
              // S6, locked verbatim (Stage 5 table). It used to read "You're in -
              // waiting on [Name]", which asserts a booking against a cell that
              // ends "nobody has paid yet".
              <>Suggested to {firstName}</>
            ) : (
              // S7. `open` never reaches this arm with a live plan - the suggest card
              // is that step - so what is left here is the one being asked.
              <>
                {firstName}&apos;s keen for {eventTitle} - you in?
              </>
            )}
          </h2>
          {seatRace ? (
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
              No drama - there&apos;s always another. Find one you&apos;ll both like.
            </p>
          ) : waitingAsProposer ? (
            // S6's locked reassurance. No countdown, no "seen" receipt, no nudge -
            // the whole point of the line is that there is nothing to do but wait.
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
              We&apos;ll let {firstName} know, and tell you the moment it&apos;s confirmed - no
              rush.
            </p>
          ) : null}
          {deciding && entry.suggestedEventCard ? (
            // S7 - the plan as the card mini (the same one S5 sent), with the full
            // event page one tap away and the way back to this drawer.
            <div className="mt-4">
              <PlanEventCard event={entry.suggestedEventCard} />
              <Link
                href={planBookingHref(entry)}
                className="ck-taplink mt-2 inline-flex text-[13px] font-semibold text-[color:var(--purple)] underline decoration-dotted underline-offset-2"
              >
                See full details →
              </Link>
            </div>
          ) : entry.suggestedEventStartsAt ? (
            <p className="mt-2 text-xs font-semibold tracking-[0.04em] text-[color:var(--slate)]">
              {longDate.format(new Date(entry.suggestedEventStartsAt))}
              {entry.suggestedEventSlug ? (
                <>
                  {" · "}
                  <Link
                    href={`/events/${entry.suggestedEventSlug}`}
                    className="text-[color:var(--purple)] underline decoration-dotted underline-offset-2"
                  >
                    view
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <div className={`mt-5 flex flex-wrap items-center gap-2 ${stackOnPhone}`}>
            {/* S7 - and ONLY S7. Confirming is the recipient's move (§B4.2); the
                proposer is waiting (S6, which the spec says carries no booking
                control at all). This used to render on the `open` step too, for
                both sides, which let either of them jump a system pick straight
                from open to confirmed_together - skipping `proposed`, S6 and S7
                entirely, and notifying the other person that their "shared plan"
                was confirmed when they had never been asked about it.

                The seat gate is `viewerHasSeat || joinable`, not `joinable` alone:
                somebody who already holds a ticket needs zero seats (§B5.1
                needed=0), so a sold-out event must not strip their ability to say
                they're in.

                The label branches on the viewer's OWN booking state (C11 / §B4.1
                step 7): "I'm in · RSVP" agrees and goes straight on to book (S8,
                the panel's one-tap), "I'm in" agrees and never re-books. */}
            {step === "proposed" &&
            !entry.proposedByMe &&
            (entry.viewerHasSeat || entry.suggestedEventJoinable) ? (
              <form action={confirmAction}>
                <input type="hidden" name="proposal_id" value={entry.id} />
                {/* Confirming a plan is agreeing to a night out, not sending a
                    message - the old shared "Sending…" label said otherwise. */}
                <SubmitButton pendingLabel="Confirming…">
                  {entry.viewerHasSeat ? "I'm in" : "I'm in · RSVP"}
                </SubmitButton>
              </form>
            ) : null}
            {/* S6 has no second control at all: the proposer is waiting, and the
                locked face is the mini row and "Back to your clicks". Offering them
                a re-pick there spent the pair's joint budget on a plan the other
                person had not even answered yet. */}
            {!waitingAsProposer ? (
              <div className="grid gap-1">
                {/* The exception to the cap is a plan that can no longer be joined:
                    recovering from one doesn't spend the budget, so the way back has
                    to stay open even at the cap - otherwise a pair whose venue
                    cancelled after three alternatives had no move left at all. */}
                <button
                  type="button"
                  onClick={onPlan}
                  disabled={capReached}
                  aria-describedby={capReached ? "suggest-cap-note" : undefined}
                  className="ck-btn ck-btn--md ck-btn--secondary disabled:cursor-not-allowed"
                >
                  {entry.suggestionUnavailable
                    ? // S14's locked exit label, and the way out of a night that was
                      // called off or has started.
                      "Find another together"
                    : // S7: "drops her into S5 as the proposer" - Ava sees a new
                      // plan, never a rejection.
                      "Suggest something else"}
                </button>
                {/* Explain the dead button WITHOUT counting anything. Invariant 9
                    bans a visible cap outright, and a remaining-suggestions counter
                    is the depleting-budget copy the DS bans by name. Only the one
                    being asked ever sees it now, and they still hold two live
                    controls: passing drops the plan so the pair start fresh. */}
                {capReached && entry.suggestedEventSlug ? (
                  <p
                    id="suggest-cap-note"
                    className="text-[11.5px] font-medium text-[color:var(--slate)]"
                  >
                    Confirm it, or pass and you two can start fresh.
                  </p>
                ) : null}
              </div>
            ) : null}
            {/* S14's SECOND exit (runbook off-path table). Not a state change and
                not a booking: it puts BOTH of them on that event's waitlist, and if
                a seat frees up the normal promotion hands them the 30-minute claim.
                Seat-race only - the cancelled and already-started arms have no queue
                to join. Secondary, like the exit beside it: S14 is not a peak, and
                Deep Purple is the primary-action colour, so neither recovery route
                gets to shout. */}
            {seatRace ? (
              <form action={waitlistAction}>
                <input type="hidden" name="mutual_id" value={entry.mutualId} />
                <SubmitButton variant="secondary" pendingLabel="Adding you both…">
                  Join the waitlist together
                </SubmitButton>
              </form>
            ) : null}
            {/* S6's locked exit. The waiting side has nothing to do here, so give
                them a real way out rather than a hunt for the corner ✕. */}
            {waitingAsProposer ? (
              <button type="button" onClick={onDone} className="ck-btn ck-btn--md ck-btn--secondary">
                Back to your clicks
              </button>
            ) : null}
            {/* Decline is the recipient's no - returns to open, no blame (§B6). */}
            {step === "proposed" && !entry.proposedByMe ? (
              <form action={declineAction}>
                <input type="hidden" name="proposal_id" value={entry.id} />
                <SubmitButton variant="ghost" pendingLabel="Passing…">
                  Not this one
                </SubmitButton>
              </form>
            ) : null}
          </div>

          {/* S14 / §B5.5: a seat race is explicitly not an error - "NOT an error
              state, never red/coral". Once the plan is unavailable the recovery
              body above IS the message, so the danger alert would be a second,
              louder, contradicting copy of it. Genuine failures still get it. */}
          {confirmError && !entry.suggestionUnavailable ? (
            <p
              role="alert"
              className="mt-3 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper))] px-3 py-2 text-xs font-medium text-[color:var(--danger)]"
            >
              {confirmError}
            </p>
          ) : null}
          {declineError ? (
            <p
              role="alert"
              className="mt-3 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper))] px-3 py-2 text-xs font-medium text-[color:var(--danger)]"
            >
              {declineError}
            </p>
          ) : null}
          {waitlistError ? (
            <p
              role="alert"
              className="mt-3 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper))] px-3 py-2 text-xs font-medium text-[color:var(--danger)]"
            >
              {waitlistError}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

const headingClass =
  "font-display mt-2 text-2xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]";

// Every step's button row. On a phone the drawer is a full-width sheet, where a
// wrapping row left its buttons ragged - three widths down the left edge, the ghost's
// label indented - so below sm they stack full-width, the way the DS mockup draws
// every step. From sm up the row is unchanged.
const stackOnPhone = "max-sm:flex-col max-sm:items-stretch max-sm:[&_.ck-btn]:w-full";
