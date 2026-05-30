"use client";

import { useState } from "react";
import Link from "next/link";
import { confirmProposalAction, proposeAlternativeAction } from "@/app/proposals/actions";
import type { ProposalCatalogueEvent, ProposalEntry } from "@/lib/event-repository";

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

  const settled = proposal.status === "confirmed" || proposal.isExpired;

  return (
    <li className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          You + {proposal.otherName}
        </p>
        <StatusBadge proposal={proposal} />
      </div>

      <h3 className="font-display mt-2 text-2xl font-light leading-tight text-[color:var(--ink)]">
        {proposal.suggestedEventTitle ? (
          <>
            Suggested:{" "}
            <Link
              href={`/events/${proposal.suggestedEventSlug}`}
              className="italic hover:text-[color:var(--rose)]"
            >
              {proposal.suggestedEventTitle}
            </Link>
          </>
        ) : (
          "Pick something to do together."
        )}
      </h3>
      {proposal.suggestedEventStartsAt ? (
        <p className="mt-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          {longDate.format(new Date(proposal.suggestedEventStartsAt))}
        </p>
      ) : null}

      {proposal.status === "confirmed" ? (
        <p className="mt-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-3 text-sm font-bold text-[color:var(--ink)]">
          Plan confirmed — see you there. 🎉
        </p>
      ) : proposal.isExpired ? (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-3 text-sm font-medium text-[color:var(--mauve)]">
          This proposal expired. Click again at a future event to reopen it.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <form action={confirmProposalAction}>
              <input type="hidden" name="proposal_id" value={proposal.id} />
              <button
                type="submit"
                disabled={!proposal.suggestedEventSlug}
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm this plan
              </button>
            </form>
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              disabled={proposal.alternativesRemaining === 0}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suggest alternative
            </button>
            <span className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-[color:var(--mauve)]">
              {proposal.alternativesRemaining} of 3 left
            </span>
          </div>

          {picking ? (
            <form
              action={proposeAlternativeAction}
              className="mt-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4"
            >
              <input type="hidden" name="proposal_id" value={proposal.id} />
              <label className="block font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                Choose from the Click catalogue
              </label>
              <select
                name="event_slug"
                required
                defaultValue=""
                className="mt-2 w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)]"
              >
                <option value="" disabled>
                  Pick an event…
                </option>
                {catalogue.map((event) => (
                  <option key={event.slug} value={event.slug}>
                    {event.title} · {event.suburb} ·{" "}
                    {longDate.format(new Date(event.startsAt))}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
                >
                  Send suggestion
                </button>
                <button
                  type="button"
                  onClick={() => setPicking(false)}
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </>
      )}

      {!settled ? (
        <p className="mt-4 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-[color:var(--mauve)]">
          Expires {longDate.format(new Date(proposal.expiresAt))}
        </p>
      ) : null}
    </li>
  );
}

function StatusBadge({ proposal }: { proposal: ProposalEntry }) {
  const { label, tone } =
    proposal.status === "confirmed"
      ? { label: "Confirmed", tone: "bg-[color:var(--rose)] text-[color:var(--surface-deep)]" }
      : proposal.isExpired
        ? { label: "Expired", tone: "bg-[color:var(--cream)] text-[color:var(--mauve)]" }
        : { label: "Pending", tone: "bg-[color:var(--peach)] text-[color:var(--ink)]" };

  return (
    <span
      className={`rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${tone}`}
    >
      {label}
    </span>
  );
}
