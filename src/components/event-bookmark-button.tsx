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
      <button
        type="button"
        onClick={toggle}
        disabled={state === "submitting"}
        aria-pressed={saved}
        aria-label={saved ? "Saved to bookmarks" : "Save event"}
        title={saved ? "Saved" : "Save"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--line)] transition disabled:cursor-not-allowed disabled:opacity-60 ${
          saved
            ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
            : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21z" />
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
