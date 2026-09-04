"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import Link from "next/link";
import { SubmitButton } from "@/components/ds-client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PAIR_SUPPRESSION_DAYS } from "@/lib/clicks/constants";
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

// COORDINATION_MODAL_SYSTEM: the entire coordination sequence - reveal → suggest →
// waiting → both going, plus recovery/terminal states - is ONE stepped modal over the
// current page (§1). Steps advance IN PLACE, never a route change (§5 QA). The drawer is
// a PURE projection of the live entry's coord_state/proposal (§2): a successful action
// revalidates /proposals, the fresh entry flows back in from ClicksList, and the step
// re-projects - so revalidation DRIVES the advance instead of a fragile local override.
// §5 freeze-safety: ClicksList keys the drawer on the mutual id, so the panel mounts once
// per open and its opacity-0 step-enter-fwd entrance runs to completion exactly once;
// inner steps swap via plain conditional render off a visible base (no per-step opacity
// gate to stick). Reduced-motion is the global handler.

const INITIAL: ProposalActionState = { ok: false, error: null };

// Reveals dismissed in THIS page session. Re-opening a mutual (list, bell, dashboard)
// must never re-fire the reveal even before the list's revealSeen snapshot catches up.
// The server seen_at (markMutualSeen) covers reload / other devices; this covers
// same-session re-entry - together they kill the §4 re-fire regression.
const revealedThisSession = new Set<string>();

const longDate = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
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
};

// Same split as modal-shell.tsx, and for the same reason: the guard has to run
// BEFORE any hook, so hook order can never differ between the two renders.
//
// This one actually fired. ClicksList seeds its open row from ?open=<mutualId>,
// so a deep link into /proposals - which is exactly what every mutual
// notification and the "it's mutual" email link to - renders this component on
// the server, where createPortal's document.body target does not exist. The throw
// was caught by the route's Suspense boundary, so the page fell back to
// proposals/loading.tsx and re-rendered on the client: no error page, just a
// blank-then-flash and the whole route silently downgraded from streamed SSR.
export function CoordinationDrawer(props: CoordinationDrawerProps) {
  if (typeof document === "undefined") return null;
  return <CoordinationDrawerPanel {...props} />;
}

