# Click — QA Feature Checklist
> Updated May 2026. Reflects onboarding redesign, new event states, proposal UI, retention features, two-tier merchant approval, and locked product decisions.

**MVP scope (locked):** No chat / no direct messaging. `/messages` deprecated. Post-mutual-click coordination = Proposal UI only. See §6.2 for deprecation scope, §6.3 for replacement.

---

## 1. Public / Marketing

### 1.1 Home (`/`)
- Hero loads; primary CTA → `/auth` or `/events`
- Featured Events carousel scrolls; each card links to `/events/:id`
- Footer links: no 404s
- Responsive at 375 / 768 / 1330px

### 1.2 How It Works (`/how-it-works`)
- All sections render
- No-chat framing is explicit: "Connection through experiences, not inboxes"
- Signup CTA → `/auth`

### 1.3 Merchant Landing (`/merchant`)
- "Become a merchant" CTA → `/merchant/register`
- Commission model shown as "10% on confirmed bookings only — no listing fee"
- Founding partner deal visible

---

## 2. Authentication

### 2.1 Auth (`/auth`)
- Sign-up creates account; verification email sent (auto-confirm OFF in production)
- Sign-in with confirmed account succeeds; bad credentials rejected with toast
- Role routing on success:
  - `admin` → `/admin-portal`
  - `merchant` (approved) → `/merchant-portal`
  - `merchant` (pending) → `/merchant-pending`
  - `user` (onboarding incomplete) → `/onboarding`
  - `user` (onboarding complete) → `/dashboard`

### 2.2 Legacy auth routes (`/login`, `/register`, `/signup`)
- Redirect to `/auth`; do not maintain separate logic

### 2.3 Admin Login (`AdminLogin.tsx`)
- Non-admin blocked with explicit message (not a generic 403)
- MFA enforced before portal access

### 2.4 Sign Out
- Clears local session + Supabase session
- Redirects to `/`
- All in-memory user data cleared

---

## 3. Onboarding (`/onboarding`) — Redesigned

4 steps + 1 preview screen. `profiles.onboarding_step` persists progress for resumption.

### Step 1 — Basic Info
- Required fields: name, DOB, postcode, gender
- Under-18 DOB: blocked with age-gate message; no profile created
- AU postcode validation (4 digits)
- **No photo upload at this step**
- Browser close → step saved to `profiles.onboarding_step`; resumes on next login

### Step 2 — Intentions
- Intent cards: dating / friends / networking / exploring (multi-select)
- Dating sub-options (gender preference, open_to_dating) visible only when 'dating' selected
- Flexible discovery toggle

### Step 2.5 — Value Preview (not a data step)
- 3 blurred/sample event cards rendered from `onboarding_preview_events` table
- Heading: "Here's what Click looks like for you"
- CTA: "Tell us your interests →"
- **This screen must render before Step 3 — do not skip it**

### Step 3 — Interest Tags
- Visual icon grid (tappable tiles with icon + label) — NOT a text list
- 16 categories visible; no pagination or "show more"
- Selected tiles fill with brand colour
- Counter shown: "3 selected — keep going!"
- Music tags shown as compact secondary row
- Soft minimum 3 tags; user warned but not blocked below 3
- **Life quiz NOT here** — quiz belongs on dashboard post-signup

### Step 4 — Profile Photo + Completion
- Photo upload required — cannot advance without a photo
- Camera + gallery supported on mobile
- Crop UI for square framing
- Upload progress indicator
- On completion: `profiles.onboarding_completed = true`, `profiles.onboarding_completed_at = now()`
- **Completion screen shows no-chat framing copy** (see `06_RETENTION_AND_ENGAGEMENT.md` §7)
- Redirect → `/dashboard`

### Resumption
- User who closed browser at any step resumes from last saved step on next login
- `profiles.onboarding_step` tracks current step (integer 1–4)

---

## 4. User Dashboard (`/dashboard`)

### Core sections
- Greets user by first name
- All sections load independently (parallel queries); skeleton cards while loading
- No section blocks page render

### Suggested for You
- Renders personalised events from `user_event_scores` WHERE score > threshold
- **Cold start fallback:** when < 10 scored events, supplements with trending (7-day bookings) then new (published < 7 days ago) then editorial (`admin_featured = true`)
- Fallback content labelled accurately ("Popular in Sydney" / "Just added" / "Handpicked") — NOT "Suggested for You"
- Empty state (zero events, no fallback available): "New events are being added — check back soon" + browse CTA

