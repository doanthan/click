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
  markMutualConnectedAction,
  markMutualSeenAction,
  proposeAlternativeAction,
  releaseMutualAction,
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
  return (
    <button
      type="button"
      onClick={() => {
        if (!pending) onRequest();
      }}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      className="text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)] aria-disabled:opacity-50"
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
  const [connectedState, connectedAction] = useActionState(markMutualConnectedAction, INITIAL);

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
  // The catalogue picker's only label sat unattached above the select, so a
  // screen reader announced the one control on this step as an unlabelled
  // combobox - "Pick an event…" and nothing about what the list is for.
  const catalogueId = useId();
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
  }, [onClose]);

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

  // An empty catalogue is a normal launch-week state (nothing upcoming with two
  // free seats). Rendering the form anyway gave a select holding only its own
  // disabled placeholder, and `required` then met "Send suggestion" with the
  // browser's native "Please select an item in the list." - no explanation, and
  // the single action on this whole surface simply did not work. Say so instead,
  // and point somewhere useful.
  const picker = picking ? (
    catalogue.length === 0 ? (
      <div className="rise-soft mt-4 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4">
        <p className="eyebrow">Nothing to suggest yet</p>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--slate)]">
          There&apos;s nothing upcoming with room for two right now. New events land all
          the time - have a look and come back when you spot one.
        </p>
        <div className="mt-3 flex gap-2">
          <Link href="/discover" className="ck-btn ck-btn--sm ck-btn--primary">
            <span className="ck-btn__label">Browse events</span>
          </Link>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="ck-btn ck-btn--sm ck-btn--secondary"
          >
            Close
          </button>
        </div>
      </div>
    ) : (
    <form
      action={freshSuggest ? suggestAction : proposeAction}
      className="rise-soft mt-4 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4"
    >
      {freshSuggest ? (
        <input type="hidden" name="mutual_id" value={entry.mutualId} />
      ) : (
        <input type="hidden" name="proposal_id" value={entry.id} />
      )}
      <label htmlFor={catalogueId} className="eyebrow block">
        Choose from the Click catalogue
      </label>
      <select
        id={catalogueId}
        name="event_slug"
        required
        defaultValue=""
        className="mt-2 h-11 w-full rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
      >
        <option value="" disabled>
          Pick an event…
        </option>
        {catalogue.map((event) => (
          <option key={event.slug} value={event.slug}>
            {event.title} · {event.suburb} · {longDate.format(new Date(event.startsAt))}
          </option>
        ))}
      </select>
      <div className="mt-3 flex gap-2">
        {/* S5's primary. Naming the person is the point: it says plainly that
            this goes TO them and that they get to answer, which is exactly the
            step the old open-step "Confirm this plan" skipped past. */}
        <SubmitButton size="sm" pendingLabel="Sending…">
          Suggest this to {firstName}
        </SubmitButton>
        <button
          type="button"
          onClick={() => setPicking(false)}
          className="ck-btn ck-btn--sm ck-btn--secondary"
        >
          Cancel
        </button>
      </div>
      {(freshSuggest ? suggestState : proposeState).error ? (
        <p className="mt-3 text-xs font-medium text-[color:var(--danger)]">
          {(freshSuggest ? suggestState : proposeState).error}
        </p>
      ) : null}
    </form>
    )
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
        className="step-enter-fwd relative z-10 max-h-[92vh] w-full max-w-[540px] overflow-y-auto rounded-t-[24px] bg-[color:var(--paper)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] outline-none sm:rounded-[24px] sm:p-7"
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
              <form ref={releaseFormRef} action={releaseAction}>
                <input type="hidden" name="mutual_id" value={entry.mutualId} />
                <ReleaseControl onRequest={() => openReleaseConfirm(true)} />
              </form>
            ) : null}
            <Link
              href={`/profile/${entry.otherId}#safety`}
              className="text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]"
            >
              Report or block {firstName}
            </Link>
          </div>
          {releaseState.error ? (
            <p role="alert" className="mt-2 text-xs font-medium text-[color:var(--danger)]">
              {releaseState.error}
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
      {/* A desire, never a status - and a MIXED pair reads as two sides. The line
          arrives whole from the projection because only it knows which intent is
          whose; wrapping a fragment here could only ever produce the banned
          rounded-into-one-frame version. */}
      <p className="mt-3 rounded-full bg-[color-mix(in_srgb,var(--sage)_16%,var(--paper))] px-3 py-1.5 text-sm font-semibold text-[color:var(--sage-ink)] inline-block">
        {entry.intentLine}
        {entry.bothDating ? " · both open to dating" : null}
      </p>
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
          className="text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
        >
          Maybe later
        </button>
        <Link
          href="/how-it-works"
          className="text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]"
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
}) {
  const eventTitle = entry.suggestedEventTitle ?? "the event";
  const cal = step === "confirmed" ? gcalUrl(eventTitle, entry.suggestedEventStartsAt) : null;
  // Mirrors proposeAlternativeForProposal exactly: the budget is joint, and a plan
  // that can no longer be joined is recovered from rather than countered, so it
  // neither spends the budget nor is stopped by it.
  const capReached = entry.alternativesRemaining === 0 && !entry.suggestionUnavailable;

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
                  className="text-[13px] font-semibold text-[color:var(--purple)] underline decoration-dotted underline-offset-2"
                >
                  {eventTitle} →
                </Link>
              </div>
            ) : null}
          </>
        ) : entry.suggestedEventJoinable ? (
          // Viewer still needs a seat, and can still get one - keep the live RSVP.
          <>
            <h2 id={titleId} className={headingClass}>
              {entry.confirmedByMe
                ? "You're in - now lock in your seat."
                : `${firstName} confirmed this plan`}
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
              {entry.otherHasSeat ? (
                <>
                  {firstName} already has a seat. RSVP to lock in yours - you&apos;re going together
                  once you do.
                </>
              ) : (
                <>RSVP to lock in your seat. You&apos;re both going once you each have a spot.</>
              )}
            </p>
            {entry.suggestedEventSlug ? (
              <Link
                href={`/events/${entry.suggestedEventSlug}`}
                className="ck-btn ck-btn--md ck-btn--primary mt-5"
              >
                RSVP to {eventTitle} →
              </Link>
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
      ) : (
        // open / proposed - a plan is (or can be) on the table.
        <>
          {/* S14 - the seat filled first. Lavender compass disc, calm copy, never
              coral. Only for the sold-out arm: a cancelled or already-started
              event is a different disappointment and keeps its own line. */}
          {entry.suggestionUnavailable &&
          !entry.suggestedEventCancelled &&
          !entry.suggestedEventStarted ? (
            <div
              aria-hidden
              className="mb-1 grid h-16 w-16 place-items-center rounded-full bg-[color:var(--lav-bg)] text-2xl leading-none text-[color:var(--purple)]"
            >
              ⊙
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
            ) : step === "proposed" && entry.proposedByMe ? (
              <>You&apos;re in - waiting on {firstName}</>
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
          {entry.suggestionUnavailable &&
          !entry.suggestedEventCancelled &&
          !entry.suggestedEventStarted ? (
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
              No drama - there&apos;s always another. Find one you&apos;ll both like.
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
                {entry.suggestedEventSlug ? "Suggest alternative" : "Suggest a plan"}
              </button>
              {/* Say the number before it runs out, and explain the dead button
                  when it has. alternativesRemaining was referenced exactly once
                  in this component - its own definition.
                  At the cap both sides used to read "it's their turn to pick",
                  so each sat waiting for a move the other could not make: the
                  budget is joint, so neither button is live. Split on who
                  proposed. The proposer is genuinely waiting; the recipient
                  still holds both live controls beside this note, and passing
                  declines the plan, which drops the proposal row and hands the
                  pair a fresh budget on the next suggestion. */}
              {entry.suggestedEventSlug && entry.alternativesRemaining <= 2 && !entry.suggestionUnavailable ? (
                <p
                  id="suggest-cap-note"
                  className="text-[11.5px] font-medium text-[color:var(--slate)]"
                >
                  {entry.alternativesRemaining === 0
                    ? entry.proposedByMe
                      ? `You've both used up the suggestions for this plan - it's with ${firstName} to confirm or pass.`
                      : "You've both used up the suggestions for this plan - confirm it, or pass and you two can start fresh."
                    : `${entry.alternativesRemaining} suggestion${
                        entry.alternativesRemaining === 1 ? "" : "s"
                      } left for this plan.`}
                </p>
              ) : null}
            </div>
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

          {picker}
        </>
      )}
    </div>
  );
}

const headingClass =
  "font-display mt-2 text-2xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]";
