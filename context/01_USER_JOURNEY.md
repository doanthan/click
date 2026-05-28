# Click — User Journey
> Developer implementation spec. Updated May 2026 to include onboarding redesign, cold start states, mutual click profile snapshot, activity feed, and post-event retention loop.

---

## 0. Design Constraints (Non-Negotiable)

- **No chat. No direct messaging.** Post-mutual-click coordination is the Proposal UI only. Frame no-chat as a feature in every onboarding touchpoint — not a missing feature.
- **No anonymous RSVP or Click actions** — email verification enforced at DB layer, not UI.
- **State is derived from the DB on every render.** UI never assumes booking or access state.
- **Cold start is a first-class problem.** When scored data is thin, fall back to editorial/trending — never show an empty feed.
- **Clicks are anonymous until mutual** — never expose a one-way click to the target.

---

## 1. Authentication & Account Creation

### Entry points
- `/auth` — primary (email/password + Google OAuth)
- `/register`, `/signup` — legacy aliases; redirect to `/auth`

### 1.1 Sign Up
- User submits email + password
- Supabase Auth creates `auth.users` row
- `handle_new_user()` trigger fires:
  - INSERT `profiles(id, email, created_at)`
  - INSERT `user_roles(user_id, role='user')`
- Verification email sent via Resend
- Redirect → `/onboarding` (never dashboard)

### 1.2 Email Verification Gate
Hard gates enforced at RLS — not UI conditionals:
- RSVP / booking creation
- "Click with Someone" actions
- Appearing in match feeds

Unverified users may: browse `/events` (locked state), view public event cards only.

Gate check: `SELECT email_confirmed_at FROM auth.users WHERE id = auth.uid()` — null = blocked.

### 1.3 Google OAuth
- Same `handle_new_user()` trigger fires
- Skips email verification gate (Google confirms email)
- Flag: `profiles.auth_provider = 'google'`

### 1.4 Sign In — Role Routing
| Role | Redirect |
|---|---|
| `admin` | `/admin-portal` |
| `merchant` only | `/merchant-portal` |
| `user`, onboarding incomplete | `/onboarding` |
| `user`, onboarding complete | `/dashboard` |

### Failure modes
- Duplicate email → "Account already exists — sign in instead"
- Unconfirmed email hits gate → 403 from RLS + verification nudge banner
- `handle_new_user()` fails → orphaned `auth.users` row; recovery check on first dashboard load

---

## 2. Onboarding (`/onboarding`)

**Redesigned.** Previous 4-step flow had a critical drop-off problem at Step 3: too much tag selection too soon, no demonstrated value, photo gate was ambiguous. New flow below.

Completion writes `profiles.onboarding_completed = true`. Mid-flow progress saved to `profiles.onboarding_step` so users can resume.

### Step 1 — Basic Info
| Field | DB Column | Validation |
|---|---|---|
| First name | `profiles.full_name` | Required, 2–50 chars |
| Date of birth | `profiles.date_of_birth` | Required; must be 18+ |
| Postcode | `profiles.postcode` | Required; AU 4-digit |
| Gender | `profiles.gender` | Required; enum: male / female / non-binary / prefer-not-to-say |

**No photo here.** Photo is collected at Step 4. Asking for it at Step 1 increases abandonment with no benefit — the user hasn't decided they trust the platform yet.

**Under-18 DOB:** Block at validation. Do not create profile. Show age-gate message. Do not redirect to signup.

### Step 2 — Intentions
| Field | DB Column | Notes |
|---|---|---|
| Connection intent | `profiles.connection_intent` | Array enum: dating / friends / networking / exploring |
| Open to dating | `profiles.open_to_dating` | Boolean; shown only if 'dating' selected |
| Dating gender preference | `profiles.dating_preference` | Enum: men / women / everyone; conditional |
| Flexible discovery | `profiles.flexible_discovery` | Boolean; enables cross-intent suggestions |

### Step 2.5 — Value Preview (not a data-collection step)
After Step 2, before the tag step, show a **preview screen**:
- Heading: "Here's what Click looks like for you"
- 3 blurred/sample event cards styled to their stated intentions
- Copy: "Tell us your interests and we'll surface real events like these"
- CTA: "Let's do it →"

This earns Step 3. Users who understand what they're building toward complete the tag step at significantly higher rates. Do not skip this screen.

