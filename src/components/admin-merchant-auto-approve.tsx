"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Trust toggle for one merchant: auto-publish vs manual per-event review.
// Reports through sonner + router.refresh() rather than an inline red line, so
// it matches AdminMerchantVerification directly above it on the same page - two
// stacked controls answering in two different channels meant an operator who
// had learned to watch for the toast saw nothing when this one failed.
export function AdminMerchantAutoApprove({
  merchantId,
  initial,
}: {
  merchantId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const next = !enabled;
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/merchants/${merchantId}/auto-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApprove: next }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        autoApproveEvents?: boolean;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not update - the merchant is unchanged.");
        setSaving(false);
        return;
      }

      const applied = payload.autoApproveEvents ?? next;
      setEnabled(applied);
      setSaving(false);
      toast.success(
        applied
          ? "Trusted - their free events now publish live."
          : "Back to manual review - new events wait in the queue.",
      );
      // The surrounding server page renders the trust state too; without this it
      // kept showing the old one until a manual reload.
      router.refresh();
    } catch {
      // A network failure used to leave the button stuck on "Saving…" forever.
      toast.error("Could not reach the server - the merchant is unchanged.");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Event review</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
            {/* Free and paid diverge here: createEventForMerchant only requires
                Stripe Connect for an event that takes money (needsStripe =
                priceCents > 0), so a trusted host with no payouts still publishes
                free events live. Saying "new events publish live" flat promised
                the admin something paid events do not do. */}
            {enabled
              ? "Trusted - free events publish live; paid events wait until payouts are connected."
              : "Manual review - every new event waits in the pending queue."}
          </p>
          <p className="mt-1 text-xs text-[color:var(--slate)]">
            Approving any one of this merchant&apos;s events turns this on
            automatically. Turn it off to send them back to manual review.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          // aria-disabled, not disabled: disabling a focused control mid-write
          // blurs it and drops keyboard users at the top of the document. The
          // re-entry guard lives at the top of toggle().
          aria-disabled={saving || undefined}
          aria-busy={saving || undefined}
          className={`shrink-0 ck-btn ck-btn--sm ${
            enabled ? "ck-btn--secondary" : "ck-btn--primary"
          } ${saving ? "opacity-70" : ""}`}
        >
          {saving ? "Saving…" : enabled ? "Require review" : "Trust merchant"}
        </button>
      </div>
    </div>
  );
}
