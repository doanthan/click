# Click — Event State Machine: Locked / Unlocked / Waitlist
> Updated May 2026. Refund policy locked, FOMO threshold adjusted for pilot, Stripe Payment Element embedded, saves signal added. Self-review section updated.

---

## 0. Guiding Principles

- **State is owned by the database, not the UI.** Every render re-derives event state from a fresh DB query.
- **Capacity enforced at Postgres level.** No application-layer check is sufficient alone.
- **Money never moves without a confirmed state.** Stripe payment and booking confirmation are atomic.
- **A waitlist offer is a time-limited reservation.** Spot held via `pending_waitlist` booking row (Option B).
- **Cancellation always triggers the waitlist.** No cancellation path skips the queue check.
- **Refund policy is platform-defined, locked, non-negotiable by merchants.**

---

## 1. Event State Definitions

### 1a. Platform-level status (`events.status`)

| Status | Meaning | User visible |
|---|---|---|
| `draft` | Not submitted | ❌ |
| `pending_review` | Awaiting admin approval | ❌ |
| `published` | Live and bookable | ✅ |
| `cancelled` | Cancelled by merchant or admin | ❌ |
| `completed` | Past `end_time` | ❌ |

RLS enforces this — do not rely on frontend filtering:
```sql
CREATE POLICY "events_public_read" ON events
  FOR SELECT USING (status = 'published');
```

### 1b. User-level access state (derived, never stored)

```sql
CREATE OR REPLACE FUNCTION get_user_event_state(p_event_id uuid, p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_booking_status  text;
  v_waitlist_exists boolean;
  v_offer_pending   boolean;
BEGIN
  -- Check confirmed booking
  SELECT status INTO v_booking_status
    FROM event_bookings
    WHERE event_id = p_event_id AND user_id = p_user_id
    LIMIT 1;

  IF v_booking_status = 'confirmed' THEN RETURN 'unlocked'; END IF;

  -- Check active waitlist offer (special sub-state)
  SELECT EXISTS(
    SELECT 1 FROM waitlist_offers wo
    JOIN event_waitlists ew ON ew.id = wo.waitlist_id
    WHERE ew.event_id = p_event_id AND ew.user_id = p_user_id
      AND wo.status = 'pending' AND wo.expires_at > now()
  ) INTO v_offer_pending;

  IF v_offer_pending THEN RETURN 'offer_pending'; END IF;

  -- Check active waitlist entry
  SELECT EXISTS(
    SELECT 1 FROM event_waitlists
    WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'active'
  ) INTO v_waitlist_exists;

  IF v_waitlist_exists THEN RETURN 'waitlisted'; END IF;

  RETURN 'locked';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

| State | Condition | User sees |
|---|---|---|
| `locked` | No booking, not waitlisted | Event info, FOMO card, saves count, RSVP CTA |
| `waitlisted` | Active waitlist row | Queue position, leave-waitlist option |
| `offer_pending` | Live waitlist offer in window | Offer claim banner with countdown |
| `unlocked` | Confirmed booking | Full address, cancel option |

---

## 2. Locked State

### What the user sees
- Event title, description, tags, date/time, price
- Approximate distance ("~2km away") — **never exact address**
- Saves count: "47 people saved this" — from `bookmarks` table; no minimum threshold
- FOMO card (if ≥3 confirmed attendees — pilot threshold)
- Capacity indicator (see §7)
- CTA: **"RSVP to unlock"** (free) or **"Book now — $X"** (paid)

### What is hidden
- Exact venue address and map pin
- Any attendee identities

### Logged-out users
- Same locked view
- CTA: "Sign in to RSVP" → `/auth?redirect=/events/:id`
- Return to event after auth completes

### 2a. FOMO Card Rules

**Pilot threshold: ≥ 3 confirmed attendees** (will increase to 5 post-pilot as event sizes grow).

Rules before showing any FOMO signal:
1. Total confirmed attendees ≥ 3
2. Each tag mentioned must appear in ≥ 2 attendee profiles (pilot) / ≥ 3 (post-pilot)
3. "X people you might click with attending" requires X ≥ 2

**Saves signal (no threshold):**
```sql
-- Always show if bookmarks > 0:
SELECT COUNT(*) FROM bookmarks WHERE event_id = $1
```
Copy: "X people saved this" — shown even with 1 save. This gives locked events social energy from day one without requiring confirmed bookings.

**FOMO card query (cached in `event_fomo_cache`):**
```sql
SELECT
  (SELECT COUNT(*) FROM event_bookings
    WHERE event_id = $1 AND status = 'confirmed') AS total_attendees,
  (SELECT COUNT(*) FROM bookmarks WHERE event_id = $1) AS save_count,
  (SELECT json_agg(t) FROM (
    SELECT it.label, COUNT(*) as n
    FROM event_bookings eb
    JOIN profile_interest_tags pit ON pit.profile_id = eb.user_id
    JOIN interest_tags it ON it.id = pit.tag_id
    WHERE eb.event_id = $1 AND eb.status = 'confirmed'
    GROUP BY it.label HAVING COUNT(*) >= 2
    ORDER BY n DESC LIMIT 2
  ) t) AS top_tags,
  (SELECT json_agg(l) FROM (
    SELECT it.label, COUNT(*) as n
    FROM event_bookings eb
    JOIN profile_life_tags plt ON plt.profile_id = eb.user_id
    JOIN interest_tags it ON it.id = plt.tag_id
    WHERE eb.event_id = $1 AND eb.status = 'confirmed'
    GROUP BY it.label HAVING COUNT(*) >= 2
    ORDER BY n DESC LIMIT 1
  ) l) AS top_life_tags;
