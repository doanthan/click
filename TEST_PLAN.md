# Click — Manual Test Plan

End-to-end test plan for the booking-workflow MVP. Walk through this once after every Stripe-touching change or before each release.

The `/test` route (`http://localhost:3001/test`) is a navigation hub that links every page grouped by access level — use it as the jumping-off point for sections 1–6.

---

## Pre-flight

Tick all four before starting:

- [ ] `.env` has `STRIPE_SECRET_KEY=sk_test_…` (not `STRIPE_PK_KEY` — that name is wrong)
- [ ] `.env` has `STRIPE_WEBHOOK_SECRET=whsec_…` from `stripe listen` output
- [ ] `.env` has `NEXT_PUBLIC_APP_URL=http://localhost:3001` (matches the port Next is actually using)
- [ ] Migration applied: `alter type rsvp_status add value if not exists 'pending_payment';` ran successfully in Supabase

Start three terminals:

```bash
# Terminal A — dev server
npm run dev

# Terminal B — Stripe webhook forwarder
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Terminal C — psql, for spot-checking DB rows (optional)
psql "$DATABASE_URL"
```

Test accounts (from seed data + your own logins):

| Role | How to sign in |
|---|---|
| Attendee | Any Google/email login that hasn't been promoted |
| Merchant | Email matching a merchant in `merchant_profiles`, or sign up via `/merchant/signup` |
| Admin | Email listed in `ADMIN_EMAILS` env var (default `admin@click.local`) |

---

## 1. Smoke pass (no login, no Stripe needed)

Goal: pages render, navigation works, public surface isn't broken.

| # | Action | Expected |
|---|---|---|
| 1.1 | Visit `/` | Hero renders, no marquee strip, subtitle reads "Show up twice. Become familiar." |
| 1.2 | Visit `/test` | Four sections (Public / Logged-in / Merchant / Admin) with one link per route |
| 1.3 | Visit `/events` | Grid of event cards loads (~20 from seed) |
| 1.4 | Click an event image or title | Lands on `/events/[slug]` with full description, suburb, capacity bar, tags |
| 1.5 | Visit `/events/does-not-exist-xyz` | 404 page |
| 1.6 | Visit `/login` | Login form renders, OAuth + credentials options visible |
| 1.7 | Visit `/forgot-password` | Page renders without error |
| 1.8 | Visit `/discover` | AI prompt + event grid renders |
| 1.9 | Visit `/dashboard` while logged out | 307 redirect to `/login?callbackUrl=/dashboard` |
| 1.10 | Visit `/admin` while not an admin | Redirect to login (or 403 if logged in as non-admin) |

---

## 2. Free-event RSVP flow (regression)

Goal: free events still work end-to-end. Don't skip — Stripe changes can break the free path.

| # | Action | Expected |
|---|---|---|
| 2.1 | Log in as an attendee | Lands on `/dashboard` |
| 2.2 | Open a `Free` event detail page (e.g. `/events/coogee-ocean-swim`) | Price shows "Free", green "RSVP" button visible |
| 2.3 | Click RSVP | Button flips to "Cancel RSVP" (peach), success message below |
| 2.4 | Visit `/dashboard` | Event appears under "Upcoming RSVPs", count metric increased |
| 2.5 | Visit `/dashboard/calendar` | Event shows up as a chip on its date in the month grid |
| 2.6 | Click "Cancel RSVP" on the detail page | Button flips back to "RSVP", confirmation message |
| 2.7 | Verify in DB | `select status from event_attendees where event_id = (select id from events where slug = '<slug>') and profile_id = (select id from profiles where email = '<your-email>')` → `cancelled` |

---

## 3. Paid-event booking flow (the main Stripe test)

Goal: locked → reserve → pay → confirmed → calendar. This is Khang's flow.

