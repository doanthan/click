"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "pending" | "approved" | "rejected" | "suspended";

// Approve / Decline control for the merchant review page — the first step of the
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
  const [error, setError] = useState("");

  async function decide(next: "approved" | "rejected") {
    let reason: string | undefined;
    if (next === "rejected") {
      const input = window.prompt(
        "Reason for declining (included in the email to the merchant)?",
        "",
      );
      if (input === null) return; // cancelled the prompt
      reason = input.trim() || undefined;
    } else if (
      !window.confirm(
        "Approve this merchant? They'll be able to create events and will get an approval email.",
      )
    ) {
      return;
    }

    setSaving(next);
    setError("");

    const response = await fetch(
      `/api/admin/merchants/${merchantId}/verification`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, reason }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      verificationStatus?: Status;
    };

    if (!response.ok) {
      setError(payload.error ?? "Could not update.");
      setSaving(null);
      return;
    }

    setStatus(payload.verificationStatus ?? next);
    setSaving(null);
    // Re-render the server page so the status badge + downstream gating update.
    router.refresh();
  }

  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            Verification decision
          </p>
          <p className="mt-2 text-sm font-bold text-[color:var(--ink)]">
            {isApproved
              ? "Approved — this merchant can publish events."
              : isRejected
                ? "Declined — this merchant cannot publish events."
                : "Review the details, documents and ABN above, then approve or decline."}
          </p>
          <p className="mt-1 text-xs font-medium text-[color:var(--mauve)]">
            Approving lets them create events and sends an approval email.
            Declining notifies them with your reason. You can change this later.
          </p>
          {error ? (
            <p className="mt-2 text-xs font-bold text-[color:var(--punch)]">{error}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => decide("approved")}
            disabled={saving !== null || isApproved}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-5 py-2.5 text-xs font-black uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--rose)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving === "approved" ? "Approving…" : isApproved ? "Approved ✓" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => decide("rejected")}
            disabled={saving !== null || isRejected}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-xs font-black uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving === "rejected" ? "Declining…" : isRejected ? "Declined" : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}
