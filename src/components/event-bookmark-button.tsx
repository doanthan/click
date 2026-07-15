"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { openLoginModal } from "./login-modal-host";

type State = "idle" | "submitting" | "error";

export function EventBookmarkButton({
  eventId,
  initiallySaved,
  compact = false,
  variant = "button",
}: {
  eventId: string;
  initiallySaved: boolean;
  compact?: boolean;
  variant?: "button" | "star";
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const pathname = usePathname();

  async function toggle() {
    setState("submitting");
    setMessage("");
    const optimisticNext = !saved;

    const response = await fetch(
      `/api/events/${encodeURIComponent(eventId)}/bookmark`,
      { method: optimisticNext ? "POST" : "DELETE" },
    );

    if (response.status === 401) {
      setState("idle");
      openLoginModal({ callbackUrl: pathname || "/events" });
      return;
    }

    const payload = (await response.json()) as { error?: string; saved?: boolean };

    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Could not save.");
      return;
    }

    setSaved(typeof payload.saved === "boolean" ? payload.saved : optimisticNext);
    setState("idle");
  }

  if (variant === "star") {
    return (
      // The DS save affordance: a bookmark glyph on a translucent-cream disc,
      // riding the card cover top-right. Fills Deep Purple once saved. No heavy
      // border, no star (the DS icon set has no star).
      <button
        type="button"
        onClick={toggle}
        disabled={state === "submitting"}
        aria-pressed={saved}
        aria-label={saved ? "Saved to bookmarks" : "Save event"}
        title={saved ? "Saved" : "Save"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(249,246,240,0.92)] text-[color:var(--ink)] shadow-[var(--shadow-xs)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill={saved ? "var(--purple)" : "none"}
          stroke={saved ? "var(--purple)" : "currentColor"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={state === "submitting"}
        aria-pressed={saved}
        className={`rounded-full border-2 border-[color:var(--line)] text-center font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "px-3 py-1.5 text-[0.68rem] uppercase tracking-wider hard-shadow-sm" : "px-4 py-3 text-sm"
        } ${
          saved
            ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
            : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
        }`}
      >
        {state === "submitting" ? "Saving..." : saved ? "Saved" : "Save"}
      </button>
      {message && !compact ? (
        <p className="text-xs font-bold text-[color:var(--rose)]">{message}</p>
      ) : null}
    </div>
  );
}
