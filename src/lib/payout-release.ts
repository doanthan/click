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

/**
 * Where one event's money is on the host's timeline (fix 25), by the same rule
 * releaseHeldPayouts pays out by. A booking is held until its event has been
 * over PAYOUT_RELEASE_DELAY_HOURS - or, for a cancelled event, kept for its
 * refunds - but never past PAYOUT_MAX_HOLD_DAYS after it was made. So the
 * event's money is all out once its NEWEST booking is (Codex review: the
 * status used to ignore the 80-day cap and showed cancelled events held for
 * ever).
 *
 * Per EVENT, not per bank payout: a payout is drawn from the whole balance and
 * can cover several events or part of one, so "paid to your bank" is shown per
 * payout instead.
 *
 *   held             - not over (plus the delay) yet
 *   held_for_refunds - cancelled, so kept for its refunds
 *   released         - the next payout run sends it
 */
export function eventMoneyState(input: {
  endsAt: Date;
  cancelled: boolean;
  newestBookingAt: Date;
  now?: Date;
}): { state: "held" | "released" | "held_for_refunds"; releaseAt: Date } {
  const capAt = new Date(input.newestBookingAt.getTime() + PAYOUT_MAX_HOLD_DAYS * 86_400_000);
  const afterEvent = new Date(input.endsAt.getTime() + PAYOUT_RELEASE_DELAY_HOURS * 3_600_000);
  const releaseAt = input.cancelled || capAt < afterEvent ? capAt : afterEvent;
  const now = input.now ?? new Date();
  if (now >= releaseAt) return { state: "released", releaseAt };
  return { state: input.cancelled ? "held_for_refunds" : "held", releaseAt };
}
