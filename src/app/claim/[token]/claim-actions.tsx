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
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const copy = LABELS[action];

  async function run() {
    setState("busy");
    setMessage("");
    try {
      const res = await fetch(`/api/claim/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        eventSlug?: string;
      };
      if (!res.ok || !payload.ok) {
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
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-click-display), system-ui, sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 8px" }}>
          {copy.doneTitle}
        </p>
        <p style={{ fontFamily: SANS, fontSize: 15, color: "var(--mauve)", margin: 0 }}>
          {copy.doneBody}
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      <button
        type="button"
        onClick={run}
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
        <p style={{ fontFamily: SANS, fontSize: 14, color: "var(--danger)", margin: "14px 0 0" }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
