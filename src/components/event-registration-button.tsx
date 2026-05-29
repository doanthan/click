"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { openLoginModal } from "./login-modal-host";
import {
  EventRsvpSuccessOverlay,
  type EventSuccessDetails,
} from "./event-rsvp-success-overlay";

type RegistrationState =
  | "idle"
  | "submitting"
  | "registered"
  | "waitlisted"
  | "cancelling"
  | "cancelled"
  | "error";

export function EventRegistrationButton({
  eventId,
  initiallyRegistered = false,
  isWaitlist = false,
  successDetails,
}: {
  eventId: string;
  initiallyRegistered?: boolean;
  isWaitlist?: boolean;
  // When present, a confirmed (non-waitlist) RSVP pops the confetti overlay.
  successDetails?: EventSuccessDetails;
}) {
  const [state, setState] = useState<RegistrationState>(
    initiallyRegistered ? "registered" : "idle",
  );
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function register() {
    setState("submitting");
    setMessage("");

    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/register`, {
      method: "POST",
    });

    if (response.status === 401) {
      setState("idle");
      openLoginModal({ callbackUrl: pathname || "/events" });
      return;
    }

    const payload = (await response.json()) as {
      registration?: { status?: string; eventTitle?: string };
      error?: string;
      redirectTo?: string;
    };

    if (response.status === 402 && payload.redirectTo) {
      window.location.href = payload.redirectTo;
      return;
    }

    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Registration failed.");
      return;
    }

    const status = payload.registration?.status;
    setState(status === "waitlisted" ? "waitlisted" : "registered");
    setMessage(
      status === "waitlisted" ? "You are on the waitlist." : "You are registered.",
    );
    if (status !== "waitlisted" && successDetails) {
      setShowSuccess(true);
    }
  }

  async function cancel() {
    setState("cancelling");
    setMessage("");

    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/register`, {
      method: "DELETE",
    });

    if (response.status === 401) {
      setState("registered");
      openLoginModal({ callbackUrl: pathname || "/events" });
      return;
    }

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Cancel failed.");
      return;
    }

    setState("cancelled");
    setMessage("Your RSVP was cancelled.");
  }

  const isLocked =
    state === "registered" || state === "waitlisted" || state === "cancelling";

  return (
    <div className="grid gap-1">
      {showSuccess && successDetails ? (
        <EventRsvpSuccessOverlay
          details={successDetails}
          onClose={() => {
            setShowSuccess(false);
            // Reflect the new RSVP in the server-rendered "who's clicked in" list.
            router.refresh();
          }}
        />
      ) : null}
      {isLocked ? (
        <button
          type="button"
          onClick={cancel}
          disabled={state === "cancelling"}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-4 py-3 text-center text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--rose)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {state === "cancelling"
            ? "Cancelling..."
            : state === "waitlisted"
              ? "Leave waitlist"
              : "Cancel RSVP"}
        </button>
      ) : (
        <button
          type="button"
          onClick={register}
          disabled={state === "submitting"}
          className={`rounded-full border-2 border-[color:var(--line)] px-4 py-3 text-center text-sm font-bold hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-70 ${
            isWaitlist
              ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
              : "bg-[color:var(--rose)] text-[color:var(--surface-deep)] hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
          }`}
        >
          {state === "submitting"
            ? isWaitlist
              ? "Joining waitlist..."
              : "RSVPing..."
            : state === "cancelled"
              ? isWaitlist
                ? "Rejoin waitlist"
                : "RSVP again"
              : isWaitlist
                ? "Join waitlist"
                : "RSVP"}
        </button>
      )}
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
