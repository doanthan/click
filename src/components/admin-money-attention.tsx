"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge, type BadgeTone } from "@/components/ds";
import type { AdminDisputeRow, AdminRefundFailureRow } from "@/lib/event-repository";

/**
 * The "Needs attention" tab of /admin/transactions - the two money queues that
 * had no screen at all.
 *
 * REFUND FAILURES. A cancellation whose Stripe refund threw still cancels: the
 * seat is released and the attendee is told their refund is coming, then the
 * failure is written to `refund_failures` and the request returns fine. That
 * table had five writers and no reader, so the only signal an operator ever got
 * was the attendee eventually asking where their money was. Retry re-asks
 * Stripe; Clear closes an entry that was settled some other way, and demands a
 * note, because a cleared queue nobody can explain is worse than a full one.
 *
 * DISPUTES. Stripe gives a hard evidence deadline and defaults to the customer
 * when it passes, so the cost of not noticing one is the whole charge plus the
 * fee. Evidence is submitted in the Stripe Dashboard - we deliberately do not
 * mirror that here - so every row is a deep link, and the deadline is the
 * loudest thing on it.
 */

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

/**
 * Why a retry is or is not possible, said in the operator's terms rather than
 * leaving them to press the button and read a Stripe error.
 */
function retryability(row: AdminRefundFailureRow): {
  canRetry: boolean;
  tone: BadgeTone;
  label: string;
  detail: string | null;
} {
  if (!row.paymentTransactionId) {
    return {
      canRetry: false,
      tone: "neutral",
      label: "No charge attached",
      detail: "The payment row is gone, so there is nothing to retry against. Clear it with a note.",
    };
  }
  if (row.refundableAmountCents == null || row.refundableAmountCents <= 0) {
    return {
      canRetry: false,
      tone: "sage",
      label: "Already refunded",
      detail:
        "Stripe has nothing left to send back on this charge - the money moved by another route. Clear it with a note.",
    };
  }
  if (row.refundableAmountCents < row.amountCents) {
    return {
      canRetry: true,
      tone: "amber",
      label: "Partly refunded",
      detail: `Only ${formatMoney(row.refundableAmountCents, row.currency)} of the ${formatMoney(
        row.amountCents,
        row.currency,
      )} owed is still refundable. A retry sends the smaller amount.`,
    };
  }
  return { canRetry: true, tone: "coral", label: "Owed", detail: null };
}

/** Deadline pressure, from a server-computed clock - never the browser's. */
function deadline(secondsUntilDue: number | null): { tone: BadgeTone; label: string } | null {
  if (secondsUntilDue == null) return null;
  const hours = secondsUntilDue / 3600;
  if (hours < 0) return { tone: "coral", label: "Deadline passed" };
  if (hours < 48) {
    const rounded = Math.max(1, Math.round(hours));
    return { tone: "coral", label: `${rounded} ${rounded === 1 ? "hour" : "hours"} left` };
  }
  const days = Math.floor(hours / 24);
  return { tone: days <= 5 ? "amber" : "lavender", label: `${days} days left` };
}

/**
 * The server refuses a clear whose note is shorter than this
 * (`dismissRefundFailureAsAdmin` in src/lib/event-repository.ts). Mirrored here
 * so the operator finds out while the field is still in front of them, instead
 * of typing an explanation, confirming, and watching the dialog close on a 400
 * with their words gone.
 */
const MIN_CLEAR_NOTE = 10;

function disputeStatusTone(status: string): BadgeTone {
  switch (status) {
    case "won":
      return "sage";
    case "lost":
      return "coral";
    case "warning_closed":
      return "neutral";
    case "under_review":
    case "warning_under_review":
      return "lavender";
    default:
      return "amber"; // needs_response, warning_needs_response
  }
}