### Click Radar
- Shows events with tag overlap + people overlap + trending signal
- Cold start: if < 3 tag-matched events, supplement with nearest-postcode events labelled "Happening near you"

### You Might Click With
- 3 cards, rotate every 4 hours
- Cold start (< 3 scored matches): show 1–2 real matches + quiz prompt card; never show placeholder profiles

### Activity Feed
- Shows last 5 `user_activity` items
- "See your full story →" links to `/profile#activity`
- Empty state (new user): "Your Click story starts here. Book your first event." + browse CTA

### Upcoming Events
- Only confirmed bookings
- Empty state: "Nothing booked yet — browse events below" + 3 suggested event cards

### Notification toasts
- Mutual click: fires; links to profile snapshot
- Waitlist offer: fires with 30-min countdown
- Event 24h reminder: fires
- Post-event prompt: fires 12h after event end

---

## 5. Events Discovery

### 5.1 Events List (`/events`)
- Filters: category, tag, search, date, distance, sort (trending/newest/suggested)
- URL state sync: `?category=`, `?tag=`, `?search=` apply on mount and update reactively
- Pagination: scroll-to-top on page change; skeleton cards while loading
- Reset Filters clears all state
- **Zero results state:** never blank — shows 4 trending events with "Nothing matches — here's what's on this week"
- Data source: Supabase only; no mock data in production path

### 5.2 Event Detail (`/events/:id`)

**Four user states (not three):**

| State | Condition | What renders |
|---|---|---|
| Locked | Not booked, not waitlisted | Event info, saves count, FOMO card (if ≥3 attendees), RSVP CTA |
| Waitlisted | Active waitlist row | Queue position, leave-waitlist option, FOMO card |
| Offer Pending | Live waitlist offer (30-min window) | Offer claim banner with countdown timer; **no FOMO card** |
| Unlocked | Confirmed booking | Full address, attendee count, cancel RSVP |

- Saves count ("47 people saved this") shown in locked state; no minimum threshold
- FOMO card: only when total confirmed ≥ 3 (pilot threshold)
- **Venue address never visible to locked/waitlisted users** — protected at DB level via `get_event_address()` function, not client rendering
- Booking flow: opens inline — Stripe Checkout or modal (per `05_BOOKING_LIFECYCLE.md`)
- State persists across page reload (derived from DB, not client state)
- Logged-out users: locked state + "Sign in to RSVP" CTA → `/auth?redirect=/events/:id`

**Refund policy copy visible on event page for all paid events:**
> "Cancellation: full refund if cancelled 48h+ before event, 50% refund within 24–48h, no refund within 24h."

### 5.3 Bookmarks (`/bookmarks`, `/saved-events`)
- Filter by category/tag works
- Bookmark toggle persists across page reload
- Empty state shown when no bookmarks

### 5.4 Confirmed Events (`/confirmed-events`)
- Split: Upcoming / Past tabs
- Cancel from this page removes booking; triggers refund flow per policy
- Empty state shown for each tab when none

---

## 6. Social / People

### 6.1 People (`/people`)
- Shows You Might Click With cards (same data as dashboard section)
- Clicking another user inserts into `clicks` table
- Mutual click: notification fires; profile snapshot shown (not event suggestion directly)

### 6.2 Messages (`/messages`) — DEPRECATED

**Deprecation scope:**
- Route `/messages` removed from router; navigating directly returns 410 or redirects to `/dashboard` with toast: "Messages aren't a thing here — see your mutual Clicks instead →"
- No nav link, header item, notification, or dropdown anywhere links to `/messages`
- `messages` / `conversations` table writes disabled at RLS layer (INSERT policy = false for all roles except service-role audit reads)
- Existing rows readable by admin only
- No notification template uses the words "message", "inbox", or "chat"

**QA checks:**
- Direct navigation to `/messages` → 410 / redirect (not 404, not blank)
- `INSERT INTO messages` via PostgREST → rejected
- Grep codebase for `href="/messages"`, `to="/messages"`, `"/messages"` → zero results
- All notification copy: no "message" / "inbox" / "chat" language

### 6.3 Proposal UI (post-mutual-click coordination)

**Flow:**
1. Mutual click detected → both users notified "You have a new Click ✨"
2. Tapping notification → **profile snapshot** opens (read-only: photo, name, age, suburb, top 5 tags, bio line, events attended count, intent)
3. From snapshot: CTA "See what's on for you two →" → opens Proposal UI
4. Proposal shows suggested event; options: "Yes, let's go" or "Suggest something else"
5. "Suggest something else" → event picker (catalog only, no free text, max 3 alternatives)
6. Optional: 200-char note field (contact-info blocklist enforced server-side)

