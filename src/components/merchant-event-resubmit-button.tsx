"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ResubmitState = "idle" | "submitting" | "done" | "error";

// Resubmit a rejected event for admin review after the merchant has edited it
// (bug board #217). Posts to /api/merchant/events/[slug]/resubmit, which flips
// the status back to pending (or live for a trusted merchant) and re-queues it.
export function MerchantEventResubmitButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ResubmitState>("idle");
  const [message, setMessage] = useState("");

  async function resubmit() {
    setState("submitting");
    setMessage("");

    const response = await fetch(
      `/api/merchant/events/${encodeURIComponent(eventId)}/resubmit`,
      { method: "POST" },
    );
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; status?: string }
      | null;

    if (!response.ok || !payload) {
      setState("error");
      setMessage(payload?.error ?? "Could not resubmit this event. Try again.");
      return;
    }

    setState("done");
    setMessage(
      payload.status === "Live"
        ? "Resubmitted - your event is live again."
        : "Resubmitted for review. We'll email you the outcome.",
    );
    router.refresh();
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={resubmit}
        disabled={state === "submitting" || state === "done"}
        className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "submitting"
          ? "Resubmitting…"
          : state === "done"
            ? "Resubmitted ✓"
            : "Resubmit for review →"}
      </button>
      {message ? (
        <p
          className={`text-xs font-bold ${
            state === "error" ? "text-[color:var(--rose)]" : "text-[color:var(--mauve)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
