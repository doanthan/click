"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Status = "pending" | "approved" | "rejected" | "suspended";

// Approve / Decline control for the merchant review page - the first step of the
// review process is eyeballing the merchant's details, so the decision lives
// right here (bug board #178). POSTs to the existing verification route, which
// also emails the merchant (verified / rejected) via updateMerchantVerificationForAdmin.
export function AdminMerchantVerification({
  merchantId,
  initialStatus,
}: {
  merchantId: string;
  initialStatus: Status;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [saving, setSaving] = useState<null | "approved" | "rejected">(null);
  // Which decision the branded ConfirmDialog is currently confirming (null = closed).
  const [pending, setPending] = useState<null | "approved" | "rejected">(null);

  // Opens the branded confirm/prompt dialog for the chosen decision.
  function decide(next: "approved" | "rejected") {
    setPending(next);
  }

  // Runs after the admin confirms in the dialog. `reason` carries the decline
  // free-text (empty for approvals) and rides through to the merchant email.
  async function performDecision(next: "approved" | "rejected", reason?: string) {
    setSaving(next);

    try {
      const response = await fetch(`/api/admin/merchants/${merchantId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        verificationStatus?: Status;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not update.");
        setSaving(null);
        setPending(null);
        return;
      }

      setStatus(payload.verificationStatus ?? next);
      setSaving(null);
      setPending(null);
      toast.success(next === "approved" ? "Merchant approved." : "Merchant declined.");
      // Re-render the server page so the status badge + downstream gating update.
      router.refresh();
    } catch {
      // A dropped connection used to strand the button on "Approving…" with the
      // dialog still open and no way to tell whether the decision landed.
      toast.error("Could not reach the server - the merchant is unchanged. Try again.");
      setSaving(null);
      setPending(null);
    }
  }

  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Verification decision</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
            {isApproved
              ? "Approved & trusted - their events now publish without per-event review."
              : isRejected
                ? "Declined - this merchant cannot publish events."
                : "Review the details, documents and ABN above, then approve or decline."}
          </p>
          <p className="mt-1 text-xs text-[color:var(--slate)]">
            Approving auto-trusts this merchant, so their events publish straight
            to live (no per-event review) and sends an approval email. Need manual
            review instead? Flip the trust toggle below. Declining notifies them
            with your reason. You can change this later.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => decide("approved")}
            disabled={saving !== null || isApproved}
            className="ck-btn ck-btn--primary ck-btn--sm disabled:cursor-not-allowed"
          >
            {saving === "approved" ? "Approving…" : isApproved ? "Approved ✓" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => decide("rejected")}
            disabled={saving !== null || isRejected}
            className="ck-btn ck-btn--secondary ck-btn--sm disabled:cursor-not-allowed"
          >
            {saving === "rejected" ? "Declining…" : isRejected ? "Declined" : "Decline"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pending === "approved"}
        title="Approve this merchant?"
        description="They'll be approved AND auto-trusted - their events publish straight to live without per-event review (you can switch them back to manual review with the trust toggle). They'll get an approval email. You can change this later."
        confirmLabel="Approve merchant"
        tone="peach"
        busy={saving === "approved"}
        onConfirm={() => performDecision("approved")}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === "rejected"}
        title="Decline this merchant?"
        description="They'll be notified by email and won't be able to publish events. You can change this later."
        confirmLabel="Decline merchant"
        tone="rose"
        busy={saving === "rejected"}
        promptLabel="Reason for declining (included in the email to the merchant)"
        promptPlaceholder="Leave blank to send the generic note"
        onConfirm={(reason) => performDecision("rejected", reason || undefined)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
