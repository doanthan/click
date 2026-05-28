# Click — Master Document Index
> Single source of truth for what lives where. Read this before touching any spec.
> Last updated: May 2026

---

## Document Map

| File | Canonical for | Status |
|---|---|---|
| `00_MASTER_INDEX.md` | Navigation — this file | ✅ Current |
| `01_USER_JOURNEY.md` | User auth, onboarding, dashboard, booking UX, social click flow, post-event loop | ✅ Current |
| `02_MERCHANT_JOURNEY.md` | Merchant registration, approval, portal, event creation, attendee mgmt, finances | ✅ Current |
| `03_ADMIN_JOURNEY.md` | Admin access, merchant/event/user moderation, tag management, audit log | ✅ Current |
| `04_MATCHING_ALGORITHM_V2.md` | Matching engine: feature engineering, cohort weights, scoring, evaluation, build order | ✅ Current — **use this, not §3 of `04_TAG_AND_MATCHING_DATA_FLOW.md`** |
| `04_TAG_AND_MATCHING_DATA_FLOW.md` | How tags connect merchant events → user feeds; FOMO generation; feed population | ✅ Current — §3 scoring weights superseded by `04_MATCHING_ALGORITHM_V2.md` |
| `05_BOOKING_LIFECYCLE.md` | Booking state machine, Stripe integration, pending reservation pattern, waitlist, refund policy, all schemas | ✅ Current — **canonical booking reference** |
| `05_EVENT_STATE_MACHINE.md` | Locked/unlocked/waitlist UX states, FOMO rules, capacity display, cancellation policy | ✅ Current — booking implementation detail defers to `05_BOOKING_LIFECYCLE.md` |
| `06_INFRASTRUCTURE_FIXES.md` | Engineering tickets: pending bookings race fix, realtime refetch, sub-tags, proposal UI deprecation of /messages | ✅ Current |
| `06_RETENTION_AND_ENGAGEMENT.md` | Weekly digest email, activity feed, post-event loop, milestone notifications, no-chat copy framework | ✅ Current |
| `QA_FEATURE_CHECKLIST.md` | QA validation checklist for every route and feature | ✅ Updated (this session) |

---

## How the Documents Relate

```
PRODUCT DECISIONS (what we're building)
  01_USER_JOURNEY.md          ← user experience, UX flows, onboarding, social
  02_MERCHANT_JOURNEY.md      ← merchant experience, portal, events
  03_ADMIN_JOURNEY.md         ← admin operations, moderation, settings
  06_RETENTION_AND_ENGAGEMENT.md ← re-engagement, digest, activity feed

        ↓ references

TECHNICAL IMPLEMENTATION (how we're building it)
  04_MATCHING_ALGORITHM_V2.md     ← matching engine, ML pipeline, feature store
  04_TAG_AND_MATCHING_DATA_FLOW.md ← tag pipeline, feed population, FOMO
  05_BOOKING_LIFECYCLE.md         ← booking, payment, waitlist, refund (schemas + edge fns)
  05_EVENT_STATE_MACHINE.md       ← event UI states, capacity display, cancellation policy
  06_INFRASTRUCTURE_FIXES.md      ← engineering tickets, race conditions, deprecations

        ↓ validated by

QA & TESTING
  QA_FEATURE_CHECKLIST.md         ← every route, every feature, every check
```

---

## Conflicts Resolved

The following inconsistencies existed across documents. These are the resolutions — if in doubt, use this table.

| Topic | Correct answer | Source |
|---|---|---|
| Event status on merchant submit | `pending_review` (not `published`) | `02_MERCHANT_JOURNEY.md` §5 |
| Booking table name | `bookings` (not `event_bookings`) | `05_BOOKING_LIFECYCLE.md` §2.2 |
| Pending reservation table | Separate `pending_bookings` table (not a status on `bookings`) | `05_BOOKING_LIFECYCLE.md` §2.1 |
| Stripe integration method | Stripe Checkout session with redirect (not Payment Element) | `05_BOOKING_LIFECYCLE.md` §3.1 — Checkout provides hosted page; Payment Element is embedded. Use Checkout for MVP simplicity; Payment Element is an enhancement for Phase 2. |
| Waitlist offer window | 30 minutes | `05_BOOKING_LIFECYCLE.md` §2.3 (`offer_expires_at = offered_at + 30 min`) |
| FOMO minimum attendees (pilot) | 3 | `05_EVENT_STATE_MACHINE.md` §2a |
| Photo in onboarding | Step 4 (not Step 1) | `01_USER_JOURNEY.md` §2 |
| Click Life Quiz | Post-signup dashboard prompt (not in onboarding) | `01_USER_JOURNEY.md` §11 |
| Matching weights | Cohort-learned logistic regression (not static %) | `04_MATCHING_ALGORITHM_V2.md` §3 |
| Proposal UI note field | ≤200 chars with contact-info blocklist (not free-text) | `06_INFRASTRUCTURE_FIXES.md` T5 |
| Refund policy | 100% >48h / 50% 24–48h / 0% <24h / 100% merchant cancel | `05_EVENT_STATE_MACHINE.md` §6 |
| Trusted merchant auto-approve | After 3 clean events, zero disputes | `02_MERCHANT_JOURNEY.md` §2 |
| Commission — founding merchants | 0% for 3 months from approval | `02_MERCHANT_JOURNEY.md` §2 |

