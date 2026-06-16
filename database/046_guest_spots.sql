-- 046_guest_spots.sql
-- Spec: TECH/19_GUEST_RSVP.md (v2.0). "A guest spot is an anonymous +1 with a
-- name attached." No profile / auth row exists for a guest until they claim.
--
-- ADAPTATION (recorded as spec/code divergence to reconcile in spec 19 + 05):
-- The spec models seats as a single `bookings` row with `ticket_count` 1–4 and
-- hangs guest_spots off it. This codebase has no `bookings`/`ticket_count` — it's
-- one `event_attendees` row per (event, profile). So here EACH extra seat the
-- purchaser buys IS a `guest_spots` row:
--   * The purchaser's own seat stays their normal `event_attendees` row.
--   * Each additional seat (named friend OR anonymous +1) is one guest_spots row
--     tied to the purchaser's `payment_transactions` row (our booking-money record).
--   * Capacity = confirmed event_attendees + non-cancelled guest_spots (hold-aware).
--   * 'cancelled' status is the per-seat teardown that frees capacity (the spec
--     decrements ticket_count; we flip status).
--   * No RLS policies: this app reaches Postgres via the service-role pooler and
--     enforces access in query code (like every other app table), not auth.uid().

create table if not exists guest_spots (
  id                      uuid primary key default gen_random_uuid(),
  -- Our "booking": the purchaser's payment record holding all seats + funds.
  payment_transaction_id  uuid not null references payment_transactions(id) on delete cascade,
  event_id                uuid not null references events(id) on delete cascade,
  purchaser_profile_id    uuid not null references profiles(id) on delete cascade,
  -- Null while the seat is an anonymous +1 (status 'unnamed') or after the guest
  -- removes their details ('removed'). Set when a seat is named ('invited'/'claimed').
  guest_first_name        text,
  guest_email             text,
  guest_dob               date,            -- >= 18 at event date when named; validated before naming
  status                  text not null default 'unnamed'
    check (status in ('unnamed', 'invited', 'claimed', 'released', 'removed', 'cancelled')),
    -- unnamed   = paid +1 seat, no name attached (the default reserved seat)
    -- invited   = seat named, friend not yet signed up
    -- claimed   = friend signed up via token; claimed_profile_id set
    -- released  = friend handed the seat back; reverts to a held +1 (still paid)
    -- removed   = guest used "remove my details"; PII nulled; seat still held
    -- cancelled = purchaser cancelled this seat (refunded); frees capacity
  claim_token             uuid not null default gen_random_uuid(),
  claim_token_expires_at  timestamptz not null default now() + interval '30 days',
  claimed_at              timestamptz,
  claimed_profile_id      uuid references profiles(id) on delete set null,
  attended                boolean,
  invite_sent_at          timestamptz,
  invite_resend_count     int not null default 0,   -- hard cap 3 resends
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists uq_guest_token on guest_spots(claim_token);

-- One live named spot per email per event, regardless of who purchases it.
create unique index if not exists uq_guest_email_per_event
  on guest_spots(event_id, lower(guest_email))
  where status in ('invited', 'claimed') and guest_email is not null;

create index if not exists ix_guest_spots_txn on guest_spots(payment_transaction_id);
create index if not exists ix_guest_spots_event_live on guest_spots(event_id) where status <> 'cancelled';
create index if not exists ix_guest_spots_claimed_profile on guest_spots(claimed_profile_id)
  where claimed_profile_id is not null;

-- "remove my details" / bounce / complaint suppression. Checked before every
-- invite send and every naming. Raw email is gone; the hash is the minimum
-- needed to honour the request (spec §3.1).
create table if not exists guest_email_suppression (
  email_hash   text primary key,        -- sha256(lower(email))
  reason       text not null check (reason in ('removed_by_guest', 'bounce', 'complaint')),
  created_at   timestamptz not null default now()
);
