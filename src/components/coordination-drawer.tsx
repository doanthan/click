"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  confirmProposalAction,
  declineProposalAction,
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

type Step = "reveal" | "open" | "proposed" | "confirmed" | "gone" | "expired";

// Projection from the entry (§2). `gone` = C12: a confirmed plan whose agreed event
// died (no live suggestion left) - a failed attempt, never a terminal.
function projectStep(entry: ProposalEntry): Exclude<Step, "reveal"> {
  if (entry.status === "expired" || entry.isExpired) return "expired";
  if (entry.status === "confirmed") return entry.suggestedEventSlug ? "confirmed" : "gone";
  return entry.coordState === "proposed" ? "proposed" : "open";
}

function SubmitButton({
  className,
  children,
  disabled,
}: {
  className: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? "Sending…" : children}
    </button>
  );
}

export function CoordinationDrawer({
  entry,
  catalogue,
  onClose,
}: {
  entry: ProposalEntry;
  catalogue: ProposalCatalogueEvent[];
  onClose: () => void;
}) {
  const [confirmState, confirmAction] = useActionState(confirmProposalAction, INITIAL);
  const [declineState, declineAction] = useActionState(declineProposalAction, INITIAL);
  const [proposeState, proposeAction] = useActionState(proposeAlternativeAction, INITIAL);
  const [suggestState, suggestAction] = useActionState(suggestPlanAction, INITIAL);
  const [releaseState, releaseAction] = useActionState(releaseMutualAction, INITIAL);

  const [picking, setPicking] = useState(false);
  const [revealDismissed, setRevealDismissed] = useState(() =>
    revealedThisSession.has(entry.mutualId),
  );

  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  // When a successful action revalidates /proposals, close the picker after the
  // fresh server state renders so local UI never fights the server truth.
  const sig = `${entry.status}|${entry.coordState}|${entry.suggestedEventSlug ?? ""}`;
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
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
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
  // Reveal fires once per user per mutual (§4). Skip on a dead/expired mutual.
  const step: Step = !entry.revealSeen && !revealDismissed && base !== "expired" ? "reveal" : base;

  function dismissReveal() {
    revealedThisSession.add(entry.mutualId);
    setRevealDismissed(true);
    void markMutualSeenAction(entry.mutualId); // persist for reload / other devices
  }

  const firstName = entry.otherName.split(/\s+/)[0];
  // An open mutual with no live plan → a FRESH suggestion keyed on the mutual
  // (suggestPlanAction). A live pending plan is re-pointed instead (proposeAlternative,
  // which owns the 3-alt cap).
  const freshSuggest = step === "open" && !entry.suggestedEventSlug;

  const picker = picking ? (
    <form
      action={freshSuggest ? suggestAction : proposeAction}
      className="mt-4 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4"
    >
      {freshSuggest ? (
        <input type="hidden" name="mutual_id" value={entry.mutualId} />
      ) : (
        <input type="hidden" name="proposal_id" value={entry.id} />
      )}
      <label className="eyebrow block">Choose from the Click catalogue</label>
      <select
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
        <SubmitButton className="ck-btn ck-btn--sm ck-btn--primary disabled:cursor-not-allowed">
          Send suggestion
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
  ) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[color:var(--surface-deep)]/45 backdrop-blur-[2px]"
      />
      <div
        ref={cardRef}
        tabIndex={-1}
        className="step-enter-fwd relative z-10 max-h-[92vh] w-full max-w-[540px] overflow-y-auto rounded-t-[24px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-lg)] outline-none sm:rounded-[24px] sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lav-bg)] hover:text-[color:var(--ink)]"
        >
          <span aria-hidden className="text-lg leading-none">
            ✕
          </span>
        </button>

        {step === "reveal" ? (
          <RevealStep entry={entry} titleId={titleId} onSuggest={dismissReveal} />
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
            picker={picker}
          />
        )}

        {/* SAFE-08: an in-flow safety exit at every step - block ends the plan. */}
        <div className="mt-6 border-t border-[color:var(--line-soft)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form
              action={releaseAction}
              onSubmit={(event) => {
                if (!window.confirm(`Hide this connection with ${firstName}?`)) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="mutual_id" value={entry.mutualId} />
              <SubmitButton className="text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)] disabled:opacity-50">
                Not feeling it
              </SubmitButton>
            </form>
            <Link
              href={`/profile/${entry.otherId}#safety`}
              className="text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]"
            >
              Report or block {firstName}
            </Link>
          </div>
          {releaseState.error ? (
            <p className="mt-2 text-xs font-medium text-[color:var(--danger)]">
              {releaseState.error}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// §4 reveal - copy locked, fired once. Headline, intent line (a desire not a status),
// the dating opt-in line only when BOTH opted in, one action, quiet explainer link.
function RevealStep({
  entry,
  titleId,
  onSuggest,
}: {
  entry: ProposalEntry;
  titleId: string;
  onSuggest: () => void;
}) {
  return (
    <div>
      <span className="eyebrow">It&apos;s mutual</span>
      <h2
        id={titleId}
        className="font-display mt-3 text-3xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]"
      >
        You clicked with {entry.otherName}.
      </h2>
      <p className="mt-3 text-base font-medium leading-6 text-[color:var(--ink-soft)]">
        You&apos;re both here for {entry.sharedIntent}.
      </p>
      {entry.bothDating ? (
        <p className="mt-2 text-sm font-semibold text-[color:var(--purple)]">
          You&apos;re both open to dating ✨
        </p>
      ) : null}
      <button type="button" onClick={onSuggest} className="ck-btn ck-btn--md ck-btn--primary mt-6">
        Suggest something to do
      </button>
      <div className="mt-4">
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
  picker: React.ReactNode;
}) {
  const eventTitle = entry.suggestedEventTitle ?? "the event";
  const cal = step === "confirmed" ? gcalUrl(eventTitle, entry.suggestedEventStartsAt) : null;

  return (
    <div>
      <span className="eyebrow">You + {entry.otherName}</span>

      {step === "confirmed" ? (
        entry.viewerHasSeat ? (
          // C11: already-booked side - never a live RSVP, partner-focused status.
          <>
            <h2 id={titleId} className={headingClass}>
              {entry.otherHasSeat ? "You're both going ✨" : "You're in ✨"}
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
              {entry.otherHasSeat ? (
                <>
                  You and {firstName} both have a seat at {eventTitle}. See you there.
                </>
              ) : (
                <>
                  Your seat&apos;s locked in. {firstName} hasn&apos;t grabbed one yet - you&apos;ll
                  be going together the moment they do.
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {cal ? (
                <a
                  href={cal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ck-btn ck-btn--md ck-btn--primary"
                >
                  Add to calendar
                </a>
              ) : null}
              {entry.suggestedEventSlug ? (
                <Link
                  href={`/events/${entry.suggestedEventSlug}`}
                  className="ck-btn ck-btn--md ck-btn--secondary"
                >
                  View {eventTitle} →
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          // Viewer still needs a seat - keep the live RSVP.
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
      ) : step === "expired" ? (
        <>
          <h2 id={titleId} className={headingClass}>
            This plan wound down.
          </h2>
          <p className="mt-3 rounded-2xl bg-[color:var(--lav-bg)] p-3 text-sm font-medium text-[color:var(--ink-soft)]">
            Still out there - if you cross paths again, you can pick it back up.
          </p>
        </>
      ) : (
        // open / proposed — a plan is (or can be) on the table.
        <>
          <h2 id={titleId} className={headingClass}>
            {step === "proposed" && entry.proposedByMe ? (
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
            {/* The proposer is waiting; only the recipient (or an open mutual) confirms. */}
            {!(step === "proposed" && entry.proposedByMe) && entry.suggestedEventSlug ? (
              <form action={confirmAction}>
                <input type="hidden" name="proposal_id" value={entry.id} />
                <SubmitButton className="ck-btn ck-btn--md ck-btn--primary disabled:cursor-not-allowed">
                  Confirm this plan
                </SubmitButton>
              </form>
            ) : null}
            <button
              type="button"
              onClick={onTogglePicker}
              disabled={entry.alternativesRemaining === 0 && !entry.proposedByMe}
              className="ck-btn ck-btn--md ck-btn--secondary disabled:cursor-not-allowed"
            >
              {entry.suggestedEventSlug ? "Suggest alternative" : "Suggest a plan"}
            </button>
            {/* Decline is the recipient's no - returns to open, no blame (§B6). */}
            {step === "proposed" && !entry.proposedByMe ? (
              <form action={declineAction}>
                <input type="hidden" name="proposal_id" value={entry.id} />
                <SubmitButton className="ck-btn ck-btn--md ck-btn--ghost disabled:cursor-not-allowed">
                  Not this one
                </SubmitButton>
              </form>
            ) : null}
          </div>

          {confirmError ? (
            <p className="mt-3 rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] px-3 py-2 text-xs font-medium text-[color:var(--ink-soft)]">
              {confirmError}
            </p>
          ) : null}
          {declineError ? (
            <p className="mt-3 rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] px-3 py-2 text-xs font-medium text-[color:var(--ink-soft)]">
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