export function AdminMoneyAttention({
  refundFailures,
  disputes,
}: {
  refundFailures: AdminRefundFailureRow[];
  disputes: AdminDisputeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retrying, setRetrying] = useState<AdminRefundFailureRow | null>(null);
  const [clearing, setClearing] = useState<AdminRefundFailureRow | null>(null);
  // Which row is mid-request, so only its buttons go quiet.
  const [busyId, setBusyId] = useState<string | null>(null);

  // Resolves true only when the queue actually moved. The clear dialog waits on
  // that answer before it closes, so a refusal leaves the operator's note where
  // they typed it.
  async function act(
    row: AdminRefundFailureRow,
    action: "retry" | "dismiss",
    note?: string,
  ): Promise<boolean> {
    setBusyId(row.id);
    try {
      const response = await fetch(`/api/admin/refund-failures/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "That did not go through - nothing was changed.");
        return false;
      }
      toast.success(
        action === "retry"
          ? `Refund sent to ${row.attendeeName ?? "the attendee"}.`
          : "Cleared from the queue.",
      );
      startTransition(() => router.refresh());
      return true;
    } catch {
      toast.error("Could not reach the server - nothing was changed.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <header>
          <p className="eyebrow">Refunds that never left</p>
          <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
            {refundFailures.length === 0
              ? "Nobody is waiting on money."
              : `${refundFailures.length} ${refundFailures.length === 1 ? "person is" : "people are"} owed a refund.`}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--slate)]">
            The booking was cancelled and the attendee was told a refund was coming, but the
            Stripe call failed. Their seat is already gone, so a retry only moves the money -
            it does not touch the booking or send a second cancellation.
          </p>
        </header>

        {refundFailures.length === 0 ? (
          <EmptyState
            eyebrow="All clear"
            title="No failed refunds"
            body="Every refund Click has attempted reached Stripe. Failures land here automatically."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
            {refundFailures.map((row) => {
              const state = retryability(row);
              const busy = busyId === row.id || pending;
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 border-b border-[color:var(--line)] px-5 py-4 last:border-0 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-semibold tabular-nums text-[color:var(--ink)]">
                        {formatMoney(row.amountCents, row.currency)}
                      </p>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </div>
                    <p className="text-sm text-[color:var(--ink)]">
                      {row.attendeeName ?? "Unknown member"}
                      {row.attendeeEmail ? (
                        <span className="text-[color:var(--slate)]"> · {row.attendeeEmail}</span>
                      ) : null}
                    </p>
                    <p className="text-[13px] text-[color:var(--slate)]">
                      {row.eventTitle ?? "Event removed"} · failed{" "}
                      {dateTimeFormatter.format(new Date(row.createdAt))}
                    </p>
                    {row.errorMessage ? (
                      <p className="max-w-2xl break-words font-mono text-[11.5px] leading-5 text-[color:var(--slate)]">
                        {row.errorMessage}
                      </p>
                    ) : null}
                    {state.detail ? (
                      <p className="max-w-2xl text-[13px] leading-5 text-[color:var(--slate)]">
                        {state.detail}
                      </p>
                    ) : null}
                  </div>

                  {/* A real `disabled`, not aria-disabled: these opened a
                      ConfirmDialog that turns off Escape, the scrim tap and
                      Cancel while a request is in flight, so a button that only
                      *looked* off could still be tapped mid-retry and drop the
                      operator into a modal with no way out. The opener is
                      guarded too, so a stale pointer/keyboard event that lands
                      after the request starts is a no-op rather than a second
                      dialog over a live refund. */}
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {state.canRetry ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!busy) setRetrying(row);
                        }}
                        disabled={busy}
                        className="ck-btn ck-btn--primary ck-btn--sm"
                      >
                        {busyId === row.id ? "Working…" : "Retry refund"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (!busy) setClearing(row);
                      }}
                      disabled={busy}
                      className="ck-btn ck-btn--secondary ck-btn--sm"
                    >
                      {busyId === row.id ? "Working…" : "Clear with a note"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <header>
          <p className="eyebrow">Disputes</p>
          <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
            {disputes.length === 0
              ? "No open disputes."
              : `${disputes.length} open ${disputes.length === 1 ? "dispute" : "disputes"}.`}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--slate)]">
            Evidence is submitted in the Stripe Dashboard, not here. Miss the deadline and
            Stripe decides for the cardholder, so treat the clock as the whole job.
          </p>
        </header>

        {disputes.length === 0 ? (
          <EmptyState
            eyebrow="All clear"
            title="Nothing disputed"
            body="Disputes appear here the moment Stripe raises one, with their evidence deadline."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
            {disputes.map((row) => {
              const due = deadline(row.secondsUntilDue);
              return (
                <div
                  key={row.stripeDisputeId}
                  className="flex flex-col gap-3 border-b border-[color:var(--line)] px-5 py-4 last:border-0 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-semibold tabular-nums text-[color:var(--ink)]">
                        {formatMoney(row.amountCents, row.currency)}
                      </p>
                      <Badge tone={disputeStatusTone(row.status)}>
                        {row.status.replace(/_/g, " ")}
                      </Badge>
                      {due ? <Badge tone={due.tone}>{due.label}</Badge> : null}
                    </div>
                    <p className="text-sm text-[color:var(--ink)]">
                      {row.attendeeName ?? "Unknown member"}
                      {row.attendeeEmail ? (
                        <span className="text-[color:var(--slate)]"> · {row.attendeeEmail}</span>
                      ) : null}
                    </p>
                    <p className="text-[13px] text-[color:var(--slate)]">
                      {row.eventTitle ?? "Event removed"}
                      {row.merchantName ? ` · ${row.merchantName}` : ""}
                      {row.reason ? ` · reason: ${row.reason.replace(/_/g, " ")}` : ""}
                    </p>
                    <p className="text-[13px] text-[color:var(--slate)]">
                      {row.evidenceDueBy
                        ? `Respond by ${dateTimeFormatter.format(new Date(row.evidenceDueBy))}`
                        : "Stripe gave no evidence deadline for this one."}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <a
                      href={`https://dashboard.stripe.com/disputes/${row.stripeDisputeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ck-btn ck-btn--primary ck-btn--sm"
                    >
                      Respond in Stripe
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={retrying !== null}
        title="Send this refund again?"
        description={
          retrying
            ? `${formatMoney(
                Math.min(retrying.amountCents, retrying.refundableAmountCents ?? retrying.amountCents),
                retrying.currency,
              )} goes back to ${retrying.attendeeName ?? "the attendee"} for ${
                retrying.eventTitle ?? "their booking"
              }. This moves real money on the live Stripe account and cannot be undone. Their seat was already cancelled, so nothing else changes and they get a refund receipt, not a second cancellation.`
            : ""
        }
        confirmLabel="Send the refund"
        tone="rose"
        /* Scoped to this row, not "any row is busy". busyId is per row, so a
           second row's buttons stay live while the first is in flight - and a
           dialog opened for that second row must not inherit the first one's
           busy state, which would lock Escape, the scrim and Cancel over an
           action that has not even started. */
        busy={retrying !== null && busyId === retrying.id}
        onConfirm={() => {
          const row = retrying;
          setRetrying(null);
          if (row) void act(row, "retry");
        }}
        onCancel={() => setRetrying(null)}
      />

      <ConfirmDialog
        open={clearing !== null}
        title="Clear this without refunding?"
        description={
          clearing
            ? `${formatMoney(clearing.amountCents, clearing.currency)} owed to ${
                clearing.attendeeName ?? "the attendee"
              } leaves the queue and no money moves. Only do this when it has been settled another way.`
            : ""
        }
        promptLabel={`What happened to the money? At least ${MIN_CLEAR_NOTE} characters, saved to the audit log.`}
        promptPlaceholder="e.g. refunded manually in Stripe on 24 Aug, ref pi_3Q..."
        promptRequired
        confirmLabel="Clear from the queue"
        tone="rose"
        busy={clearing !== null && busyId === clearing.id}
        onConfirm={(note) => {
          const row = clearing;
          if (!row) return;
          // Same rule the route enforces, checked before the POST so a note
          // that is too short costs a toast rather than a round trip.
          if (note.trim().length < MIN_CLEAR_NOTE) {
            toast.error(
              `Say what happened to the money - at least ${MIN_CLEAR_NOTE} characters.`,
            );
            return;
          }
          // Hold the dialog open until the server answers. It used to close
          // first, so a rejected clear (note too short, entry already resolved,
          // connection dropped) took the operator's typed explanation with it
          // and left only a toast. Closing on success alone means a refusal is
          // something they can fix in place.
          void act(row, "dismiss", note).then((ok) => {
            if (ok) setClearing(null);
          });
        }}
        onCancel={() => setClearing(null)}
      />
    </div>
  );
}
