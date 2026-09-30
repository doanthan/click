"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { loadProfilePreviewAction } from "@/app/profile/[userId]/actions";
import { Icon } from "./ds";
import { ModalShell } from "./modal-shell";
import { ProfileDetails, type ProfileDetailsData } from "./profile-details";
import { Skeleton, SkeletonText } from "./skeleton";

/**
 * "View profile" on a click surface - the daily picks on the Click page and the
 * dashboard, and who was there - opens the profile OVER the card instead of leaving
 * the page (CHANGE BRIEF 2026-09-30 §2.4), with that card's own click pinned to the
 * bottom. Tapping it sends the card's click, closes this, and leaves the card behind
 * showing "clicked".
 *
 * This file sends nothing. The footer is the card's control, handed in by the card,
 * so the send stays on the two surfaces that own one and the source (daily pick or
 * the night you were both at) is always the card's. Opened from anywhere else - the
 * event page's attendee list, Your clicks - a profile is the read-only page, and
 * never this.
 *
 * The trigger stays a real link to /profile/[id]: a modified click, a new tab or no
 * JavaScript gets the page.
 */
export function opensInPlace(event: MouseEvent): boolean {
  // A modified click means "open it somewhere else" - the link does that.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  event.preventDefault();
  return true;
}

export function ProfileModal({
  profileId,
  onClose,
  footer,
}: {
  profileId: string;
  onClose: () => void;
  // The card's click control, in whichever of its three states it is in.
  footer: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // null while it loads. The modal mounts fresh on every open (ModalShell's
  // contract), so this never shows the previous person.
  const [profile, setProfile] = useState<ProfileDetailsData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    loadProfilePreviewAction(profileId)
      .then((loaded) => {
        if (!live) return;
        if (loaded) setProfile(loaded);
        else setFailed(true);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [profileId]);

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      align="sheet"
      initialFocusRef={closeRef}
      /* A column, not one scroller: the profile scrolls, the footer does not, so
         the click stays within reach however long the profile runs. Body scroll is
         locked while this is open, hence the card's own max height. */
      cardClassName="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[600px] flex-col overflow-hidden rounded-[var(--radius-xl)] bg-[color:var(--paper)] shadow-[var(--shadow-lg)]"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close profile"
        className="absolute top-2 right-2 z-10 grid size-11 place-items-center rounded-[12px] text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
      >
        <Icon name="x" size={18} stroke={2.2} />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 pr-14 sm:p-8 sm:pr-16">
        {profile ? (
          <ProfileDetails profile={profile} titleAs="h2" titleId={titleId} />
        ) : failed ? (
          <div className="py-6">
            <h2 id={titleId} className="font-display text-[15px] font-semibold text-[color:var(--ink)]">
              We couldn&apos;t open this profile here.
            </h2>
            <Link
              href={`/profile/${profileId}`}
              className="font-display mt-2 inline-flex text-[14px] font-semibold text-[color:var(--purple)] underline underline-offset-2"
            >
              Open it on its own page
            </Link>
          </div>
        ) : (
          <div role="status" aria-busy="true">
            <span id={titleId} className="sr-only">
              Opening profile
            </span>
            <div className="flex items-center gap-4">
              <Skeleton className="size-[72px] rounded-full" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
            <SkeletonText lines={4} className="mt-8" />
          </div>
        )}
      </div>

      {/* Only once there is a profile to decide on - a click from a skeleton would
          be a click on someone the viewer hasn't seen yet. */}
      {profile ? (
        <div className="shrink-0 border-t border-[color:var(--line-soft)] bg-[color:var(--paper)] px-6 py-4 sm:px-8">
          {footer}
        </div>
      ) : null}
    </ModalShell>
  );
}