| # | Action | Expected |
|---|---|---|
| 3.1 | Log in as an attendee | Lands on `/dashboard` |
| 3.2 | From `/events`, click "RSVP" on a paid event card (e.g. Haymarket Dumpling Night $22) | Redirects to `/events/haymarket-dumpling-night` (API returned 402 with `redirectTo`) |
| 3.3 | Detail page shows "Reserve & pay A$22" button (rose) | If you see "Stripe isn't configured", env vars aren't loaded — restart `npm run dev` |
| 3.4 | Click "Reserve & pay A$22" | Button flips to "Reserving seat…" then "Redirecting to Stripe…" |
| 3.5 | Lands on `checkout.stripe.com/...` with the event title, price A$22, your email pre-filled | Stripe-hosted page renders |
| 3.6 | Pay with `4242 4242 4242 4242`, any future expiry (e.g. `12/30`), any CVC (`123`), any AU postcode (`2000`) | Stripe shows success state briefly |
| 3.7 | Auto-redirects to `/dashboard/calendar?booked=haymarket-dumpling-night` | Calendar loads, peach toast "✓ You're in for Haymarket Dumpling Night." visible above the month grid |
| 3.8 | Event chip appears on the correct date | Chip is peach (Confirmed badge), links to detail page |
| 3.9 | Check `stripe listen` terminal | Should show `checkout.session.completed → 200 OK` (and possibly `payment_intent.succeeded → 200 OK`) |
| 3.10 | Verify in DB | `select status from event_attendees where event_id = (select id from events where slug = 'haymarket-dumpling-night') order by updated_at desc limit 1;` → `confirmed` |
| 3.11 | Verify in DB | `select status, amount_cents, stripe_payment_intent_id from payment_transactions order by updated_at desc limit 1;` → `paid`, `2200`, `pi_…` |
| 3.12 | Re-visit `/events/haymarket-dumpling-night` | CTA now shows "Cancel RSVP" (you're confirmed) |

---

## 4. Stripe-side edge cases

### 4.1 Decline path

| # | Action | Expected |
|---|---|---|
| 4.1.1 | Start checkout on a paid event | Lands on Stripe page |
| 4.1.2 | Pay with decline card `4000 0000 0000 0002` | Stripe shows "Your card has been declined" |
| 4.1.3 | After ~10 seconds of retrying | Eventually you can hit back; seat is freed on session expiry |
| 4.1.4 | DB check | `event_attendees.status` for this user/event → `pending_payment` (until session expires) then `cancelled` after webhook fires |

### 4.2 Cancel path (user bails)

| # | Action | Expected |
|---|---|---|
| 4.2.1 | Start checkout, then click "← Back" on the Stripe page | Lands on `/events/[slug]?canceled=1` |
| 4.2.2 | Page shows peach banner "Checkout was cancelled. Your seat hold was released — you can try again any time." | |
| 4.2.3 | DB check | The pending row remains until the session expires (30 min); when `stripe listen` shows `checkout.session.expired`, status flips to `cancelled` |
| 4.2.4 | Force expiry test (optional) | In a different terminal: `stripe trigger checkout.session.expired` and watch the webhook fire |

### 4.3 Seat-hold race (concurrent buyer)

Need two browsers (or normal + incognito) logged in as different users.

| # | Action | Expected |
|---|---|---|
| 4.3.1 | Browser A: find a paid event with exactly 1 seat left | Seats counter shows "1 of N left" |
| 4.3.2 | Browser A: click "Reserve & pay" | Redirects to Stripe (seat is now held as `pending_payment`) |
| 4.3.3 | Browser B (incognito, logged in as different user): visit same event detail page | Seats counter shows "0 of N left" — held seat counts toward capacity |
| 4.3.4 | Browser B: button shows "Join waitlist" instead of "Reserve & pay" | Hold gating works |
| 4.3.5 | Browser A: complete payment | Status flips `pending_payment → confirmed`, B stays on waitlist |

---

## 5. Waitlist + locked events

| # | Action | Expected |
|---|---|---|
| 5.1 | Open `/events/slow-dating-six` (seeded as `Waitlist`) | Status pill says "Waitlist", CTA is "Join waitlist" (peach) regardless of price |
| 5.2 | Click "Join waitlist" | Button flips to "Leave waitlist", DB row inserted as `waitlisted` |
| 5.3 | Visit `/dashboard/calendar` | Event appears with "Waitlist" badge on its date |
| 5.4 | Open a `Locked` event (filter seed for `status='locked'`) | Status pill says "Locked"; location section shows 🔒 + suburb only, no street address |
| 5.5 | Register (free) | After success, refresh the page — full venue + address now revealed |

---

## 6. Auth gates

| # | Action | Expected |
|---|---|---|
| 6.1 | Logged out, open a paid event detail page, click "Reserve & pay" | Login modal opens with callback URL pointing back to the event |
| 6.2 | Log in via the modal | Returns to event detail page (not auto-purchased — by design) |
| 6.3 | Logged out, click RSVP on a free event card | Login modal opens |
| 6.4 | `curl -X POST http://localhost:3001/api/events/<slug>/register` | 401 Unauthorized |
| 6.5 | `curl -X POST http://localhost:3001/api/events/<slug>/checkout` (no Stripe env vars) | 503 |
| 6.6 | `curl -X POST http://localhost:3001/api/webhooks/stripe -d '{}'` (no signature) | 400 (or 503 if Stripe is fully unset) |

---

## 7. Merchant + admin (regression)

| # | Action | Expected |
|---|---|---|
| 7.1 | Log in as merchant, visit `/merchant` | Calendar + events panel render, your events listed |
| 7.2 | Confirmed count includes `pending_payment` rows | (intentional — held seats are taken seats) |
| 7.3 | Open `/merchant/events/[your-event-slug]` | Attendee list renders for `confirmed` + `waitlisted` (held buyers not shown until they pay) |
| 7.4 | Create a new event via the merchant form | New event appears with `Pending` status |
| 7.5 | Log in as admin, visit `/admin` | Pending events queue shows the new event |
| 7.6 | Approve a pending event | Status flips to `Live`; event becomes visible to attendees |

---

## 8. Sign-off checklist

Before declaring "ready":

- [ ] All section 1 boxes ticked (smoke pass)
- [ ] Sections 2 and 3 fully working (free RSVP + paid booking)
- [ ] At least 4.2 (cancel) tested — 4.1 and 4.3 nice-to-have but not blocking for MVP demo
- [ ] Section 5 — locked event + waitlist visible
- [ ] No console errors in browser devtools on any page
- [ ] No 500s in `npm run dev` terminal during the run
- [ ] `stripe listen` shows all webhook deliveries returning `200 OK`

---

## Known limitations (won't fix in MVP)

- Auto-promoting the first waitlister when a paid hold expires — manual via merchant dashboard for now
- Refunds — `'refunded'` enum exists but no UI to trigger
- Email notifications — `notifications` table is in-app only
- Stripe Connect (per-merchant payouts) — platform-take-all for MVP
- `.ics` / Google Calendar export from event detail page

## When something fails

Map of "if X fails, look here":

| Symptom | File |
|---|---|
| Pay button missing on paid detail page | `src/app/events/[slug]/page.tsx` — `isPaid && !isWaitlistMode && !isRegistered` branch + Stripe key |
| 402 from grid RSVP doesn't redirect | `src/components/event-registration-button.tsx` — `response.status === 402 && payload.redirectTo` |
| Webhook silent / not firing | `src/app/api/webhooks/stripe/route.ts` + `STRIPE_WEBHOOK_SECRET` matches `stripe listen` output |
| Hold not freed after abandoned checkout | `markPaymentFailed` in `src/lib/event-repository.ts` |
| Capacity counted wrong | All capacity queries in `event-repository.ts` filter `status in ('confirmed', 'pending_payment')` |
| Calendar toast not showing | `src/components/user-calendar.tsx` — `bookedSlug` prop |
