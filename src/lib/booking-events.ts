import type { Pool, PoolClient } from "pg";
import type { RefundTier } from "./refund-policy";

// Append-only booking-lifecycle log. See database/045_booking_events.sql and
// TECH/22_ANALYTICS.md §2. Every code path that mutates booking state must also
// record the transition here — inside the same transaction as the local state
// change, or in the webhook handler for Stripe-driven events.

export type BookingEventType =
  | "reserved"
  | "reservation_expired"
  | "confirmed"
  | "cancelled_by_attendee"
  | "cancelled_by_merchant"
  | "refunded_full"
  | "refunded_partial"
  | "refund_denied"
  | "attended"
  | "no_show"
  | "payout_included";

export type BookingEventActor =
  | "attendee"
  | "guest"
  | "merchant"
  | "admin"
  | "system"
  | "stripe_webhook";

// Spec time-band values. The app's RefundTier is an outcome axis
// (full/half/none); it maps 1:1 onto the policy's time bands.
export type RefundBand = "gt_48h" | "within_48h" | "within_24h";

export function refundBandFromTier(tier: RefundTier): RefundBand {
  switch (tier) {
    case "full":
      return "gt_48h";
    case "half":
      return "within_48h";
    case "none":
      return "within_24h";
  }
}

export type BookingEventInput = {
  bookingId: string;
  eventId: string;
  merchantId?: string | null;
  userId?: string | null;
  guestRsvpId?: string | null;
  eventType: BookingEventType;
  amountCents?: number | null;
  currency?: string | null;
  refundTier?: RefundBand | null;
  stripeObjectId?: string | null;
  // Stripe-driven events should pass Stripe's `created` time, not arrival time,
  // so analytics ordering survives out-of-order webhook delivery. Defaults now().
  occurredAt?: Date | string | null;
  actor: BookingEventActor;
  metadata?: Record<string, unknown>;
};

type Queryable = Pick<Pool | PoolClient, "query">;

// Inserts one append-only row. `on conflict do nothing` makes Stripe webhook
// replays (same stripe_object_id + event_type) a no-op rather than a duplicate.
//
// IMPORTANT: when called with an open-transaction client, this MUST be allowed
// to throw — a failed insert aborts the surrounding Postgres transaction, and
// the caller's rollback is what keeps the state change and its log atomic.
// Callers logging AFTER commit (with the pool) should wrap this in a .catch().
export async function logBookingEvent(
  db: Queryable,
  input: BookingEventInput,
): Promise<void> {
  await db.query(
    `
      insert into booking_events (
        booking_id, event_id, merchant_id, user_id, guest_rsvp_id,
        event_type, amount_cents, currency, refund_tier, stripe_object_id,
        occurred_at, actor, metadata
      ) values (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
        $6, $7, coalesce($8, 'AUD'), $9, $10,
        coalesce($11::timestamptz, now()), $12, coalesce($13::jsonb, '{}'::jsonb)
      )
      on conflict do nothing
    `,
    [
      input.bookingId,
      input.eventId,
      input.merchantId ?? null,
      input.userId ?? null,
      input.guestRsvpId ?? null,
      input.eventType,
      input.amountCents ?? null,
      input.currency ?? null,
      input.refundTier ?? null,
      input.stripeObjectId ?? null,
      input.occurredAt instanceof Date
        ? input.occurredAt.toISOString()
        : (input.occurredAt ?? null),
      input.actor,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
}
