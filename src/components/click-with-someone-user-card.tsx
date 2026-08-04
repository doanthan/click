"use client";

import Link from "next/link";
import { useActionState } from "react";
import { clickPersonAction } from "@/app/people/actions";
import type { SuggestedPerson } from "@/lib/event-repository";
import { Avatar, Button, CommonalityLine, Spark, TagRow, ckBtn, commonality } from "./ds";

/**
 * The People Card - the canonical "person you can click with" card, used
 * IDENTICALLY on every surface it appears on (the daily set on /people, the
 * dashboard's rotated person, the who-was-there grid).
 *
 * The anatomy is INVARIANT; only the ACTION LAYOUT adapts to the width:
 *   avatar LEFT (one size, 52 - never shrunk)
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

  // "sent" persists across reloads via person.alreadyClicked (a pending click
  // already recorded server-side), and also flips immediately after a fresh
  // successful submit in this session.
  const sent = state?.ok === true || person.alreadyClicked;
  const firstName = person.displayName.split(/\s+/)[0] ?? person.displayName;
  const intent = intentLine(person.intents, viewerOpenToDating);
  const hook = commonality({
    sharedEvent: person.sharedEvent,
    proximity: person.nearby ? "you're both nearby" : null,
  });

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
      <div className={layout === "row" ? "flex items-center gap-2 sm:flex-col sm:gap-2.5" : "flex items-center gap-2"}>
        {sent ? (
          <span className={ckBtn("pending", "sm", { full: true })} aria-live="polite">
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

  const card =
    "rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] shadow-[var(--shadow-sm)]";

  // WIDE ROW - avatar + content + a right-hand action column on desktop; the
  // same card stacks to the paired bottom row on mobile.
  if (layout === "row") {
    return (
      <article className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5`}>
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <Avatar name={person.displayName} src={person.photoUrl} size={52} />
          {content}
        </div>
        <div className="sm:w-[190px] sm:shrink-0">{actions}</div>
      </article>
    );
  }

  // NARROW CARD - content on top, the action pair kept together in a bottom row
  // (never split to opposite corners).
  return (
    <article className={`${card} flex h-full flex-col gap-3 p-4`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar name={person.displayName} src={person.photoUrl} size={52} />
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
