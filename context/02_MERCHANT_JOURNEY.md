# Click — Merchant Journey
> Developer implementation spec. Updated May 2026 to include two-tier event approval, trusted merchant auto-approve, 4-hour SLA queue, first-event onboarding checklist, under-attended event handling, and founding merchant deal logic.

---

## 0. Design Constraints

- **Merchants cannot self-approve.** All new applications require admin sign-off.
- **Event scheduling conflicts enforced at DB layer**, not UI only.
- **Click-managed events own capacity.** External-booking events use informational capacity only.
- **No event published without at least one Interest Tag.**
- **ABN validation is server-side** — not just client regex.
- **Admin event approval has a 4-hour SLA** for new merchants. Trusted merchants auto-approve.
- **Refund policy is platform-defined and immutable by merchants** — they cannot set their own.

---

## 1. Merchant Registration (`/merchant/register`)

4-step wizard. Single `INSERT merchants` row on final submit only — no partial rows per step.

### Step 1 — Business Details
| Field | DB Column | Validation |
|---|---|---|
| Business name | `merchants.business_name` | Required, 2–100 chars |
| Trading name | `merchants.trading_name` | Optional |
| ABN | `merchants.abn` | Required; 11-digit; checksum validation (see below) |
| ACN | `merchants.acn` | Optional; 9-digit |
| Business type | `merchants.business_type` | Enum: sole_trader / company / partnership / trust |
| Event category focus | `merchants.event_categories` | Multi-select from categories table; min 1 |

**ABN Validation (server-side, `src/utils/merchant/abn-validation.ts`):**
```typescript
// 1. Strip spaces, confirm 11 digits
// 2. Subtract 1 from first digit
// 3. Multiply each digit by weighting [10,1,3,5,7,9,11,13,15,17,19]
// 4. Sum products; valid if sum % 89 === 0
// Optional: verify against ABR API (requires ABR_GUID env var)
```

### Step 2 — Contact & Address
| Field | DB Column | Validation |
|---|---|---|
| Contact email | `merchants.contact_email` | Required; valid email |
| Phone | `merchants.phone` | Required; AU format |
| Street address | `merchants.address_street` | Required |
| Suburb | `merchants.address_suburb` | Required |
| State | `merchants.address_state` | Required; AU state enum |
| Postcode | `merchants.address_postcode` | Required; 4-digit AU |

### Step 3 — Documents (Storage: `merchant-documents` — private; signed URLs only)
| Document | DB Column | Required |
|---|---|---|
| ABN certificate | `merchants.doc_abn_url` | ✅ |
| Public liability insurance | `merchants.doc_insurance_url` | ✅ |
| Liquor licence | `merchants.doc_liquor_url` | Only if alcohol events planned |

### Step 4 — Review & Submit
- Read-only summary
- On submit: `INSERT merchants(status='pending', submitted_at=now())`
- `INSERT user_roles(user_id, role='merchant')` — portal access blocked until status='approved'
- Redirect → `/merchant-pending`

**Post-submission:**
- Admin notified in approval queue
- Merchant receives auto-email: "Application received — we'll be in touch within 1 business day"
- Merchant sees holding page with checklist of what to prepare for their first event

**Failure modes:**
- ABN already in `merchants` table → "This ABN is already registered. Contact support."
- Document upload fails → inline error; do not advance step
- Double-submit → unique constraint on `merchants.abn` catches duplicate

---

## 2. Admin Approval → Portal Unlock

### Two-tier approval system (New)

**Tier 1 — New merchants:** Full admin review required. Target SLA: **4 hours** from submission during business hours. Admin portal surfaces a queue urgency indicator: amber at 2h, red at 4h.

**Tier 2 — Trusted merchants:** After a merchant has 3 events approved with zero moderation issues and zero refund disputes, they are flagged `merchants.trusted = true`. Subsequent event submissions by trusted merchants **auto-approve** without admin review.

```sql
-- Auto-approve logic (runs on events INSERT for trusted merchants):
CREATE OR REPLACE FUNCTION auto_approve_trusted_merchant_event()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM merchants
    WHERE id = NEW.merchant_id AND trusted = true
  ) THEN
    NEW.status := 'published';
    NEW.approved_at := now();
    NEW.approved_by := 'system_auto';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_approve_on_insert
  BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION auto_approve_trusted_merchant_event();
```

Trusted status can be revoked by admin at any time (`UPDATE merchants SET trusted=false`). Revocation is logged in `admin_audit_log`.