**QA checks:**
- Mutual click creates `event_proposals` row with suggested event
- Either user can accept in one tap
- "Suggest something else" restricted to Click catalog; no free text
- Note field rejects: URLs, email addresses, phone numbers, social handles
- Note field accepts: "Looking forward to it!" (innocuous copy passes)
- Max 3 counter-proposals per mutual click (hard limit)
- 7-day expiry triggers; "renew" available exactly once
- Expired proposal: surface removed; click history retained
- Profile snapshot only accessible when `mutual_clicks` row exists between the two users (RLS enforced)

### 6.4 Notifications (`/notifications`)
- Feed shows all notification types in chronological order
- Unread count badge on header icon
- Marking as read clears badge
- Each notification links to relevant route

### 6.5 User Profile (`/profile`, `/profile/:userId`)
- Own profile: shows all fields + full activity feed
- Another user's profile: only accessible via mutual click snapshot (not browsable directly)
- Edit (`/profile/edit`): name, photo, bio, interest tags, music tags, postcode, intentions, dating prefs
- Photo re-crop supported
- Interest tag change queues `user_features_dirty` entry (async rebuild, does not block UI)

---

## 7. Click Life Quiz (`/quiz`)

- Not in onboarding flow
- Prompted from dashboard (day 7 or after first event) via persistent dismissible card
- 7 sections, all skippable
- Completion: `personality_profiles` updated; `user_features_dirty` entry created; `user_activity(type='quiz_completed')` inserted; quiz prompt dismissed permanently
- Confirmation screen: "Your matches just got a lot better"
- Retake any time from profile

---

## 8. Account Settings (`/account-settings`)

- **Account tab:** change email (re-verification required); delete account (soft-delete; 30-day hard-delete cron)
- **Notifications tab:** per-type toggles write to `notification_settings`; weekly digest toggle present; unsubscribe from digest sets `weekly_digest = false`
- **Privacy tab:** dating visibility toggle; profile discoverability toggle; both persist on reload
- **Payments tab:** add/remove Stripe payment methods (note: PayPal listed in codebase — remove or replace with Stripe-only)
- **Security tab:** change password; 2FA setup

---

## 9. Merchant

### 9.1 Merchant Registration (`/merchant/register`, `/merchant-signup`)
- 4-step wizard; single DB insert on Step 4 submit only (no partial rows)
- ABN checksum validation (server-side, not just regex)
- Invalid ABN/ACN rejected at Step 1 with clear error
- Document upload required (ABN cert, insurance); upload failure blocks step advance
- Submission: creates `merchants` row `status='pending'`; merchant role added but portal locked
- Redirect → `/merchant-pending` holding page
- Duplicate ABN: "This ABN is already registered — contact support"

### 9.2 Merchant Pending (`/merchant-pending`)
- Shows: "Application received — we'll be in touch within 1 business day"
- Checklist of what to prepare for first event (static content)

### 9.3 Merchant Portal (`/merchant-portal`)
- Only accessible when `merchants.status = 'approved'`; otherwise redirect to pending page
- Sidebar collapse/expand works; bottom tabs on mobile < 768px
- Tab `?tab=` deep-links correctly
- **All tabs render real Supabase data — no mock data**
- First-time login: onboarding checklist shown in place of normal dashboard until all 5 steps complete

### 9.4 First-Event Onboarding Checklist (new)
- 5 steps: complete profile / connect Stripe / create first event / preview / submit
- Progress bar in portal header until complete
- Checklist persists in `merchant_onboarding_checklist` table
- Each completed step marked with timestamp

### 9.5 Event Creation Wizard (`/merchant/events/create`)
- 5 steps: basics, when/where, capacity+price, media, review
- **Per-step validation blocks "Next"**
- Schedule conflict check: server-side, blocks with conflicting event name + time shown
- Image upload: returns public URL; non-blocking on failure
- Stripe Connect gate: if merchant has no `stripe_account_id` and price > 0 → block with Stripe onboarding prompt
- Commission display: shows merchant net payout at entered price
- Founding partner: shows "$0.00 commission (Founding Partner deal until [date])"
- Submit: `status='pending_review'` for new merchants; `status='published'` for trusted merchants (auto-approve trigger)
- **Created event does NOT appear in `/events` until admin approves (or auto-approved)**
- Event immediately visible in Merchant > Events tab with status badge

