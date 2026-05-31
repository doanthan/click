/**
 * Cancellation refund policy — single source of truth for the tiered refund a
 * user receives when THEY cancel a paid booking. Imported by both the server
 * (to initiate the actual Stripe refund) and the client (to show the exact
 * dollar amount in the cancel dialog), so the number the user sees always
 * equals the number we refund.
 *
 * Tiers (hours before the event starts):
 *   ≥ 48h  → 100% refund
 *   24–48h → 50% refund
 *   < 24h  → no refund
 *
 * A MERCHANT cancelling the whole event is always a 100% refund and does NOT
 * go through this function — see `cancelMerchantEvent`.
 *
 * Note: the refund is computed on the full amount the buyer paid
 * (`amount_cents` = ticket + booking fee). We refund the booking fee too on
 * partial/full refunds — simpler and more generous than splitting it out, and
 * we don't persist the fee/ticket split on the transaction anyway.
 */

export type RefundTier = "full" | "half" | "none";

export type RefundQuote = {
  /** Amount to refund, in cents (already rounded). */
  refundCents: number;
  tier: RefundTier;
  /** 100 | 50 | 0 — for copy like "50% refund". */
  percent: 0 | 50 | 100;
  /** Whole hours until the event starts (negative if already started). */
  hoursUntilStart: number;
};

const HOUR_MS = 60 * 60 * 1000;

export function quoteCancellationRefund(
  amountPaidCents: number,
  startsAt: Date | string,
  now: Date = new Date(),
): RefundQuote {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const hoursUntilStart = (start.getTime() - now.getTime()) / HOUR_MS;

  let percent: 0 | 50 | 100;
  let tier: RefundTier;
  if (hoursUntilStart >= 48) {
    percent = 100;
    tier = "full";
  } else if (hoursUntilStart >= 24) {
    percent = 50;
    tier = "half";
  } else {
    percent = 0;
    tier = "none";
  }

  const refundCents =
    percent === 100
      ? amountPaidCents
      : percent === 50
        ? Math.round(amountPaidCents / 2)
        : 0;

  return {
    refundCents,
    tier,
    percent,
    hoursUntilStart: Math.floor(hoursUntilStart),
  };
}

/** Human label for the cancel dialog, e.g. "Full refund — $35.00". */
export function refundQuoteLabel(quote: RefundQuote, currency = "AUD"): string {
  const dollars = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(quote.refundCents / 100);

  if (quote.tier === "full") return `Full refund — ${dollars}`;
  if (quote.tier === "half") return `Partial refund (50%) — ${dollars}`;
  return "No refund — cancelling within 24 hours of the event";
}