### Approval flow (new merchants)
```
Admin opens pending merchant application
  │
  ▼
Checklist:
  ✓ ABN checksum valid (pre-validated — show result)
  ✓ Insurance doc uploaded + not expired
  ✓ Business name not already active in system
  ✓ No prior ban/rejection on this user account
  │
  ├─ Approve:
  │    UPDATE merchants SET status='approved', verified_at=now(), verified_by=auth.uid()
  │    logAdminAction('merchant_approved', merchant_id)
  │    Edge fn: send-merchant-approval-email (includes portal URL + first-event guide link)
  │
  └─ Reject:
       Admin enters rejection_reason (required, min 20 chars)
       UPDATE merchants SET status='rejected', rejection_reason, rejected_by=auth.uid()
       logAdminAction('merchant_rejected', merchant_id, {reason})
       Edge fn: send-merchant-rejection-email (includes reason + resubmit instructions)
```

### Founding merchant flag
```sql
-- Add to merchants table:
merchants.is_founding_partner  boolean DEFAULT false
merchants.founding_deal_expiry timestamptz  -- 3 months from approval

-- Effects:
-- commission_rate = 0 while now() < founding_deal_expiry
-- badge: "Founding Partner" shown on event cards and merchant profile
-- feed placement: slight boost in suggested rankings during founding period
```

Admin sets `is_founding_partner = true` at approval for first 35 merchants. After founding_deal_expiry, standard 10% commission applies automatically.

---

## 3. Merchant Portal (`/merchant-portal`)

Sidebar (desktop) / bottom tabs (mobile < 768px). State synced to `?tab=` query param.

| Tab | Hook | Source |
|---|---|---|
| Dashboard | `useMerchantAnalytics` | Aggregated `events` + `event_bookings` |
| Events | `useMerchantEvents` | `events WHERE merchant_id = current` |
| Attendees | `useEventBookings` | `event_bookings` JOIN `profiles` |
| Bookings | `useEventBookings` | Same, different view |
| Analytics | `useMerchantAnalytics` | Revenue + conversion time-series (Recharts) |
| Finances | `useMerchantFinances` | Stripe Connect payouts |
| Venues | `useMerchantVenues` | `venues` table |
| Discounts | `useMerchantDiscounts` | `discount_codes` table |
| Support | `useSupportTickets` | `support_tickets` table |
| Settings | `useMerchant` | `merchants` row |

### Dashboard tab widgets
| Widget | Data |
|---|---|
| Total active events | `COUNT(events WHERE status='published')` |
| Confirmed attendees (all time) | `COUNT(event_bookings WHERE status='confirmed')` |
| Revenue this month | `SUM(event_bookings.amount_paid)` — Click-managed only |
| Commission paid this month | `revenue × commission_rate` |
| Upcoming events (next 5) | Ordered by `start_time`; capacity progress bars |
| Recent bookings (last 10) | First name + event title + booked_at |
| Under-attended alert | See §3.1 |

### 3.1 Under-Attended Event Alert (New)

A merchant event is flagged as under-attended when:
```sql
-- Trigger: runs 72h before event start_time
confirmed_count < (events.capacity * 0.3) AND events.start_time < now() + interval '72h'
```

When triggered:
- Merchant sees alert card in dashboard: "⚠️ [Event] is at [X]% capacity — 3 days to go"
- Suggested actions shown in portal:
  1. "Boost visibility" — marks event as `admin_featured = true` for 48h (free during pilot)
  2. "Lower the price" — merchant can reduce price (edit event → Step 3)
  3. "Set a minimum" — merchant can set `minimum_viable_attendees` (see §3.2)
- Admin also notified (for awareness, not required to act)

### 3.2 Minimum Viable Attendees (New)

Merchants can optionally set a minimum number of attendees for an event to proceed.

```sql
events.minimum_viable_attendees  int DEFAULT NULL  -- null = always runs
events.minimum_decision_hours    int DEFAULT 24    -- hours before event to make call
```

**If minimum is set and not reached by decision time:**
```
Cron: check_event_viability() runs every hour
  IF confirmed_count < minimum_viable_attendees
  AND start_time < now() + (minimum_decision_hours * interval '1 hour'):
    │
    ▼
  Merchant receives notification: "Your event has [X] attendees — minimum was [Y].
  You have [Z] hours to decide: run it anyway or cancel with full refunds."
  │
  Merchant options:
  ├─ "Run it anyway" → event proceeds; minimum_met = true; no attendee notification
  └─ "Cancel event" → same as merchant-initiated cancellation (§5)
               → 100% refund to all attendees regardless of timing
               → Email all attendees: "Event cancelled — full refund issued"
```

This prevents the awkward scenario of 2 people showing up to a 20-person cooking class.

---

## 4. First-Event Onboarding Checklist (New)

