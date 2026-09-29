"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { clickPersonAction } from "@/app/people/actions";
import type { SuggestedPerson } from "@/lib/event-repository";
import { soloIntentLabel } from "@/lib/intent-label";
import { Button, Spark, ckBtn } from "./ds";
import { MutualClickLink, announceClickSent, useRevealedMutual } from "./mutual-reveal";
import { PeopleCard } from "./people-card";

/**
 * The discovery People Card - the daily set on /people and the dashboard's
 * rotated person. The anatomy is the shared shell in people-card.tsx; this
 * file owns the part that differs per surface: the discovery click, with the
 * stateful button PAIRED with a quiet "View profile" ghost.
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

  // The reply cannot say whether this completed a mutual (§6.1); the reveal host
  // finds out with its own read for this person, and plays the reveal if it did. A
  // ref so a re-render can't announce the same send twice.
  const announced = useRef(false);
  useEffect(() => {
    if (state?.ok !== true || announced.current) return;
    announced.current = true;
    announceClickSent(person.id);
  }, [state, person.id]);

  // Runbook Stage 1: "the button flips to a muted `clicked` instantly -
  // optimistic, same footprint, no spinner, no ✨". It used to wait for the whole
  // send (a dozen round trips to the database) behind a spinner and then fire a
  // confetti burst, which read as slow and celebrated a one-way click the other
  // person never sees (bug board #266 - the burst is banned, see
  // brand-confetti.ts). `flipped` is this session's own send, in flight or landed;
  // a refused one drops back to the button, with the reason under the tags.
  const flipped = submitting || state?.ok === true;
  // "sent" also persists across reloads via person.alreadyClicked (a pending click
  // already recorded server-side).
  const sent = flipped || person.alreadyClicked;
  const mutualId = useRevealedMutual(person.id);
  const firstName = person.displayName.split(/\s+/)[0] ?? person.displayName;

  // The action pair. ONE footprint across states: only the fill and the label
  // change - "click with [name]" → the muted, unresolved "clicked" (no spark) → the
  // Sage "clicked" + spark, once the reveal host has played this person's mutual.
  const actions = (
    <form action={formAction} className={layout === "row" ? "contents sm:block" : "contents"}>
      <input type="hidden" name="profile_id" value={person.id} />
      <div
        className={layout === "row" ? "flex flex-col gap-2 sm:gap-2.5" : "flex flex-wrap items-center gap-2"}
      >
        {mutualId ? (
          <MutualClickLink mutualId={mutualId} firstName={firstName} full />
        ) : sent ? (
          /* .rise-soft only when it just happened - on a reload the pill is
             simply the resting state and has nothing to announce. The class holds
             from the tap through the reply, so the landing never replays it. */
          <span
            className={ckBtn("pending", "sm", { full: true, className: flipped ? "rise-soft" : "" })}
            aria-live="polite"
          >
            <span className="ck-btn__label">clicked</span>
          </span>
        ) : (
          <Button type="submit" variant="primary" size="sm" full>
            click with {firstName}
          </Button>
        )}
        <Link href={`/profile/${person.id}`} className={ckBtn("ghost", "sm", { full: layout === "row" })}>
          <span className="ck-btn__label">View profile</span>
        </Link>
      </div>
    </form>
  );

  /* The photo is also a pointer-only route to the profile (the shell makes it
     aria-hidden + untabbable): the "View profile" ghost above is the labelled
     way there. `click-settle` is the lavender wash a landed click drains out of. */
  return (
    <PeopleCard
      person={person}
      layout={layout}
      intent={soloIntentLabel(person.intents, viewerOpenToDating)}
      profileHref={`/profile/${person.id}`}
      actions={actions}
      className={flipped ? "click-settle" : ""}
      // "We'll only show you if it's mutual" has been answered once the reveal
      // played, and a retry must not carry the previous refusal under its
      // fresh "clicked". Under the tags in BOTH layouts - as a sibling of the
      // columns it became a third flex item and clipped the tag row.
      footer={mutualId || submitting ? null : <Status state={state} />}
    />
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
