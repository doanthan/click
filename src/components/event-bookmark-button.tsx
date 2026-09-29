"use client";

import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();

  async function toggle() {
    // One request at a time. The control stays live and undimmed while it
    // runs, so a tap reads as done; a second tap in that window is dropped
    // rather than racing the first.
    if (state === "submitting") return;
    const previous = saved;
    const next = !saved;
    // Show the answer now and let the request confirm it or put it back. The
    // icon used to sit dimmed through the whole round trip before it changed.
    setSaved(next);
    setState("submitting");
    setMessage("");

    let response: Response;
    try {
      response = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/bookmark`,
        { method: next ? "POST" : "DELETE" },
      );
    } catch {
      // Never strand the control in "submitting" - taps are dropped while it
      // is, so a rejected fetch would brick it until a page reload.
      setSaved(previous);
      setState("error");
      setMessage("We couldn't reach Click. Try again.");
      return;
    }

    if (response.status === 401) {
      setSaved(previous);
      setState("idle");
      openLoginModal({ callbackUrl: pathname || "/discover" });
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      saved?: boolean;
    };

    if (!response.ok) {
      setSaved(previous);
      setState("error");
      setMessage(payload.error ?? "Could not save.");
      return;
    }

    setSaved(typeof payload.saved === "boolean" ? payload.saved : next);
    setState("idle");
    // /bookmarks is a server-rendered list: without this, unsaving from that
    // page left the card sitting there as though nothing happened. The icon
    // has already changed by now, so the tap never waits on it.
    router.refresh();
  }

  if (variant === "star") {
    return (
      // The DS save affordance: a bookmark glyph on a translucent-cream disc,
      // riding the card cover top-right. Fills Deep Purple once saved. No heavy
      // border, no star (the DS icon set has no star).
      <span className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-busy={state === "submitting" || undefined}
        aria-pressed={saved}
        aria-label={saved ? "Saved to bookmarks" : "Save event"}
        title={state === "error" && message ? message : saved ? "Saved" : "Save"}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--champagne)_92%,transparent)] text-[color:var(--ink)] shadow-[var(--shadow-xs)] transition hover:bg-[color:var(--paper)] lg:size-9"
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
      {/* The star variant used to have no failure surface at all: a 500 or the
          503 from databaseUnavailableError set state "error" and showed the
          reader nothing, so a card that never saved looked identical to one
          that did. */}
      {state === "error" && message ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 size-2 rounded-full bg-[color:var(--danger)] ring-2 ring-[color:var(--champagne)]"
          />
          <span role="alert" className="sr-only">
            {message}
          </span>
        </>
      ) : null}
      </span>
    );
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-busy={state === "submitting" || undefined}
        aria-pressed={saved}
        className={`ck-btn ${compact ? "ck-btn--sm" : "ck-btn--md ck-btn--full"} ${
          saved ? "ck-btn--primary" : "ck-btn--secondary"
        }`}
      >
        {saved ? "Saved" : "Save"}
      </button>
      {message && !compact ? (
        <p className="text-xs font-semibold text-[color:var(--danger)]">{message}</p>
      ) : null}
    </div>
  );
}
