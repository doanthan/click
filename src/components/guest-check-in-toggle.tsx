"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleGuestCheckInAction } from "@/app/merchant/actions";

// Day-of check-in for a named +1 on the merchant door list (spec 19 §11). Mirrors
// the attendee check-in button: posts to the server action, which writes
// guest_spots.attended and revalidates the event page so the new state shows.
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

  function toggle() {
    const next = !attended;
    const form = new FormData();
    form.set("guest_id", guestId);
    form.set("event_slug", eventSlug);
    form.set("next", String(next));
    startTransition(async () => {
      try {
        await toggleGuestCheckInAction(form);
        toast.success(
          next ? `Checked in ${name}.` : `Undid check-in for ${name}.`,
        );
      } catch {
        toast.error("Could not update check-in. Try again.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={attended}
      className={`ck-btn ck-btn--sm ${attended ? "ck-btn--mutual" : "ck-btn--secondary"}`}
    >
      {attended ? "✓ Checked in" : "Check in"}
    </button>
  );
}
