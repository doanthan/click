"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  toggleAttendeeCheckInAction,
  toggleGuestCheckInAction,
} from "@/app/merchant/actions";

// Door-of check-in, both kinds of body in the room: the ticket-holder who
// booked the seat (event_attendees.checked_in_at) and the named +1 they brought
// (guest_spots.attended, spec 19 §11). One presentational button so the two
// cannot drift apart on the same door list.
//
// Optimistic: a host at a venue door is on venue wifi, and a round-trip that
// leaves the button unchanged for a second reads as "it didn't take" - so they
// tap again. useOptimistic flips the label on the same frame as the tap and
// React rolls it back if the action throws.

function CheckInButton({
  checkedIn,
  pending,
  onToggle,
  name,
}: {
  checkedIn: boolean;
  pending: boolean;
  onToggle: () => void;
  name: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      // aria-disabled, not disabled: dropping a focused button out of the tab
      // order mid-press blurs it, which sends a keyboard host back to the top
      // of the document right as the outcome lands. The guard is in onToggle.
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      aria-pressed={checkedIn}
      aria-label={checkedIn ? `Undo check-in for ${name}` : `Check in ${name}`}
      // md, not sm. .ck-btn--sm is 36px and .ck-btn--md is 44px, and the
      // comment directly above those rules in globals.css names 44 as "the min
      // touch target". This is the control a host taps forty times in a row,
      // one-handed, standing at a door - it does not get to be the smallest
      // target on the screen.
      className={`ck-btn ck-btn--md ${
        checkedIn ? "ck-btn--mutual" : "ck-btn--secondary"
      } ${pending ? "opacity-70" : ""}`}
    >
      {/* No entrance animation on this label, deliberately. The feedback is
          already there and it is better: useOptimistic flips the variant
          (secondary to the sage `mutual`) and the words on the SAME frame as
          the tap, with no round trip. pop-in is a 700ms rotating celebration -
          right for a mutual click, wrong for a control a host taps forty times
          in a row at a door, where it would read as the page fighting them. */}
      {checkedIn ? "✓ Checked in" : "Check in"}
    </button>
  );
}

export function GuestCheckInToggle({
  guestId,
  eventSlug,
  name,
  attended,
}: {
  guestId: string;
  eventSlug: string;
  name: string;
  attended: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(attended);

  function toggle() {
    if (isPending) return;
    const next = !optimistic;
    const form = new FormData();
    form.set("guest_id", guestId);
    form.set("event_slug", eventSlug);
    form.set("next", String(next));
    startTransition(async () => {
      setOptimistic(next);
      try {
        await toggleGuestCheckInAction(form);
        toast.success(next ? `Checked in ${name}.` : `Undid check-in for ${name}.`);
      } catch {
        toast.error("Could not update check-in. Try again.");
      }
    });
  }

  return (
    <CheckInButton
      checkedIn={optimistic}
      pending={isPending}
      onToggle={toggle}
      name={name}
    />
  );
}

export function AttendeeCheckInToggle({
  attendeeId,
  eventSlug,
  name,
  checkedIn,
}: {
  attendeeId: string;
  eventSlug: string;
  name: string;
  checkedIn: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(checkedIn);

  function toggle() {
    if (isPending) return;
    const next = !optimistic;
    const form = new FormData();
    form.set("attendee_id", attendeeId);
    form.set("event_slug", eventSlug);
    form.set("next", String(next));
    startTransition(async () => {
      setOptimistic(next);
      try {
        await toggleAttendeeCheckInAction(form);
        toast.success(next ? `Checked in ${name}.` : `Undid check-in for ${name}.`);
      } catch {
        toast.error("Could not update check-in. Try again.");
      }
    });
  }

  return (
    <CheckInButton
      checkedIn={optimistic}
      pending={isPending}
      onToggle={toggle}
      name={name}
    />
  );
}
