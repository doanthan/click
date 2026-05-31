"use client";

import { useState } from "react";

export function AdminMerchantAutoApprove({
  merchantId,
  initial,
}: {
  merchantId: string;
  initial: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    setError("");

    const response = await fetch(
      `/api/admin/merchants/${merchantId}/auto-approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApprove: next }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      autoApproveEvents?: boolean;
    };

    if (!response.ok) {
      setError(payload.error ?? "Could not update.");
      setSaving(false);
      return;
    }

    setEnabled(payload.autoApproveEvents ?? next);
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            Event review
          </p>
          <p className="mt-2 text-sm font-bold text-[color:var(--ink)]">
            {enabled
              ? "Trusted — new events publish live without review."
              : "Manual review — every new event waits in the pending queue."}
          </p>
          <p className="mt-1 text-xs font-medium text-[color:var(--mauve)]">
            Approving any one of this merchant&apos;s events turns this on
            automatically. Turn it off to send them back to manual review.
          </p>
          {error ? (
            <p className="mt-2 text-xs font-bold text-[color:var(--punch)]">{error}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          className={`shrink-0 rounded-full border-2 border-[color:var(--line)] px-5 py-2.5 text-xs font-black uppercase tracking-wide hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
            enabled
              ? "bg-[color:var(--cream)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
              : "bg-[color:var(--rose)] text-[color:var(--surface-deep)] hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
          }`}
        >
          {saving
            ? "Saving…"
            : enabled
              ? "Require review"
              : "Trust merchant"}
        </button>
      </div>
    </div>
  );
}