**Implementation:** Static/curated sample cards per intent type stored in `onboarding_preview_events` table. No matching engine needed here.

### Step 3 — Interest Tags (Redesigned)
**UI requirement: visual icon grid, not a list.** Each category is a tappable tile with icon + label. Selected tiles fill with brand colour. Target: complete in under 60 seconds on mobile.

| Field | DB Column | Notes |
|---|---|---|
| Interest tags | `profile_interest_tags(profile_id, tag_id)` | Soft minimum 3; counter shown ("3 selected — keep going!") |
| Music tags | `profiles.music_tags` (array) | Shown as a secondary compact row below main grid |

**Life tags and the quiz are not here.** Quiz belongs post-signup on the dashboard as an engagement prompt, not in onboarding. Putting it here kills completion rates.

Display tags grouped by category with category headers. 16 categories, show all. Let the user scroll — do not paginate or hide categories behind a "show more."

### Step 4 — Profile Photo + Completion
| Field | DB Column | Notes |
|---|---|---|
| Profile photo | `profiles.avatar_url` (Storage: `user-avatars`) | Required here; cannot skip |

**Why required here and not earlier:** By Step 4 the user has invested 3 steps. Completion rate for photo upload at Step 4 is significantly higher than at Step 1. Requiring it here also means the RSVP gate (photo required) is already satisfied before they hit any events.

Photo upload must be:
- Mobile camera + gallery supported
- Crop UI for square framing
- Upload progress indicator
- On success: writes `profiles.avatar_url`, triggers `profiles.onboarding_completed = true`

**No-chat framing — shown on completion screen:**
> "Click is different. No endless texting. When you both Click on someone, we suggest a real event to go to together. Connection through experience, not inboxes."

This must appear on the completion screen. It sets expectations before the user hits the dashboard and looks for a message button.

Redirect → `/dashboard`

### Edge cases
- Browser close mid-onboarding: resume from `profiles.onboarding_step` on next login
- Skipping Step 3 tags entirely: allow with a soft warning ("Your suggestions will be limited without interests — you can add them anytime"); algorithm uses partial data + trending fallback
- Photo upload fails: show retry; do not advance to dashboard without a photo

---

## 3. Dashboard (`/dashboard`)

All sections load independently via parallel queries. Never block the page on a slow section — skeleton cards while loading.

### 3.1 Sections

| Section | Source | Refresh | Empty state |
|---|---|---|---|
| **Upcoming Events** | `event_bookings` JOIN `events` | Realtime | "Nothing booked yet — browse events below" + 3 suggested cards |
| **Saved / Waitlist** | `bookmarks`, `event_waitlists` | 10 min | "Save events to find them here" |
| **Click with Someone** | `user_match_scores` pre-computed | 4h rotation | See §3.2 |
| **Click Radar** | Tag intersection + trending | 30 min | See §3.2 |
| **Suggested for You** | `user_event_scores` pre-computed | 4h + on tag change | See §3.2 cold start |
| **Activity Feed** | `user_activity` table | Realtime | "Your Click story starts here" |
| **Category Icons** | `categories` (static) | N/A | N/A |

### 3.2 Cold Start — Editorial Fallback

**This is critical for pilot.** When `user_event_scores` has fewer than 10 scored events for a user (new user, incomplete profile, or small event pool), do NOT show an empty feed. Fall back in this order:

```
1. user_event_scores (personalised, if >= 10 scored events)
2. Trending this week: SELECT events ORDER BY booking_count_7d DESC LIMIT 6
3. New this week:      SELECT events WHERE published_at > now()-interval'7d' LIMIT 6
4. Curated editorial:  SELECT events WHERE admin_featured = true LIMIT 6
```

Label the fallback honestly:
- Trending: "Popular in Sydney this week"
- New: "Just added"
- Editorial: "Handpicked for you"

Never label fallback content as "Suggested for You" — that label is reserved for genuinely personalised results. Mislabelling destroys trust when users notice the suggestions aren't relevant.

**Click Radar cold start:** If tag intersection yields fewer than 3 events, supplement with events in user's postcode area regardless of tag match. Label: "Happening near you."

**You Might Click With cold start:** If fewer than 3 scored user matches exist, show:
- 1–2 real scored matches (if available)
- A prompt card: "Complete the Click Quiz to see better matches" (links to `/quiz`)
- Never show placeholder/fake profile cards