### 9.6 Events Management (Merchant > Events)
- Filter: Upcoming / Draft / Pending Review / Past / Cancelled
- Capacity progress bars
- Edit: only description, banner, external URL editable after publish; other changes → back to pending_review
- Cancel: `CancelEventDialog` requires reason; triggers bulk refund + attendee emails

### 9.7 Attendees (Merchant > Attendees)
- Lists bookings with profiles data
- Check-in toggle: flips `bookings.attended = true`; writes `checked_in_at`
- CSV export: first_name, email, booking_date, payment_status, checked_in, checked_in_at
- No PII beyond what's listed above in the CSV

### 9.8 Analytics (Merchant > Analytics)
- Revenue, bookings, capacity utilisation, conversion, commission — all Recharts
- Timeframe selector works; data updates correctly
- Source attribution: shows bookings from weekly digest vs direct
- Export button functional

### 9.9 Under-Attended Alert (new)
- Alert card appears in dashboard when confirmed < 30% capacity AND event within 72h
- Suggested actions shown: boost visibility / lower price / set minimum
- Admin also notified (informational)

### 9.10 Finances / Bookings / Venues / Discounts / Support / Settings
- Finances: shows gross revenue, commission deducted, net payout; Stripe Connect link
- Bookings: same data as Attendees, different view
- Settings: all edits save correctly; payout settings redirect to Stripe

---

## 10. Admin Portal (`/admin-portal/*`)

- Non-admin direct navigation blocked; redirect to `/` (do not confirm portal exists)
- MFA enforced before access

### 10.1 Merchant Approvals
- Queue sorted by `submitted_at ASC` (oldest first)
- **Urgency indicators: amber at 2h, red at 4h** from submission
- Document links: signed URLs generated on demand (30-min expiry)
- Approve: sets `status='approved'`; sends approval email with portal link
- Reject: requires reason (min 20 chars); sends rejection email with reason + resubmit instructions
- Founding partner flag: admin can set `is_founding_partner = true` at approval
- All approvals/rejections logged in `admin_audit_log`

### 10.2 Event Moderation
- Queue: `status='pending_review'` events, oldest first
- Review checklist: tags, title accuracy, photos, no duplicates, Stripe account for paid events
- Approve: `status='published'`; event appears in feeds immediately
- Reject: requires reason; merchant notified with edit instructions
- Unpublish live event: requires reason; refund decision (Yes/No); attendees notified

### 10.3 User Moderation
- List with filters: verified / unverified / flagged / suspended / banned
- Actions: flag, suspend (with duration), ban (permanent), restore
- All actions logged; user notified by email on suspension/ban
- `is_user_active()` function enforced at RLS level — not UI only

### 10.4 Tag Management
- Create tag: label + category + type required
- Edit tag label: cascades to all profiles + events via tag_id FK (label changes, ID never changes)
- Merge tags: confirmation dialog lists affected user + event counts; admin types source tag name to confirm
- Archive: tag hidden from selection UI; existing references preserved
- Category management: create/rename/reorder; delete blocked if tags reference it

### 10.5 Audit Log
- Paginated, newest first
- Filters: actor (admin), action type, date range, target type
- CSV export
- **Append-only** — no delete or edit UI

### 10.6 Platform Analytics
- All metrics live from DB (no caching at MVP)
- Matching quality metrics: mutual-click rate, proposal acceptance rate, suggestion→RSVP rate (per `04_MATCHING_ALGORITHM_V2.md` §7.1)
- Per-cohort breakdowns available

### 10.7 System Settings
- Commission rate change: confirmation dialog; logged
- Maintenance mode toggle: immediate effect via middleware (not React check)
- Cancellation policy: editable via `platform_settings.cancellation_policy` jsonb; changes reflected everywhere `calculate_refund_amount()` is called

---

## 11. Role-Based Portal Switching

- Admin: sees Admin + Merchant + User options in header dropdown
- Merchant (approved): sees Merchant + User options
- Regular user: sees User only
- Switching routes correctly without re-login
- Session persists on switch

---

## 12. Post-Event Retention Loop

### 12.1 Post-Event Prompt
- Appears on dashboard 12h after `events.end_time` for confirmed attendees
- Two responses: "Yes, I clicked with someone" (opens attendee picker) / "Just me this time"
- Both responses dismiss the card and write to `user_activity`
- Attendee picker: shows confirmed attendees (first name + photo); select up to 5
- Selecting attendee: inserts `post_event_clicks`; runs mutual click detection

