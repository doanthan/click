"use client";

import { useState } from "react";
import Link from "next/link";
import { CoordinationDrawer } from "./coordination-drawer";
import { ckBtn } from "./ds";
import { PeopleCard } from "./people-card";
import type { ProposalCatalogueEvent, ProposalEntry } from "@/lib/event-repository";

// "Your clicks" (COORDINATION_MODAL_SYSTEM §7): the durable home, grouped Live mutuals ·
// Plans · Past clicks. Every row is the SAME outcome card - the People Card the rest of
// the product shows people on - and state is carried by three things only (the DS's
// Your-clicks outcome card, CLICK_LANGUAGE v27 §5): the section header, an earned accent
// (the lavender-wash fill on YOUR-MOVE cards - never a status colour, which stays on
// badges) and the action. No state pill beside the name, no ✨ on a list row.
//
// Tapping a row's action opens the ONE coordination drawer at that mutual's current step
// (§1) - the list is a list, not a coordination surface, so it's allowed to be a routed
// page (§10.12). The list OWNS which mutual is open and feeds the drawer the LIVE entry,
// so a mutation's revalidate flows the fresh coord_state straight back into the open
// drawer (advance in place).

const shortDate = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" });

type Shelf = "live" | "plan" | "past";
// Whose move it is decides the fill and the button: yours = the lavender-wash card and
// the purple verb; theirs = a white card and the muted "Waiting on [Name]" footprint
// (still a way into the drawer); settled = a white card and the quiet secondary.
type Turn = "yours" | "theirs" | "settled";

type OutcomeCard = { shelf: Shelf; turn: Turn; detail: string | null; action: string | null };

// Derived purely from the entry, in the drawer's own reading order (projectStep): the
// mutual's status FIRST, then coord_state while it is active - so the card and the
// drawer it opens never describe the same click two different ways (bug board #225).
// Never the banned "expired" / "wound down" / "didn't line up" (§5a): a lapsed click is
// simply "Still out there".
function outcomeCard(e: ProposalEntry): OutcomeCard {
  const first = e.otherName.split(/\s+/)[0];
  const title = e.suggestedEventTitle ?? "That plan";
  const when = e.suggestedEventStartsAt
    ? ` · ${shortDate.format(new Date(e.suggestedEventStartsAt))}`
    : "";

  // The SUCCESS terminal. Names the plan they went to; "We clicked 👍" is its closure
  // action, never a status pill. With no plan the card's own "You were both at" line
  // already names the night, so the detail stays empty rather than restating it.
  if (e.mutualStatus === "connected") {
    return {
      shelf: "past",
      turn: "settled",
      detail:
        e.status === "confirmed" && e.suggestedEventTitle
          ? `You went to ${e.suggestedEventTitle} together${when}`
          : null,
      action: "We clicked 👍",
    };
  }
  // Soft-released, or a plan that lapsed: the neutral S16 line, no marker, nothing to
  // do - the absence is the signal. S18 is read before the clock, as the drawer reads it.
  if (e.mutualStatus !== "active" || (e.isExpired && !e.partnerCancelled)) {
    return {
      shelf: "past",
      turn: "settled",
      detail: "Still out there - if you cross paths again, you can pick it back up.",
      action: null,
    };
  }
  // §B5.6 S18: their plans changed. Neither a peak nor a failure - and never the
  // both-going marker for a partner who isn't coming.
  if (e.partnerCancelled) {
    return {
      shelf: "live",
      turn: "yours",
      detail: `${first}'s plans changed - pick something else together`,
      action: "Suggest a plan →",
    };
  }
  // Agreed - through the handshake, or two people who each booked the same night
  // (§B5.3 reaches confirmed_together either way).
  if (e.status === "confirmed" || e.coordState === "confirmed_together") {
    if (!e.suggestedEventSlug || e.suggestedEventCancelled) {
      return { shelf: "live", turn: "yours", detail: "That plan fell through - pick another", action: "Suggest a plan →" };
    }
    // A seat each is a Plan, and stays one through the night itself.
    if (e.viewerHasSeat && e.otherHasSeat) {
      return { shelf: "plan", turn: "settled", detail: `Going to ${e.suggestedEventTitle ?? "an event"}${when}`, action: "See the plan →" };
    }
    if (e.viewerHasSeat) {
      return { shelf: "live", turn: "theirs", detail: `Waiting for ${first} to save their spot`, action: `Waiting on ${first}` };
    }
    // Seatless on a night that's closed to you - never prompt an RSVP that can't happen.
    if (!e.suggestedEventJoinable) {
      return {
        shelf: "live",
        turn: "yours",
        detail: e.suggestedEventStarted ? `${title} has already started` : `${title} filled up`,
        action: "Suggest a plan →",
      };
    }
    return {
      shelf: "live",
      turn: "yours",
      detail: e.otherHasSeat ? `${first}'s in - save your spot` : "You both said yes - grab your seat",
      action: "Save your spot →",
    };
  }
  if (e.suggestionUnavailable) {
    return { shelf: "live", turn: "yours", detail: `${title} is off the table`, action: "Suggest a plan →" };
  }
  if (e.coordState === "proposed") {
    // The proposer's line is the drawer's own S6 headline, so the card and the step it
    // opens say the same thing - and it says nothing a chat would ("reply" is C4 grep
    // 5's no-chat vocabulary).
    return e.proposedByMe
      ? { shelf: "live", turn: "theirs", detail: `Suggested to ${first}`, action: `Waiting on ${first}` }
      : { shelf: "live", turn: "yours", detail: `${first} suggested a plan`, action: "See their plan →" };
  }
  // open: always the actionable "Suggest a plan" card (there is no dormant state). The
  // system's pick fills it when there is one; otherwise the warmth line.
  return {
    shelf: "live",
    turn: "yours",
    detail: e.suggestedEventTitle
      ? `We think you'd both like ${e.suggestedEventTitle}${when}`
      : "Pick something you'd both enjoy",
    action: "Suggest a plan →",
  };
}

