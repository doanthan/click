"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { quoteCancellationRefund, refundQuoteLabel } from "@/lib/refund-policy";
import type { MyGuestSeat } from "@/lib/event-repository";

// Purchaser-facing manager for the +1 seats they bought (spec 19 §10.1). Each seat
// can be handed back individually; the refund (per the standard cancellation
// window, on the per-seat amount paid) is shown before confirming so the number
// the buyer sees equals what we refund.
function seatStatusLabel(seat: MyGuestSeat): string {
  switch (seat.status) {
    case "claimed":
      return "Joined Click";
    case "invited":
      return "Invited - not joined yet";
    case "released":
      return "Handed back - held as an unnamed +1";
    case "removed":
      return "Details removed - held as an unnamed +1";
    default:
      return "Unnamed +1";
  }
}

function formatAud(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100,
  );
}

export function MyGuestSeats({
  perSeatCents,
  eventDateISO,
  seats: initialSeats,
}: {
  perSeatCents: number;
  eventDateISO: string;
  seats: MyGuestSeat[];
}) {
  const router = useRouter();
  const [seats, setSeats] = useState(initialSeats);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Same event for every seat → one quote covers them all.
  const refundLabel = refundQuoteLabel(quoteCancellationRefund(perSeatCents, eventDateISO), "AUD");

  function cancelSeat(seat: MyGuestSeat) {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/guest-seats/${encodeURIComponent(seat.guestSpotId)}/cancel`,
          { method: "POST" },
        );
        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          refund?: { refundCents: number; failed: boolean } | null;
        };
        if (!res.ok || !payload.ok) {
          toast.error(payload.error || "Could not cancel the seat.");
          return;
        }
        setSeats((prev) => prev.filter((s) => s.guestSpotId !== seat.guestSpotId));
        setConfirmId(null);
        const r = payload.refund;
        if (r && !r.failed && r.refundCents > 0) {
          toast.success(`Seat cancelled - ${formatAud(r.refundCents)} refund on the way.`);
        } else if (r && r.failed) {
          toast.success("Seat cancelled - your refund is processing.");
        } else {
          toast.success("Seat cancelled.");
        }
        router.refresh();
      } catch {
        toast.error("Network error. Try again.");
      }
    });
  }

  if (seats.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        Your +1s
      </h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--mauve)]">
        Seats you bought for friends. You can hand any one back - the refund goes to
        your card per the cancellation policy.
      </p>
      <div className="mt-3 grid gap-2">
        {seats.map((seat) => {
          const name = seat.firstName?.trim() || "Unnamed +1";
          const confirming = confirmId === seat.guestSpotId;
          return (
            <div
              key={seat.guestSpotId}
              className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[color:var(--ink)]">{name}</p>
                  <p className="text-xs font-semibold text-[color:var(--mauve)]">
                    {seatStatusLabel(seat)}
                  </p>
                </div>
                {!confirming ? (
                  <button
                    type="button"
                    onClick={() => setConfirmId(seat.guestSpotId)}
                    disabled={isPending}
                    className="shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)] disabled:opacity-60"
                  >
                    Cancel seat
                  </button>
                ) : null}
              </div>
              {confirming ? (
                <div className="mt-3 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3">
                  <p className="text-xs font-bold leading-5 text-[color:var(--surface-deep)]">
                    Cancel {name}&apos;s seat? {refundLabel}.
                    {seat.claimed
                      ? " They’ll be told their spot is no longer held."
                      : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => cancelSeat(seat)}
                      disabled={isPending}
                      className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm disabled:opacity-60"
                    >
                      {isPending ? "Cancelling…" : "Yes, cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      disabled={isPending}
                      className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] disabled:opacity-60"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