When a merchant is approved and logs in for the first time, show a **first-event checklist** in place of the normal dashboard. Do not show an empty portal — it causes abandonment.

```
Welcome to Click! Here's how to get your first event live in 15 minutes:

□ Complete your business profile (logo, description, social links)
□ Connect Stripe for payments (required for paid events)
□ Create your first event (use our guide for best results)
□ Preview how your event appears to Click users
□ Submit for review

[ Start: Complete your profile → ]
```

**DB:**
```sql
merchant_onboarding_checklist(
  merchant_id  uuid REFERENCES merchants(id),
  step         text,   -- 'profile' | 'stripe' | 'first_event' | 'preview' | 'submitted'
  completed_at timestamptz
)
```

Checklist persists until all 5 steps completed. After completion, normal dashboard shown. Progress bar visible in portal header until complete.

**First-event tips shown inline during event creation wizard (new merchant only):**
- Step 1: "Strong titles include the activity + vibe: 'Thursday Pottery for Beginners' not 'Pottery Class'"
- Step 2: "Inner-city Sydney events fill fastest. Surry Hills, Newtown, Darlinghurst are your best starting suburbs."
- Step 3: "Smaller, intimate events (10–20 people) convert better on Click than large ones. Save large events for after you've built an audience."
- Tags: "Pick all relevant tags — users filter by these. A cooking class can have: Food, Social, Learning, Creative."

---

## 5. Event Creation Wizard (`/merchant/events/create`)

5-step wizard. Single `INSERT events` on final submit.

### Step 1 — Basics
| Field | DB Column | Validation |
|---|---|---|
| Event title | `events.title` | Required, 5–100 chars |
| Description | `events.description` | Required, 20–2000 chars |
| Category | `events.category_id` | Required; FK to `categories` |
| Interest tags | `event_interest_tags` join table | Required; min 1; visual chip selector |
| Booking type | `events.booking_type` | Enum: click_managed / external |
| External URL | `events.external_booking_url` | Required if booking_type='external' |
| Minimum viable attendees | `events.minimum_viable_attendees` | Optional; integer > 0 |

### Step 2 — When & Where
| Field | DB Column | Validation |
|---|---|---|
| Start date/time | `events.start_time` | Required; future |
| End date/time | `events.end_time` | Required; > start_time |
| Venue name | `events.venue_name` | Required |
| Street address | `events.venue_address` | Required |
| Suburb | `events.venue_suburb` | Required |
| State | `events.venue_state` | Required; AU state enum |
| Postcode | `events.venue_postcode` | Required |
| Lat/lng | `events.lat`, `events.lng` | Auto via Mapbox geocoding on address input |

**Schedule conflict check (server-side):**
```sql
SELECT COUNT(*) FROM events
WHERE merchant_id = current_merchant_id
  AND status IN ('published', 'pending_review', 'draft')
  AND NOT (end_time <= $start_time OR start_time >= $end_time);
-- If > 0: block with "You have another event during this time: [title]"
```

### Step 3 — Capacity & Price
| Field | DB Column | Validation |
|---|---|---|
| Capacity | `events.capacity` | Required; integer > 0 |
| Price | `events.price` | Required; 0.00 for free |
| Currency | `events.currency` | Default 'AUD' |

**Stripe Connect gate:** If `merchants.stripe_account_id IS NULL` and price > 0: block with "Connect Stripe to accept payments" + link to Stripe onboarding. Do not allow paid events from merchants without Stripe.

**Commission display:** Show merchant the net payout at this price:
> "You'll receive $[price × (1 - commission_rate)] per confirmed booking. Click's commission: $[price × commission_rate]."

### Step 4 — Media
| Field | DB Column | Notes |
|---|---|---|
| Banner image | `events.banner_image_url` | Storage: `event-images` (public bucket) |
| Gallery images | `event_images` join table | Optional; max 5 |

Stored at `event-images/{merchant_id}/{event_id}/{filename}`. Upload returns public URL.

### Step 5 — Review & Submit
- Read-only summary of all fields
- **Founding merchant:** Show "Founding Partner Commission: $0.00 (Free until [date])"
- Submit: `INSERT events(status='pending_review', submitted_at=now())`
  - Trusted merchant: trigger auto-approves → status becomes 'published' immediately
  - New merchant: status stays 'pending_review'; admin queue notified
- Merchant sees event in their Events tab immediately with status badge

**Failure modes:**
- Mapbox geocoding fails: manual lat/lng entry fallback; do not block submission
- Image upload fails: non-blocking warning; submission proceeds without image
- Schedule conflict: hard block with conflicting event name + time

---

## 6. Event Lifecycle

