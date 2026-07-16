"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EventStatus } from "@/lib/click-data";

type CancelState = "idle" | "submitting" | "done" | "error";

export function MerchantEventCancelButton({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const router = useRouter();
  const [state, setState] = useState<CancelState>("idle");
  const [message, setMessage] = useState("");
  const disabled = status === "Cancelled" || state === "submitting" || state === "done";

  async function cancelEvent() {
    const confirmed = window.confirm(
      "Cancel this event? Confirmed and waitlisted attendees will be notified.",
    );
    if (!confirmed) return;

    setState("submitting");
    setMessage("");

    const response = await fetch(
      `/api/merchant/events/${encodeURIComponent(eventId)}/cancel`,
      { method: "POST" },
    );
    const payload = (await response.json()) as {
      error?: string;
      notified?: number;
      alreadyCancelled?: boolean;
    };

    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Could not cancel this event.");
      return;
    }

    setState("done");
    setMessage(
      payload.alreadyCancelled
        ? "This event was already cancelled."
        : `Event cancelled. ${payload.notified ?? 0} attendee${payload.notified === 1 ? "" : "s"} notified.`,
    );
    router.refresh();
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={cancelEvent}
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
          className={`text-xs font-bold ${
            state === "error" ? "text-[color:var(--rose)]" : "text-[color:var(--mauve)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
