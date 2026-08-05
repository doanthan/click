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
    // The double-submit guard that a real `disabled` attribute used to provide -
    // see the aria-disabled note on the button below.
    if (state === "submitting" || state === "done") return;
    setState("submitting");
    setMessage("");

    try {
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
    } catch {
      // The fetch itself can reject (offline, DNS, aborted navigation) and that
      // path skipped every setState below, stranding the button on
      // "Resubmitting..." with nothing said.
      setState("error");
      setMessage("Could not reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="grid gap-1">
      {/* aria-disabled rather than `disabled`: dropping a focused button out of
          the tab order mid-press makes browsers blur it, which sends keyboard
          users back to the top of the document right as the outcome arrives.
          The label and aria-busy carry the state instead. */}
      <button
        type="button"
        onClick={resubmit}
        aria-busy={state === "submitting" || undefined}
        aria-disabled={state === "submitting" || state === "done" || undefined}
        className={`ck-btn ck-btn--primary ck-btn--md ${
          state === "submitting" || state === "done" ? "opacity-60" : ""
        }`}
      >
        {state === "submitting"
          ? "Resubmitting…"
          : state === "done"
            ? "Resubmitted ✓"
            : "Resubmit for review →"}
      </button>
      {message ? (
        <p
          role={state === "error" ? "alert" : "status"}
          // The confirmation line pops in because landing in the review queue is
          // the whole point of the tap - it is not a celebration, so nothing
          // heavier than typography arrives with it.
          className={`text-xs font-bold ${state === "done" ? "pop-in" : ""} ${
            state === "error" ? "text-[color:var(--danger)]" : "text-[color:var(--mauve)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