### 12.2 Post-Event Email
- Sent at same 12h trigger
- Subject: "How was [Event Title]? 🎉"
- CTA buttons deep-link to `/post-event/:event_id`
- `post_event_prompts_sent` idempotency table prevents duplicate sends

### 12.3 Activity Feed
- All `user_activity` event types render correctly
- Milestone events (first booking, 5 events, 10 events) trigger correctly
- Feed on dashboard: last 5 items; "See all" links to `/profile#activity`
- Empty state for new users shows correctly

---

## 13. Weekly Digest Email

- Sends Tuesday 8am AEST to users with no confirmed booking in last 14 days
- Content: 4 personalised events from `user_event_scores` + 1 editorial pick
- Cold start: supplements with trending events if < 4 scored results
- Subject line rotates across 4 variants (A/B tracked in `email_sends`)
- One-tap RSVP links deep-link to `/events/:id?source=weekly_digest`
- Booking from digest: `event_bookings.source = 'weekly_digest'` written for attribution
- Unsubscribe link: sets `notification_settings.weekly_digest = false` without login
- `post_event_prompts_sent` equivalent: `email_sends` table prevents duplicate sends

---

## 14. Cross-Cutting

### 14.1 Header / Navigation
- No link to `/messages` anywhere (grepped, confirmed zero)
- Notifications badge count correct
- Mobile hamburger nav works at 375px
- Logo links to `/` (logged out) or `/dashboard` (logged in)

### 14.2 Footer
- All links functional; no 404s
- Privacy policy, terms of service, refund policy links present
- Refund policy page exists and matches `platform_settings.cancellation_policy`

### 14.3 SEO & Accessibility
- Lazy-loaded routes via `Suspense` + `LoadingSpinner`
- Semantic HTML + alt text on all images
- WCAG 2.1 AA colour contrast (Deep Purple #3b2f81 on Cream #fdfaf6 — verify)
- Keyboard navigation through all forms

### 14.4 Toaster
- Global `sonner` toaster for success/error feedback
- Toast visible on: booking confirmed, cancellation, waitlist join, refund initiated, mutual click

### 14.5 404 / 410
- Unknown routes → `NotFound` page
- `/messages` → 410 or redirect with toast (not 404)

---

## 15. Backend / Data

- **Tables:** All tables in `05_BOOKING_LIFECYCLE.md` §2 exist with correct schemas
- **RLS:** All policies enforced; `has_role()` security-definer function present
- **`pending_bookings`:** separate from `bookings`; TTL cleanup cron active
- **`event_capacity_v`:** view exists and used by booking edge functions
- **`user_features`:** table exists; sync triggers active
- **`admin_audit_log`:** append-only; no UPDATE/DELETE policy
- **Indexes:** `events.merchant_id`, `events.status`, `bookings.event_id`, `user_features.user_id`
- **Realtime:** bookings/attendees updates active
- **Storage buckets:**
  - `event-images`: public read, authenticated write
  - `merchant-documents`: private, signed URLs only
  - `user-avatars`: private, signed URLs only

---

## 16. Smoke-Test Script (End-to-End)

Run in order. Each step must pass before the next.

1. Sign up new account at `/auth` → confirm email → land on `/onboarding`
2. Complete onboarding steps 1–4 (including photo upload at Step 4) → land on `/dashboard`
3. Verify dashboard cold-start: "Suggested for You" shows trending/editorial fallback with correct label (not "Suggested for You")
4. Browse `/events` → filter by category → open a free event → book it → state flips to unlocked → address visible
5. Book a paid event → Stripe checkout → webhook fires → confirmed booking in `/confirmed-events`
6. Cancel the paid booking → refund initiated → removed from confirmed list
7. Join waitlist on a sold-out event → receive offer notification → claim spot within 30 min
8. Register as merchant → submit application → admin approves → merchant portal accessible
9. Merchant: complete onboarding checklist → create event via 5-step wizard → event in pending_review
10. Admin: approve event → event visible in `/events`
11. Book event from 2nd user account → appears in Merchant > Attendees → CSV export works
12. 1st and 2nd user mutually click → profile snapshot appears → proposal UI opens → accept event suggestion
13. Admin: navigate to `/admin-portal` directly from a non-admin account → redirected to `/`
14. Navigate to `/messages` directly → 410 / redirect with toast
15. Post-event (or simulate): post-event prompt appears → select attendee → mutual click detected
16. Verify weekly digest cron sends correctly to a test account inactive for 14+ days
