"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ds";
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
  // Pre-rendered refund label (e.g. "Full refund - $35.00"). When present, the
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
  // Tone is tracked separately from `state` because a failure does not always
  // move the machine into "error" - a failed waitlist confirm goes back to
  // "waitlisted", a failed cancel back to "registered". Keying the colour off
  // the state alone printed those two in quiet Slate, which made a failure read
  // exactly like a success.
  const [messageIsError, setMessageIsError] = useState(false);
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

  /** Neutral progress / confirmation copy. */
  function say(text: string) {
    setMessage(text);
    setMessageIsError(false);
  }
  /** Something went wrong - always rendered in --danger and announced live. */
  function fail(text: string) {
    setMessage(text);
    setMessageIsError(true);
  }

  async function register() {
    setState("submitting");
    say("");

    let response: Response;
    try {
      response = await fetch(`/api/events/${encodeURIComponent(eventId)}/register`, {
        method: "POST",
      });
    } catch {
      // Without this a dropped connection left the button stuck on "RSVPing..."
      // with no way back but a reload. Reset only - never re-send.
      setState("error");
      fail("We couldn't reach Click. Check your connection and try again.");
      return;
    }

    if (response.status === 401) {
      setState("idle");
      openLoginModal({ callbackUrl: pathname || "/events" });
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      registration?: { status?: string; eventTitle?: string };
      error?: string;
      redirectTo?: string;
    };

    if (payload.redirectTo && !response.ok) {
      window.location.href = payload.redirectTo;
      return;
    }

    if (!response.ok) {
      setState("error");
      fail(payload.error ?? "Registration failed.");
      return;
    }

    const status = payload.registration?.status;
    setState(status === "waitlisted" ? "waitlisted" : "registered");
    say(
      status === "waitlisted" ? "You are on the waitlist." : "You are registered.",
    );
    if (status === "waitlisted") {
      router.refresh();
    } else if (successDetails) {
      // Already on the full event page - pop the confetti "You're confirmed!"
      // overlay in place (it has all the details around it already).
      setShowSuccess(true);
    } else {
      // RSVP'd from a card/modal (e.g. Discover): send the now-confirmed
      // attendee straight to their unlocked event page - full details + venue,
      // and a "You're confirmed!" banner (+ add-a-photo nudge) keyed off ?booked=1.
      say("You're confirmed! Taking you to your event…");
      window.location.href = `/events/${encodeURIComponent(eventId)}?booked=1`;
    }
  }

  // Accept a waitlist promotion offer for a free event. Paid offers come back
  // as a 402 with a redirect to the event page, where the buyer pays via Stripe.
  async function confirmSpot() {
    setState("confirming");
    say("");

    let response: Response;
    try {
      response = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/waitlist/accept`,
        { method: "POST" },
      );
    } catch {
      // Back to "waitlisted" - the offer is still live server-side, so the hold
      // clock keeps running and the CTA stays tappable. Reset only, no re-send.
      setState("waitlisted");
      fail("We couldn't reach Click. Check your connection and try again.");
      return;
    }

    if (response.status === 401) {
      setState("waitlisted");
      openLoginModal({ callbackUrl: pathname || "/events" });
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      registration?: { status?: string; eventTitle?: string };
      error?: string;
      redirectTo?: string;
    };

    if (payload.redirectTo && !response.ok) {
      window.location.href = payload.redirectTo;
      return;
    }

    if (!response.ok) {
      setState("waitlisted");
      fail(payload.error ?? "Could not confirm your spot.");
      router.refresh();
      return;
    }

    setState("registered");
    say("Your spot is confirmed!");
    if (successDetails) {
      setShowSuccess(true);
    } else {
      router.refresh();
    }
  }

  async function cancel() {
    const previous = state === "waitlisted" ? "waitlisted" : "registered";
    setState("cancelling");
    say("");

    let response: Response;
    try {
      response = await fetch(`/api/events/${encodeURIComponent(eventId)}/register`, {
        method: "DELETE",
      });
    } catch {
      // Land back on whichever seat state they had, so the spot still reads as
      // theirs - a stuck "Cancelling..." implies it went through when it did not.
      setState(previous);
      fail("We couldn't reach Click - your spot is unchanged. Try again.");
      return;
    }

    if (response.status === 401) {
      setState(previous);
      openLoginModal({ callbackUrl: pathname || "/events" });
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setState("error");
      fail(payload.error ?? "Cancel failed.");
      return;
    }

    setState("cancelled");
    // After cancelling, the page re-renders into the locked/pre-RSVP state and
    // this button re-mounts to "idle", wiping the in-memory message - so it
    // looked like a silent dump onto a locked event (bug board #212). Carry an
    // acknowledgment in the URL so a durable banner confirms the cancel. The
    // waitlist "leave" path keeps the lighter in-place refresh.
    if (previous === "waitlisted") {
      say("You left the waitlist.");
      router.refresh();
    } else {
      say("Your RSVP was cancelled.");
      // Hard-replace the Stripe success URL so its reusable `session_id` is
      // removed before the server renders again. This also guarantees that the
      // attendee list, capacity and private venue gate all come from the newly
      // cancelled database state instead of lingering client props.
      window.location.replace(
        `${pathname ?? `/events/${encodeURIComponent(eventId)}`}?cancelled=1`,
      );
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
              say("");
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
        <Button
          type="button"
          onClick={() => void confirmSpot()}
          disabled={offerExpired}
          loading={state === "confirming"}
          full
        >
          Confirm your spot
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void cancel()}
          disabled={state === "confirming"}
          full
        >
          Leave waitlist
        </Button>
        {state === "confirming" ? (
          <p role="status" aria-live="polite" className="text-xs font-medium text-[color:var(--slate)]">
            Confirming your spot…
          </p>
        ) : null}
        {message ? (
          <p
            role={messageIsError ? "alert" : "status"}
            aria-live={messageIsError ? "assertive" : "polite"}
            className={`text-xs font-medium ${
              messageIsError ? "text-[color:var(--danger)]" : "text-[color:var(--slate)]"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  const isLocked =
    state === "registered" ||
    state === "waitlisted" ||
    state === "cancelling" ||
    state === "confirming";

  const busyMessage =
    state === "submitting"
      ? isWaitlist
        ? "Joining the waitlist…"
        : "Saving your RSVP…"
      : state === "cancelling"
        ? isWaitlist
          ? "Leaving the waitlist…"
          : "Cancelling your RSVP…"
        : state === "confirming"
          ? "Confirming your spot…"
          : null;

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
        <Button
          type="button"
          variant="secondary"
          onClick={onCancelClick}
          loading={state === "cancelling" || state === "confirming"}
          full
        >
          {state === "waitlisted" ? "Leave waitlist" : "Cancel RSVP"}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={() => void register()}
          loading={state === "submitting"}
          full
        >
          {state === "cancelled"
            ? isWaitlist
              ? "Rejoin waitlist"
              : "RSVP again"
            : isWaitlist
              ? "Join waitlist"
              : "RSVP"}
        </Button>
      )}
      {/* The DS button hides its own label while loading, so the in-flight
          wording lives here - where it is also announced, which a swapped label
          on a disabled button never was. */}
      {busyMessage ? (
        <p role="status" aria-live="polite" className="text-xs font-medium text-[color:var(--slate)]">
          {busyMessage}
        </p>
      ) : null}
      {message ? (
        <p
          role={messageIsError ? "alert" : "status"}
          aria-live={messageIsError ? "assertive" : "polite"}
          className={`text-xs font-medium ${
            messageIsError ? "text-[color:var(--danger)]" : "text-[color:var(--slate)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
