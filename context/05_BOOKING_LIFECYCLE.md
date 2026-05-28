# 05 — Booking Lifecycle: RSVP, Payment, Waitlist, Cancellation, Refund

**Audience:** Implementer building the booking path end-to-end
**Stack:** React + TypeScript + Supabase (Postgres + RLS + Edge Functions) + Stripe Connect
**Cross-refs:** `01_USER_WORKFLOW.md` §6 (RSVP states); `02_MERCHANT_WORKFLOW.md` §6 (events table, cancel-event flow); `06_INFRASTRUCTURE_FIXES.md` §1 (this is the canonical implementation of ticket 1)

---

## 0. Why this document exists

The v1 spec treated booking as: user clicks RSVP → Stripe Checkout → webhook flips `bookings.status = 'confirmed'` → done. That's wrong for three reasons:

1. **Race condition on capacity.** Capacity is checked at "create checkout session" time. Stripe Checkout sessions take 30s–10min to complete (or never complete). If 5 seats remain and 10 users click RSVP within a minute, all 10 pass the capacity check, all 10 get a Checkout URL, and the first 5 to complete win — but Stripe doesn't tell you about completions in order, and the others get a 200 OK from the webhook handler that then has to either overbook or silently fail. There is no clean retry path from there.
2. **No reservation primitive.** A user who closes the Stripe tab without completing leaves no trace. The seat they were "trying" to claim is invisible to the system, so capacity counts diverge from intent.
3. **Cancellation/refund is treated as one happy path.** Real merchants cancel events. Real users cancel within minutes of event start. Refund failures (expired card, closed account, Stripe dispute already open) happen 1–3% of the time and need an operator queue, not a silent log line.

The fix is a **two-phase booking pattern with a `pending_bookings` reservation table that holds seats for 15 minutes**, plus an explicit cancellation/refund state machine with a failed-refund operator queue.

---

## 1. State machine

```
              ┌────────────┐
              │  (no row)  │   user has not clicked RSVP
              └─────┬──────┘
                    │ POST /create-stripe-checkout
                    │ INSERT pending_bookings row + Stripe session
                    ▼
              ┌────────────┐
              │  pending   │   reservation held for 15 min
              └─────┬──────┘
        ┌───────────┼───────────┐
        │           │           │
   webhook       15 min TTL    user closes
   completed     expires       checkout tab
        │           │           │
        ▼           ▼           ▼ (silent — TTL handles it)
  ┌──────────┐ ┌──────────┐
  │ confirmed│ │ expired  │
  └────┬─────┘ └──────────┘
       │           ▲
       │ user cancels (refund initiated)
       ▼           │
  ┌──────────────────────┐
  │ cancelled_pending_   │   refund request submitted to Stripe
  │ refund               │
  └──────────┬───────────┘
             │
     ┌───────┴────────┐
     │                │
 refund.created   refund.failed
     │                │
     ▼                ▼
┌──────────┐    ┌────────────────┐
│ refunded │    │ refund_failed  │  → goes to admin queue
└──────────┘    └────────────────┘
                  (resolved manually → refunded OR converted_to_credit)
```

Capacity rule: **`pending` and `confirmed` both count against capacity.** `expired`, `cancelled_*`, `refunded`, `refund_failed`, `no_show` do not.

---

## 2. Schema

### 2.1 `pending_bookings` (reservation table)

```sql
create table public.pending_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  ticket_count int not null check (ticket_count between 1 and 4),
  unit_price_cents int not null,        -- locked at reservation time
  total_cents int not null,             -- ticket_count * unit_price_cents
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  client_idempotency_key text not null  -- supplied by client; prevents double-submit
);

create unique index uq_pending_idem
  on public.pending_bookings(user_id, event_id, client_idempotency_key);

create index ix_pending_event_active
  on public.pending_bookings(event_id)
  where expires_at > now();

create index ix_pending_user
  on public.pending_bookings(user_id, created_at desc);
```

Why a separate table and not `bookings.status = 'pending'`:
- The pending row is short-lived (15 min). Keeping it in `bookings` pollutes that table with rows that 80%+ will never become real bookings (industry data on abandoned Stripe Checkout is roughly 20–40%; budget for it).
- The pending row has *different* RLS than a confirmed booking — only the owning user sees it, and only briefly.
- The pending row has a TTL. Mixing TTL'd rows with permanent rows in one table is a maintenance trap (cleanup jobs accidentally hit confirmed rows; soft-delete columns proliferate).
- Foreign keys from `attendance` / `mutual_clicks` / `proposals` etc. should only point at *confirmed* bookings. Splitting tables makes that constraint enforceable structurally.

RLS:

