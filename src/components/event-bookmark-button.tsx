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
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--champagne)_92%,transparent)] text-[color:var(--ink)] shadow-[var(--shadow-xs)] transition hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
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
        className={`ck-btn ${compact ? "ck-btn--sm" : "ck-btn--md ck-btn--full"} ${
          saved ? "ck-btn--primary" : "ck-btn--secondary"
        }`}
      >
        {state === "submitting" ? "Saving..." : saved ? "Saved" : "Save"}
      </button>
      {message && !compact ? (
        <p className="text-xs font-semibold text-[color:var(--danger)]">{message}</p>
      ) : null}
    </div>
  );
}