const actionClass: Record<Turn, string> = {
  yours: ckBtn("primary", "sm", { full: true }),
  // The pending footprint reads "unresolved"; the cursor says it still opens.
  theirs: ckBtn("pending", "sm", { full: true, className: "cursor-pointer" }),
  settled: ckBtn("secondary", "sm", { full: true }),
};

function ClickRow({
  entry,
  card,
  onOpen,
}: {
  entry: ProposalEntry;
  card: OutcomeCard;
  onOpen: () => void;
}) {
  return (
    <li className="min-w-0">
      <PeopleCard
        person={{
          id: entry.otherId,
          displayName: entry.otherName,
          photoUrl: entry.otherPhotoUrl,
          sharedInterests: entry.sharedTags,
          sharedEvent: entry.sourceEventTitle,
        }}
        intent={entry.intentLabel}
        // No "View profile" ghost on this card, so the name is the labelled route -
        // and the way to report or block from a click that has nothing left to open.
        profileHref={`/profile/${entry.otherId}`}
        linkName
        yourMove={card.turn === "yours"}
        detail={
          card.detail ? (
            <p className="text-[13.5px] font-semibold leading-snug text-[color:var(--ink)]">{card.detail}</p>
          ) : null
        }
        actions={
          card.action ? (
            <button type="button" onClick={onOpen} className={actionClass[card.turn]}>
              <span className="ck-btn__label">{card.action}</span>
            </button>
          ) : null
        }
      />
    </li>
  );
}

const shelfHeading = "text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]";

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

  const rows = entries.map((entry) => ({ entry, card: outcomeCard(entry) }));
  const live = rows.filter((row) => row.card.shelf === "live");
  const plans = rows.filter((row) => row.card.shelf === "plan");
  // Connected wins stay standing; released clicks fold into one quiet line (DS).
  const wins = rows.filter((row) => row.card.shelf === "past" && row.card.action);
  const rested = rows.filter((row) => row.card.shelf === "past" && !row.card.action);

  const renderRow = ({ entry, card }: (typeof rows)[number]) => (
    <ClickRow key={entry.mutualId} entry={entry} card={card} onOpen={() => setOpenId(entry.mutualId)} />
  );

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

      {live.length === 0 && plans.length === 0 ? (
        <div className="mt-7 rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-8 text-center">
          <p className="font-display text-[1.05rem] font-semibold text-[color:var(--ink)]">No live clicks yet.</p>
          <p className="mx-auto mt-2 max-w-[380px] text-sm leading-relaxed text-[color:var(--ink-soft)]">
            Show up to an event, then click with someone afterwards. Clicking is anonymous - we&apos;ll
            only show you if it&apos;s mutual, and your first plan opens here.
          </p>
          <div className="mt-4 flex justify-center">
            <Link href="/discover" className="ck-btn ck-btn--sm ck-btn--primary">
              <span className="ck-btn__label">Find events</span>
            </Link>
          </div>
        </div>
      ) : null}

      {live.length > 0 ? (
        <section className="mt-7">
          <h2 className={shelfHeading}>Live mutuals</h2>
          {/* Locked (CLICK_LANGUAGE v27 §5): what a mutual is, and the one action. */}
          <p className="mt-1 text-[13.5px] font-medium text-[color:var(--slate)]">
            You both clicked. Now plan something you&apos;d both enjoy.
          </p>
          <ul className="mt-3 grid gap-3">{live.map(renderRow)}</ul>
        </section>
      ) : null}

      {plans.length > 0 ? (
        <section className="mt-9">
          <h2 className={shelfHeading}>Plans</h2>
          <ul className="mt-3 grid gap-3">{plans.map(renderRow)}</ul>
        </section>
      ) : null}

      {wins.length > 0 || rested.length > 0 ? (
        <section className="mt-9">
          <h2 className={shelfHeading}>Past clicks</h2>
          {wins.length > 0 ? <ul className="mt-3 grid gap-3">{wins.map(renderRow)}</ul> : null}
          {rested.length > 0 ? (
            // Native disclosure: no client state, keyboard and screen reader for free.
            <details className="mt-3">
              <summary className="ck-taplink inline-block cursor-pointer list-none text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)] [&::-webkit-details-marker]:hidden">
                + {rested.length} past click{rested.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-3 grid gap-3">{rested.map(renderRow)}</ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