### 3.3 Intent Mode Toggle
- Toggle: Dating / Friends / Networking in dashboard header
- Writes to `profiles.active_intent`
- Feed tone adjusts immediately (no reload)
- Dating mode gates: only show users where `open_to_dating = true` AND `dating_preference` is compatible

### 3.4 Activity Feed (New)
Surface on dashboard below main sections. Also accessible at `/profile` as "Your Click Story."

**What appears in the activity feed:**

| Event | Copy | DB source |
|---|---|---|
| User attended an event | "You went to [Event] at [Venue]" | `event_bookings` status → completed |
| Mutual click formed | "You and [Name] clicked ✨" | `mutual_clicks` |
| Mutual click → event attended | "You and [Name] went to [Event] together" | `mutual_clicks` + `event_bookings` |
| Quiz completed | "You completed the Click Quiz" | `personality_profiles` |
| First booking | "You booked your first Click event 🎉" | `event_bookings` milestone |
| N events attended milestone | "You've been to 5 Click events" | computed on `event_bookings` count |

**Storage:**
```sql
user_activity(
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id),
  type        text,        -- 'event_attended' | 'mutual_click' | 'quiz_completed' | 'milestone'
  payload     jsonb,       -- {event_id, event_title, other_user_name, etc.}
  created_at  timestamptz DEFAULT now()
)
-- RLS: user reads own rows only
```

Populated by triggers on `event_bookings` (status → completed), `mutual_clicks` (INSERT), `personality_profiles` (INSERT/UPDATE).

**Display:** Chronological feed, newest first. Max 20 items shown; "See all" loads full history. Each item is a compact single-line card with icon. No interaction required — this is read-only social proof of their own journey on Click.

### 3.5 Notification Integration
In-app toasts/slide-ins for:
- New mutual click detected
- Waitlist spot opened (with 15-min countdown)
- Event starting in 24h
- Post-event feedback prompt (12h after end)
- Weekly digest reminder (if email not opened in 5 days)

All persist in `notifications` table for `/notifications` feed.

---

## 4. Events — Browse & Discovery

### Events list (`/events`)

URL state sync (deep-linking required):
- `?category=` — filter by category
- `?tag=` — filter by interest tag
- `?search=` — full-text on title + description
- `?date=` — ISO date filter
- `?sort=` — trending / newest / suggested

Pagination: cursor-based on `published_at`. Load 12 per page. Scroll-to-top on change.

**Empty search state:** Never show a blank page. If filters return 0 results: "Nothing matches that filter right now — here's what's on this week" + 4 trending events below.

### Event detail (`/events/:id`)

| State | Location visible | FOMO card | Saves count | CTA |
|---|---|---|---|---|
| **Locked** | ❌ (~distance only) | ✅ (if ≥3 attendees) | ✅ always | "RSVP to unlock" / "Book — $X" |
| **Waitlisted** | ❌ | Offer banner instead | ✅ | "You're #X — claim when notified" |
| **Unlocked** | ✅ full address | ❌ | ❌ | "Cancel RSVP" |

**Saves count** ("17 people saved this") fires immediately from `bookmarks` count — no minimum cohort required. This gives the locked state social energy even before 3 bookings exist.

**FOMO card threshold:** Pilot threshold is **≥ 3 confirmed attendees** (not 5). Adjust to 5 once average event size grows post-pilot. This prevents the circular dependency where FOMO needs bookings and bookings need FOMO.

**Logged-out users:** Same locked view. CTA → `/auth?redirect=/events/:id`. Return to event after auth.

---

## 5. Booking Flow

### Pre-booking checks (server-side, in order)
| Check | Failure |
|---|---|
| Authenticated | 401 → `/auth` |
| Email verified | 403 → verification nudge |
| Onboarding complete | 403 → `/onboarding` |
| Profile photo uploaded | 403 → "Add a photo to book events" → `/profile/edit` |
| No existing confirmed booking | 409 → show unlocked state |
| Event is published | 404 |
| Event start_time in future | 410 → "This event has already started" |