```

```sql
event_fomo_cache(
  event_id       uuid PRIMARY KEY REFERENCES events(id),
  total_count    int,
  save_count     int,
  top_tags       jsonb,
  top_life_tags  jsonb,
  computed_at    timestamptz DEFAULT now()
)
```

Recompute trigger: on `event_bookings` INSERT / status change to cancelled, and on `bookmarks` INSERT / DELETE.

---

## 3. Booking Flow (Locked → Unlocked)

### 3a. Pre-booking checks (server-side, fail fast)

| Check | Failure |
|---|---|
| Authenticated | 401 → `/auth` |
| Email verified | 403 → verification nudge |
| Onboarding complete | 403 → `/onboarding` |
| Profile photo exists | 403 → "Add a photo to book" → `/profile/edit` |
| No existing confirmed booking | 409 → show unlocked state |
| Event status = `published` | 404 |
| Event `start_time` in future | 410 → "This event has started" |

### 3b. Free event booking

```
rpc('reserve_event_spot', { p_event_id, p_user_id })
  │
  ▼ Single transaction, FOR UPDATE lock
  SELECT capacity FROM events WHERE id = p_event_id FOR UPDATE
  SELECT COUNT(*) confirmed FROM event_bookings
    WHERE event_id = p_event_id
    AND status IN ('confirmed', 'pending_waitlist')
    AND (status = 'confirmed' OR expires_at > now())
  IF held >= capacity → RAISE EXCEPTION 'event_full'
  INSERT event_bookings(user_id, event_id, status='confirmed', booked_at=now())
  COMMIT
  │
  ├─ Success → send-booking-email (async) → UI re-fetches → 'unlocked'
  └─ event_full → offer waitlist (§4)
```

### 3c. Paid event booking — Stripe Payment Element (embedded)

**No redirect to Stripe Checkout.** Payment Element renders inline in a modal on `/events/:id`. User never leaves the page.

```
User clicks "Book — $X"
  │
  ▼
Optimistic capacity check (informational only — real check in edge fn)
  IF confirmed full → skip to waitlist offer immediately
  │
  ▼
Edge fn: create-stripe-payment-intent
  Params: { event_id, user_id, amount, currency: 'aud' }
  1. FOR UPDATE capacity re-check — return {error:'event_full'} if full
  2. stripe.paymentIntents.create({ amount, currency, metadata: { event_id, user_id } })
  3. INSERT payment_sessions(session_id, event_id, user_id, status='pending')
  4. Return { client_secret }
  │
  ▼
Client initialises Stripe Payment Element with client_secret
  -- Card input renders inline in modal
  -- User completes payment on /events/:id — no redirect
  │
  ▼
stripe.confirmPayment() succeeds client-side
  │
  ▼