function CoordinationDrawerPanel({
  entry,
  catalogue,
  onClose,
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

  const [picking, setPicking] = useState(false);
  const [revealDismissed, setRevealDismissed] = useState(() =>
    revealedThisSession.has(entry.mutualId),
  );

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

  // When a successful action revalidates /proposals, close the picker after the
  // fresh server state renders so local UI never fights the server truth.
  const sig = `${entry.status}|${entry.coordState}|${entry.suggestedEventSlug ?? ""}|${entry.suggestedEventJoinable}`;
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPicking(false));
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
  const step: Step =
    !entry.revealSeen && !revealDismissed && base !== "released" && base !== "connected"
      ? "reveal"
      : base;

  const dismissReveal = useCallback(() => {
    revealedThisSession.add(entry.mutualId);
    setRevealDismissed(true);
    void markMutualSeenAction(entry.mutualId); // persist for reload / other devices
  }, [entry.mutualId]);

  // THE #1 behaviour bug class (COORDINATION_MODAL_SYSTEM §4): the reveal is
  // dismissed by "Maybe later" AND by ✕ AND by the scrim AND by Escape, and every
  // one of those has to write reveal_seen. Only the primary CTA used to, so anyone
  // who closed the reveal instead of acting on it got it fired at them again on
  // every entry point, on every device, forever.
  //
  // markMutualSeen is idempotent server-side (its WHERE matches only while the
  // viewer's seen_at is still null), so the double call from the CTA path is a
  // no-op. Order matters: stamp before onClose, which unmounts the panel.
  const closeStep = useCallback(() => {
    if (step === "reveal") dismissReveal();
    onClose();
  }, [step, dismissReveal, onClose]);
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

  const picker = picking ? (
    <PlanPicker
      catalogue={catalogue}
      firstName={firstName}
      formAction={freshSuggest ? suggestAction : proposeAction}
      hidden={
        freshSuggest ? (
          <input type="hidden" name="mutual_id" value={entry.mutualId} />
        ) : (
          <input type="hidden" name="proposal_id" value={entry.id} />
        )
      }
      error={(freshSuggest ? suggestState : proposeState).error}
      onBack={() => setPicking(false)}
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
        className="step-enter-fwd relative z-10 max-h-[92dvh] w-full max-w-[540px] overflow-y-auto rounded-t-[24px] bg-[color:var(--paper)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] outline-none sm:rounded-[24px] sm:p-7"
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

        {/* key={step} remounts the body on every advance so .rise-soft replays -
            the one flow in this surface that genuinely steps was the one that
            never felt like it was stepping. Safe against the freeze the header
            comment warns about: rise-soft is pure CSS with fill `both` settling
            at opacity 1, not a JS-applied class that can stick invisible. */}
        <div key={step} className="rise-soft">
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
              onTogglePicker={() => setPicking((v) => !v)}
              onDone={closeStep}
              picker={picker}
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
            control that actually does something on a click that has run out. */}
        <div className="mt-6 border-t border-[color:var(--line-soft)] pt-4">
          {/* §B7.1: the closure ritual sits beside the two exits, and it is the
              only one of the three that is a WIN - so it leads, and it is a real
              button rather than a quiet link. There is deliberately no "it didn't
              work" counterpart: Click never shows a verdict. */}
          {step !== "released" && step !== "connected" ? (
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
  formAction,
  hidden,
  error,
  onBack,
}: {
  catalogue: ProposalCatalogueEvent[];
  firstName: string;
  formAction: (payload: FormData) => void;
  hidden: React.ReactNode;
  error: string | null;
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

  // A radio, not a <select>: the row has to carry the suburb and the date too, and
  // the native control still submits `event_slug` with the form and still enforces
  // `required` - no state to keep in sync, no listbox to rebuild.
  const row = (event: ProposalCatalogueEvent) => (
    <label
      key={event.slug}
      className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] px-3 py-2 hover:bg-[color:var(--cream)] has-[:checked]:bg-[color:var(--lav-bg)]"
    >
      <input
        type="radio"
        name="event_slug"
        value={event.slug}
        required
        className="mt-1 accent-[var(--purple)]"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[color:var(--ink)]">
          {event.title}
        </span>
        <span className="block text-xs font-medium text-[color:var(--slate)]">
          {event.suburb} · {longDate.format(new Date(event.startsAt))}
        </span>
      </span>
    </label>
  );

  return (
    <form
      action={formAction}
      className="rise-soft mt-4 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4"
    >
      {hidden}
      {/* S5b's back link - this is a sub-step of the suggest card, not a modal of
          its own, so the way out is back rather than cancel. */}
      <button
        type="button"
        onClick={onBack}
        className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
      >
        ‹ Back
      </button>
      <p className="font-display mt-2 text-base font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
        Choose an event for {firstName}
      </p>
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

      <div className="mt-4">
        {/* S5's primary. Naming the person is the point: it says plainly that
            this goes TO them and that they get to answer, which is exactly the
            step the old open-step "Confirm this plan" skipped past. */}
        <SubmitButton size="sm" pendingLabel="Sending…">
          Suggest this to {firstName}
        </SubmitButton>
      </div>
      {error ? (
        <p className="mt-3 text-xs font-medium text-[color:var(--danger)]">{error}</p>
      ) : null}
    </form>
  );
}

// S3 - the peak micro-moment, fired exactly once per user per mutual. Every string
// here is locked (CLICK_LANGUAGE §5); none of it is paraphrasable.
//
// The ✨ lives on the disc, never welded into the headline - §5 allows at most ONE
// per element and concentrates them at the peaks. The dating clause is APPENDED to
// the sage intent pill rather than given its own line, and only when both sides have
// the toggle on: it is never inferred and never one-sided.
function RevealStep({
  entry,
  titleId,
  onSuggest,
  onLater,
}: {
  entry: ProposalEntry;
  titleId: string;
  onSuggest: () => void;
  onLater: () => void;
}) {
  const firstName = entry.otherName.split(/\s+/)[0];
  return (
    // aria-live so a screen-reader user gets the moment too - it is announced, not
    // just drawn (Part 9). Polite: it must never interrupt what they were reading.
    <div aria-live="polite">
      <div
        aria-hidden
        className="grid h-[74px] w-[74px] place-items-center rounded-full bg-[color:var(--lav-bg)] text-[28px] leading-none text-[color:var(--purple)]"
      >
        ✨
      </div>
      <h2
        id={titleId}
        className="font-display mt-4 text-3xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]"
      >
        You clicked with {firstName}.
      </h2>
      {/* Stage 3's shared context, above the pill: a post-event mutual names the
          night the two of them were actually at, which is the reason the reveal
          means anything. Null on a discovery mutual - there is no shared night, so
          the line is simply absent rather than invented. */}
      {entry.sourceEventTitle ? (
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
          You were both at {entry.sourceEventTitle}.
        </p>
      ) : null}
      {/* A desire, never a status - and a MIXED pair reads as two sides. The line
          arrives whole from the projection because only it knows which intent is
          whose; wrapping a fragment here could only ever produce the banned
          rounded-into-one-frame version. */}
      <p className="mt-3 rounded-full bg-[color-mix(in_srgb,var(--sage)_16%,var(--paper))] px-3 py-1.5 text-sm font-semibold text-[color:var(--sage-ink)] inline-block">
        {entry.intentLine}
        {entry.bothDating ? " · both open to dating" : null}
      </p>
      {/* Stage 3's other half: "<=2 shared tags", under the intent pill. There is
          deliberately no filtering here - B5 item 6 ("sensitive life tags, even when
          shared") is enforced in the projection's SQL, so a life-quiz answer never
          reaches this component to be rendered by accident. Tags are the pills in
          this design system; the buttons are the radius-12 ones. */}
      {entry.sharedTags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {entry.sharedTags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-[color:var(--lav-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--purple)]"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-base font-medium leading-6 text-[color:var(--ink-soft)]">
        Find a thing you&apos;d both enjoy, and just show up.
      </p>
      <button type="button" onClick={onSuggest} className="ck-btn ck-btn--md ck-btn--primary mt-6">
        Suggest a plan
      </button>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* The quiet exit. It is a real exit, not decoration: dismissing the reveal
            ANY way persists reveal_seen, so this can never become the one route
            that leaves it firing forever. */}
        <button
          type="button"
          onClick={onLater}
          className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
        >
          Maybe later
        </button>
        <Link
          href="/how-it-works"
          className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]"
        >
          How clicking works →
        </Link>
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
  onTogglePicker,
  onDone,
  picker,
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
  onTogglePicker: () => void;
  onDone: () => void;
  picker: React.ReactNode;
  waitlistAction: (payload: FormData) => void;
  waitlistError: string | null;
  waitlistJoined: boolean;
}) {
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

  return (
    <div>
      <span className="eyebrow">You + {entry.otherName}</span>

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
            <div className="mt-5 flex flex-wrap gap-2">
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
              <div className="mt-5 flex flex-wrap items-center gap-2">
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
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onTogglePicker}
                className="ck-btn ck-btn--md ck-btn--primary"
              >
                Suggest another plan
              </button>
              {entry.suggestedEventSlug ? (
                <Link
                  href={`/events/${entry.suggestedEventSlug}`}
                  className="ck-btn ck-btn--md ck-btn--secondary"
                >
                  View {eventTitle} →
                </Link>
              ) : null}
            </div>
            {picker}
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
              onClick={onTogglePicker}
              className="ck-btn ck-btn--md ck-btn--primary"
            >
              Suggest another plan
            </button>
          </div>
          {picker}
        </>
      ) : step === "partner-cancelled" ? (
        // S18 (§B5.6, Cindy-signed 2026-07-05). Neutral disc, NO ✨: this is neither
        // a peak nor a failure. It never says WHY - a refund, an emergency and cold
        // feet all read identically, by design - and it routes forward.
        <>
          <div
            aria-hidden
            className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--cream)] text-2xl leading-none text-[color:var(--mauve)]"
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
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTogglePicker}
              className="ck-btn ck-btn--md ck-btn--primary"
            >
              Find another together
            </button>
            <button type="button" onClick={onDone} className="ck-btn ck-btn--md ck-btn--secondary">
              Keep my spot - all good
            </button>
          </div>
          {picker}
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
          <button type="button" onClick={onDone} className="ck-btn ck-btn--md ck-btn--primary mt-5">
            Back to your clicks
          </button>
        </>
      ) : step === "released" ? (
        // S16 - soft release. NOT a peak: no ✨, no verdict, no loss frame. Copy is
        // the CLICK_LANGUAGE §5 lock verbatim.
        <>
          <div
            aria-hidden
            className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--cream)] text-2xl leading-none text-[color:var(--mauve)]"
          >
            🕐
          </div>
          <h2 id={titleId} className={headingClass}>
            Still out there
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
            If you cross paths again, you can pick it back up. No rush - these things have their
            own timing.
          </p>
          <button type="button" onClick={onDone} className="ck-btn ck-btn--md ck-btn--secondary mt-5">
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
          <div className="mt-5 flex flex-wrap items-center gap-3">
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
            ) : step === "proposed" ? (
              <>
                {firstName}&apos;s keen for {eventTitle} - you in?
              </>
            ) : entry.suggestedEventTitle ? (
              <>Here&apos;s a plan: {eventTitle}</>
            ) : (
              <>Pick something to do with {firstName}.</>
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
          {entry.suggestedEventStartsAt ? (
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

          <div className="mt-5 flex flex-wrap items-center gap-2">
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
                step 7): "Save my spot" books, "I'm in" does not re-book. */}
            {step === "proposed" &&
            !entry.proposedByMe &&
            (entry.viewerHasSeat || entry.suggestedEventJoinable) ? (
              <form action={confirmAction}>
                <input type="hidden" name="proposal_id" value={entry.id} />
                {/* Confirming a plan is agreeing to a night out, not sending a
                    message - the old shared "Sending…" label said otherwise. */}
                <SubmitButton pendingLabel="Confirming…">
                  {entry.viewerHasSeat ? "I'm in" : "Save my spot"}
                </SubmitButton>
              </form>
            ) : null}
            <div className="grid gap-1">
              {/* Out of alternatives = out of alternatives, for BOTH of them. The
                  budget is joint and proposeAlternativeForProposal has never cared
                  who proposed, so leaving the proposer's button live only ever
                  bought them a 400. The exception is a plan that can no longer be
                  joined: recovering from one doesn't spend the budget, so the way
                  back has to stay open even at the cap - otherwise a pair whose
                  venue cancelled after three alternatives had no move left at
                  all. */}
              <button
                type="button"
                onClick={onTogglePicker}
                disabled={capReached}
                aria-describedby={capReached ? "suggest-cap-note" : undefined}
                className="ck-btn ck-btn--md ck-btn--secondary disabled:cursor-not-allowed"
              >
                {seatRace
                  ? // S14's locked exit label.
                    "Find another together"
                  : entry.suggestedEventSlug
                    ? "Suggest alternative"
                    : "Suggest a plan"}
              </button>
              {/* Explain the dead button WITHOUT counting anything. Invariant 9
                  bans a visible cap outright, and a remaining-suggestions counter
                  is the depleting-budget copy the DS bans by name - it just
                  slipped the literal CI grep, which only looks for the click one.
                  So the note says only what is true and actionable now, and splits
                  on who proposed: at the joint cap neither button is live, and both
                  sides used to be told it was the other's turn to pick. The
                  proposer is genuinely waiting; the recipient still holds the two
                  live controls beside this note, and passing drops the proposal
                  row so the pair starts fresh. */}
              {capReached && entry.suggestedEventSlug ? (
                <p
                  id="suggest-cap-note"
                  className="text-[11.5px] font-medium text-[color:var(--slate)]"
                >
                  {entry.proposedByMe
                    ? `It's with ${firstName} to confirm or pass.`
                    : "Confirm it, or pass and you two can start fresh."}
                </p>
              ) : null}
            </div>
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

          {picker}
        </>
      )}
    </div>
  );
}

const headingClass =
  "font-display mt-2 text-2xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]";
