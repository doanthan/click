"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProposalEntry } from "@/lib/event-repository";
import { Spark, ckBtn } from "./ds";

// The mutual reveal (S3): the coordination drawer's first step, wherever the drawer
// opens - over /proposals from Your clicks, or over the click surface the completer
// is on (MutualRevealHost). One component, so the locked strings below exist once
// rather than as two copies that drift.

// What the reveal reads - a slice of the drawer's ProposalEntry.
export type RevealContent = Pick<
  ProposalEntry,
  "otherName" | "sourceEventTitle" | "sourceEventDay" | "intentLine" | "bothDating" | "sharedTags"
>;

// Reveals shown in THIS page session. Re-opening a mutual (list, bell, dashboard)
// must never re-fire the reveal even before the list's revealSeen snapshot catches up.
// The server seen_at (markMutualSeen, stamped the moment the reveal shows) covers
// reload / other devices; this covers same-session re-entry - together they kill the
// §4 re-fire regression.
export const revealedThisSession = new Set<string>();

// A click form fires this after any send the server accepted, naming the person it
// clicked - which the form already knows; it says nothing about the outcome, because
// the send's reply is identical whether or not it formed a mutual (§6.1). The host
// answers with its own read, after commit, for a mutual with exactly that person.
export const CLICK_SENT_EVENT = "click:sent";

export type ClickSent = { profileId: string };

export function announceClickSent(profileId: string) {
  window.dispatchEvent(new CustomEvent<ClickSent>(CLICK_SENT_EVENT, { detail: { profileId } }));
}

// The host fires this as a reveal opens, so a card still showing that person can
// move its button to the mutual state underneath the modal - a state that opens
// the mutual, hence the id riding along.
const MUTUAL_REVEALED_EVENT = "click:mutual-revealed";

type MutualRevealed = { profileId: string; mutualId: string };

export function announceMutualRevealed(profileId: string, mutualId: string) {
  window.dispatchEvent(
    new CustomEvent<MutualRevealed>(MUTUAL_REVEALED_EVENT, { detail: { profileId, mutualId } }),
  );
}

// The id of this person's mutual once its reveal has played on this page, else null.
export function useRevealedMutual(profileId: string) {
  const [mutualId, setMutualId] = useState<string | null>(null);
  useEffect(() => {
    function onRevealed(event: Event) {
      const { detail } = event as CustomEvent<MutualRevealed>;
      if (detail.profileId === profileId) setMutualId(detail.mutualId);
    }
    window.addEventListener(MUTUAL_REVEALED_EVENT, onRevealed);
    return () => window.removeEventListener(MUTUAL_REVEALED_EVENT, onRevealed);
  }, [profileId]);
  return mutualId;
}

// A person's row in its mutual state (CLICK_LANGUAGE §91): the click button's own
// footprint in Sage with the one spark, and it "taps through to the mutual, never
// starts a new click". A link, so it can't be mistaken for a send.
export function MutualClickLink({
  mutualId,
  firstName,
  full,
  className,
}: {
  mutualId: string;
  firstName: string;
  full?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/proposals?open=${mutualId}`}
      aria-label={`See your click with ${firstName}`}
      className={ckBtn("mutual", "sm", { full, className })}
    >
      <span className="ck-btn__label">clicked</span>
      <Spark size={12} tone="var(--sage)" />
    </Link>
  );
}

// S3 - the peak micro-moment, fired exactly once per user per mutual. Every string
// here is locked (CLICK_LANGUAGE §5); none of it is paraphrasable.
//
// The ✨ lives on the disc, never welded into the headline - §5 allows at most ONE
// per element and concentrates them at the peaks. The dating clause is APPENDED to
// the sage intent pill rather than given its own line, and only when both sides have
// the toggle on: it is never inferred and never one-sided.
export function RevealStep({
  entry,
  titleId,
  onSuggest,
  onLater,
}: {
  entry: RevealContent;
  titleId: string;
  onSuggest: () => void;
  onLater: () => void;
}) {
  const firstName = entry.otherName.split(/\s+/)[0];
  return (
    // aria-live so a screen-reader user gets the moment too - it is announced, not
    // just drawn (Part 9). Polite: it must never interrupt what they were reading.
    <div aria-live="polite">
      {/* The one celebration a mutual gets (bug board #266): the DS's "soft pop
          animation, prefers-reduced-motion safe" on the ✨ disc - never confetti on
          a mutual surface (brand-confetti.ts). Scale only (.ck-coord-pop, §5): the
          disc is visible from the first frame, so nothing waits on the animation. */}
      <div
        aria-hidden
        className="ck-coord-pop grid h-[74px] w-[74px] place-items-center rounded-full bg-[color:var(--lav-bg)] text-[28px] leading-none text-[color:var(--purple)]"
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
          night the two of them were actually at, and the day it was (S3: "You were
          both at [Event] on [Day]"), which is the reason the reveal means anything.
          Null when both clicked from explore - there is no shared night, so the line
          is simply absent rather than invented, and the pill and tags carry it. */}
      {entry.sourceEventTitle ? (
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
          You were both at {entry.sourceEventTitle}
          {entry.sourceEventDay ? ` on ${entry.sourceEventDay}` : null}.
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
      {/* Full width on a phone, like every other step's primary in the sheet. */}
      <button type="button" onClick={onSuggest} className="ck-btn ck-btn--md ck-btn--primary mt-6 max-sm:w-full">
        Suggest a plan
      </button>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* The quiet exit. reveal_seen is already stamped - the drawer writes it the
            moment the reveal shows - so no way out can leave it firing again. */}
        <button
          type="button"
          onClick={onLater}
          className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
        >
          Maybe later
        </button>
        {/* Leaving to read how clicking works is an exit too, so it takes the same
            way out - otherwise the drawer would ride along onto /how-it-works over
            the page it opened. */}
        <Link
          href="/how-it-works"
          onClick={onLater}
          className="ck-taplink text-[13px] font-semibold text-[color:var(--slate)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]"
        >
          How clicking works →
        </Link>
      </div>
    </div>
  );
}