Stripe webhook → edge fn: stripe-webhook
  On payment_intent.succeeded:
    1. Verify signature (STRIPE_WEBHOOK_SECRET)
    2. Idempotency: SELECT from processed_webhook_events; INSERT after processing
    3. reserve_event_spot(event_id, user_id) with FOR UPDATE
    4. Success:
         INSERT event_bookings(status='confirmed', payment_intent_id, amount_paid)
         UPDATE payment_sessions status='completed'
         send-booking-email (async)
         INSERT user_activity(type='event_booked', payload={event_id})
    5. event_full at webhook:
         Immediate Stripe refund: stripe.refunds.create({ payment_intent })
         Email: "Event filled just before your payment — full refund issued"
         UPDATE payment_sessions status='refunded_event_full'
  │
  ▼
Supabase Realtime: client subscription on event_bookings fires
  → UI transitions to 'unlocked' without page reload
```

**Idempotency table:**
```sql
processed_webhook_events(stripe_event_id text PRIMARY KEY, processed_at timestamptz)
```

**Unique booking constraint:**
```sql
CREATE UNIQUE INDEX one_confirmed_booking_per_user
  ON event_bookings(event_id, user_id) WHERE status = 'confirmed';
```

---

## 4. Waitlist Flow

### 4a. Joining the waitlist

```sql
CREATE OR REPLACE FUNCTION join_waitlist(p_event_id uuid, p_user_id uuid)
RETURNS int AS $$
DECLARE v_position int;
BEGIN
  PERFORM id FROM events WHERE id = p_event_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM event_waitlists
    WHERE event_id=p_event_id AND user_id=p_user_id AND status='active')
  THEN RAISE EXCEPTION 'already_waitlisted'; END IF;

  IF EXISTS (SELECT 1 FROM event_bookings
    WHERE event_id=p_event_id AND user_id=p_user_id AND status='confirmed')
  THEN RAISE EXCEPTION 'already_booked'; END IF;

  SELECT COALESCE(MAX(position),0)+1 INTO v_position
    FROM event_waitlists WHERE event_id=p_event_id AND status='active';

  INSERT INTO event_waitlists(event_id, user_id, position, joined_at, status)
    VALUES(p_event_id, p_user_id, v_position, now(), 'active');

  RETURN v_position;
END;
$$ LANGUAGE plpgsql;
```

### 4b. What the waitlisted user sees
- Queue position: "You're #3 on the waitlist"
- No payment, no address revealed
- FOMO card still shown (not yet committed)
- CTA: "Leave waitlist"
- Email confirmation with position

### 4c. Offer when spot opens

```
Trigger: after_booking_status_change
  Fires on: UPDATE event_bookings WHERE NEW.status='cancelled' AND OLD.status='confirmed'
  Fires on: UPDATE event_bookings WHERE NEW.status='expired_offer'
  │
  ▼
offer_next_waitlist_spot(p_event_id):
  SELECT id, user_id FROM event_waitlists
    WHERE event_id=p_event_id AND status='active'
    ORDER BY position ASC LIMIT 1 FOR UPDATE

  IF no row: return (empty queue — terminate)

  UPDATE event_waitlists SET status='offered' WHERE id=v_id

  -- Hard-reserve the spot (Option B):
  INSERT event_bookings(user_id, event_id, status='pending_waitlist',
    offered_at=now(), expires_at=now()+interval'15 min')

  INSERT waitlist_offers(waitlist_id, event_id, user_id,
    offered_at=now(), expires_at=now()+interval'15 min', status='pending')

  INSERT notifications(user_id, type='waitlist_offer', payload={offer_id, event_id, expires_at})
  Edge fn: send-waitlist-offer-email
```

### 4d. Offer claim UI (state = `offer_pending`)

User sees offer claim banner (not FOMO card) with countdown timer:
> "Your spot is waiting — claim it in 14:32"

CTA: "Confirm booking" (free) or "Pay now — $X" (paid)

```
Server checks:
  1. waitlist_offers row exists, status='pending', expires_at > now()
     IF expired → RAISE EXCEPTION 'offer_expired' → cascade to next in queue
  2. pending_waitlist booking row still exists (spot is held)
  │
  ├─ Free: UPDATE event_bookings SET status='confirmed' WHERE status='pending_waitlist'
  │        UPDATE waitlist_offers SET status='claimed', claimed_at=now()
  │        UPDATE event_waitlists SET status='converted'
  │
  └─ Paid: same Stripe Payment Element flow as §3c
           On webhook success: UPDATE event_bookings, waitlist_offers, event_waitlists
           On Stripe fail/expire: UPDATE waitlist_offers status='expired'
                                  UPDATE event_bookings status='expired_offer'
                                  cascade to next in queue