### Free events
```
rpc('reserve_event_spot', { p_event_id, p_user_id })
  │
  ▼ DB function — single transaction with FOR UPDATE lock
  SELECT capacity FROM events WHERE id = p_event_id FOR UPDATE
  SELECT COUNT(*) confirmed FROM event_bookings WHERE event_id = p_event_id AND status = 'confirmed'
  IF confirmed >= capacity → RAISE EXCEPTION 'event_full'
  INSERT event_bookings(user_id, event_id, status='confirmed', booked_at=now())
  COMMIT
  │
  ├─ Success → send-booking-email (async) → UI re-fetches state → 'unlocked'
  └─ event_full → offer waitlist (§5.1)
```

### Paid events — Stripe Payment Element (embedded)

**Changed from redirect checkout.** Stripe Payment Element is embedded directly in a modal on `/events/:id`. The user never leaves the page. This eliminates the mobile context-switch and abandoned checkout problem.

```
User clicks "Book — $X"
  │
  ▼
Capacity pre-check (optimistic — real check on webhook)
  IF full → skip to waitlist offer
  │
  ▼
Edge fn: create-stripe-payment-intent
  Params: { event_id, user_id, amount }
  1. FOR UPDATE capacity check — return error if full
  2. stripe.paymentIntents.create({ amount, currency: 'aud', metadata: { event_id, user_id } })
  3. INSERT payment_sessions(session_id, event_id, user_id, status='pending')
  4. Return { client_secret }
  │
  ▼
Client: initialise Stripe Payment Element with client_secret
  -- Renders card input inline in modal on /events/:id
  -- User completes payment without leaving page
  │
  ▼
stripe.confirmPayment() succeeds
  │
  ▼
Stripe webhook → edge fn: stripe-webhook
  On payment_intent.succeeded:
    1. Verify signature
    2. Idempotency check: processed_webhook_events
    3. reserve_event_spot(event_id, user_id) with FOR UPDATE
    4. On success: INSERT event_bookings(status='confirmed', payment_intent_id, amount_paid)
                   UPDATE payment_sessions status='completed'
                   send-booking-email (async)
    5. On event_full: immediate Stripe refund + email user
  │
  ▼
Client: Supabase Realtime subscription on event_bookings fires
  → UI transitions to 'unlocked' without page reload
```

**Idempotency:**
```sql
processed_webhook_events(stripe_event_id text PRIMARY KEY, processed_at timestamptz)
-- Check before processing; insert after. Duplicate webhooks silently ignored.
```

**Unique booking constraint:**
```sql
CREATE UNIQUE INDEX one_confirmed_booking_per_user
  ON event_bookings(event_id, user_id) WHERE status = 'confirmed';
```

### 5.1 Waitlist
See `05_EVENT_STATE_MACHINE.md` for full waitlist flow. Summary:
- Join: free, no payment, position assigned in DB function with FOR UPDATE lock
- Offer: 15-min window, `pending_waitlist` booking row holds soft spot
- Claim: same payment flow as direct booking
- Expiry: cron every 5 min cascades to next in queue

### 5.2 Cancellation

**Refund policy (locked — must appear on every event page and booking confirmation email):**

| Cancellation timing | Refund |
|---|---|
| More than 48h before event | 100% refund |
| 24h–48h before event | 50% refund |
| Less than 24h before event | No refund |
| Merchant cancels event | 100% refund always |

```
User clicks "Cancel RSVP"
  │
  ▼
Confirmation dialog shows: event name, refund amount they'll receive (based on policy + hours remaining)
  │
  ▼
Server checks: booking confirmed + within cancellable window
  IF past cancellation window: "Cancellations closed — contact support"
  │
  ▼
UPDATE event_bookings SET status='cancelled', cancelled_at=now(), cancelled_by='user'
  │
  ├─ If amount_paid > 0:
  │    Calculate refund_amount based on policy + hours to event
  │    stripe.refunds.create({ payment_intent, amount: refund_amount })
  │    On failure: log to payment_transactions(refund_status='failed') → surface to admin
  │
  ▼
Trigger: offer_next_waitlist_spot(event_id)
Email: "Cancellation confirmed — refund of $X in 3–5 business days" (or "no refund per policy")
UI: state returns to 'locked'
```

---

## 6. Social — Click with Someone

### Display
3 user cards, rotate every 4 hours. Each card shows:
- First name, age, suburb
- Top 3 **shared** interest tags (intersection with current user — not just their tags)
- Profile photo
- Subtle intent indicator ("Open to friends" / "Open to dating")

