"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { openLoginModal } from "./login-modal-host";

type State = "idle" | "submitting" | "error";

export function EventBookmarkButton({
  eventId,
  initiallySaved,
}: {
  eventId: string;
  initiallySaved: boolean;
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

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={state === "submitting"}
        aria-pressed={saved}
        className={`rounded-full border-2 border-[color:var(--line)] px-4 py-3 text-center text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          saved
            ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
            : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
        }`}
      >
        {state === "submitting" ? "Saving..." : saved ? "Saved" : "Save"}
      </button>
      {message ? (
        <p className="text-xs font-bold text-[color:var(--rose)]">{message}</p>
      ) : null}
    </div>
  );
}