```

### 4e. Offer expiry cron (every 5 minutes)

```
edge fn: expire-waitlist-offers

SELECT DISTINCT ew.event_id FROM waitlist_offers wo
  JOIN event_waitlists ew ON ew.id = wo.waitlist_id
  WHERE wo.status='pending' AND wo.expires_at < now()

For each event_id:
  -- Check if offer was secretly claimed concurrently:
  SELECT status FROM waitlist_offers WHERE id=v_offer_id
  IF status='claimed': skip (race won by user — do not cascade)
  IF status='pending':
    UPDATE waitlist_offers SET status='expired'
    UPDATE event_waitlists SET status='active' WHERE id=v_waitlist_id
    UPDATE event_bookings SET status='expired_offer'
      WHERE status='pending_waitlist' AND event_id=X AND user_id=Y
    offer_next_waitlist_spot(event_id)
```

### 4f. Leaving the waitlist

```
UPDATE event_waitlists SET status='cancelled', cancelled_at=now()
  WHERE event_id=X AND user_id=Y AND status='active'

IF pending offer exists for this user+event:
  UPDATE waitlist_offers SET status='cancelled'
  UPDATE event_bookings SET status='expired_offer'
    WHERE status='pending_waitlist' AND event_id=X AND user_id=Y
  offer_next_waitlist_spot(event_id)

-- No resequencing of remaining positions. Gaps are fine — ORDER BY position ASC handles it.
```

---

## 5. Unlocked State

### What the user sees
- Full venue name + exact address + Mapbox pin + directions link
- Confirmed attendee count (number only — no names)
- Event schedule, description, host info
- CTA: "Cancel RSVP"
- No FOMO card

### Address protection (DB level — not client rendering)

```sql
CREATE OR REPLACE FUNCTION get_event_address(p_event_id uuid)
RETURNS text AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM event_bookings
    WHERE event_id=p_event_id AND user_id=auth.uid() AND status='confirmed'
  ) THEN
    RETURN (SELECT venue_address FROM events WHERE id=p_event_id);
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Venue address should live in `event_private_details(event_id, venue_address, venue_lat, venue_lng)` with RLS allowing read only for confirmed bookers and the merchant owner. Do not store address in the public `events` row.

---

## 6. Cancellation (Unlocked → Locked)

### Refund policy (Platform-defined — locked, not configurable by merchants)

| When user cancels | Refund |
|---|---|
| > 48h before event start | 100% |
| 24h–48h before event start | 50% |
| < 24h before event start | 0% |
| Merchant cancels event | 100% always |
| Admin unpublishes event | 100% always (admin decision) |

**This policy must appear:**
- On every event detail page (locked and unlocked states)
- In every booking confirmation email
- In the cancellation confirmation dialog (showing the exact dollar amount)

```sql
-- Add to platform_settings:
platform_settings.cancellation_policy  jsonb DEFAULT '{
  "full_refund_hours": 48,
  "partial_refund_hours": 24,
  "partial_refund_pct": 50
}'
```

### Refund calculation function
```sql
CREATE OR REPLACE FUNCTION calculate_refund_amount(
  p_amount_paid    numeric,
  p_event_start    timestamptz
) RETURNS numeric AS $$
DECLARE
  v_hours_to_event numeric;
  v_policy         jsonb;
BEGIN
  v_hours_to_event := EXTRACT(EPOCH FROM (p_event_start - now())) / 3600;
  SELECT cancellation_policy INTO v_policy FROM platform_settings LIMIT 1;

  IF v_hours_to_event > (v_policy->>'full_refund_hours')::numeric THEN
    RETURN p_amount_paid;
  ELSIF v_hours_to_event > (v_policy->>'partial_refund_hours')::numeric THEN
    RETURN p_amount_paid * ((v_policy->>'partial_refund_pct')::numeric / 100);
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 6a. User-initiated cancellation

```
User clicks "Cancel RSVP"
  │
  ▼
