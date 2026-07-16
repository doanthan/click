"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  | "confirming"
  | "confirm-cancel"
  | "cancelling"
  | "cancelled"
  | "error";

export function EventRegistrationButton({
  eventId,
  initiallyRegistered = false,
  isWaitlist = false,
  // ISO timestamp of a live waitlist promotion offer. When set (and the viewer
  // is waitlisted), a "Confirm your spot" CTA + countdown appears.
  offerExpiresAt = null,
  // Pre-rendered refund label (e.g. "Full refund — $35.00"). When present, the
  // cancel button first shows a confirmation with the exact amount.
  cancelRefundLabel = null,
  successDetails,
}: {
  eventId: string;
  initiallyRegistered?: boolean;
  isWaitlist?: boolean;
  offerExpiresAt?: string | null;
  cancelRefundLabel?: string | null;
  // When present, a confirmed (non-waitlist) RSVP pops the confetti overlay.
  successDetails?: EventSuccessDetails;
}) {
  const [state, setState] = useState<RegistrationState>(
    initiallyRegistered ? (isWaitlist ? "waitlisted" : "registered") : "idle",
  );
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  // null until mounted, so the live countdown never causes a hydration mismatch.
  const [nowMs, setNowMs] = useState<number | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!offerExpiresAt) return;
    // First tick lands after ~1s; until then the banner shows the static
    // hold time (holdLabel), so there's no synchronous setState in the effect.
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [offerExpiresAt]);

  // Pinned locale + timezone make this deterministic across SSR and the client.
  const holdLabel = offerExpiresAt
    ? new Date(offerExpiresAt).toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Australia/Sydney",
      })
    : null;

  const msLeft =
    offerExpiresAt && nowMs != null ? new Date(offerExpiresAt).getTime() - nowMs : null;
  const countdown =
    msLeft != null && msLeft > 0
      ? `${Math.floor(msLeft / 60000)}:${String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0")}`
      : null;
  const offerExpired = msLeft != null && msLeft <= 0;

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
    if (status === "waitlisted") {
      router.refresh();
    } else if (successDetails) {
      // Already on the full event page — pop the confetti "You're confirmed!"
      // overlay in place (it has all the details around it already).
      setShowSuccess(true);
    } else {
      // RSVP'd from a card/modal (e.g. Discover): send the now-confirmed
      // attendee straight to their unlocked event page — full details + venue,
      // and a "You're confirmed!" banner (+ add-a-photo nudge) keyed off ?booked=1.
      setMessage("You're confirmed! Taking you to your event…");
      window.location.href = `/events/${encodeURIComponent(eventId)}?booked=1`;
    }
  }

  // Accept a waitlist promotion offer for a free event. Paid offers come back
  // as a 402 with a redirect to the event page, where the buyer pays via Stripe.
  async function confirmSpot() {
    setState("confirming");
    setMessage("");

    const response = await fetch(
      `/api/events/${encodeURIComponent(eventId)}/waitlist/accept`,
      { method: "POST" },
    );

    if (response.status === 401) {
      setState("waitlisted");
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
      setState("waitlisted");
      setMessage(payload.error ?? "Could not confirm your spot.");
      router.refresh();
      return;
    }

    setState("registered");
    setMessage("Your spot is confirmed!");
    if (successDetails) {
      setShowSuccess(true);
    } else {
      router.refresh();
    }
  }

  async function cancel() {
    const previous = state === "waitlisted" ? "waitlisted" : "registered";
    setState("cancelling");
    setMessage("");

    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/register`, {
      method: "DELETE",
    });

    if (response.status === 401) {
      setState(previous);
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
    // After cancelling, the page re-renders into the locked/pre-RSVP state and
    // this button re-mounts to "idle", wiping the in-memory message — so it
    // looked like a silent dump onto a locked event (bug board #212). Carry an
    // acknowledgment in the URL so a durable banner confirms the cancel. The
    // waitlist "leave" path keeps the lighter in-place refresh.
    if (previous === "waitlisted") {
      setMessage("You left the waitlist.");
      router.refresh();
    } else {
      setMessage("Your RSVP was cancelled.");
      router.push(`${pathname ?? `/events/${encodeURIComponent(eventId)}`}?cancelled=1`);
      router.refresh();
    }
  }

  // Cancel click: paid bookings show the refund amount first; everything else
  // (free RSVP, waitlist) cancels straight away.
  function onCancelClick() {
    if (cancelRefundLabel) {
      setState("confirm-cancel");
    } else {
      void cancel();
    }
  }

  // ----- Refund-aware cancel confirmation (paid bookings) -----
  if (state === "confirm-cancel") {
    return (
      <div className="grid gap-2 rounded-[var(--radius-md)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-3">
        <p className="text-sm font-semibold text-[color:var(--ink)]">
          Cancel your booking?
        </p>
        <p className="text-xs font-medium text-[color:var(--slate)]">
          {cancelRefundLabel}
          <br />
          Refunds take 3-5 business days to process.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setState("registered");
              setMessage("");
            }}
            className="ck-btn ck-btn--md ck-btn--full ck-btn--secondary"
          >
            Keep my spot
          </button>
          <button
            type="button"
            onClick={() => void cancel()}
            className="ck-btn ck-btn--md ck-btn--full ck-btn--danger"
          >
            Cancel booking
          </button>
        </div>
      </div>
    );
  }

  // A live promotion offer: "Confirm your spot" + countdown above "Leave waitlist".
  const showOffer =
    !!offerExpiresAt && (state === "waitlisted" || state === "confirming");

  if (showOffer) {
    return (
      <div className="grid gap-2">
        <div className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
          {offerExpired ? (
            <>Your offer just expired - refresh to see your place in the queue.</>
          ) : (
            <>
              A seat opened up! Confirm your spot
              {countdown ? (
                <>
                  {" "}- <span className="tabular-nums font-semibold">{countdown}</span> left
                </>
              ) : holdLabel ? (
                ` before ${holdLabel}`
              ) : null}
              .
            </>
          )}
        </div>
        <button
          type="button"
          onClick={confirmSpot}
          disabled={state === "confirming" || offerExpired}
          className="ck-btn ck-btn--md ck-btn--full ck-btn--primary"
        >
          {state === "confirming" ? "Confirming…" : "Confirm your spot"}
        </button>
        <button
          type="button"
          onClick={() => void cancel()}
          disabled={state === "confirming"}
          className="ck-btn ck-btn--md ck-btn--full ck-btn--secondary"
        >
          Leave waitlist
        </button>
        {message ? (
          <p className="text-xs font-medium text-[color:var(--danger)]">{message}</p>
        ) : null}
      </div>
    );
  }

  const isLocked =
    state === "registered" ||
    state === "waitlisted" ||
    state === "cancelling" ||
    state === "confirming";

  return (
    <div className="grid gap-1">
      {showSuccess && successDetails ? (
        <EventRsvpSuccessOverlay
          details={successDetails}
          onClose={() => {
            setShowSuccess(false);
            router.refresh();
          }}
        />
      ) : null}
      {isLocked ? (
        <button
          type="button"
          onClick={onCancelClick}
          disabled={state === "cancelling" || state === "confirming"}
          className="ck-btn ck-btn--md ck-btn--full ck-btn--secondary"
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
          className="ck-btn ck-btn--md ck-btn--full ck-btn--primary"
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
          className={`text-xs font-medium ${
            state === "error" ? "text-[color:var(--danger)]" : "text-[color:var(--slate)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
