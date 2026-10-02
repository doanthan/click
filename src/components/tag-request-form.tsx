"use client";

import { useId, useState } from "react";
import { toast } from "sonner";

// "Can't find the right tag?" - the one way a host gets a tag added (bug board
// #275). The picker stays a closed list; this queues the ask for an admin on
// /admin/tags (POST /api/merchant/tag-requests) and never holds the event up -
// the host picks the closest tag now and adds the new one once it exists.
// Shared by the event wizard's tag picker and the portal's Settings tab (bug
// board #315), so the two places a host might go looking ask the same way.
export function TagRequestForm({ context = "event" }: { context?: "event" | "settings" }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const labelId = useId();
  const ready = label.trim().length >= 2 && !sending;

  async function send() {
    if (!ready) return;
    setSending(true);
    try {
      const response = await fetch("/api/merchant/tag-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, note }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        status?: "requested" | "exists";
        label?: string;
        error?: string;
      };
      if (!response.ok) {
        toast.error(payload.error ?? "Couldn't send that request - try again.");
        return;
      }
      if (payload.status === "exists") {
        toast.success(
          context === "event"
            ? `"${payload.label}" is already a tag - search for it above.`
            : `"${payload.label}" is already a tag - pick it when you create or edit an event.`,
        );
        return;
      }
      toast.success(`Sent - we'll let you know when "${payload.label ?? label.trim()}" is added.`);
      setLabel("");
      setNote("");
      setOpen(false);
    } catch {
      toast.error("Could not reach the server - try again.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ck-taplink justify-self-start text-[12.5px] font-semibold text-[color:var(--purple)] underline underline-offset-2"
      >
        Can&apos;t find the right tag? Request one
      </button>
    );
  }

  return (
    <div className="grid gap-2 rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-3">
      <label htmlFor={labelId} className="text-[13.5px] font-semibold text-[color:var(--ink)]">
        Tag you&apos;d like added
      </label>
      <input
        id={labelId}
        value={label}
        maxLength={40}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void send();
          }
        }}
        placeholder="e.g. Board games"
        className="ck-input w-full"
      />
      <input
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Note for the Click team (optional)"
        placeholder="Anything we should know? (optional)"
        className="ck-input w-full"
      />
      <p className="text-[12.5px] leading-5 text-[color:var(--slate)]">
        {context === "event"
          ? "An admin reviews it. Your event doesn't wait - pick the closest tag for now."
          : "An admin reviews it, and we'll let you know once it's added."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void send()}
          aria-disabled={!ready || undefined}
          className={`ck-btn ck-btn--primary ck-btn--sm${ready ? "" : " opacity-60"}`}
        >
          <span className="ck-btn__label">{sending ? "Sending…" : "Send request"}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ck-btn ck-btn--secondary ck-btn--sm"
        >
          <span className="ck-btn__label">Cancel</span>
        </button>
      </div>
    </div>
  );
}