```sql
alter table public.pending_bookings enable row level security;

create policy pending_bookings_select_own
  on public.pending_bookings for select
  using (user_id = auth.uid());

create policy pending_bookings_insert_via_edge_only
  on public.pending_bookings for insert
  with check (false);   -- inserts only via service role in edge function

create policy pending_bookings_no_user_updates
  on public.pending_bookings for update
  using (false);

create policy pending_bookings_no_user_deletes
  on public.pending_bookings for delete
  using (false);
```

### 2.2 `bookings` (confirmed bookings)

```sql
create type booking_status as enum (
  'confirmed',
  'cancelled_pending_refund',
  'refunded',
  'refund_failed',
  'no_show'
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  user_id uuid not null references auth.users(id),
  ticket_count int not null check (ticket_count between 1 and 4),
  unit_price_cents int not null,
  total_cents int not null,
  status booking_status not null default 'confirmed',
  stripe_payment_intent_id text not null,
  stripe_charge_id text,
  stripe_checkout_session_id text not null unique,
  confirmed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancellation_reason text,
  refund_initiated_at timestamptz,
  refunded_at timestamptz,
  refund_amount_cents int,
  stripe_refund_id text,
  refund_failure_reason text,
  attended bool,                    -- set by check-in flow or feedback at 12h
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_bookings_user_event_active
  on public.bookings(user_id, event_id)
  where status in ('confirmed', 'cancelled_pending_refund');
-- prevents the same user from holding two confirmed bookings on the same event
-- (cancelled/refunded rows are allowed to coexist with a new booking)

create index ix_bookings_event_status on public.bookings(event_id, status);
create index ix_bookings_user_confirmed on public.bookings(user_id, confirmed_at desc) where status = 'confirmed';
create index ix_bookings_refund_failed on public.bookings(refund_failure_reason) where status = 'refund_failed';
```

RLS:

```sql
alter table public.bookings enable row level security;

create policy bookings_select_own
  on public.bookings for select
  using (user_id = auth.uid());

create policy bookings_select_merchant
  on public.bookings for select
  using (
    exists (
      select 1 from public.events e
      where e.id = bookings.event_id
        and e.merchant_id in (
          select id from public.merchants where owner_id = auth.uid()
        )
    )
  );

create policy bookings_select_admin
  on public.bookings for select
  using (public.has_role(auth.uid(), 'admin'));

-- All writes go through edge functions running as service role.
create policy bookings_no_user_writes on public.bookings for insert with check (false);
create policy bookings_no_user_updates on public.bookings for update using (false);
create policy bookings_no_user_deletes on public.bookings for delete using (false);
```

### 2.3 `waitlist`

```sql
create type waitlist_status as enum ('waiting', 'offered', 'accepted', 'declined', 'expired');

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null,             -- 1-indexed, set at insert
  status waitlist_status not null default 'waiting',
  joined_at timestamptz not null default now(),
  offered_at timestamptz,            -- when seat became available + user notified
  offer_expires_at timestamptz,      -- offered_at + 30 min
  resolved_at timestamptz,           -- when accepted/declined/expired
  stripe_checkout_session_id text,   -- set when user accepts the offer
  unique (event_id, user_id)
);

create index ix_waitlist_event_active on public.waitlist(event_id, position) where status = 'waiting';
create index ix_waitlist_offered on public.waitlist(event_id, offer_expires_at) where status = 'offered';
```

RLS: `select` own row; admins see all; merchants see waitlist for their events (count only via view, not row-level — see §6.4).

### 2.4 `refund_failures` (operator queue)

```sql
create type refund_failure_resolution as enum (
  'pending',
  'retried_succeeded',
  'manually_marked_refunded',
  'converted_to_credit',
  'written_off'
);

create table public.refund_failures (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  stripe_error_code text,
  stripe_error_message text,
  amount_cents int not null,
  failed_at timestamptz not null default now(),
  resolution refund_failure_resolution not null default 'pending',
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_notes text,
  retry_count int not null default 0,
  last_retry_at timestamptz
);

create index ix_refund_failures_pending on public.refund_failures(failed_at) where resolution = 'pending';
```

RLS: admin-only read/write.

### 2.5 `event_capacity_view`

A view (not a materialised view — we need real-time accuracy here) used by the capacity check:

```sql
create or replace view public.event_capacity_v as
select
  e.id as event_id,
  e.capacity,
  coalesce(b.confirmed_count, 0) as confirmed_count,
  coalesce(p.pending_count, 0) as pending_count,
  e.capacity
    - coalesce(b.confirmed_count, 0)
    - coalesce(p.pending_count, 0) as available
from public.events e
left join lateral (
  select count(*)::int as confirmed_count
  from public.bookings
  where event_id = e.id
    and status in ('confirmed', 'cancelled_pending_refund')
) b on true
left join lateral (
  select coalesce(sum(ticket_count), 0)::int as pending_count
  from public.pending_bookings
  where event_id = e.id
    and expires_at > now()
) p on true;
```

