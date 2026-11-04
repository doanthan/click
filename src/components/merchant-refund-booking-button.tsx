"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatMoney } from "@/lib/amounts";

// A host refunds one booking from their event's door list (fix 31). Two
// choices, because they do different things to the seat: cancelling refunds
// in full and gives the seat back (its +1s and the waitlist move as they do on
// any cancellation); a part refund is goodwill - the money goes back and the
// guest keeps coming. The route re-checks everything, including that the money
// is still held in the host's balance.
export function MerchantRefundBookingButton({
  paymentTransactionId,
  guestName,
  remainingCents,
}: {
  paymentTransactionId: string;
  guestName: string;
  remainingCents: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"cancel" | "partial" | null>(null);
  const [busy, setBusy] = useState(false);

  async function refund(chosen: "cancel" | "partial", amountText: string) {
    let amountCents: number | undefined;
    if (chosen === "partial") {
      const dollars = Number(amountText.replace(/[^0-9.]/g, ""));
      amountCents = Math.round(dollars * 100);
      if (!Number.isFinite(dollars) || amountCents <= 0) {
        toast.error("Enter the amount to refund, e.g. 5.00.");
        return;
      }
      // A refund of everything left releases the seat (the charge.refunded
      // webhook), so that is Cancel + refund, not a part refund.
      if (amountCents >= remainingCents) {
        toast.error(`A part refund has to be less than ${formatMoney(remainingCents)}. To refund all of it, use Cancel + refund.`);
        return;
      }
    }
    setBusy(true);
    try {
      const response = await fetch(
        `/api/merchant/transactions/${encodeURIComponent(paymentTransactionId)}/refund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: chosen, amountCents }),
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "The refund didn't go through - nothing was refunded.");
        return;
      }
      toast.success(
        chosen === "cancel"
          ? `${guestName}'s booking is cancelled and refunded in full.`
          : `Refunded ${formatMoney(amountCents ?? 0)} to ${guestName}. They keep their seat.`,
      );
      setMode(null);
      router.refresh();
    } catch {
      // No answer at all, so we can't say which side of Stripe it failed on.
      toast.error("Couldn't reach Click. Refresh the page to see whether the refund went through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-semibold">
      <button
        type="button"
        onClick={() => setMode("partial")}
        className="text-[color:var(--purple)] underline underline-offset-2"
      >
        Part refund
      </button>
      <button
        type="button"
        onClick={() => setMode("cancel")}
        className="text-[color:var(--danger)] underline underline-offset-2"
      >
        Cancel + refund
      </button>
      <ConfirmDialog
        open={mode === "cancel"}
        title={`Cancel ${guestName}'s booking?`}
        description={`They get ${formatMoney(remainingCents)} back in full, their seat and any +1s are released, and they're emailed. This can't be undone.`}
        confirmLabel="Cancel and refund"
        tone="rose"
        busy={busy}
        onConfirm={() => refund("cancel", "")}
        onCancel={() => setMode(null)}
      />
      <ConfirmDialog
        open={mode === "partial"}
        title={`Refund part of ${guestName}'s booking?`}
        description={`The money goes back to their card and they keep their seat. Less than ${formatMoney(remainingCents)} - to refund all of it, use Cancel + refund.`}
        promptLabel="Amount to refund (AUD)"
        promptPlaceholder="5.00"
        promptMultiline={false}
        promptRequired
        confirmLabel="Refund"
        tone="ink"
        busy={busy}
        onConfirm={(value) => refund("partial", value)}
        onCancel={() => setMode(null)}
      />
    </span>
  );
}
