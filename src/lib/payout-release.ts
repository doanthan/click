// Hosts are paid after their event, not when a ticket sells. Every host's
// Stripe payouts are manual (holdPayouts in stripe-connect.ts), and the daily
// api/cron/release-payouts job pays out whatever no longer needs holding
// (releaseHeldPayouts in stripe-sync.ts). Kept import-free so node --test can
// load it directly.

// How long after an event ends its money stays held. A refund for an event that
// didn't happen then comes out of money still in the host's Stripe balance,
// instead of being clawed back after it has gone to their bank.
export const PAYOUT_RELEASE_DELAY_HOURS = 48;

// Stripe makes a manual-payout account pay its funds out within 90 days in
// Australia (docs.stripe.com/connect/manual-payouts). A booking older than this
// is released even if its event is still ahead, with margin to spare.
export const PAYOUT_MAX_HOLD_DAYS = 80;

/**
 * Cents to pay out of one host's Stripe balance right now.
 *
 * `heldCents` is the host's share of bookings for events that haven't finished
 * (plus the delay above) or were cancelled. The rest of the balance is theirs
 * now. Held money can be sitting in `available` or still in `pending`, so this
 * releases the whole balance minus what's held, capped at what Stripe will let
 * us pay out today. Money from an event that ended before its payment cleared
 * goes out on a later run.
 */
export function releasableCents(balance: {
  availableCents: number;
  pendingCents: number;
  heldCents: number;
}): number {
  const owed = balance.availableCents + balance.pendingCents - balance.heldCents;
  return Math.max(0, Math.min(balance.availableCents, owed));
}
