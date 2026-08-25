"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { EventStatus } from "@/lib/click-data";

type CancelState = "idle" | "submitting" | "done" | "error";

export function MerchantEventCancelButton({
  eventId,
  status,
  confirmedSeats,
  waitlistedCount,
}: {
  eventId: string;
  status: EventStatus;
  // The page has already counted these (seats, not profiles - a paid +1 holds a
  // seat too), so the confirm can name the real headcount instead of a vague
  // "attendees will be notified".
  confirmedSeats: number;
  waitlistedCount: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<CancelState>("idle");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const disabled = status === "Cancelled" || state === "submitting" || state === "done";

  // Cancelling refunds paid bookings and fans an email out to every affected
  // attendee the moment the request commits, so there is no undo to offer -
  // every bit of friction has to sit in FRONT of the POST. That is why this is
  // the branded ConfirmDialog (focus trap, Escape, scroll lock, real numbers)
  // and not a native window.confirm.
  const seatLine =
    confirmedSeats === 0 && waitlistedCount === 0
      ? "Nobody holds a seat yet, so there is no one to email."
      : `${confirmedSeats} confirmed ${confirmedSeats === 1 ? "seat" : "seats"} and ${waitlistedCount} waitlisted ${waitlistedCount === 1 ? "person" : "people"} will be emailed.`;

  async function cancelEvent() {
    setState("submitting");
    setMessage("");

    try {
      const response = await fetch(
        `/api/merchant/events/${encodeURIComponent(eventId)}/cancel`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        notified?: number;
        alreadyCancelled?: boolean;
      } | null;

      if (!response.ok || !payload) {
        setState("error");
        // No payload means we do not know which side of the commit it failed
        // on, so this must not assert that nothing changed - cancelEvent's
        // post-commit failures are real cancellations. Send them to the page,
        // which shows the true current status.
        setMessage(
          payload?.error ??
            "We couldn't confirm whether the cancellation went through. Reload this page to see the event's current status before trying again.",
        );
        return;
      }

      setState("done");
      setMessage(
        payload.alreadyCancelled
          ? "This event was already cancelled."
          : `Event cancelled. ${payload.notified ?? 0} attendee${payload.notified === 1 ? "" : "s"} notified.`,
      );
      router.refresh();
    } catch {
      // Without this branch a dropped connection left the button reading
      // "Cancelling..." forever, with no way to tell whether the refunds and
      // the attendee emails had gone out. Say plainly that they have not.
      setState("error");
      setMessage(
        "Could not reach the server, so this event is still on. Check your connection and try again.",
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled}
        className="ck-btn ck-btn--danger ck-btn--md"
      >
        {status === "Cancelled"
          ? "Event cancelled"
          : state === "submitting"
            ? "Cancelling..."
            : "Cancel event"}
      </button>
      {message ? (
        <p
          // Errors interrupt, outcomes wait their turn - the destructive action
          // on this page used to announce neither.
          role={state === "error" ? "alert" : "status"}
          className={`text-xs font-bold ${
            state === "error" ? "text-[color:var(--danger)]" : "text-[color:var(--mauve)]"
          }`}
        >
          {message}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        tone="rose"
        title="Cancel this event?"
        // Names the money, not just the seats. "Paid bookings are refunded" read
        // as an admin detail; what it actually means is the host gives back the
        // night's takings, in full, with no partial option and no undo. No
        // dollar figure: the page does not carry per-booking amounts, and an
        // ESTIMATED total on an irreversible money dialog is worse than none.
        description={`${seatLine} Every paid booking is refunded in full - the takings for this event leave your account, and there is no partial option and no undo.`}
        confirmLabel="Cancel event"
        cancelLabel="Keep the event"
        busy={state === "submitting"}
        onConfirm={cancelEvent}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
