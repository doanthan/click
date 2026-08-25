"use client";

import { useState } from "react";
import Link from "next/link";
import { CoordinationDrawer } from "./coordination-drawer";
import type { ProposalCatalogueEvent, ProposalEntry } from "@/lib/event-repository";

// "Your clicks" (§7): the durable list. Every row is the SAME compact outcome card;
// state is only an accent, never a different layout. Tapping a row opens the ONE
// coordination drawer at that mutual's current step (§1) - the list is a list, not a
// coordination surface, so it's allowed to be a routed page (§10.12). The list OWNS which
// mutual is open and feeds the drawer the LIVE entry, so a mutation's revalidate flows
// the fresh coord_state straight back into the open drawer (advance in place).

const longDate = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" });

type Tone = "sage" | "amber" | "neutral";

// A row's accent + one-word state, derived purely from the entry (mirrors the drawer's
// projection). Never the §11-banned "expired" OR "wound down" - both are the
// verdict/loss register CLICK_LANGUAGE.md §5a bans by name. A lapsed plan is
// simply "Still out there".
function rowState(e: ProposalEntry): { label: string; tone: Tone; sub: string } {
  const first = e.otherName.split(/\s+/)[0];
  if (e.isExpired) return { label: "Still out there", tone: "neutral", sub: "Cross paths again and you can pick it up." };
  // A seat you're holding outranks everything: it stays "both going" through the
  // night itself. Only a genuinely dead event (cancelled) is "fell through".
  if (e.status === "confirmed") {
    if (!e.suggestedEventSlug || e.suggestedEventCancelled)
      return { label: "Pick a plan", tone: "amber", sub: "That plan fell through - pick another." };
    if (e.viewerHasSeat) {
      return e.otherHasSeat
        ? { label: "Both going", tone: "sage", sub: `You're both going to ${e.suggestedEventTitle ?? "the event"}.` }
        : { label: "You're in", tone: "sage", sub: `Your seat's locked - waiting on ${first}.` };
    }
    // Confirmed but seatless on an event that's closed to you - never prompt an
    // RSVP that cannot happen.
    if (!e.suggestedEventJoinable)
      return {
        label: "Pick a plan",
        tone: "amber",
        sub: e.suggestedEventStarted ? "That one's already started - pick another." : "That one filled up - pick another.",
      };
    return { label: "RSVP needed", tone: "amber", sub: `RSVP to lock in your seat.` };
  }
  // pending
  if (e.suggestionUnavailable)
    return { label: "Pick a plan", tone: "amber", sub: `${e.suggestedEventTitle ?? "That plan"} is off the table - pick another.` };
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

function ClickRow({ entry, onOpen }: { entry: ProposalEntry; onOpen: () => void }) {
  const s = rowState(entry);
  return (
    // min-w-0: a grid item defaults to min-width:auto and won't shrink below its
    // content, so without this the row grows to its untruncated text and pushes the
    // badge off-screen at 375. min-w-0 lets the column shrink so `truncate` bites.
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
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
  // The list owns which mutual is open (a deep-linked ?open= opens on first render). The
  // drawer is fed the LIVE entry, so a mutation's revalidate advances it in place.
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const openEntry = openId ? entries.find((e) => e.mutualId === openId) ?? null : null;
  const openMissing = Boolean(openId) && !openEntry;

  const live = entries.filter((e) => !e.isExpired);
  const past = entries.filter((e) => e.isExpired);

  return (
    <>
      {openEntry ? (
        <CoordinationDrawer
          key={openEntry.mutualId}
          entry={openEntry}
          catalogue={catalogue}
          onClose={() => setOpenId(null)}
        />
      ) : null}

      {openMissing ? (
        <p className="mt-7 rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] px-4 py-3 text-sm font-medium text-[color:var(--ink-soft)]">
          That one isn&apos;t here any more. Everything still going is below.
        </p>
      ) : null}

      {live.length > 0 ? (
        <ul className="mt-7 grid gap-4">
          {live.map((entry) => (
            <ClickRow key={entry.mutualId} entry={entry} onOpen={() => setOpenId(entry.mutualId)} />
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
              <ClickRow key={entry.mutualId} entry={entry} onOpen={() => setOpenId(entry.mutualId)} />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
