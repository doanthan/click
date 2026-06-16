"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "claim" | "release" | "remove";

const LABELS: Record<Action, { idle: string; busy: string; doneTitle: string; doneBody: string }> = {
  claim: {
    idle: "Claim my spot",
    busy: "Claiming…",
    doneTitle: "You're in 🎉",
    doneBody: "Your spot is confirmed — find it in your upcoming events.",
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
        <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, color: "#1F1226", margin: "0 0 8px" }}>
          {copy.doneTitle}
        </p>
        <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 15, color: "#6D435A", margin: 0 }}>
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
          background: action === "remove" ? "#6D435A" : "#340068",
          color: "#fff",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 16,
          fontWeight: 600,
          padding: "14px 28px",
          borderRadius: 8,
          opacity: state === "busy" ? 0.7 : 1,
        }}
      >
        {state === "busy" ? copy.busy : copy.idle}
      </button>
      {state === "error" && message ? (
        <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, color: "#B42318", margin: "14px 0 0" }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
