"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type MouseEvent } from "react";
import { clickPersonAction } from "@/app/people/actions";
import type { DailyPick } from "@/lib/event-repository";
import { Button, Spark, ckBtn } from "./ds";
import { MutualClickLink, announceClickSent, useRevealedMutual } from "./mutual-reveal";
import { PeopleCard } from "./people-card";
import { ProfileModal, opensInPlace } from "./profile-modal";

/**
 * The daily picks People Card - the three on the Click page and the dashboard's
 * one-at-a-time person, which are the same three people (CHANGE BRIEF 2026-09-30).
 * The anatomy is the shared shell in people-card.tsx; this file owns the part that
 * differs per surface: the explore click, with the stateful button PAIRED with a
 * quiet "View profile" ghost that opens the profile over the card, carrying the
 * same click.
 */
export function ClickWithSomeoneUserCard({
  person,
  layout = "row",
}: {
  person: DailyPick;
  // "row"  - wide list rows: actions in a RIGHT column (discovery / people page)
  // "grid" - narrow cards: actions PAIRED in a bottom row (who-was-there 2-up)
  layout?: "row" | "grid";
}) {
  const [state, formAction, submitting] = useActionState(clickPersonAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);

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
  // "sent" also persists across reloads and across surfaces via
  // person.alreadyClicked - the viewer's live click at this pick, from either
  // source, so a tap on the dashboard shows as "clicked" on the Click page too.
  const sent = flipped || person.alreadyClicked;
  // A mutual this page just revealed, else the one the pick already had when the
  // page loaded - picks stay in the day's set once clicked, so a pick that went
  // mutual this morning still shows its Sage state this afternoon.
  const mutualId = useRevealedMutual(person.id) ?? person.mutualId;
  const firstName = person.displayName.split(/\s+/)[0] ?? person.displayName;

  const openProfile = (event: MouseEvent<HTMLAnchorElement>) => {
    if (opensInPlace(event)) setProfileOpen(true);
  };

  // The action, in its three states. ONE footprint across them: only the fill and
  // the label change - "click with [name]" → the muted, unresolved "clicked" (no
  // spark) → the Sage "clicked" + spark, once there is a mutual to open. The same
  // control sits on the card and at the foot of the profile modal.
  const control = (inProfile: boolean) => (
    <>
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
      ) : inProfile ? (
        /* The modal is portalled out of this card's form, so its button submits
           the form by hand - the same action with the same profile_id - and
           closes, leaving the card behind showing "clicked". */
        <Button
          type="button"
          variant="primary"
          size="sm"
          full
          onClick={() => {
            formRef.current?.requestSubmit();
            setProfileOpen(false);
          }}
        >
          click with {firstName}
        </Button>
      ) : (
        <Button type="submit" variant="primary" size="sm" full>
          click with {firstName}
        </Button>
      )}
    </>
  );

  const actions = (
    <form ref={formRef} action={formAction} className={layout === "row" ? "contents sm:block" : "contents"}>
      <input type="hidden" name="profile_id" value={person.id} />
      <div
        className={layout === "row" ? "flex flex-col gap-2 sm:gap-2.5" : "flex flex-wrap items-center gap-2"}
      >
        {control(false)}
        {/* Still a real link to the page: a new tab or no JavaScript gets it. */}
        <Link
          href={`/profile/${person.id}`}
          onClick={openProfile}
          aria-haspopup="dialog"
          className={ckBtn("ghost", "sm", { full: layout === "row" })}
        >
          <span className="ck-btn__label">View profile</span>
        </Link>
      </div>
    </form>
  );

  /* The photo opens the same modal, pointer-only (the shell makes it aria-hidden
     and untabbable): the "View profile" ghost above is the labelled way there.
     `click-settle` is the lavender wash a landed click drains out of. */
  return (
    <>
      <PeopleCard
        person={person}
        layout={layout}
        // Gated server-side: a dating intent only reaches a dating-visible viewer.
        intent={person.intentLabel}
        profileHref={`/profile/${person.id}`}
        onOpenProfile={openProfile}
        actions={actions}
        className={flipped ? "click-settle" : ""}
        // "We'll only show you if it's mutual" has been answered once the reveal
        // played, and a retry must not carry the previous refusal under its
        // fresh "clicked". Under the tags in BOTH layouts - as a sibling of the
        // columns it became a third flex item and clipped the tag row.
        footer={mutualId || submitting ? null : <Status state={state} />}
      />
      {/* A sibling of the card, never inside the link that opened it: the modal
          is portalled, but a React event still bubbles through the tree. */}
      {profileOpen ? (
        <ProfileModal
          profileId={person.id}
          onClose={() => setProfileOpen(false)}
          footer={control(true)}
        />
      ) : null}
    </>
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