### Sending a Click
```
User taps "Click" on a card
  │
  ▼
INSERT clicks(from_user_id, to_user_id, created_at)
-- to_user receives NO notification
  │
  ▼
Trigger: detect_mutual_click()
  SELECT id FROM clicks
    WHERE from_user_id = to_user AND to_user_id = from_user
    AND created_at > now() - interval '30 days'
  │
  ├─ No match: silent
  └─ Mutual: INSERT mutual_clicks → notify both → queue shared event suggestion
```

**Privacy invariant:** `clicks` table is write-only for the sender. `to_user_id` column is never readable by the target user via any RLS policy.

### 6.1 Mutual Click — Profile Snapshot (New)

**Before the event suggestion is shown, both users see a read-only profile snapshot of each other.** This is the trust step that was missing. Without it, "someone you've never seen before — want to go to an event with them?" converts poorly.

**Snapshot contains (read-only, no interaction):**
- Profile photo
- First name + age + suburb
- Top 5 interest tags
- One-line bio (if set)
- Number of Click events attended ("Been to 4 events")
- Intent: "Here for [friends / dating / networking]"

**What the snapshot does NOT show:**
- Last name, full postcode, email, any contact details
- Their list of mutual clicks or who else they've clicked
- Any message input

**Flow:**
```
Mutual click detected
  │
  ▼
Both users see notification: "You have a new Click ✨"
  │
  ▼
Tapping notification → opens profile snapshot modal (read-only)
  │
  ▼
Below snapshot: "You both love [shared tag] and [shared tag]"
  │
  ▼
CTA: "See what's on for you two →"
  │
  ▼
Opens Proposal UI with shared event suggestion (§7)
```

**DB:** No new table needed. Snapshot is a read-only view of `profiles` + `profile_interest_tags` + `event_bookings` count. Must be accessible via RLS only in the context of a confirmed `mutual_clicks` row between the two users.

```sql
-- RLS: user can view another user's snapshot only if mutual_clicks row exists
CREATE POLICY "profile_snapshot_mutual_only" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM mutual_clicks
      WHERE (user_a_id = auth.uid() AND user_b_id = profiles.id)
         OR (user_b_id = auth.uid() AND user_a_id = profiles.id)
    )
  );
```

### 6.2 Mutual Click — Shared Event Suggestion
System selects top event from intersection of both users' `user_event_scores`. Must be published, have capacity, future-dated, within reasonable distance of both users.

Stored in `mutual_click_suggestions(mutual_click_id, event_id, suggested_at, expires_at)`. Store top 3 options, not just 1 — if top event fills before both users act, fall back to option 2.

---

## 7. Proposal UI (Post-Mutual-Click Coordination)

No free-text input anywhere in this flow.

```
Both users see shared event suggestion card
  │
  ├─ "Yes, let's go" → both directed to RSVP flow for suggested event
  │
  └─ "Suggest something else" → event picker
       - Search/filter restricted to Click's published catalog
       - No free-text input
       - Max 3 alternative proposals per mutual click
       - Each proposal notifies the other user
       │
       Other user: Accept → RSVP / Decline → back to suggestions
```

**Constraints:**
- 3 proposals max per mutual click (hard DB limit)
- 7-day expiry on mutual click; one "renew" allowed
- Expired: proposal surface removed, click history kept for matching signal
- No notification copy uses the word "message" — use "Click suggestion", "event idea", "invitation"

---

## 8. Post-Event Retention Loop (New)

This is the re-engagement mechanism that was entirely missing from the original spec.

### 8.1 "You Went" Confirmation (12h after event end)

Cron runs 12h after `events.end_time` for all confirmed attendees:

```
INSERT notifications(user_id, type='post_event_prompt', payload={event_id, event_title})
Edge fn: send-post-event-email
  Subject: "How was [Event Title]?"
  Body: warm copy acknowledging they went + feedback prompt
```

**In-app:** Card appears at top of dashboard:
> "You went to [Pottery with Friends] last night. Did you Click with someone? 🎉"

Two actions:
1. "Yes, I clicked with someone" → opens attendee selection (up to 5 people from confirmed list)
2. "Just me this time" → dismisses; still writes `event_attended` to `user_activity`

Both responses write to `user_activity` and feed persona recalculation. Neither response is wrong — do not make users feel bad for the "just me" response.

