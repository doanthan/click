"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CoordinationDrawerHost, openCoordinationDrawer } from "./coordination-drawer";
import type { ProposalCatalogueEvent, ProposalEntry } from "@/lib/event-repository";

// "Your clicks" (§7): the durable list. Every row is the SAME compact outcome card;
// state is only an accent, never a different layout. Tapping a row opens the ONE
// coordination drawer at that mutual's current step (§1) - the list is a list, not a
// coordination surface, so it's allowed to be a routed page (§10.12).

const longDate = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" });

type Tone = "sage" | "amber" | "neutral";

// A row's accent + one-word state, derived purely from the entry (mirrors the drawer's
// projection). Never the §11-banned "expired" - a lapsed plan is softly "Wound down".
function rowState(e: ProposalEntry): { label: string; tone: Tone; sub: string } {
  const first = e.otherName.split(/\s+/)[0];
  if (e.isExpired) return { label: "Wound down", tone: "neutral", sub: "Cross paths again and you can pick it up." };
  if (e.status === "confirmed") {
    if (!e.suggestedEventSlug) return { label: "Pick a plan", tone: "amber", sub: "That plan fell through - pick another." };
    if (e.viewerHasSeat) {
      return e.otherHasSeat
        ? { label: "Both going", tone: "sage", sub: `You're both going to ${e.suggestedEventTitle ?? "the event"}.` }
        : { label: "You're in", tone: "sage", sub: `Your seat's locked - waiting on ${first}.` };
    }
    return { label: "RSVP needed", tone: "amber", sub: `RSVP to lock in your seat.` };
  }
  // pending
  if (e.coordState === "proposed") {
    return e.proposedByMe
      ? { label: "Waiting", tone: "amber", sub: `Waiting on ${first} to say yes.` }
      : { label: "Your turn", tone: "amber", sub: `${first}'s keen for ${e.suggestedEventTitle ?? "a plan"} - you in?` };
  }
  return e.suggestedEventSlug
    ? { label: "Plan ready", tone: "amber", sub: e.suggestedEventTitle ?? "A plan's ready." }
    : { label: "Suggest a plan", tone: "amber", sub: "Suggest something to do together." };
}

const toneClass: Record<Tone, string> = {
  sage: "bg-[color-mix(in_srgb,var(--sage)_16%,var(--paper))] text-[color:var(--sage-ink)]",
  amber: "bg-[color-mix(in_srgb,var(--amber)_16%,var(--paper))] text-[color:var(--amber-ink)]",
  neutral: "bg-[color:var(--cream)] text-[color:var(--mauve)]",
};

function ClickRow({ entry }: { entry: ProposalEntry }) {
  const s = rowState(entry);
  return (
    <li>
      <button
        type="button"
        onClick={() => openCoordinationDrawer(entry)}
        className="w-full rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-5 text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lavender-100)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-[color:var(--slate)]">You + {entry.otherName}</p>
            <p className="font-display mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
              {s.sub}
            </p>
            {entry.suggestedEventStartsAt && !entry.isExpired ? (
              <p className="mt-1 text-xs font-semibold tracking-[0.04em] text-[color:var(--slate)]">
                {longDate.format(new Date(entry.suggestedEventStartsAt))}
              </p>
            ) : null}
          </div>
          <span className={`ck-badge shrink-0 ${toneClass[s.tone]}`}>{s.label}</span>
        </div>
      </button>
    </li>
  );
}

export function ClicksList({
  entries,
  catalogue,
  initialOpenId,
}: {
  entries: ProposalEntry[];
  catalogue: ProposalCatalogueEvent[];
  initialOpenId?: string;
}) {
  const live = entries.filter((e) => !e.isExpired);
  const past = entries.filter((e) => e.isExpired);

  // Deep-link (?open=<mutualId>, e.g. a notification): open the drawer at the current
  // step on mount. The host is a child, so its listener is registered before this
  // parent effect fires. Runs once (the id is the page's initial param).
  useEffect(() => {
    if (!initialOpenId) return;
    const match = entries.find((e) => e.mutualId === initialOpenId);
    if (match) openCoordinationDrawer(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenId]);

  return (
    <>
      <CoordinationDrawerHost catalogue={catalogue} />

      {live.length > 0 ? (
        <ul className="mt-7 grid gap-4">
          {live.map((entry) => (
            <ClickRow key={entry.mutualId} entry={entry} />
          ))}
        </ul>
      ) : (
        <div className="mt-7 rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-8 text-center">
          <p className="font-display text-[1.05rem] font-semibold text-[color:var(--ink)]">No live clicks yet.</p>
          <p className="mx-auto mt-2 max-w-[380px] text-sm leading-relaxed text-[color:var(--ink-soft)]">
            Show up to an event, then click with someone afterwards. If they click you back, your first
            plan opens here.
          </p>
          <div className="mt-4 flex justify-center">
            <Link href="/discover" className="ck-btn ck-btn--sm ck-btn--primary">
              <span className="ck-btn__label">Find events</span>
            </Link>
          </div>
        </div>
      )}

      {past.length > 0 ? (
        <div className="mt-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--slate)]">
            Past clicks · {past.length}
          </p>
          <ul className="grid gap-4">
            {past.map((entry) => (
              <ClickRow key={entry.mutualId} entry={entry} />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
