// The lowest price a paid ticket can have (decision D3, 2026-11-05). Click's
// fee is the host's 2.9% and Click pays Stripe's processing out of it, so a
// cheap ticket costs Click more than it earns. Free events are unaffected, and
// events already listed keep their price. One value for the wizard and the
// server. Kept import-free so node --test can load it directly.
export const MIN_PAID_TICKET_CENTS = 1000;

/** The message for a paid price under the minimum, or null when it's fine. */
export function ticketPriceError(priceCents: number): string | null {
  if (priceCents > 0 && priceCents < MIN_PAID_TICKET_CENTS) {
    return `Paid tickets start at $${MIN_PAID_TICKET_CENTS / 100}. Make it free, or $${MIN_PAID_TICKET_CENTS / 100} or more.`;
  }
  return null;
}

/**
 * Where one ticket's money goes (fix 13), with the same arithmetic checkout
 * uses: Click's commission comes off the host's price, rounded down
 * (calculateApplicationFee), and any booking fee is added on top for the guest,
 * rounded to the nearest cent (createPaymentHold). The wizard shows this as the
 * price is typed, so "Guests pay" is what Stripe will actually charge.
 */
export function ticketSplit(
  priceCents: number,
  commissionBps: number,
  bookingFeeBps: number,
): { guestPaysCents: number; hostKeepsCents: number; clickKeepsCents: number } {
  if (priceCents <= 0) return { guestPaysCents: 0, hostKeepsCents: 0, clickKeepsCents: 0 };
  const commissionCents = Math.floor((priceCents * Math.max(0, commissionBps)) / 10_000);
  const bookingFeeCents = Math.round((priceCents * Math.max(0, bookingFeeBps)) / 10_000);
  return {
    guestPaysCents: priceCents + bookingFeeCents,
    hostKeepsCents: priceCents - commissionCents,
    clickKeepsCents: commissionCents + bookingFeeCents,
  };
}

/**
 * One charge's split AFTER refunds (fix 24, Codex review): what the host and
 * Click each kept. A refund reverses the host's transfer and Click's fee in
 * proportion (issueRefund), and the charge-time columns are never rewritten,
 * so every part is scaled by the share of the charge that survived - the same
 * treatment the Finances tiles give their totals. A fully refunded charge
 * keeps nothing. `net` is ticket less commission, so a row reconciles.
 */
export function chargeSplitAfterRefunds(charge: {
  amountCents: number;
  applicationFeeCents: number | null;
  bookingFeeCents: number | null;
  refundedCents: number;
}): { ticketCents: number; bookingFeeCents: number; commissionCents: number; netCents: number } {
  const bookingFee = charge.bookingFeeCents ?? 0;
  const ticket = charge.amountCents - bookingFee;
  const commission = Math.max(0, (charge.applicationFeeCents ?? 0) - bookingFee);
  const kept =
    charge.amountCents > 0
      ? Math.max(0, charge.amountCents - charge.refundedCents) / charge.amountCents
      : 0;
  const ticketCents = Math.round(ticket * kept);
  const commissionCents = Math.round(commission * kept);
  return {
    ticketCents,
    bookingFeeCents: Math.round(bookingFee * kept),
    commissionCents,
    netCents: ticketCents - commissionCents,
  };
}