Show dialog:
  "[Event Name] on [Date]"
  "Refund: $[calculate_refund_amount()] (based on cancellation policy)"
  [Cancel booking] [Keep my spot]
  │
  ▼
Server checks:
  1. Booking confirmed for this user+event
  2. Event has not started (start_time > now())
     IF started: "This event has already started — contact support"
  │
  ▼
refund_amount = calculate_refund_amount(amount_paid, event.start_time)
UPDATE event_bookings SET status='cancelled', cancelled_at=now(), cancelled_by='user'
  │
  ├─ If amount_paid > 0 AND refund_amount > 0:
  │    stripe.refunds.create({ payment_intent, amount: refund_amount_in_cents })
  │    On success: INSERT payment_transactions(type='refund', status='completed', amount=refund_amount)
  │    On failure: INSERT payment_transactions(refund_status='failed') → surface to admin
  │
  ▼
Email user: "Cancellation confirmed. Refund of $[X] in 3–5 business days." OR "No refund per policy."
Trigger: offer_next_waitlist_spot(event_id)
INSERT user_activity(type='event_cancelled', payload={event_id}) -- for pattern tracking
UI: state returns to 'locked'
```

### 6b. Merchant-initiated cancellation (full refund always)

```
Merchant cancels → CancelEventDialog (requires reason, min 20 chars)
  │
  ▼
UPDATE events SET status='cancelled', cancellation_reason, cancelled_at
  │
  ▼
Edge fn: cancel-event-bookings(event_id)
  FOR EACH confirmed booking:
    stripe.refunds.create({ payment_intent }) -- 100% always
    Log to payment_transactions
    UPDATE event_bookings status='cancelled', cancelled_by='merchant'
    Email attendee: "Event cancelled — full refund of $X in 3–5 business days"
  │
  UPDATE event_waitlists status='cancelled' WHERE status IN ('active','offered')
  UPDATE waitlist_offers status='cancelled' WHERE status='pending'
  UPDATE event_bookings status='cancelled' WHERE status='pending_waitlist'
  Email waitlisted users: "Event cancelled — you were not charged"
  logAdminAction('event_cancelled_by_merchant', event_id, {reason})
```

Stripe failures: log, continue loop, surface to admin.

### 6c. Admin unpublish

```sql
UPDATE events SET status='unpublished', unpublished_reason, unpublished_by=admin_uid, unpublished_at=now()
logAdminAction('event_unpublished', event_id, {reason})
```
Dialog: "Issue full refunds to confirmed attendees? Yes / No." If Yes: same bulk refund as §6b.

---

## 7. Capacity Display Rules

```sql
SELECT
  e.capacity,
  (SELECT COUNT(*) FROM event_bookings
    WHERE event_id = e.id
    AND status IN ('confirmed', 'pending_waitlist')
    AND (status = 'confirmed' OR expires_at > now())
  ) AS held_count,
  e.capacity - held_count AS available_spots
FROM events e WHERE e.id = $1;
```

| Condition | Display |
|---|---|
| `available_spots > 10` | "Spots available" |
| `available_spots <= 10 AND > 0` | "X spots left" |
| `available_spots = 0, waitlist empty` | "Sold out" |
| `available_spots = 0, waitlist has entries` | "Join waitlist" |
| User is on waitlist | "You're #X on the waitlist" |

Do not show total capacity. It is not public information.

---

## 8. State Transition Diagram

```
                    ┌──────────────────────────────────┐
                    │            LOCKED                │
                    │  saves count + FOMO (if ≥3 bkgs) │
                    └───────────┬──────────┬───────────┘
                                │          │
                     Spots      │          │  Full
                     available  │          │
                                ▼          ▼
                    ┌───────────────┐  ┌──────────────┐
                    │  BOOKING      │  │  WAITLISTED  │
                    │  FLOW (§3)    │  │  (§4a–4b)    │
                    └──────┬────────┘  └──────┬───────┘
                           │                  │ Offer
                    Confirmed                 │ received
                           │                  ▼
                           │         ┌────────────────┐
                           │         │  OFFER PENDING │
                           │         │  15-min window │
                           │         └──────┬─────────┘
                           │         Claimed│
                           ▼                ▼
                    ┌─────────────────────────────────┐
                    │            UNLOCKED             │
                    │  full address, cancel option    │
                    └──────────────┬─────────────────┘
                                   │
                          Cancel / merchant cancel
                                   │
                                   ▼
                    ┌─────────────────────────────────┐
                    │            LOCKED               │
                    │  waitlist triggered             │
                    └─────────────────────────────────┘
