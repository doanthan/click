"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  confirmProposalAction,
  proposeAlternativeAction,
  type ProposalActionState,
} from "@/app/proposals/actions";
import type { ProposalCatalogueEvent, ProposalEntry } from "@/lib/event-repository";

const INITIAL_ACTION_STATE: ProposalActionState = { ok: false, error: null };

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

const longDate = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function ProposalCard({
  proposal,
  catalogue,
}: {
  proposal: ProposalEntry;
  catalogue: ProposalCatalogueEvent[];
}) {
  const [picking, setPicking] = useState(false);
  const [confirmState, confirmAction] = useActionState(
    confirmProposalAction,
    INITIAL_ACTION_STATE,
  );
  const [proposeState, proposeAction] = useActionState(
    proposeAlternativeAction,
    INITIAL_ACTION_STATE,
  );

  // Close the catalogue picker once a suggestion lands so the updated proposal
  // is visible. Done as a render-time adjustment (tracking the last-handled
  // action result) rather than an effect - each submit yields a new state
  // object, so reference identity tells us when a fresh result arrives.
  const [handledResult, setHandledResult] = useState(proposeState);
  if (proposeState !== handledResult) {
    setHandledResult(proposeState);
    if (proposeState.ok) setPicking(false);
  }

  // C12: a confirmed plan whose event has died (no live suggested event) is NOT a
  // terminal — it drops to a re-suggest recovery below, never a "Wrapped" dead end.
  const agreedEventGone = proposal.status === "confirmed" && !proposal.suggestedEventSlug;
  const settled = (proposal.status === "confirmed" && !agreedEventGone) || proposal.isExpired;

  // The catalogue picker is shared by the pending action row AND the C12 recovery.
  const picker = picking ? (
    <form
      action={proposeAction}
      className="mt-4 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4"
    >
      <input type="hidden" name="proposal_id" value={proposal.id} />
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
      {proposeState.error ? (
        <p className="mt-3 text-xs font-medium text-[color:var(--danger)]">
          {proposeState.error}
        </p>
      ) : null}
    </form>
  ) : null;

  return (
    <li className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-[color:var(--slate)]">
          You +{" "}
          <Link
            href={`/profile/${proposal.otherId}`}
            className="text-[color:var(--purple)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]"
          >
            {proposal.otherName}
          </Link>
        </p>
        <StatusBadge proposal={proposal} />
      </div>

      <h3 className="font-display mt-2 text-2xl font-semibold tracking-[-0.025em] leading-tight text-[color:var(--ink)]">
        {proposal.suggestedEventTitle ? (
          <>
            Suggested:{" "}
            <Link
              href={`/events/${proposal.suggestedEventSlug}`}
              className="text-[color:var(--purple)] hover:text-[color:var(--rose)]"
            >
              {proposal.suggestedEventTitle}
            </Link>
          </>
        ) : proposal.suggestionUnavailable || agreedEventGone ? (
          "That plan fell through - pick another together."
        ) : proposal.status === "confirmed" ? (
          <>Your plan with {proposal.otherName}.</>
        ) : (
          "Pick something to do together."
        )}
      </h3>
      {proposal.suggestedEventStartsAt ? (
        <p className="mt-1 text-xs font-semibold tracking-[0.04em] text-[color:var(--slate)]">
          {longDate.format(new Date(proposal.suggestedEventStartsAt))}
        </p>
      ) : null}

      {/* The suggested event sold out (or was cancelled) since it was proposed.
          Neither person is attending it, so spell that out and steer them to
          "Suggest alternative" rather than leaving a dead, disabled card. */}
      {(proposal.suggestionUnavailable || agreedEventGone) && !settled ? (
        <p className="mt-3 rounded-2xl bg-[color:var(--lav-bg)] p-3 text-sm font-medium text-[color:var(--ink-soft)]">
          {agreedEventGone
            ? "The event you two agreed on isn't available anymore, so nothing's booked - pick another plan together and you're back on."
            : "The event you were eyeing is now full or no longer available - you aren't booked into anything yet."}
        </p>
      ) : null}

      {proposal.status === "confirmed" && !agreedEventGone ? (
        proposal.viewerHasSeat ? (
          // C11: the viewer already holds a seat — never a live RSVP button, never a
          // "RSVP needed" badge. Status line is partner-focused (§B4.1 step 7).
          <div className="mt-4 rounded-[var(--radius-lg)] bg-[color:var(--lav-bg)] p-3">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              {proposal.otherHasSeat ? "You're both going ✨" : "You're in ✨"}
            </p>
            <p className="mt-1 text-sm font-medium text-[color:var(--ink)]/80">
              {proposal.otherHasSeat ? (
                <>
                  You and {proposal.otherName} both have a seat at{" "}
                  {proposal.suggestedEventTitle ?? "the event"}. See you there.
                </>
              ) : (
                <>
                  Your seat&apos;s locked in. {proposal.otherName} hasn&apos;t grabbed one
                  yet - you&apos;ll be going together the moment they do.
                </>
              )}
            </p>
            <Link
              href={`/events/${proposal.suggestedEventSlug}`}
              className="ck-btn ck-btn--sm ck-btn--secondary mt-3"
            >
              View {proposal.suggestedEventTitle ?? "the event"} →
            </Link>
          </div>
        ) : (
          // Viewer still needs a seat — keep the live RSVP.
          <div className="mt-4 rounded-[var(--radius-lg)] bg-[color:var(--lav-bg)] p-3">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              {proposal.confirmedByMe
                ? "You're in - now lock in your seat."
                : `${proposal.otherName} confirmed this plan`}
            </p>
            <p className="mt-1 text-sm font-medium text-[color:var(--ink)]/80">
              {proposal.otherHasSeat ? (
                <>
                  {proposal.otherName} already has a seat. RSVP to lock in yours -
                  you&apos;re going together once you do.
                </>
              ) : (
                <>
                  RSVP to lock in your seat. You&apos;re both going once you each
                  have a confirmed spot.
                </>
              )}
            </p>
            <Link
              href={`/events/${proposal.suggestedEventSlug}`}
              className="ck-btn ck-btn--sm ck-btn--primary mt-3"
            >
              RSVP to {proposal.suggestedEventTitle ?? "the event"} →
            </Link>
          </div>
        )
      ) : agreedEventGone ? (
        // C12: a dead agreed event is a failed attempt, not a terminal — offer a
        // re-suggest, never a delete button.
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              className="ck-btn ck-btn--md ck-btn--primary"
            >
              Suggest another plan
            </button>
          </div>
          {picker}
        </>
      ) : proposal.isExpired ? (
        <p className="mt-4 rounded-2xl bg-[color:var(--lav-bg)] p-3 text-sm font-medium text-[color:var(--ink-soft)]">
          This proposal expired. Click again at a future event to reopen it.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <form action={confirmAction}>
              <input type="hidden" name="proposal_id" value={proposal.id} />
              <SubmitButton
                disabled={!proposal.suggestedEventSlug}
                className="ck-btn ck-btn--md ck-btn--primary disabled:cursor-not-allowed"
              >
                Confirm this plan
              </SubmitButton>
            </form>
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              disabled={proposal.alternativesRemaining === 0}
              className="ck-btn ck-btn--md ck-btn--secondary disabled:cursor-not-allowed"
            >
              Suggest alternative
            </button>
            <span className="text-[12px] font-medium text-[color:var(--slate)]">
              {proposal.alternativesRemaining} of 3 left
            </span>
          </div>

          {confirmState.error ? (
            <p className="mt-3 rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] px-3 py-2 text-xs font-medium text-[color:var(--ink-soft)]">
              {confirmState.error}
            </p>
          ) : null}

          {picker}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {!settled ? (
          <p className="text-[12px] font-medium text-[color:var(--slate)]">
            Expires {longDate.format(new Date(proposal.expiresAt))}
          </p>
        ) : (
          <span />
        )}
        {/* SAFE-08: an in-flow safety exit. Links to the partner's profile where the
            block / mute / report controls live (blocking ends this plan immediately). */}
        <Link
          href={`/profile/${proposal.otherId}#safety`}
          className="text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]"
        >
          Report or block {proposal.otherName.split(/\s+/)[0]}
        </Link>
      </div>
    </li>
  );
}

function StatusBadge({ proposal }: { proposal: ProposalEntry }) {
  const amber =
    "bg-[color-mix(in_srgb,var(--amber)_16%,var(--paper))] text-[color:var(--amber-ink)]";
  const sage =
    "bg-[color-mix(in_srgb,var(--sage)_16%,var(--paper))] text-[color:var(--sage-ink)]";
  const neutral = "bg-[color:var(--cream)] text-[color:var(--mauve)]";

  const agreedEventGone = proposal.status === "confirmed" && !proposal.suggestedEventSlug;
  const { label, tone } =
    proposal.status === "confirmed" && !agreedEventGone
      ? proposal.viewerHasSeat
        // C11: the already-booked side never shows a pair-computed "RSVP needed" badge.
        ? proposal.otherHasSeat
          ? { label: "Both going", tone: sage }
          : { label: "You're in", tone: sage }
        : { label: "RSVP needed", tone: amber }
      : agreedEventGone
        // C12: not a terminal — an invitation to re-pick, not a "Wrapped" dead end.
        ? { label: "Pick a plan", tone: amber }
        : proposal.isExpired
          ? { label: "Expired", tone: neutral }
          : { label: "Pending", tone: amber };

  return <span className={`ck-badge ${tone}`}>{label}</span>;
}
