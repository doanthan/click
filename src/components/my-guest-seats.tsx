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

// Name, or fix the name of, one +1 seat (bug board #228). A seat already invited
// can change its name alone; a different email - or a seat nobody has been named
// for yet - is a new person, so it takes a date of birth too (the same 18+ rule
// as checkout) and sends them a fresh invite.
function NameSeatForm({
  seat,
  onSaved,
  onCancel,
}: {
  seat: MyGuestSeat;
  onSaved: (seat: MyGuestSeat) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(seat.firstName ?? "");
  const [email, setEmail] = useState(seat.email ?? "");
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const renameOnly =
    seat.status === "invited" &&
    email.trim().toLowerCase() === (seat.email ?? "").trim().toLowerCase();

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/guest-seats/${encodeURIComponent(seat.guestSpotId)}/name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renameOnly ? { firstName } : { firstName, email, dob }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        seat?: MyGuestSeat;
      };
      if (!res.ok || !payload.ok || !payload.seat) {
        setError(payload.error || "Could not save their details.");
        return;
      }
      const saved = payload.seat;
      toast.success(
        renameOnly
          ? `Saved - their spot is under ${saved.firstName}.`
          : saved.claimed
            ? `${saved.firstName} is already on Click - the spot is in their Upcoming Events.`
            : `Saved - ${saved.firstName} will get an invite from Click.`,
      );
      onSaved(saved);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="mt-3 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          aria-label="Guest first name"
          autoComplete="off"
          className="ck-input w-full"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Guest email"
          autoComplete="off"
          className="ck-input w-full"
        />
      </div>
      {renameOnly ? null : (
        <label className="grid gap-1 text-[11px] font-medium text-[color:var(--slate)]">
          Their date of birth (guests must be 18 or older)
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            aria-label="Guest date of birth"
            className="ck-input w-full"
          />
        </label>
      )}
      {renameOnly ? null : (
        <p className="text-[11px] text-[color:var(--slate)]">
          We&apos;ll email them one invite with the event details and a link to claim the spot.
        </p>
      )}
      {error ? (
        <p role="alert" className="text-[11px] font-medium text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving || undefined}
          className="ck-btn ck-btn--sm ck-btn--primary"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="ck-btn ck-btn--sm ck-btn--secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function MyGuestSeats({
  perSeatCents,
  eventDateISO,
  seats: initialSeats,
  editable = false,
}: {
  perSeatCents: number;
  eventDateISO: string;
  seats: MyGuestSeat[];
  /** Before the event starts - after that the list is the host's door list and
   *  nameGuestSeatForPurchaser refuses. Decided by the server-rendered page. */
  editable?: boolean;
}) {
  const router = useRouter();
  const [seats, setSeats] = useState(initialSeats);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      <h2 className="eyebrow">Your +1s</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
        Seats you bought for friends. Add or fix a friend&apos;s name any time before the
        event, or hand a seat back - the refund goes to your card per the cancellation policy.
      </p>
      <div className="mt-3 grid gap-2">
        {seats.map((seat) => {
          const name = seat.firstName?.trim() || "Unnamed +1";
          const confirming = confirmId === seat.guestSpotId;
          const editing = editingId === seat.guestSpotId;
          // Someone who has claimed their seat is a member now; their name is
          // their profile's to change, not the buyer's.
          const canName = editable && !seat.claimed;
          return (
            <div
              key={seat.guestSpotId}
              className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--ink)]">{name}</p>
                  <p className="text-xs font-medium text-[color:var(--slate)]">
                    {seatStatusLabel(seat)}
                  </p>
                </div>
                {!confirming && !editing ? (
                  <div className="flex shrink-0 gap-2">
                    {canName ? (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmId(null);
                          setEditingId(seat.guestSpotId);
                        }}
                        disabled={isPending}
                        className="ck-btn ck-btn--sm ck-btn--secondary"
                      >
                        {seat.firstName?.trim() ? "Edit" : "Add name"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setConfirmId(seat.guestSpotId)}
                      disabled={isPending}
                      className="ck-btn ck-btn--sm ck-btn--secondary"
                    >
                      Cancel seat
                    </button>
                  </div>
                ) : null}
              </div>
              {editing ? (
                <NameSeatForm
                  seat={seat}
                  onCancel={() => setEditingId(null)}
                  onSaved={(saved) => {
                    setSeats((prev) =>
                      prev.map((s) => (s.guestSpotId === saved.guestSpotId ? saved : s)),
                    );
                    setEditingId(null);
                    router.refresh();
                  }}
                />
              ) : null}
              {confirming ? (
                <div className="mt-3 rounded-xl bg-[color:var(--champagne-deep)] p-3">
                  <p className="text-xs font-medium leading-5 text-[color:var(--ink)]">
                    Cancel {name}&apos;s seat? {refundLabel}.
                    {seat.claimed
                      ? " They’ll be told their spot is no longer held."
                      : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => cancelSeat(seat)}
                      // disabled stays: a second tap here is a second refund
                      // attempt. aria-busy is what makes the wait audible, since
                      // a disabled button is skipped by many screen-reader cursors.
                      disabled={isPending}
                      aria-busy={isPending || undefined}
                      className="ck-btn ck-btn--sm ck-btn--danger"
                    >
                      {isPending ? "Cancelling…" : "Yes, cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      disabled={isPending}
                      className="ck-btn ck-btn--sm ck-btn--secondary"
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
