import { createHash } from "crypto";
import type { Pool, PoolClient } from "pg";

// Guest Spots (spec 19). A guest is an anonymous +1 with a name attached — no
// account exists until the friend claims. See database/046_guest_spots.sql for
// the data model and the adaptation notes.

export const GUEST_MAX = 3; // purchaser + 3 = the 4-seat-per-event ceiling

export type GuestDetailInput = {
  firstName: string;
  email: string;
  dob: string; // ISO date (YYYY-MM-DD)
};

export type NormalizedGuest = {
  firstName: string;
  email: string; // lower-cased, trimmed
  dob: string; // YYYY-MM-DD
};

type Queryable = Pick<Pool | PoolClient, "query">;

function validationError(message: string): never {
  const error = new Error(message);
  error.name = "ValidationError";
  throw error;
}

// sha256(lower(trim(email))) — the only form of a removed guest's email we keep.
export function hashGuestEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Whole-years between dob and a reference date (the event date). Floors on the
// birthday boundary so "turns 18 the day after the event" is correctly under-18.
function ageAt(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

// Pure validation: shape, dedupe-in-array, not-the-purchaser, and 18+ at the
// event date. Suppression and "already has a live spot" are DB checks done by
// the caller under the capacity lock. Throws ValidationError on the first
// problem, naming the offending guest by index (spec §13).
export function validateGuestDetails(
  guests: GuestDetailInput[],
  opts: { purchaserEmail: string; eventDate: Date },
): NormalizedGuest[] {
  if (guests.length > GUEST_MAX) {
    validationError(`You can name up to ${GUEST_MAX} friends.`);
  }
  const seen = new Set<string>();
  const purchaser = opts.purchaserEmail.trim().toLowerCase();
  return guests.map((g, i) => {
    const label = `Guest ${i + 1}`;
    const firstName = (g.firstName ?? "").trim();
    if (firstName.length < 2 || firstName.length > 50) {
      validationError(`${label}: first name must be 2–50 characters.`);
    }
    const email = (g.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) validationError(`${label}: enter a valid email address.`);
    if (email === purchaser) validationError(`${label}: you can't name your own email as a guest.`);
    if (seen.has(email)) validationError(`${label}: this email is named more than once.`);
    seen.add(email);

    if (!g.dob) validationError(`${label}: date of birth is required.`);
    const dob = new Date(`${g.dob}T00:00:00Z`);
    if (Number.isNaN(dob.getTime())) validationError(`${label}: date of birth is invalid.`);
    if (ageAt(dob, opts.eventDate) < 18) {
      validationError(`${label}: guests must be 18 or older at the event date.`);
    }
    return { firstName, email, dob: g.dob };
  });
}

// Returns the lower-cased emails (of the given set) that are suppressed — a
// person who said "remove my details" (or bounced/complained) is never re-invited.
export async function filterSuppressedEmails(
  db: Queryable,
  emails: string[],
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const hashes = emails.map((e) => hashGuestEmail(e));
  const res = await db.query<{ email_hash: string }>(
    `select email_hash from guest_email_suppression where email_hash = any($1::text[])`,
    [hashes],
  );
  const suppressedHashes = new Set(res.rows.map((r) => r.email_hash));
  return new Set(emails.filter((e) => suppressedHashes.has(hashGuestEmail(e))));
}

// Emails (of the given set) that already hold a live (invited/claimed) spot at
// this event — the uq_guest_email_per_event invariant, surfaced at checkout so
// we can reject before charging rather than silently dropping the seat.
export async function liveGuestEmailsForEvent(
  db: Queryable,
  eventId: string,
  emails: string[],
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const res = await db.query<{ email: string }>(
    `
      select lower(guest_email) as email
      from guest_spots
      where event_id = $1::uuid
        and status in ('invited', 'claimed')
        and lower(guest_email) = any($2::text[])
    `,
    [eventId, emails.map((e) => e.toLowerCase())],
  );
  return new Set(res.rows.map((r) => r.email));
}

// Reserve `count` extra seats at hold time as unnamed placeholders — zero PII,
// but they consume capacity immediately so a concurrent buyer can't take the
// friends' seats while the purchaser is in Stripe Checkout. Named at webhook
// time. Must run inside the same txn/lock as the capacity check.
export async function reserveUnnamedGuestSeats(
  client: PoolClient,
  args: {
    paymentTransactionId: string;
    eventId: string;
    purchaserProfileId: string;
    count: number;
  },
): Promise<void> {
  if (args.count <= 0) return;
  await client.query(
    `
      insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status)
      select $1::uuid, $2::uuid, $3::uuid, 'unnamed'
      from generate_series(1, $4::int)
    `,
    [args.paymentTransactionId, args.eventId, args.purchaserProfileId, args.count],
  );
}

// Cancel every still-held guest seat on a booking (whole-booking cancel / hold
// expiry / event cancel). Frees capacity. Idempotent.
export async function cancelGuestSeatsForTransaction(
  db: Queryable,
  paymentTransactionId: string,
): Promise<void> {
  await db.query(
    `
      update guest_spots
      set status = 'cancelled', updated_at = now()
      where payment_transaction_id = $1::uuid and status <> 'cancelled'
    `,
    [paymentTransactionId],
  );
}

export type NamedGuestOutcome =
  | { kind: "invited"; guestSpotId: string; firstName: string; email: string; claimToken: string }
  | { kind: "claimed"; guestSpotId: string; firstName: string; email: string; claimedProfileId: string }
  | { kind: "skipped_suppressed"; firstName: string; email: string }
  | { kind: "skipped_conflict"; firstName: string; email: string }
  | { kind: "skipped_no_seat"; firstName: string; email: string };

// Webhook-time: attach the named guests (from Stripe session metadata) onto the
// unnamed placeholder seats reserved at hold time. Per spec §5:
//   1. suppressed email  -> skip (seat stays an unnamed +1)
//   2. existing Click user -> link instantly as 'claimed' (no token/invite)
//   3. otherwise          -> 'invited' (+ caller queues the invite email)
//   conflict on the per-event email uniqueness -> skip (seat stays unnamed)
// Idempotent-friendly: re-running won't double-name (already-named rows of this
// txn are left alone; only 'unnamed' rows are consumed).
export async function nameReservedGuestSeats(
  client: PoolClient,
  args: { paymentTransactionId: string; eventId: string; guests: NormalizedGuest[] },
): Promise<NamedGuestOutcome[]> {
  const outcomes: NamedGuestOutcome[] = [];
  for (const guest of args.guests) {
    // Already named on this booking (replay) — nothing to do.
    const already = await client.query<{ id: string }>(
      `select id::text from guest_spots
        where payment_transaction_id = $1::uuid and lower(guest_email) = $2 and status in ('invited','claimed')
        limit 1`,
      [args.paymentTransactionId, guest.email],
    );
    if (already.rows[0]) continue;

    const suppressed = await filterSuppressedEmails(client, [guest.email]);
    if (suppressed.has(guest.email)) {
      outcomes.push({ kind: "skipped_suppressed", firstName: guest.firstName, email: guest.email });
      continue;
    }

    // Per-event uniqueness: someone else already holds this email's live spot.
    const live = await liveGuestEmailsForEvent(client, args.eventId, [guest.email]);
    if (live.has(guest.email)) {
      outcomes.push({ kind: "skipped_conflict", firstName: guest.firstName, email: guest.email });
      continue;
    }

    const existingUser = await client.query<{ id: string }>(
      `select id::text from profiles where lower(email) = $1 limit 1`,
      [guest.email],
    );

    // Consume one unnamed placeholder seat on this booking.
    const claimedProfileId = existingUser.rows[0]?.id ?? null;
    const named = await client.query<{ id: string; claim_token: string }>(
      `
        update guest_spots
        set guest_first_name = $2,
            guest_email = $3,
            guest_dob = $4::date,
            status = $5,
            claimed_profile_id = $6,
            claimed_at = case when $6 is not null then now() else null end,
            invite_sent_at = case when $6 is null then now() else null end,
            updated_at = now()
        where id = (
          select id from guest_spots
          where payment_transaction_id = $1::uuid and status = 'unnamed'
          order by created_at
          limit 1
          for update skip locked
        )
        returning id::text, claim_token::text
      `,
      [
        args.paymentTransactionId,
        guest.firstName,
        guest.email,
        guest.dob,
        claimedProfileId ? "claimed" : "invited",
        claimedProfileId,
      ],
    );
    const row = named.rows[0];
    if (!row) {
      // No unnamed seat left to name (shouldn't happen — we reserved one per
      // guest at hold time — but never overrun the booking's seats).
      outcomes.push({ kind: "skipped_no_seat", firstName: guest.firstName, email: guest.email });
      continue;
    }
    if (claimedProfileId) {
      outcomes.push({
        kind: "claimed",
        guestSpotId: row.id,
        firstName: guest.firstName,
        email: guest.email,
        claimedProfileId,
      });
    } else {
      outcomes.push({
        kind: "invited",
        guestSpotId: row.id,
        firstName: guest.firstName,
        email: guest.email,
        claimToken: row.claim_token,
      });
    }
  }
  return outcomes;
}
