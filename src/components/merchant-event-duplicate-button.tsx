"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DuplicateState = "idle" | "submitting" | "error";

// Clones an event into a fresh draft (no attendees, re-dated a week out) and
// routes the merchant straight to the copy so they can adjust the date/details.
// Handy for recurring events — host the same plan again without re-typing it.
export function MerchantEventDuplicateButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<DuplicateState>("idle");
  const [message, setMessage] = useState("");

  async function duplicateEvent() {
    const confirmed = window.confirm(
      "Duplicate this event? We'll create a fresh copy (no attendees) dated a week from now for you to adjust.",
    );
    if (!confirmed) return;

    setState("submitting");
    setMessage("");

    const response = await fetch(
      `/api/merchant/events/${encodeURIComponent(eventId)}/duplicate`,
      { method: "POST" },
    );
    const payload = (await response.json()) as { error?: string; slug?: string };

    if (!response.ok || !payload.slug) {
      setState("error");
      setMessage(payload.error ?? "Could not duplicate this event.");
      return;
    }

    // Land on the copy so the merchant can set the real date / tweak details.
    router.push(`/merchant/events/${payload.slug}`);
    router.refresh();
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={duplicateEvent}
        disabled={state === "submitting"}
        className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "submitting" ? "Duplicating..." : "Duplicate event"}
      </button>
      {message ? (
        <p className="text-xs font-bold text-[color:var(--rose)]">{message}</p>
      ) : null}
    </div>
  );
}
