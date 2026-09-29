import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, CommonalityLine, Icon, TagRow, commonality } from "./ds";

/**
 * The People Card shell - the ONE card for a person you can click with, or
 * already have, on every surface: the daily set on /people and your clicks
 * below it, the dashboard's rotated person, the who-was-there grid (dashboard
 * and event page), and the event page's attendee list (bug board #293, #297).
 *
 * The anatomy is INVARIANT; only the ACTION LAYOUT adapts to the width:
 *   avatar LEFT (one size per layout - never shrunk, and never per-surface)
 *   first name + intent grouped TIGHT and INLINE (never stacked, intent never green)
 *   a CONDITIONAL commonality line on a NON-interest axis (so it can never
 *     restate the tags below it); omitted cleanly when there's no overlap
 *   <=3 shared interest tags, one line + "+N"
 *
 * The surface owns everything stateful - the click form, the plan action - and
 * hands it in as `actions`. This file holds no hooks, so server pages (your
 * clicks, the attendee list) and client cards render the same markup.
 *
 * Not on this card, by rule: the age (that lives on the profile), the private
 * quiz persona, life tags (private until mutual), and the anonymity
 * reassurance - that shows ONCE at the top of the section, never per card.
 */

/* The photo is the reason anyone stops on this card, and at the DS's ~52 it was
 * the smallest thing in a 760px row - a thumbnail beside three lines of text.
 * Sizing it to the content block beside it makes the person, not the copy, the
 * centre of gravity. One size per layout, for every surface and the /people
 * loading skeleton. */
export const PEOPLE_CARD_AVATAR = { row: 76, grid: 64 } as const;

export type PeopleCardPerson = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  // INTEREST tags both people share - never life tags; the queries filter those out.
  sharedInterests: string[];
  // Commonality inputs, all optional: the line takes the first that resolves.
  sharedEvent?: string | null;
  sharedMusic?: string | null;
  nearby?: boolean;
};

/* Same hover idiom as the Event Card (event-card.tsx) so the two card families
   feel like one surface: a 3px lift onto the next shadow step, plus the photo's
   1.04 push. Only on a card you can act on - a static card doesn't pretend. */
const CARD_BASE = "rounded-[var(--radius-lg)] border shadow-[var(--shadow-sm)]";
const CARD_HOVER = "group transition duration-200 hover:-translate-y-[3px] hover:shadow-[var(--shadow-md)]";

export function PeopleCard({
  person,
  layout = "row",
  intent,
  nameAside,
  detail,
  interestsOnly = false,
  profileHref,
  linkName = false,
  actions,
  href,
  footer,
  yourMove = false,
  className = "",
}: {
  person: PeopleCardPerson;
  // "row"  - wide list rows: actions in a RIGHT column (discovery, dashboard, your clicks)
  // "grid" - narrow cards: actions PAIRED in a bottom row (who-was-there, attendee list)
  layout?: "row" | "grid";
  // Already gated by the surface: "Here for friends", "You're both here for ...".
  intent?: string | null;
  // Inline after the name - the "You" label, the "going" check.
  nameAside?: ReactNode;
  // A state line straight under the identity pair (your clicks: the plan status).
  detail?: ReactNode;
  // The attendee list: no intent and no commonality line, interests only.
  interestsOnly?: boolean;
  // The person's profile. The photo becomes a pointer-only route there
  // (aria-hidden, untabbable), so a surface that sets it must ALSO give a
  // labelled route: the "View profile" ghost in `actions`, or `linkName`.
  profileHref?: string;
  // Render the name as that labelled link (your clicks, which has no ghost).
  linkName?: boolean;
  actions?: ReactNode;
  // Whole-card link (the attendee list): the card IS the way to the profile,
  // with a quiet chevron, and nothing inside it is interactive.
  href?: string;
  // Under the tags: a refused send's reason, the hidden-from-list note, a guest line.
  footer?: ReactNode;
  // The earned your-move accent on your clicks: the soft lavender-wash fill.
  yourMove?: boolean;
  className?: string;
}) {
  const firstName = person.displayName.split(/\s+/)[0] || person.displayName;
  const hook = interestsOnly
    ? null
    : commonality({
        sharedEvent: person.sharedEvent,
        sharedMusic: person.sharedMusic,
        proximity: person.nearby ? "you're both nearby" : null,
      });
  const avatarSize = PEOPLE_CARD_AVATAR[layout];
  const interactive = Boolean(href || actions);
  const card = [
    CARD_BASE,
    yourMove
      ? "border-transparent bg-[color:var(--lav-bg)]"
      : "border-[color:var(--line-soft)] bg-[color:var(--paper)]",
    interactive ? CARD_HOVER : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const photo = (
    <Avatar
      name={person.displayName}
      src={person.photoUrl}
      size={avatarSize}
      className={interactive ? "transition-transform duration-200 ease-out group-hover:scale-[1.04]" : undefined}
    />
  );
  const avatar =
    profileHref && !href ? (
      <Link href={profileHref} aria-hidden tabIndex={-1} className="shrink-0 rounded-full focus:outline-none">
        {photo}
      </Link>
    ) : (
      <span className="shrink-0">{photo}</span>
    );

  const nameClass = "font-display truncate text-[17px] font-semibold leading-tight text-[color:var(--ink)]";
  // Identity pair - name and intent INLINE on the baseline, grouped tight.
  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
        {linkName && profileHref ? (
          <Link href={profileHref} className={`${nameClass} hover:underline`}>
            {firstName}
          </Link>
        ) : (
          <span className={nameClass}>{firstName}</span>
        )}
        {nameAside}
        {!interestsOnly && intent ? (
          <span className="text-[13px] font-medium leading-tight text-[color:var(--slate)]">{intent}</span>
        ) : null}
      </div>
      {detail}
      <CommonalityLine c={hook} />
      {person.sharedInterests.length > 0 ? (
        /* TagRow fits WHOLE tags to a width budget it estimates server-side (no JS
           measuring). This card's content column runs from ~140px (2-up in the
           event page's left column) to ~430px (the dashboard), so any single
           budget either clipped a tag or hid interests there was room for. Three
           pre-fitted rows; the column's own width - a container query, not the
           viewport - shows one. Each budget sits under its tier's floor. */
        <div className="@container min-w-0">
          <div className="@min-[200px]:hidden">
            <TagRow tags={person.sharedInterests} max={3} budget={136} />
          </div>
          <div className="hidden @min-[200px]:block @min-[340px]:hidden">
            <TagRow tags={person.sharedInterests} max={3} budget={196} />
          </div>
          <div className="hidden @min-[340px]:block">
            <TagRow tags={person.sharedInterests} max={3} budget={336} />
          </div>
        </div>
      ) : null}
      {footer}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={`${card} relative flex h-full items-start gap-3.5 p-4 pr-9`}>
        <Icon name="chevR" size={16} stroke={2} className="absolute top-4 right-3 text-[color:var(--ink-faint)]" />
        {avatar}
        {content}
      </Link>
    );
  }

  // WIDE ROW - avatar + content + a right-hand action column on desktop; on
  // mobile the actions drop under the content, full width.
  if (layout === "row") {
    return (
      <article className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5`}>
        <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
          {avatar}
          {content}
        </div>
        {actions ? <div className="sm:w-[190px] sm:shrink-0">{actions}</div> : null}
      </article>
    );
  }

  // NARROW CARD - content on top, the action pair kept together in a bottom row
  // (never split to opposite corners).
  return (
    <article className={`${card} flex h-full flex-col gap-3 p-4`}>
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        {avatar}
        {content}
      </div>
      {actions}
    </article>
  );
}
