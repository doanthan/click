"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EVENT_CREATE_STORAGE_KEY } from "@/lib/event-create-storage";
import type { EventDuplicateDraft } from "@/lib/event-repository";

type DuplicateState = "idle" | "loading" | "error";

// "Duplicate" pre-populates the create wizard with this event's details (no
// attendees, no date) and drops the merchant into the normal create flow so
// they pick a fresh date/time, tweak anything, and publish — which is what
// pushes the copy into discovery. Handy for recurring events. The draft is
// seeded into the same sessionStorage slot the wizard rehydrates from.
// Bug board #184 (choose the date), #185 (no "Copy of" prefix), #191 (prefill +
// publish to discovery).
export function MerchantEventDuplicateButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<DuplicateState>("idle");
  const [message, setMessage] = useState("");

  async function duplicateEvent() {
    const confirmed = window.confirm(
      "Duplicate this event? We'll open a new event pre-filled with these details — pick a new date and publish when you're ready. (Any unsaved event draft will be replaced.)",
    );
    if (!confirmed) return;

    setState("loading");
    setMessage("");

    try {
      const response = await fetch(
        `/api/merchant/events/${encodeURIComponent(eventId)}/duplicate`,
        { method: "GET" },
      );
      const payload = (await response.json()) as {
        error?: string;
        draft?: EventDuplicateDraft;
      };

      if (!response.ok || !payload.draft) {
        setState("error");
        setMessage(payload.error ?? "Could not duplicate this event.");
        return;
      }

      // Seed the wizard, then land on step 1 so the merchant fills in the date.
      sessionStorage.setItem(EVENT_CREATE_STORAGE_KEY, JSON.stringify(payload.draft));
      router.push("/merchant/events/create/basics");
    } catch {
      setState("error");
      setMessage("Could not duplicate this event. Check your connection.");
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={duplicateEvent}
        disabled={state === "loading"}
        className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "loading" ? "Opening copy..." : "Duplicate event"}
      </button>
      {message ? (
        <p className="text-xs font-bold text-[color:var(--rose)]">{message}</p>
      ) : null}
    </div>
  );
}