### Statuses
| Status | User visible | Merchant editable | Notes |
|---|---|---|---|
| `draft` | ❌ | ✅ full | Not submitted |
| `pending_review` | ❌ | ✅ limited | Awaiting admin |
| `published` | ✅ | ✅ limited | Live |
| `cancelled` | ❌ | ❌ | Refunds triggered |
| `completed` | ❌ | ❌ | Past end_time |

**Editable after publishing:** description, banner_image, external_booking_url only. Title/date/capacity/price changes → set status back to 'pending_review' for re-review (except trusted merchants: auto-approve applies to edits too).

### Event cancellation
```
Merchant: Cancel Event → CancelEventDialog (requires reason, min 20 chars)
  │
  ▼
UPDATE events SET status='cancelled', cancellation_reason, cancelled_at
  │
  ▼
Edge fn: cancel-event-bookings(event_id)
  FOR EACH confirmed booking:
    100% Stripe refund (regardless of timing — merchant cancellation always full refund)
    UPDATE event_bookings status='cancelled'
    Email attendee: "Event cancelled — full refund of $X in 3–5 business days"
  │
  UPDATE event_waitlists status='cancelled' (active + offered)
  UPDATE waitlist_offers status='cancelled' (pending)
  UPDATE event_bookings status='cancelled' (pending_waitlist)
  Email waitlisted users: "Event cancelled — you were not charged"
```

Stripe refund failures: log to `payment_transactions(refund_status='failed')`, continue loop, surface to admin.

---

## 7. Attendee Management

### Attendees tab
- All `event_bookings` JOIN `profiles` for this merchant's events
- Columns: name, email, RSVP date, payment status, check-in status
- Filters: by event, by status (confirmed / cancelled / checked_in)

### Check-in
```sql
UPDATE event_bookings
  SET checked_in = true, checked_in_at = now()
  WHERE id = $booking_id
    AND event_id IN (SELECT id FROM events WHERE merchant_id = current_merchant_id)
-- RLS: merchant can only update bookings on their own events
```

### CSV export
Columns: first_name, email, booking_date, payment_status, checked_in, checked_in_at.
Excludes: full address, DOB, private profile data.

---

## 8. Analytics

All queries scoped to `merchant_id = current`. No mock data.

| Metric | Source | Chart |
|---|---|---|
| Revenue over time | `SUM(amount_paid) GROUP BY date` | Line (Recharts) |
| Bookings per event | `COUNT(event_bookings) GROUP BY event_id` | Bar |
| Capacity utilisation | `(confirmed / capacity) × 100` | Progress bars |
| Conversion: views → bookings | `event_views` / `event_bookings` per event | Table |
| Commission paid | `SUM(amount_paid) × commission_rate` | Summary card |
| Top tags by bookings | JOIN `event_interest_tags` | Horizontal bar |
| Source attribution | `event_bookings.source` (weekly_digest / direct / etc.) | Pie |

Timeframe selector: 7 / 30 / 90 days / All time. URL param `?timeframe=`.

---

## 9. Finances

### Commission rates
| Merchant type | Rate | Notes |
|---|---|---|
| Founding partner (within deal period) | 0% | Until `founding_deal_expiry` |
| Standard | 10% | On all Click-managed confirmed bookings |

**Stripe Connect:** Merchant must complete Stripe Connect onboarding before creating paid events. Gate enforced at event creation wizard Step 3.

**Payout:** Weekly cron `merchant-payout`. Transfers `SUM(confirmed bookings) × (1 - commission_rate)` to merchant's Stripe account. Platform retains commission.

---

## 10. Settings

| Tab | Editable |
|---|---|
| Business Profile | trading_name, contact_email, phone, address, logo, description |
| Notifications | Email preferences for bookings, cancellations, capacity alerts, under-attended alerts |
| Security | Password, 2FA |
| Payout | Stripe Connect management (redirects to Stripe) |
| Danger Zone | Request account deletion (admin review) |

---

## Appendix: Key RLS Policies (Merchant Scope)

```sql
-- Merchants read/write only their own merchant row
CREATE POLICY "merchant_own_row" ON merchants
  FOR ALL USING (auth.uid() = user_id);

-- Merchants read/write only their own events
CREATE POLICY "merchant_own_events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = events.merchant_id
        AND merchants.user_id = auth.uid()
        AND merchants.status = 'approved'
    )
  );

-- Merchants read bookings on their own events
CREATE POLICY "merchant_event_bookings" ON event_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      JOIN merchants ON merchants.id = events.merchant_id
      WHERE events.id = event_bookings.event_id
        AND merchants.user_id = auth.uid()
    )
  );
```
