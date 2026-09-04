"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { clickPersonAction } from "@/app/people/actions";
import type { SuggestedPerson } from "@/lib/event-repository";
import { CLICK_PUFF, fireBrandConfetti } from "./brand-confetti";
import { Avatar, Button, CommonalityLine, Spark, TagRow, ckBtn, commonality } from "./ds";

/**
 * The People Card - the canonical "person you can click with" card, used
 * IDENTICALLY on every surface it appears on (the daily set on /people, the
 * dashboard's rotated person, the who-was-there grid).
 *
 * The anatomy is INVARIANT; only the ACTION LAYOUT adapts to the width:
 *   avatar LEFT (one size per layout - never shrunk, and never per-surface)
 *   name + intent grouped TIGHT and INLINE (never stacked, intent never green)
 *   a CONDITIONAL commonality line on a NON-interest axis (so it can never
 *     restate the tags below it); omitted cleanly when there's no overlap
 *   <=3 neutral interest tags, one line + "+N"
 *   the stateful click button PAIRED with a quiet "View profile" ghost
 *
 * Not on this card, by rule: the age (that lives on the profile), the private
 * quiz persona, life tags (private until mutual), and the anonymity
 * reassurance - that shows ONCE at the top of the section, never per card.
 */

/* The photo is the reason anyone stops on this card, and at the DS's ~52 it was
 * the smallest thing in a 760px row - a thumbnail beside three lines of text.
 * Sizing it to the content block it sits next to (name + commonality + tags is
 * ~76px tall) makes the person, not the copy, the centre of gravity. Held here
 * as constants rather than inline so both layouts and the /people loading
 * skeleton stay in step. */
const AVATAR_ROW = 76;
const AVATAR_GRID = 64;