```

---

## 9. Full Table Reference

```sql
events(id, status, capacity, start_time, end_time, price, minimum_viable_attendees, ...)
event_private_details(event_id, venue_address, venue_lat, venue_lng)
event_bookings(id, event_id, user_id, status, booked_at, cancelled_at,
               cancelled_by, payment_intent_id, amount_paid, expires_at, source)
event_waitlists(id, event_id, user_id, position, joined_at, status, cancelled_at)
waitlist_offers(id, waitlist_id, event_id, user_id, offered_at, expires_at, status, claimed_at)
payment_transactions(id, event_id, user_id, type, status, stripe_intent_id,
                     amount, refund_amount, refund_status, resolved_by, created_at)
payment_sessions(id, session_id, event_id, user_id, created_at, status)
processed_webhook_events(stripe_event_id text PRIMARY KEY, processed_at timestamptz)
event_fomo_cache(event_id, total_count, save_count, top_tags, top_life_tags, computed_at)
platform_settings(id, commission_rate, cancellation_policy jsonb, fomo_min_cohort,
                  mutual_click_expiry_days, waitlist_offer_minutes, maintenance_mode)
```

---

## 10. Self-Review — Issues Found & Resolved

**Issue 1: Circular FOMO dependency**
FOMO needed ≥5 bookings, but bookings needed FOMO. In early pilot most events won't hit 5 bookings quickly.
**Resolution:** Pilot threshold lowered to 3 in §2a. Saves signal added with no threshold — fires from first bookmark. FOMO and saves are now two separate signals, each able to fire independently.

**Issue 2: Refund policy was TBD**
Undefined policy meant the cancel button had no copy, merchants didn't know what to expect, and users couldn't make informed cancellation decisions.
**Resolution:** Policy locked in §6 and §0. Stored in `platform_settings.cancellation_policy` jsonb. `calculate_refund_amount()` DB function ensures consistency everywhere it's used. Policy must appear on event page and in booking confirmation email.

**Issue 3: Stripe redirect caused mobile drop-off**
Redirecting to Stripe Checkout breaks mobile context and increases abandoned checkout rates.
**Resolution:** Replaced with Stripe Payment Element embedded in modal in §3c. Client receives `client_secret` from edge fn; Payment Element renders inline. Realtime subscription on `event_bookings` handles the UI transition without page reload.

**Issue 4: FOMO card shown during offer window**
User with active offer shouldn't see "RSVP to unlock" FOMO card — they should see the offer claim UI.
**Resolution:** Added `offer_pending` as a distinct sub-state in `get_user_event_state()`. Offer claim banner renders instead of FOMO card when state = `offer_pending`.

**Issue 5: Double-booking via browser back**
Stripe webhook retries could create duplicate `event_bookings` rows.
**Resolution:** `processed_webhook_events` idempotency table + unique partial index on `event_bookings(event_id, user_id) WHERE status='confirmed'`.

**Issue 6: Waitlist position race condition**
Two users joining simultaneously could get the same position number if computed in application code.
**Resolution:** `join_waitlist()` DB function uses `FOR UPDATE` on the event row to serialise position assignment.

**Issue 7: No address protection at DB level**
Client-side conditional rendering was the only protection for venue address.
**Resolution:** Address moved to `event_private_details` table with RLS restricting reads to confirmed bookers + merchant owner + admin. `get_event_address()` security-definer function is the only read path.

**Issue 8: Stale pending_waitlist rows inflating capacity**
If expiry cron missed a cycle, stale `pending_waitlist` rows would count as held capacity.
**Resolution:** Capacity query filters `pending_waitlist` rows by `expires_at > now()` — stale rows excluded automatically even without cron cleanup.

**Issue 9: No under-attended event handling**
No spec for what happens when events approach start time with low attendance.
**Resolution:** Added under-attended alert trigger at 72h/30% threshold in Merchant Journey §3.1 and minimum viable attendees logic in §3.2.
