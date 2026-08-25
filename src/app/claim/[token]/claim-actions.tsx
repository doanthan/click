"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "claim" | "release" | "remove";

const SANS = "var(--font-click-body), system-ui, -apple-system, sans-serif";

const LABELS: Record<Action, { idle: string; busy: string; doneTitle: string; doneBody: string }> = {
  claim: {
    idle: "Claim my spot",
    busy: "Claiming…",
    doneTitle: "You're in 🎉",
    doneBody: "Your spot is confirmed - find it in your upcoming events.",
  },
  release: {
    idle: "Hand the spot back",
    busy: "Releasing…",
    doneTitle: "Spot released",
    doneBody: "We've let them know. The seat is back with the person who invited you.",
  },
  remove: {
    idle: "Remove my details",
    busy: "Removing…",
    doneTitle: "Your details are gone",
    doneBody: "We've removed your details and won't hold them. Nothing else is needed.",
  },
};

export function GuestClaimActions({
  token,
  action,
  redirectSlug,
}: {
  token: string;
  action: Action;
  // When a claim succeeds, send the now-signed-in guest to the event page.
  redirectSlug?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error" | "confirm-other">("idle");
  const [message, setMessage] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const copy = LABELS[action];

  async function run(confirmDifferentEmail = false) {
    setState("busy");
    setMessage("");
    try {
      const res = await fetch(`/api/claim/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, confirmDifferentEmail }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        eventSlug?: string;
        reason?: string;
        invitedEmailMasked?: string;
      };
      if (!res.ok || !payload.ok) {
        // The seat was saved for a different address. Say so, and let them take
        // it deliberately - the person who paid is told who actually claimed it.
        if (payload.reason === "email-mismatch") {
          setInvitedEmail(payload.invitedEmailMasked || "the invited address");
          setState("confirm-other");
          return;
        }
        setState("error");
        setMessage(payload.error || "Something went wrong. Try again.");
        return;
      }
      setState("done");
      if (action === "claim") {
        const slug = payload.eventSlug || redirectSlug;
        if (slug) {
          router.push(`/events/${slug}`);
          router.refresh();
        }
      }
    } catch {
      setState("error");
      setMessage("Network error. Try again.");
    }
  }

  if (state === "done") {
    return (
      // Announced: on the release/remove paths the button is replaced in place
      // and nothing else on the page moves, so a screen reader is otherwise
      // given no sign the tap did anything.
      <div role="status" style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-click-display), system-ui, sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 8px" }}>
          {copy.doneTitle}
        </p>
        <p style={{ fontFamily: SANS, fontSize: 15, color: "var(--mauve)", margin: 0 }}>
          {copy.doneBody}
        </p>
      </div>
    );
  }

  if (state === "confirm-other") {
    return (
      <div role="status" style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: "var(--font-click-display), system-ui, sans-serif",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            margin: "0 0 8px",
          }}
        >
          This spot was saved for {invitedEmail}
        </p>
        <p style={{ fontFamily: SANS, fontSize: 15, color: "var(--mauve)", margin: "0 0 20px", lineHeight: 1.6 }}>
          You&apos;re signed in as someone else. You can still take the seat - we&apos;ll tell the person who
          bought it that you claimed it, so nobody turns up expecting a different name.
        </p>
        <button
          type="button"
          onClick={() => void run(true)}
          style={{
            appearance: "none",
            border: "none",
            cursor: "pointer",
            background: "var(--purple)",
            color: "var(--champagne)",
            fontFamily: SANS,
            fontSize: 16,
            fontWeight: 600,
            padding: "14px 28px",
            borderRadius: 12,
          }}
        >
          Claim it as me
        </button>
        <p style={{ fontFamily: SANS, fontSize: 14, color: "var(--mauve)", margin: "14px 0 0" }}>
          Not yours?{" "}
          <button
            type="button"
            onClick={() => setState("idle")}
            style={{
              appearance: "none",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--purple)",
              fontFamily: SANS,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Go back
          </button>
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      <button
        type="button"
        onClick={() => void run()}
        disabled={state === "busy"}
        style={{
          appearance: "none",
          border: "none",
          cursor: state === "busy" ? "default" : "pointer",
          background: action === "remove" ? "var(--danger)" : "var(--purple)",
          color: "var(--champagne)",
          fontFamily: SANS,
          fontSize: 16,
          fontWeight: 600,
          padding: "14px 28px",
          borderRadius: 12,
          opacity: state === "busy" ? 0.7 : 1,
        }}
      >
        {state === "busy" ? copy.busy : copy.idle}
      </button>
      {state === "error" && message ? (
        <p role="alert" style={{ fontFamily: SANS, fontSize: 14, color: "var(--danger)", margin: "14px 0 0" }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
