/**
 * A host refunds one booking on their own event (fix 31).
 *
 * POST /api/merchant/transactions/[id]/refund
 *   { mode: "cancel" }                     - cancel the booking, refund in full:
 *                                            the seat, its +1s and the waitlist
 *                                            are settled exactly as an admin
 *                                            refund settles them
 *   { mode: "partial", amountCents: 500 }  - a goodwill refund: the money goes
 *                                            back, the guest keeps coming
 *
 * getRefundableBookingForMerchant is the gate: the host's own event, not
 * suspended, and the money still held in their Stripe balance. issueRefund
 * does the rest, the same call the admin console makes.
 *
 * All of it runs under withPayoutRunShield (Codex review): the payout run
 * can't start while a refund is between "the money is still held" and the
 * reversal, so the check can't go stale under it - and a refund asked for
 * while a run is going is refused, to try again in a few minutes.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getRefundableBookingForMerchant,
  settleRefundedBooking,
} from "@/lib/event-repository";
import { issueRefund, withPayoutRunShield } from "@/lib/stripe-sync";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Refund failed." }, { status: 500 });
  }
  const status =
    error.name === "AuthRequiredError"
      ? 401
      : error.name === "ForbiddenError"
        ? 403
        : error.name === "NotFoundError"
          ? 404
          : error.name === "ValidationError"
            ? 400
            : error.name === "DatabaseUnavailableError"
              ? 503
              : String((error as unknown as { type?: unknown }).type ?? "").startsWith("Stripe")
                ? 400
                : 500;
  return NextResponse.json({ error: error.message || "Refund failed." }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    mode?: unknown;
    amountCents?: unknown;
  } | null;

  const mode = body?.mode === "cancel" || body?.mode === "partial" ? body.mode : null;
  if (!mode) {
    return NextResponse.json({ error: "Choose a full or a part refund." }, { status: 400 });
  }

  try {
    const outcome = await withPayoutRunShield(async () => {
      const { hostProfileId, remainingCents } = await getRefundableBookingForMerchant(session, id);

      let amountCents: number | undefined;
      if (mode === "partial") {
        const raw = Number(body?.amountCents);
        if (!Number.isInteger(raw) || raw <= 0) {
          return { status: 400, error: "Enter an amount to refund." } as const;
        }
        // Strictly less than what is left. A refund that empties the charge
        // makes it "refunded", and the charge.refunded webhook then releases
        // the seat like any full refund - so "keep their seat" could not hold.
        // Refunding all of it is Cancel + refund.
        if (raw >= remainingCents) {
          return {
            status: 400,
            error: `A part refund has to be less than the $${(remainingCents / 100).toFixed(2)} left. To refund all of it, use Cancel + refund.`,
          } as const;
        }
        amountCents = raw;
      }

      const result = await issueRefund({
        paymentTransactionId: id,
        amountCents,
        reason: "requested_by_customer",
        adminProfileId: hostProfileId,
        initiatedBy: "host",
        // A cancellation settles the seat, the +1s and the waitlist, and emails
        // the guest - the admin console's path. A part refund leaves them going.
        settleBooking: mode === "cancel",
      });

      // A goodwill refund still tells the guest their money is on its way, with
      // the seat left alone - the same call retryRefundFailureAsAdmin makes.
      if (mode === "partial") {
        await settleRefundedBooking({
          paymentTransactionId: id,
          refundedAmountCents: result.refundedAmountCents,
          releaseSeat: false,
          notify: true,
        });
      }
      return { status: 200, refund: result } as const;
    });

    if (outcome.status !== 200) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }
    return NextResponse.json({ ok: true, refund: outcome.refund });
  } catch (error) {
    return errorResponse(error);
  }
}