export function ClickWithSomeoneUserCard({
  person,
  layout = "row",
  viewerOpenToDating = false,
}: {
  person: SuggestedPerson;
  // "row"  - wide list rows: actions in a RIGHT column (discovery / people page)
  // "grid" - narrow cards: actions PAIRED in a bottom row (who-was-there 2-up)
  layout?: "row" | "grid";
  // "Open to dating" may be shown ONLY when the viewer is also open to dating.
  // A friends-only viewer never sees a dating label anywhere - so this defaults
  // to false and the label simply doesn't render.
  viewerOpenToDating?: boolean;
}) {
  const [state, formAction, submitting] = useActionState(clickPersonAction, null);

  /* The celebration is for the click the user just made, never for one the
     server merely remembers. `sent` is true on every reload once the click is
     recorded (person.alreadyClicked), so the burst hangs off `justSent`, which
     only a fresh successful submit in this session can set - and a ref gates it
     so a re-render can't fire it twice. */
  const [justSent, setJustSent] = useState(false);
  const celebrated = useRef(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.ok !== true || celebrated.current) return;
    celebrated.current = true;
    setJustSent(true);

    /* Fired from the button the user actually pressed rather than the middle of
       the viewport: on a three-card list, a burst from screen-centre reads as
       "something happened somewhere", not "that one went". canvas-confetti wants
       0-1 viewport fractions, hence the divide. */
    const rect = actionsRef.current?.getBoundingClientRect();
    const origin = rect
      ? {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        }
      : undefined;
    void fireBrandConfetti(origin, CLICK_PUFF);
  }, [state]);

  // "sent" persists across reloads via person.alreadyClicked (a pending click
  // already recorded server-side), and also flips immediately after a fresh
  // successful submit in this session.
  const sent = state?.ok === true || person.alreadyClicked;
  const firstName = person.displayName.split(/\s+/)[0] ?? person.displayName;
  const intent = intentLine(person.intents, viewerOpenToDating);
  const hook = commonality({
    sharedEvent: person.sharedEvent,
    sharedMusic: person.sharedMusic,
    proximity: person.nearby ? "you're both nearby" : null,
  });

  /* The photo, sized up and made the second route into the profile. It is
     aria-hidden + untabbable on purpose: the "View profile" ghost below is
     already the labelled way there, so this only widens the POINTER target and
     never adds a duplicate tab stop or a second identical link for a screen
     reader to read out. */
  const avatar = (
    <Link
      href={`/profile/${person.id}`}
      aria-hidden
      tabIndex={-1}
      className="shrink-0 rounded-full focus:outline-none"
    >
      <Avatar
        name={person.displayName}
        src={person.photoUrl}
        size={layout === "row" ? AVATAR_ROW : AVATAR_GRID}
        className="transition-transform duration-200 ease-out group-hover:scale-[1.04]"
      />
    </Link>
  );

  // Identity pair - name and intent INLINE on the baseline, grouped tight.
  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-display truncate text-[17px] font-semibold leading-tight text-[color:var(--ink)]">
          {firstName}
        </span>
        {intent ? (
          <span className="text-[13px] font-medium leading-tight text-[color:var(--slate)]">{intent}</span>
        ) : null}
      </div>
      <CommonalityLine c={hook} />
      <TagRow tags={person.sharedInterests} max={3} />
      {/* Stacks under the tags in BOTH layouts. Rendered as a sibling of the
          columns it became a third flex item once the action returned a
          message, collapsing the identity column and clipping TagRow. */}
      <Status state={state} />
    </div>
  );

  // The action pair. ONE footprint across states: only the fill and the label
  // change - "click with [name]" → the muted, unresolved "clicked" (no spark).
  const actions = (
    <form action={formAction} className={layout === "row" ? "contents sm:block" : "contents"}>
      <input type="hidden" name="profile_id" value={person.id} />
      <div
        ref={actionsRef}
        className={layout === "row" ? "flex flex-col gap-2 sm:gap-2.5" : "flex flex-wrap items-center gap-2"}
      >
        {sent ? (
          /* .rise-soft only when it just happened - on a reload the pill is
             simply the resting state and has nothing to announce. */
          <span
            className={ckBtn("pending", "sm", { full: true, className: justSent ? "rise-soft" : "" })}
            aria-live="polite"
          >
            <span className="ck-btn__label">clicked</span>
          </span>
        ) : (
          <Button type="submit" variant="primary" size="sm" full loading={submitting}>
            click with {firstName}
          </Button>
        )}
        <Link href={`/profile/${person.id}`} className={ckBtn("ghost", "sm", { full: layout === "row" })}>
          <span className="ck-btn__label">View profile</span>
        </Link>
      </div>
    </form>
  );

  /* Same hover idiom as the Event Card (event-card.tsx:88) so the two card
     families in the app feel like one surface: a 3px lift onto the next shadow
     step, plus the photo's 1.04 push. `click-settle` is additive on top - the
     lavender wash a landed click drains out of. */
  const card =
    "group rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-[3px] hover:shadow-[var(--shadow-md)]";
  const settle = justSent ? " click-settle" : "";

  // WIDE ROW - avatar + content + a right-hand action column on desktop; on
  // mobile the pair stacks full-width (side by side, two nowrap --full buttons
  // sat at their text width and pushed the card past a 320px viewport).
  if (layout === "row") {
    return (
      <article className={`${card}${settle} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5`}>
        <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
          {avatar}
          {content}
        </div>
        <div className="sm:w-[190px] sm:shrink-0">{actions}</div>
      </article>
    );
  }

  // NARROW CARD - content on top, the action pair kept together in a bottom row
  // (never split to opposite corners).
  return (
    <article className={`${card}${settle} flex h-full flex-col gap-3 p-4`}>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {avatar}
        {content}
      </div>
      {actions}
    </article>
  );
}

/** The mutual marker - Sage "clicked ✨". The spark lands only on this peak. */
export function MutualMarker() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--sage)]">
      clicked <Spark size={11} tone="var(--sage)" />
    </span>
  );
}

function Status({ state }: { state: { ok: boolean; message?: string } | null }) {
  if (!state?.message) return null;
  return (
    <p role="status" className="text-xs leading-5 text-[color:var(--slate)]">
      {state.message}
    </p>
  );
}

/**
 * The solo intent line: "Here for friends" · "Open to dating".
 *
 * Dating is GATED - it renders only when the viewer is also open to dating
 * (intent-neutral + mutual opt-in), so a friends-only viewer never sees a dating
 * label. Non-dating intents are preferred when someone carries several, which
 * keeps the set foregrounded on friends/activities rather than dating.
 */
function intentLine(intents: string[], viewerOpenToDating: boolean): string | null {
  const visible = intents.filter((i) => i !== "dating" || viewerOpenToDating);
  if (!visible.length) return null;
  const chosen = visible.find((i) => i !== "dating") ?? visible[0];
  switch (chosen) {
    case "friendship":
      return "Here for friends";
    case "networking":
      return "Here for networking";
    case "exploring":
      return "Here for the activities";
    case "dating":
      return "Open to dating";
    default:
      return null;
  }
}