---

## Build Order (Dev Team)

This is the sequence that unblocks the most work fastest and avoids shipping correctness bugs.

**Week 1 — Foundation (nothing else ships until these are done)**
- [ ] T4: Remove social scraping code entirely (`06_INFRASTRUCTURE_FIXES.md` T4)
- [ ] Schema migrations: `pending_bookings`, `bookings` enum, `waitlist`, `refund_failures`, `event_capacity_v` (`05_BOOKING_LIFECYCLE.md` §2)
- [ ] `user_features` table + sync triggers (`04_MATCHING_ALGORITHM_V2.md` §1.4, §10 step 1)

**Week 2 — Booking correctness (P0 blocker for any paid events)**
- [ ] T1: `create-stripe-checkout` edge fn with pending reservation pattern
- [ ] T1: `stripe-webhook` handler with idempotency
- [ ] T1: Cleanup cron for expired pending rows
- [ ] T2: Pull-on-focus refetch on dashboard (`06_INFRASTRUCTURE_FIXES.md` T2)

**Week 3 — Matching engine**
- [ ] Sub-tag taxonomy + `events.sub_tags` column + `derive-event-sub-tags` edge fn (`04_MATCHING_ALGORITHM_V2.md` §1.3, §10 steps 2–4)
- [ ] Candidate generation queries + materialised views (`04_MATCHING_ALGORITHM_V2.md` §10 steps 5–7)
- [ ] `match_impressions` table (`04_MATCHING_ALGORITHM_V2.md` §10 step 9)

**Week 4–5 — Proposal UI (replaces /messages)**
- [ ] T5 schema: `mutual_clicks`, `event_proposals` tables
- [ ] T5 edge functions: proposal-accept, proposal-decline, proposal-counter, proposal-add-note
- [ ] T5 deprecation: `/messages` route removed, RLS disabled on messages tables
- [ ] Profile snapshot RLS policy (mutual-click-gated read)
- [ ] Client: ProposalCard, EventPicker, NoteInput, DeclineModal components

**Week 5–6 — Retention & UX**
- [ ] Post-event prompt cron + `post_event_prompts_sent` idempotency table
- [ ] `user_activity` table + triggers
- [ ] Weekly digest edge fn + `email_sends` table
- [ ] Onboarding redesign: visual tag grid, value preview screen (Step 2.5), photo at Step 4
- [ ] Cold start fallback feed (trending/new/editorial when scores < 10)
- [ ] Activity feed on dashboard + profile page
- [ ] Milestone notifications

**Week 6–7 — Merchant tools**
- [ ] Two-tier approval: trusted merchant flag + auto-approve trigger
- [ ] 4-hour SLA queue indicator in admin portal
- [ ] First-event onboarding checklist
- [ ] Under-attended alert (72h/30% trigger)
- [ ] Minimum viable attendees field + decision flow

**Pre-launch gates (must be green before first public user)**
- [ ] All P0/P1 tickets from `06_INFRASTRUCTURE_FIXES.md` closed
- [ ] Refund policy copy on every event page and booking confirmation email
- [ ] `/messages` route returning 410 or redirect
- [ ] No mock/seed data in any production query path
- [ ] RLS linter clean (`supabase--linter`)
- [ ] Load test: 50 concurrent RSVPs on a 10-seat event → 10 confirmed, 40 sold_out, 0 overbooked
- [ ] Stripe webhook signature verification active
- [ ] Admin MFA enforced
- [ ] `event-images` bucket: public read, authenticated write only
- [ ] `merchant-documents` bucket: private, signed URLs only

---

## Non-Negotiables (Do Not Change Without Product Sign-Off)

These are locked decisions. Do not re-open in engineering without a written product decision.

| Decision | Rationale |
|---|---|
| No chat / no direct messaging | Core product differentiator. Revisit only with post-MVP evidence of unmet need. |
| Proposal UI is the only post-mutual-click surface | Prevents Click becoming an inbox. All coordination via events. |
| Note field in proposals ≤200 chars with contact blocklist | Prevents circumvention of no-chat decision. |
| Event status on merchant submit = `pending_review` | Prevents unapproved content appearing in feeds. Trusted merchants auto-approve via DB trigger. |
| Refund policy is platform-defined, merchants cannot override | Consistency protects user trust. Merchants knew the policy on sign-up. |
| Photo required before RSVP | Reduces anonymity, increases accountability, improves FOMO card quality. |
| Founding merchant deal: 0% commission for 3 months | Locked deal for first 35 merchants. Change requires contacting those merchants. |