Note `cancelled_pending_refund` still counts against capacity until the refund settles, because if the refund fails the booking may revert. Do **not** free the seat speculatively.

---

## 3. Edge functions

### 3.1 `create-stripe-checkout`

Called when a user clicks "RSVP" on a paid event.

Request:
```ts
{
  event_id: string,
  ticket_count: number,        // 1..4
  client_idempotency_key: string  // uuid generated client-side
}
```

Response:
```ts
{ checkout_url: string, expires_at: string }
// or:
{ error: 'sold_out' | 'already_booked' | 'event_closed' | 'capacity_changed' | 'rate_limited' }
```

Pseudocode:

```ts
export async function handler(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  const { event_id, ticket_count, client_idempotency_key } = await req.json();
  if (!isUuid(event_id) || !isUuid(client_idempotency_key)) {
    return json({ error: 'bad_request' }, 400);
  }
  if (!Number.isInteger(ticket_count) || ticket_count < 1 || ticket_count > 4) {
    return json({ error: 'bad_request' }, 400);
  }

  // Rate limit per user: max 10 checkout attempts / hour
  const recentAttempts = await db.query(`
    select count(*) from pending_bookings
    where user_id = $1 and created_at > now() - interval '1 hour'
  `, [user.id]);
  if (recentAttempts[0].count >= 10) return json({ error: 'rate_limited' }, 429);

  // Idempotency: if the same key was used in the last 15 min, return the existing session
  const existing = await db.query(`
    select stripe_checkout_session_id from pending_bookings
    where user_id = $1 and event_id = $2 and client_idempotency_key = $3
      and expires_at > now()
  `, [user.id, event_id, client_idempotency_key]);
  if (existing.length > 0) {
    const url = await stripe.checkout.sessions.retrieve(existing[0].stripe_checkout_session_id);
    return json({ checkout_url: url.url, expires_at: url.expires_at });
  }

  // The atomic critical section. Wrap in a transaction with serializable isolation
  // OR use an advisory lock. We use advisory lock keyed on event_id because it has
  // lower abort risk than serializable + retry under contention.
  return await db.transaction(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock(hashtext($1))`, [event_id]);

    const event = await tx.query(`
      select id, capacity, price_cents, status, start_time, merchant_id,
             rsvp_closes_at
      from events where id = $1 for update
    `, [event_id]);
    if (event.length === 0) return json({ error: 'not_found' }, 404);
    const e = event[0];
    if (e.status !== 'published') return json({ error: 'event_closed' }, 409);
    if (e.rsvp_closes_at && new Date(e.rsvp_closes_at) < new Date()) {
      return json({ error: 'event_closed' }, 409);
    }
    if (new Date(e.start_time) < new Date()) {
      return json({ error: 'event_closed' }, 409);
    }

    // Already booked?
    const existingBooking = await tx.query(`
      select id from bookings
      where user_id = $1 and event_id = $2
        and status in ('confirmed', 'cancelled_pending_refund')
    `, [user.id, event_id]);
    if (existingBooking.length > 0) return json({ error: 'already_booked' }, 409);

    // Capacity check (counts both pending and confirmed)
    const cap = await tx.query(`select * from event_capacity_v where event_id = $1`, [event_id]);
    if (cap[0].available < ticket_count) {
      return json({ error: 'sold_out' }, 409);
    }

    const total_cents = e.price_cents * ticket_count;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: 'aud',
          product_data: { name: `${e.title} (${ticket_count} ticket${ticket_count > 1 ? 's' : ''})` },
          unit_amount: e.price_cents,
        },
        quantity: ticket_count,
      }],
      payment_intent_data: {
        application_fee_amount: Math.round(total_cents * 0.10),
        transfer_data: { destination: await getStripeAccountId(e.merchant_id) },
        metadata: {
          event_id, user_id: user.id, ticket_count: String(ticket_count),
          click_idempotency_key: client_idempotency_key,
        },
      },
      success_url: `${SITE_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/events/${event_id}`,
      expires_at: Math.floor(Date.now() / 1000) + 15 * 60,
      metadata: { event_id, user_id: user.id },
    });

    // Insert pending_bookings row INSIDE the same transaction.
    // If Stripe API succeeded but this insert fails, the user gets a checkout URL
    // pointing at a session that webhook handler will reject (see §3.2).
    await tx.query(`
      insert into pending_bookings
        (event_id, user_id, stripe_checkout_session_id, ticket_count,
         unit_price_cents, total_cents, client_idempotency_key)
      values ($1, $2, $3, $4, $5, $6, $7)
    `, [event_id, user.id, session.id, ticket_count, e.price_cents, total_cents, client_idempotency_key]);

    return json({ checkout_url: session.url, expires_at: session.expires_at });
  });
}
```

**Why an advisory lock and not `SERIALIZABLE`:** advisory locks on a single integer (the hash of event_id) serialise *only* per-event. A surge on event A doesn't block event B. `SERIALIZABLE` would either need retry logic across the whole edge function or block more aggressively than needed. Advisory locks are also clearer to reason about in code review.

**What can still go wrong here:**
1. Stripe API succeeds, then DB insert fails (e.g. unique constraint on a stale idem key). Result: orphan Stripe session that the webhook will reject in §3.2. Acceptable — user retries, gets a new session.
2. DB insert succeeds, then Stripe API call fails (rare, but Stripe outages happen). Result: pending_bookings row with no usable session. Mitigation: this is detected because the *Stripe call happens first* — if Stripe fails we return early before insert. The order matters.

### 3.2 `stripe-webhook` — `checkout.session.completed`

```ts
case 'checkout.session.completed': {
  const session = event.data.object;
  await db.transaction(async (tx) => {
    // Look up pending row
    const pending = await tx.query(`
      select * from pending_bookings where stripe_checkout_session_id = $1
    `, [session.id]);
    if (pending.length === 0) {
      // Orphan session (insert failed in create-stripe-checkout)
      // OR a duplicate webhook delivery after the row was already promoted
      const existing = await tx.query(`
        select id from bookings where stripe_checkout_session_id = $1
      `, [session.id]);
      if (existing.length > 0) return; // idempotent — already processed
      // Truly orphaned — refund and bail
      await stripe.refunds.create({
        payment_intent: session.payment_intent,
        reason: 'duplicate',
      });
      logger.warn({ session_id: session.id }, 'orphan_session_refunded');
      return;
    }
    const p = pending[0];

    // Promote to confirmed
    const booking = await tx.query(`
      insert into bookings
        (event_id, user_id, ticket_count, unit_price_cents, total_cents,
         status, stripe_payment_intent_id, stripe_charge_id,
         stripe_checkout_session_id, confirmed_at)
      values ($1, $2, $3, $4, $5, 'confirmed', $6, $7, $8, now())
      on conflict (stripe_checkout_session_id) do nothing
      returning id
    `, [p.event_id, p.user_id, p.ticket_count, p.unit_price_cents,
        p.total_cents, session.payment_intent, session.payment_intent /* will resolve to charge */, session.id]);

    if (booking.length === 0) {
      // Duplicate webhook delivery — already inserted. Idempotent no-op.
      return;
    }

    // Delete pending row
    await tx.query(`delete from pending_bookings where id = $1`, [p.id]);

    // Notify user
    await tx.query(`
      insert into notifications (user_id, type, payload)
      values ($1, 'booking_confirmed', $2)
    `, [p.user_id, JSON.stringify({ booking_id: booking[0].id, event_id: p.event_id })]);

    // Notify merchant
    await notifyMerchantOfBooking(tx, p.event_id, booking[0].id);
  });
  break;
}
```

**Idempotency:**
- Stripe retries webhooks up to 3 days on non-2xx. The `on conflict (stripe_checkout_session_id) do nothing` plus the early-exit on existing booking guarantees repeated deliveries are no-ops.
- The webhook signature is verified before the switch statement; reject unsigned/invalid webhooks with 400.

### 3.3 `cleanup-expired-pending-bookings` (cron, every 1 min)

```sql
delete from pending_bookings where expires_at < now();
```

That's it. Expired rows free their capacity automatically because `event_capacity_v` filters on `expires_at > now()`. Stripe Checkout sessions also expire on the Stripe side at the same TTL — if a webhook arrives for an expired session, §3.2's orphan handler will refund it.

### 3.4 `cancel-booking-by-user`

Request: `{ booking_id: string }`

Refund policy (configurable per event, defaults shown):

| Time to event start | User refund |
|---|---|
| ≥ 48 hours | 100% (minus Stripe processing fee — Click absorbs the 10% commission loss) |
| 24–48 hours | 50% |
| < 24 hours | 0% (booking marked `cancelled_pending_refund` → `refunded` with 0 amount, seat freed for waitlist) |

For free events: cancel just flips status, no Stripe call.

```ts
export async function handler(req: Request) {
  const user = await getAuthenticatedUser(req);
  const { booking_id } = await req.json();

  return await db.transaction(async (tx) => {
    const booking = await tx.query(`
      select b.*, e.start_time, e.refund_policy, e.price_cents
      from bookings b join events e on e.id = b.event_id
      where b.id = $1 and b.user_id = $2 and b.status = 'confirmed'
      for update
    `, [booking_id, user.id]);
    if (booking.length === 0) return json({ error: 'not_found' }, 404);
    const b = booking[0];

    const hoursToEvent = (new Date(b.start_time).getTime() - Date.now()) / 3600000;
    let refundPct = 0;
    if (hoursToEvent >= 48) refundPct = 100;
    else if (hoursToEvent >= 24) refundPct = 50;
    const refundAmount = Math.floor(b.total_cents * refundPct / 100);

    // Free events: just cancel
    if (b.price_cents === 0) {
      await tx.query(`
        update bookings set status = 'refunded',
          cancelled_at = now(), cancelled_by = $1,
          refunded_at = now(), refund_amount_cents = 0
        where id = $2
      `, [user.id, b.id]);
      await promoteWaitlist(tx, b.event_id, b.ticket_count);
      return json({ status: 'cancelled' });
    }

    // Mark cancelled_pending_refund first so seat is held until refund settles
    await tx.query(`
      update bookings set status = 'cancelled_pending_refund',
        cancelled_at = now(), cancelled_by = $1,
        refund_initiated_at = now(), refund_amount_cents = $2
      where id = $3
    `, [user.id, refundAmount, b.id]);

    if (refundAmount === 0) {
      // 0% refund: mark refunded immediately, free seat
      await tx.query(`
        update bookings set status = 'refunded', refunded_at = now()
        where id = $1
      `, [b.id]);
      await promoteWaitlist(tx, b.event_id, b.ticket_count);
      return json({ status: 'cancelled_no_refund' });
    }

    // Initiate Stripe refund. Done AFTER the DB update, outside the tx, so
    // DB state reflects the in-flight refund even if the Stripe call hangs.
    return await initiateRefundOutsideTx(b, refundAmount, user.id);
  });
}