### 8.2 Post-Event Click Selection
```
User selects attendees they clicked with
  │
  ▼
INSERT post_event_clicks(from_user_id, to_user_id, event_id)
  │
  ▼
Trigger: detect_mutual_click() — same logic as §6
  Mutual post-event click → new mutual_clicks row → profile snapshot → proposal UI
```

### 8.3 Mutual Click Post-Event Confirmation
If two users attended an event via a mutual click suggestion, and both return post-event:
- Surface: "You and [Name] went to [Event] together ✨"
- Writes to `user_activity` for both users
- CTA: "See what's next for you two" → re-opens proposal UI with new suggestions

This closes the loop and creates a moment of social warmth that anchors the platform in real memory.

### 8.4 Profile & Algorithm Update
Post-event engagement triggers:
- `user_activity` INSERT (attended, clicked with someone)
- Persona recalculation if: 5+ new RSVPs since last calc OR new quiz submission
- `user_event_scores` partial rebuild for this user

---

## 9. Weekly Digest Email (New)

See `06_RETENTION_AND_ENGAGEMENT.md` for full spec. Summary:

- Sent every Tuesday 8am AEST to all users who have not booked an event in the last 14 days
- Subject line rotates: "5 things happening in [Suburb] this week" / "Your matches are going to these events" / "New this week near you"
- Content: 4–5 events from user's `user_event_scores` top results + 1 featured/editorial pick
- One-tap RSVP link in email (deep links to `/events/:id`)
- Unsubscribe link required; preference stored in `notification_settings`
- If user books from digest email: tag booking with `source='weekly_digest'` in `event_bookings` for attribution

---

## 10. Profile & Settings

### Profile edit (`/profile/edit`)
Editable: full name, photo, bio, interest tags, music tags, postcode, intentions, dating preferences.

Photo edit must support re-crop. Changing interest tags triggers partial `user_event_scores` rebuild (async, queued — does not block UI).

### Account settings (`/account-settings`)
| Tab | Key actions |
|---|---|
| Account | Change email (re-verification), delete account |
| Notifications | Per-type toggles; writes to `notification_settings` |
| Privacy | Dating visibility, profile discoverability |
| Payments | Stripe payment methods |
| Security | Password change, 2FA |

### Delete account
- Soft delete: `profiles.deleted_at = now()`, `profiles.is_active = false`
- RLS excludes from all public queries immediately
- Hard delete: 30-day purge cron
- On delete: cancel bookings, trigger refunds, remove from all waitlists, remove from match feeds

---

## 11. Click Life Quiz (`/quiz`)

**Not in onboarding.** Promoted from the dashboard as "Improve your matches" after the user has attended at least 1 event or been on the platform 7 days.

7 sections, all skippable:
1. Life Stage & Identity → Life Tags
2. Personality Style → Persona (Introvert / Extrovert / Ambivert)
3. Availability → weekday/weekend flags
4. Distance Willingness → proximity weighting
5. Dating Preferences (conditional)
6. Event Style → vibe preference
7. Energy & Mood → temporary weighting modifier

Storage: `personality_profiles(user_id, quiz_data jsonb, life_tags array, persona_attributes jsonb, updated_at)`

On completion:
- Writes `personality_profiles`
- Queues `user_match_scores` rebuild for this user
- Inserts `user_activity(type='quiz_completed')`
- Shows: "Your matches just got a lot better" confirmation screen

---

## Appendix: Key RLS Policies

```sql
-- Users read only their own profile (plus mutual-click snapshot exception in §6.1)
CREATE POLICY "user_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "profile_snapshot_mutual_only" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM mutual_clicks
      WHERE (user_a_id = auth.uid() AND user_b_id = profiles.id)
         OR (user_b_id = auth.uid() AND user_a_id = profiles.id)
    )
  );

-- Clicks: write-only by sender; target cannot read
CREATE POLICY "clicks_insert" ON clicks
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "clicks_select_own" ON clicks
  FOR SELECT USING (auth.uid() = from_user_id);

-- Bookings: user sees only their own
CREATE POLICY "bookings_self" ON event_bookings
  FOR ALL USING (auth.uid() = user_id);

-- Events: public read if published
CREATE POLICY "events_public_read" ON events
  FOR SELECT USING (status = 'published');

-- Activity feed: own rows only
CREATE POLICY "activity_self" ON user_activity
  FOR ALL USING (auth.uid() = user_id);
```
