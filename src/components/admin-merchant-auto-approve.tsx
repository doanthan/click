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
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Event review</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
            {enabled
              ? "Trusted - new events publish live without review."
              : "Manual review - every new event waits in the pending queue."}
          </p>
          <p className="mt-1 text-xs text-[color:var(--slate)]">
            Approving any one of this merchant&apos;s events turns this on
            automatically. Turn it off to send them back to manual review.
          </p>
          {error ? (
            <p className="mt-2 text-xs font-semibold text-[color:var(--danger)]">{error}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          className={`shrink-0 disabled:cursor-not-allowed ck-btn ck-btn--sm ${
            enabled ? "ck-btn--secondary" : "ck-btn--primary"
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