async function initiateRefundOutsideTx(booking, amount, userId) {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount,
      reason: 'requested_by_customer',
      metadata: { booking_id: booking.id, user_id: userId },
    });
    // Note: refund creation returning success ≠ refund settled.
    // The webhook charge.refund.updated → succeeded is the source of truth.
    return json({ status: 'refund_pending', stripe_refund_id: refund.id });
  } catch (err) {
    // Synchronous failure (rare — usually network/credentials issue)
    await db.query(`
      insert into refund_failures (booking_id, stripe_error_code, stripe_error_message, amount_cents)
      values ($1, $2, $3, $4)
    `, [booking.id, err.code ?? 'unknown', err.message, amount]);
    await db.query(`update bookings set status = 'refund_failed', refund_failure_reason = $1 where id = $2`,
      [err.message, booking.id]);
    return json({ status: 'refund_failed', message: 'Refund queued for manual review' });
  }
}
```

### 3.5 `stripe-webhook` — `charge.refunded` / `charge.refund.updated`

```ts
case 'charge.refunded':
case 'charge.refund.updated': {
  const refund = event.data.object;
  const paymentIntentId = refund.payment_intent;
  await db.transaction(async (tx) => {
    const booking = await tx.query(`
      select * from bookings where stripe_payment_intent_id = $1 for update
    `, [paymentIntentId]);
    if (booking.length === 0) return;
    const b = booking[0];

    if (refund.status === 'succeeded' || event.type === 'charge.refunded') {
      await tx.query(`
        update bookings set status = 'refunded', refunded_at = now(),
          stripe_refund_id = $1
        where id = $2
      `, [refund.id, b.id]);
      await promoteWaitlist(tx, b.event_id, b.ticket_count);
      await tx.query(`
        insert into notifications (user_id, type, payload)
        values ($1, 'refund_completed', $2)
      `, [b.user_id, JSON.stringify({ booking_id: b.id, amount_cents: b.refund_amount_cents })]);
    } else if (refund.status === 'failed') {
      await tx.query(`
        update bookings set status = 'refund_failed',
          refund_failure_reason = $1
        where id = $2
      `, [refund.failure_reason, b.id]);
      await tx.query(`
        insert into refund_failures (booking_id, stripe_error_code, stripe_error_message, amount_cents)
        values ($1, $2, $3, $4)
      `, [b.id, refund.failure_reason, refund.failure_reason, b.refund_amount_cents]);
      await notifyAdminsOfFailedRefund(tx, b.id);
    }
  });
  break;
}
```

---

## 4. Waitlist

### 4.1 Join waitlist

Triggered when a user clicks RSVP on a sold-out event.

```ts
export async function handler(req: Request) {
  const user = await getAuthenticatedUser(req);
  const { event_id } = await req.json();
  return await db.transaction(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock(hashtext($1))`, [event_id]);
    const cap = await tx.query(`select available from event_capacity_v where event_id = $1`, [event_id]);
    if (cap[0].available > 0) {
      // Race: capacity opened up between user's click and now. Bounce them
      // back to the RSVP flow rather than putting them on a waitlist for an
      // event that has seats.
      return json({ error: 'capacity_available', redirect: 'rsvp' });
    }
    const existing = await tx.query(`
      select id, status from waitlist where event_id = $1 and user_id = $2
    `, [event_id, user.id]);
    if (existing.length > 0 && existing[0].status === 'waiting') {
      return json({ error: 'already_waitlisted' });
    }
    const maxPos = await tx.query(`
      select coalesce(max(position), 0) as p from waitlist
      where event_id = $1 and status in ('waiting', 'offered')
    `, [event_id]);
    await tx.query(`
      insert into waitlist (event_id, user_id, position)
      values ($1, $2, $3)
      on conflict (event_id, user_id) do update
      set status = 'waiting', position = $3, joined_at = now(),
          offered_at = null, offer_expires_at = null, resolved_at = null
    `, [event_id, user.id, maxPos[0].p + 1]);
    return json({ status: 'waitlisted', position: maxPos[0].p + 1 });
  });
}
```

### 4.2 `promoteWaitlist(tx, eventId, seatsFreed)`

Called from any seat-freeing path: confirmed→refunded, cancelled by merchant, etc.

```ts
async function promoteWaitlist(tx, eventId, seatsFreed) {
  for (let i = 0; i < seatsFreed; i++) {
    const next = await tx.query(`
      select id, user_id from waitlist
      where event_id = $1 and status = 'waiting'
      order by position asc
      limit 1
      for update skip locked
    `, [eventId]);
    if (next.length === 0) return;  // no one waiting
    const offerExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await tx.query(`
      update waitlist set status = 'offered',
        offered_at = now(), offer_expires_at = $1
      where id = $2
    `, [offerExpiresAt, next[0].id]);
    await tx.query(`
      insert into notifications (user_id, type, payload, expires_at)
      values ($1, 'waitlist_offer', $2, $3)
    `, [next[0].user_id, JSON.stringify({ event_id: eventId, offer_expires_at: offerExpiresAt }), offerExpiresAt]);
  }
}
```

The offer holds the seat for 30 min. During that window, the seat is **not** counted as available — it's invisible to other waitlist promotion but also not bookable by new RSVPs. Implementation: the offered row should be reflected in `event_capacity_v`:

```sql
-- Updated event_capacity_v to include offered waitlist
create or replace view public.event_capacity_v as
select
  e.id as event_id,
  e.capacity,
  coalesce(b.confirmed_count, 0) as confirmed_count,
  coalesce(p.pending_count, 0) as pending_count,
  coalesce(w.offered_count, 0) as offered_count,
  e.capacity
    - coalesce(b.confirmed_count, 0)
    - coalesce(p.pending_count, 0)
    - coalesce(w.offered_count, 0) as available
from public.events e
left join lateral (
  select count(*)::int as confirmed_count
  from public.bookings
  where event_id = e.id
    and status in ('confirmed', 'cancelled_pending_refund')
) b on true
left join lateral (
  select coalesce(sum(ticket_count), 0)::int as pending_count
  from public.pending_bookings
  where event_id = e.id and expires_at > now()
) p on true
left join lateral (
  select count(*)::int as offered_count
  from public.waitlist
  where event_id = e.id and status = 'offered' and offer_expires_at > now()
) w on true;
```

### 4.3 Waitlist offer expiry

Cron, every 1 min:

```sql
update waitlist
  set status = 'expired', resolved_at = now()
where status = 'offered' and offer_expires_at < now();
```

Then re-run `promoteWaitlist` for each expired offer's event (cron triggers a function that batches these).

### 4.4 Accepting a waitlist offer

The user clicks the notification → goes to checkout. The flow is the same as `create-stripe-checkout` except:
- Skip the "already booked" check (they may have an old refunded booking).
- The capacity check passes because their offered row counts against capacity *for them* (the offered count is computed across all offered rows; their click consumes one).
- On successful payment, the waitlist row flips to `accepted` and `resolved_at = now()`.

Implementation: the waitlist row's `stripe_checkout_session_id` is set in `create-stripe-checkout`, and the webhook handler in §3.2 checks for a waitlist row keyed on session and flips it on confirm.

```sql
update waitlist
  set status = 'accepted', resolved_at = now(), stripe_checkout_session_id = $1
where event_id = $2 and user_id = $3 and status = 'offered'
```

If the offer has already expired by the time they click — show "this offer has expired, you're back on the waitlist at position N" and re-insert them.

### 4.5 Declining a waitlist offer

Explicit decline button: flip row to `declined`. Re-run `promoteWaitlist` for the event.

---

## 5. Merchant-initiated cancellation

Already covered in `02_MERCHANT_WORKFLOW.md` §6.7. Summary of booking-side behaviour:

- Merchant cancels entire event → all `confirmed` bookings flip to `cancelled_pending_refund` with full refunds initiated (regardless of refund policy — Click eats the loss on merchant-initiated cancel).
- All `pending` rows are deleted (no charge yet, Stripe sessions auto-expire).
- All `waiting` and `offered` waitlist rows flip to `expired`.
- Each user receives a `event_cancelled` notification.
- Refund failures pour into `refund_failures` queue normally.

Edge case: if a merchant cancels while a webhook is in flight for a fresh payment, the webhook handler in §3.2 must check `events.status = 'cancelled'` before promoting pending → confirmed. If the event is cancelled, refund the session immediately and don't create a booking row.

```ts
// Add to checkout.session.completed handler:
const eventStatus = await tx.query(`select status from events where id = $1`, [p.event_id]);
if (eventStatus[0].status === 'cancelled') {
  await stripe.refunds.create({
    payment_intent: session.payment_intent,
    reason: 'duplicate',
    metadata: { reason: 'event_cancelled_during_checkout', user_id: p.user_id },
  });
  await tx.query(`delete from pending_bookings where id = $1`, [p.id]);
  await tx.query(`
    insert into notifications (user_id, type, payload)
    values ($1, 'booking_refunded_event_cancelled', $2)
  `, [p.user_id, JSON.stringify({ event_id: p.event_id, session_id: session.id })]);
  return;
}
```

---

## 6. Edge cases

### 6.1 Double-click on RSVP button

Client uses a single `client_idempotency_key` per click intent (generated on button render, regenerated on success/failure). Double-click within the same idempotency key window returns the same checkout URL — never two sessions.

### 6.2 User closes Stripe tab without completing

`pending_bookings` row expires at 15 min. Cleanup cron removes it. Capacity auto-frees. No user-visible effect. If they retry, they get a new pending row.

### 6.3 Stripe webhook delayed past TTL

Pending row expired but webhook arrives anyway with a `succeeded` payment. Handler in §3.2:
- Pending row gone, no existing booking with this session_id.
- Capacity may have been re-sold to someone else.
- Refund the payment with reason `duplicate` and notify user.

**This is the one case where a user paid and didn't get a seat.** The communication needs to be clear: "Your payment was refunded because the booking window expired before we received confirmation from Stripe. Please retry." Acceptable but rare — Stripe webhook latency >15min is unusual.

Mitigation we *didn't* take and why: extending the TTL to 30 min reduces this case but doubles the speculative capacity hold, making the sold-out experience worse for everyone else. 15 min is the right tradeoff for our scale.

### 6.4 Merchant view of waitlist

Merchants need to see waitlist count for capacity planning, but waitlist user identities are not their business until the user actually books. A view:

```sql
create view public.merchant_waitlist_summary_v as
select
  event_id,
  count(*) filter (where status = 'waiting') as waiting_count,
  count(*) filter (where status = 'offered') as offered_count
from public.waitlist
group by event_id;
```

RLS on the underlying `waitlist` table prevents merchants from seeing rows. The view aggregates → merchants get counts only.

### 6.5 Refund-then-rebook

After a `refunded` row exists, the partial unique index in §2.2 (`status in ('confirmed', 'cancelled_pending_refund')`) allows a new booking row for the same user-event pair. No special handling needed.

### 6.6 Refund fails because customer's card is closed

Stripe returns `failure_reason = 'declined'`. Row goes to `refund_failures` queue. Admin actions in `03_ADMIN_WORKFLOW.md` §5: retry, convert to platform credit, manually mark refunded (if Click sends funds out-of-band), or write off.

### 6.7 Partial refund disputes

If a user disputes a partial refund (e.g. claims they should have got 100% not 50% due to a documented emergency), this is a manual admin action — no automated path. Admin can issue an additional refund up to the booking total via Stripe dashboard, then mark booking `refunded_amount_cents` accordingly via an admin RPC.

### 6.8 Event start time changes after bookings exist

Per `02_MERCHANT_WORKFLOW.md` §6.5, `start_time` is immutable after first booking. If the merchant *must* change it, they cancel the event and re-create it. No support for "edit-with-refund-offer" in v1.

### 6.9 User account deletion with pending refund

Soft-delete the user (`auth.users` row remains for FK integrity). The booking and refund flow continues against the deleted user. Notifications go to the email on file. Hard-delete only happens after all bookings reach terminal states (`refunded` or `attended`) and 7-year financial retention has passed.

---

## 7. Observability

Log to `events_log` (per `01_USER_WORKFLOW.md` §10):
- `checkout_initiated` — event_id, user_id, ticket_count, session_id
- `checkout_completed` — booking_id, latency_ms (session_created_at → confirmed_at)
- `checkout_abandoned` — pending_id, reason (`expired_ttl` | `event_cancelled_during_checkout`)
- `booking_cancelled` — booking_id, cancelled_by (user|merchant|admin), refund_pct, refund_amount_cents
- `refund_initiated` / `refund_succeeded` / `refund_failed`
- `waitlist_joined` / `waitlist_offered` / `waitlist_accepted` / `waitlist_expired`
- `capacity_check_failed_sold_out` — event_id, user_id (signal of demand)

Metrics surfaced on admin analytics:
- Conversion rate: checkout_initiated → checkout_completed (target ≥ 70%)
- Median time-to-confirm (target < 2 min)
- Cancellation rate by hours-to-event
- Refund failure rate (target < 1%; alert > 2%)
- Waitlist-to-confirmed conversion (target ≥ 40% — measures notification effectiveness)
- Sold-out density per merchant (high values → demand signal for capacity expansion conversation)

Alerts:
- `pending_bookings` count > 100 stuck older than 30 min → suggests cron failure or Stripe API outage
- Refund failure rate > 5% over rolling 24h → P1 incident
- Webhook delivery lag > 5 min → P2 (Stripe-side issue, not ours)

---

## 8. Test cases (the ones that matter)

| # | Scenario | Expected |
|---|---|---|
| 1 | 10 users hit RSVP simultaneously on event with 3 seats | 3 get pending rows + checkout, 7 get `sold_out`. No overbooking possible. |
| 2 | User A pending, user B pending, A completes, B's TTL expires | A confirmed (1 seat), B expired (seat freed) |
| 3 | User completes payment, then merchant cancels event in same second | Webhook detects `events.status='cancelled'`, refunds Stripe charge, no booking row created |
| 4 | Webhook arrives 16 min after session creation | Pending row gone, charge refunded with `duplicate` reason, user notified |
| 5 | Duplicate webhook delivery | Second delivery is a no-op (no duplicate booking row) |
| 6 | User cancels 49h before event | 100% refund initiated, seat goes to waitlist |
| 7 | User cancels 23h before event | 0% refund, status flips to refunded immediately, seat goes to waitlist |
| 8 | Refund fails synchronously (Stripe network err) | Booking → `refund_failed`, `refund_failures` row created, admin notified |
| 9 | Refund fails async (charge.refund.updated → failed) | Same as 8 |
| 10 | Waitlist offer not accepted in 30 min | Offer expires, next person promoted |
| 11 | Waitlist user accepts offer → fails payment → tries again | First attempt's pending row expires at 15 min; second attempt creates new pending row; both share the offered waitlist row (offer doesn't expire mid-checkout) |
| 12 | Merchant cancels event with 50 confirmed bookings | All 50 → `cancelled_pending_refund` → refund initiated; refunds happen in batches of 10 per second (Stripe rate limit) |
| 13 | User clicks RSVP twice within 100ms (double-click race) | Single pending row, single checkout URL (client_idempotency_key dedup) |
| 14 | Stripe sends webhook for a session that has no pending_bookings row and no bookings row | Orphan handler refunds; logs warning |

---

## 9. Open questions for product

These are intentional unknowns flagged for product to resolve before Phase 1:

1. **Group bookings.** Currently 1–4 tickets per booking row. Do we want to model "user A books 4 tickets and the other 3 are guests with their own profiles"? v1: no — they're anonymous +1s. Phase 1: revisit.
2. **Transferable tickets.** Can user A transfer their booking to user B? v1: no. Phase 1: probably no — friction protects against scalping.
3. **Refund-to-credit option.** Should we offer "10% bonus if you take credit instead of cash refund"? Pricing tool, not infra. Phase 1+.
4. **Click Plus members refund policy.** Click Plus (Month 7+, ~$12.99/mo) — does it include free cancellation? Product decision; infra is configurable per booking, not per-event.
5. **Reserved seating** (vs general admission). v1: GA only. Phase 2.
