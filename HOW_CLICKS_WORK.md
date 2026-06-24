# How Clicks Work

A **Click** is a private, one-directional tap that says *"I'd see you again."* It is invisible to the other person — it only ever surfaces when it becomes **mutual** (both people tap each other), and a mutual unlocks a **plan**, never a chat. There is no messaging, no DM, and no free text anywhere in the Click flow; all coordination happens through structured taps (Confirm / Suggest-from-catalogue / RSVP).

The canonical engine entry point is `createUserClickForSession` (`src/lib/event-repository.ts:6979`); the in-app explainer is `/test-click` (`src/app/test-click/page.tsx`, mounting `src/components/click-walkthrough.tsx`).

---

## TL;DR

- A Click is a **private "maybe"** — it inserts one `user_clicks` row (`status='pending'`, 30-day TTL). The clicked person is **never told**; zero notifications, zero emails on a one-way click.
- A Click can start two ways: **discovery** ("Click with someone", anytime, no gate) or **post-event** ("who did you click with?", gated to confirmed co-attendees ≥12h after the event ended).
- When the other person clicks you back (a still-live reciprocal click), the pair goes **mutual**: a `mutual_clicks` row + an `event_proposals` row (7-day window) are created, both `user_clicks` flip to `mutual`, both sides get an in-app **"Mutual Click found"** notification and the **only** click-engine email (`mutual-click-attendee`). This is the first time anyone is notified at all.
- A mutual unlocks a **plan, not a chat**: the system auto-suggests a still-bookable future event around a shared interest.
- Coordination on `/proposals` is **structured-only**: one-tap **Confirm**, or **Suggest alternative** from a closed event catalogue (no free text), capped at **3 alternatives** total.
- **Confirming the plan is NOT the booking.** After confirm, *both* people still have to **RSVP** to the event separately. "Both going" 🎉 is computed live from RSVPs, not from tapping Confirm.
- Three time windows, easily conflated: **30-day** click TTL, **7-day** proposal window (runs from the *match*, not the event date), **12h** post-event gate (post-event surfaces actually use 12h–14d / 0–30d / 12h–7d depending on surface).
- Worst case is **silence**: no reply → the click silently expires in 30 days. Nobody is ever embarrassed.
- Hard exits are limited: there is **no "decline" or "withdraw"** action — you simply never click back (TTL lapse) or **block** (hard-deletes the click rows). Expiry is read-time only; no status-flip cron for `user_clicks`.

---

## The two ways a Click starts

Both doors lead to the same private pending Click. The distinction is real and load-bearing — conflating them caused bug board #188 ("Click privately did nothing"). The branching logic is at `event-repository.ts:7040-7074`.

| | Door A — Discovery click | Door B — Post-event click |
| --- | --- | --- |
| **Where it appears** | Dashboard ("Click with Someone" rail, one rotating suggestion) + People page (full ranked list) | After an event you attended, on the dashboard and the event-detail page |
| **Stepper label** | "Click with someone" | "Who did you click with?" / "Did you click with anyone at *{event}*?" |
| **`sourceEventId`** | absent (`source_event_id` stays `null`) | present (an event **slug**, resolved to a UUID internally) |
| **Gate** | **None** — allowed any time; no shared-past-event requirement, no 12h gate | **Gated**: both people must be `event_attendees.status='confirmed'` for that event **AND** the event ended ≥12h ago (`coalesce(ends_at, starts_at) + interval '12 hours' <= now()`); else `ValidationError` (`event-repository.ts:7052-7073`) |
| **Ranking** | People ranked by *how well you match* (shared interests + match profile; Matching v2 is ON by default). Candidate pool is also gated: `role='attendee'`, not suspended, `suburb`/`bio` not null, and a **non-empty `photo_url`** (photoless profiles excluded — bug #190); capped at 24 (`getSuggestedPeople`, `:10604-10708`) | Lists confirmed co-attendees you haven't clicked yet |
| **Component** | `ClickWithSomeoneUserCard` | `PostEventClickCard` |
| **Server action** | `clickPersonAction` (`src/app/people/actions.ts:15`) | `clickCoAttendeeAction` (`src/app/dashboard/actions.ts:13`) |

In `/test-click`, Door A renders `<DemoClickCard />` (a static clone with a live "Click privately" button); Door B renders `<DemoPostEventCard />`. The page's unifying line: *"Either door leads to the same private pending Click — that's the walkthrough below."* (`click-walkthrough.tsx:644-646`).

---

## The full lifecycle

The 5 stages: **private pending → mutual → proposal → confirm → both going**. Note that the `user_clicks` lifecycle and the `event_proposals` lifecycle are *separate* state machines — the mutual click itself has no status (it exists or it doesn't); the post-mutual lifecycle lives entirely on the attached proposal row.

### State diagram

```
                    (you tap)
   (none) ──────────────────────────▶  PENDING click
                                          │   user_clicks.status = 'pending', 30-day TTL
                                          │   anonymous — they are told NOTHING
                                          │
              30 days, no reply           │  they click you back
        ┌── (silent TTL lapse / block) ──┤  (their pending click still live)
        ▼                                 ▼
   gone / deleted                    MUTUAL  ──────────────────────────────┐
   (no 'expired' status              both user_clicks → 'mutual'           │
    is ever written)                 + mutual_clicks row                   │
                                     + event_proposals row (status=pending)│
                                     + "Mutual Click found" notif (both)   │
                                     + mutual-click-attendee email (both)  │
                                          │  auto-opens                    │
                                          ▼                                │
                                     PROPOSAL  (proposal_status = 'pending')│
                                     7-day window from the MATCH           │
                                          │                                │
                  ┌───────────────────────┼────────────────────────┐      │
   7 days,        │   one tap, either of you (Confirm)              │ either suggests
   no confirm     ▼                                                 │ alternative
        ▼     CONFIRMED (proposal_status='confirmed')               │ (≤3, from catalogue)
   proposal      confirmed_by + confirmed_at set;                   │ stays 'pending',
   → 'expired'   NO seat booked yet — "RSVP needed"                 │ swaps suggested_event
   mutual drops      │                                              │
   off lists         │  you BOTH complete a real RSVP ◀─────────────┘
                     ▼   (free RSVP or paid Stripe checkout, or a claimed guest +1)
                BOTH GOING 🎉
                (computed LIVE from RSVPs — not from tapping Confirm;
                 shown only on the dashboard, never on /proposals)
```

### State-transition table

| From | Event / trigger | To | What's written |
| --- | --- | --- | --- |
| (none) | You tap Click | **Pending** | `insert user_clicks ... status='pending', expires_at=now()+30d` (`event-repository.ts:7076-7088`) |
| Pending | Re-click same person | **Pending** (refreshed) | `ON CONFLICT DO UPDATE` re-arms `expires_at`, resets `status='pending'`, refreshes `source_event_id`, resets `created_at` (`:7080-7086`) — no cooldown |
| Pending | 30 days, no reply | gone (TTL) | No row write — expiry is **read-time only** (`expires_at > now()` filters); the `expired` enum value is **never written** to `user_clicks` |
| Pending | You get blocked / block them | deleted | `blockUser` hard-deletes both directed rows (`:10892-10899`) |
| Pending (yours) | They click you back (their pending click still live) | **Mutual** | reciprocity check `:7090-7100`; upserts `mutual_clicks` (`:7201-7216`), opens `event_proposals` (`:7222-7231`), flips both `user_clicks` to `'mutual'` (`:7234-7245`), 2 notifications + 2 emails |
| Mutual / Proposal pending | auto on mutual | **Proposal pending** | `event_proposals.status='pending'`, `expires_at=now()+7d` |
| Proposal pending | One of you taps **Confirm this plan** (before expiry, event still bookable) | **Confirmed** | `confirmProposal`: `status='confirmed'`, `confirmed_by`, `confirmed_at` (`:11529-11536`) |
| Proposal pending | Either suggests an alternative (from catalogue, <3 used) | **Proposal pending** (event swapped) | `proposeAlternativeForProposal`: swaps `suggested_event_id`, `alternatives_count+1`, `proposed_by=viewer` (`:11603-11611`) |
| Proposal pending | 7 days, no confirm | **Expired** | lazily flipped on confirm-after-expiry (`:11520-11527`); reads treat `pending && expires_at<=now()` as expired without persisting (`:11413`); mutual drops off the dashboard rail (`:10815-10827`) |
| Confirmed / Proposal | Suggested event sells out / cancelled / passes | `suggestionUnavailable` | "That event filled up — pick another plan." (`:11464-11465`) |
| Confirmed | **Both** complete a real RSVP for the same upcoming event | **Both going** 🎉 | No proposal write — computed live via lateral subquery on `event_attendees status='confirmed'` OR a claimed `guest_spots` row (`:10788-10814`) |

---

## Step-by-step (the 5 stepper steps)

These reproduce the `/test-click` interactive stepper (`click-walkthrough.tsx:323-478`). The four annotation cells are labelled in the DOM as **"Trigger" · "What you see" · "What they see" · "The clock"** (`:244-249`).

### Step 01 · Private pending — "You tap. They have no idea."

| Cell | UI copy |
| --- | --- |
| **Trigger** | "You tap "Click privately", or "Click" on a post-event prompt." |
| **What you see** | "The button flips to "Clicked privately ✓ — pending their Click"." |
| **What they see** (rose) | "Nothing — they are never told. It only surfaces if they Click you back." |
| **The clock** | "Stored as pending; auto-expires after 30 days." |

The split view shows "Your screen" (`<DemoClickCard sent />`) vs "Their screen · meanwhile" rendering the big word **"Nothing."** Pills: `Can't Click yourself` · `Blocking stops new Clicks & hides you in discovery` · `100% private & anonymous`.

**In code:** inserts/upserts one `user_clicks` row, `status='pending'`, 30-day `expires_at` (`event-repository.ts:7076-7088`). Guards before the write: self-click is blocked at both the app layer (`ValidationError "You cannot Click yourself."`, `:7018`) and the DB (`no_self_click` CHECK); a block in *either* direction → `ValidationError "This person is unavailable."` (`:7024-7038`). **No notification and no email fire** — the pending click is fully anonymous. The discovery card's `clickPersonAction` deliberately does **not** revalidate (`people/actions.ts:39`), so the optimistic "pending" confirmation stays visible (fix for bug #188); the post-event card's `clickCoAttendeeAction` *does* `revalidatePath("/dashboard")` (`dashboard/actions.ts:33`), so the clicked person drops off the list.

### Step 02 · Mutual Click — "They tap you back. Both sides light up."

| Cell | UI copy |
| --- | --- |
| **Trigger** | "The moment they also Click you (their pending Click already existed)." |
| **What you see** | "A bright "Mutual Click" card on your dashboard and the People page." |
| **What they see** (rose) | "Exactly the same — both sides light up at once." |
| **The clock** | "A 7-day Proposal window opens." |

Renders `<DemoMutualCard />` plus three "Auto" cards: (1) both clicks flip to "mutual"; (2) "we auto-suggest a future, still-bookable event around a shared interest — matching both of you where it can... Soonest first, ideally one neither has RSVP'd to."; (3) "A 7-day Proposal opens automatically." Note card: *"You both get an in-app "Mutual Click found" notification (opens `/proposals`) and a mutual-click email — the first time anyone is notified at all. No chat opens — ever."* Banner: **"A mutual unlocks a PLAN, never a chat."**

**In code:** see [The engine](#the-engine) below. Reciprocity check at `:7090-7100`; mutual + proposal + status flip + notifications all commit in one transaction; emails fire after commit. *Caveat the stepper glosses:* a mutual can open with **no** suggested event ("No plan yet — pick one together"), so the auto-suggest is not guaranteed.

### Step 03 · Proposal — "You coordinate with taps — there is no chat."

| Cell | UI copy |
| --- | --- |
| **Trigger** | "Either of you opens it from the mutual card or the Proposals page." |
| **What you see** | "The proposal card above, on /proposals." |
| **What they see** (rose) | "The same card — either of you can confirm or suggest." |
| **The clock** | "Expires 7 days after it opens; the card counts it down." |

Renders `<DemoProposalCard />`: "You + Maya", a "Pending" badge, "Suggested: Sunset Pottery Social", buttons "Confirm this plan" / "Suggest alternative", counter "3 of 3 left", a "Choose from the Click catalogue" dropdown with the note *"A dropdown of real events — not a message box. There's no free text anywhere in a proposal."*, and "Expires Sun 13 Jul."

**Caveat card (verbatim):** *"The 7-day clock runs from when you **matched** — not from the event date (the event can be weeks later). If it lapses, the proposal dies and the mutual drops off your lists. The real card says "Click again to reopen", but that reopen isn't built yet — see the audit below."*

### Step 04 · Confirm — "Confirming the plan is not the booking."

| Cell | UI copy |
| --- | --- |
| **Trigger** | "One of you taps "Confirm this plan" — only possible while the suggested event is still bookable. If it sold out, you Suggest an alternative first." |
| **What you see** | "An "RSVP needed" card pointing you to the event." |
| **What they see** (rose) | "The same — they're nudged to RSVP too." |
| **The clock** | "No new timer — you just both need a seat." |

Renders `<DemoConfirmedCard />`. Banner: **"Confirming the plan ≠ holding a seat."** Pills: `Free event → free RSVP` · `Paid event → Stripe checkout` · `A claimed guest +1 also counts`.

**In code:** `confirmProposal` (`event-repository.ts:11506-11557`) only flips `pending → confirmed` and notifies the partner — **it does NOT create an RSVP or touch `event_attendees`**. The seat is reserved separately by each person's RSVP. The confirmed card's copy branches on `confirmedByMe`: "You're in — now lock in your seat." vs "{Other} confirmed this plan 🎉" (bug #199).

### Step 05 · Both going — "Two seats held. You're going together."

| Cell | UI copy |
| --- | --- |
| **Trigger** | "You both complete a real RSVP for the same upcoming event." |
| **What you see** | "The celebration card on your dashboard. The Proposals page never shows this 🎉 — it's computed live from your RSVPs, not from anyone tapping Confirm." |
| **What they see** (rose) | "The same — it celebrates on their dashboard too, at the same time." |
| **The clock** | "No timer. You're going. 🎉" |

Renders `<DemoMutualCard celebrate />`. Caption: *"Reached only when you both hold a confirmed seat (or a claimed guest +1) for the same upcoming event."* Computed live in `getMutualClicksForSession` via the `bothGoing*` lateral subquery (`:10788-10814`) — so "both going" can even be reached **without a proposal confirm at all** if the pair happen to RSVP the same event.

---

## The engine

### How a click is recorded and becomes mutual

The entire flow runs in one transaction in `createUserClickForSession` (`event-repository.ts:6979-7350`; `begin` at `:6996`, `commit` at `:7287`, `rollback` on throw at `:7345`).

**Inputs:** `{ clickedProfileId: string; sourceEventId?: string }` — note `sourceEventId` is an event **slug**, not a UUID, despite the name (matched on `e.slug` in the eligibility query at `:7059`).

**Validation / guards (in order):**
1. Auth + DB pool present, else `authError()` / `databaseUnavailableError()` (`:6989-6990`).
2. `ensureProfileForSession(session)` resolves/creates the clicker's profile (`:6992`).
3. Load clicked profile (`:6998-7010`); `NotFoundError` if missing (`:7013`).
4. Self-click guard → `ValidationError "You cannot Click yourself."` (`:7018`).
5. Block check both directions → `ValidationError "This person is unavailable."` (`:7024-7038`).
6. Click-kind branch (`:7040-7074`): discovery (no gating) vs post-event (12h + confirmed-co-attendee eligibility query, `:7052-7064`).

**Write the click (idempotent upsert)** (`:7076-7088`):
```sql
insert into user_clicks (clicker_profile_id, clicked_profile_id, source_event_id, status, expires_at)
values ($1::uuid, $2::uuid, $3::uuid, 'pending', now() + interval '30 days')
on conflict (clicker_profile_id, clicked_profile_id) do update
set source_event_id = excluded.source_event_id,
    status = 'pending',
    expires_at = now() + interval '30 days',
    created_at = now()
```
Re-clicking is idempotent on the unique ordered pair; it re-arms the 30-day TTL, resets `created_at`, and momentarily resets `status` to `'pending'` (immediately re-promoted to `'mutual'` in the same txn if the reverse click is still live, so no data loss).

**Reciprocity** (`:7090-7100`): query the *reverse* row (`clicker=clickedProfile, clicked=me`) that is **not expired** (`expires_at > now()`). If found, this click closes a mutual.

**Suggested-event selection** (only on mutual, `:7111-7199`): prefer the unlocking event (`sourceEventId ?? reciprocalClick.source_event_id`) only if still `live/featured/waitlist`, `starts_at > now()`, and not at capacity (`:7120-7145`). Else fallback (`:7148-7198`): a future, bookable event sharing an `interest`-type tag with either member, ranked by (a) neither has RSVP'd, (b) matches *both* members' interests, (c) interest-overlap count, (d) soonest. May resolve to `null`.

**Promote to mutual** (`:7201-7285`):
1. Upsert `mutual_clicks` with canonical ordering `least()/greatest()` (`:7201-7216`) — preserves an existing suggestion if the new one is null.
2. Upsert `event_proposals` on `mutual_click_id`, 7-day expiry, `proposed_by=clicker` (`:7222-7231`).
3. Flip **both** `user_clicks` rows to `'mutual'` (`:7234-7245`).
4. Insert two `notifications` rows ("Mutual Click found"), each suppressed if the recipient muted the other via `user_mutes` (`:7249-7284`).

**After commit:** fire-and-forget `mutual-click-attendee` email to each side, on mutual only (`:7289-7332`).

**Return:** `{ clickedProfileName, status: reciprocalClick ? "mutual" : "pending", suggestedEvent: { slug, title } | null }` (`:7334-7343`).

### Idempotency & key invariants
- `user_clicks unique (clicker_profile_id, clicked_profile_id)` — one directed row per ordered pair; the `ON CONFLICT` anchor.
- `mutual_clicks ordered_profile_pair CHECK (profile_a_id < profile_b_id)` + `unique` — exactly one row per unordered pair regardless of who clicked second.
- `event_proposals.mutual_click_id unique` — exactly one proposal per mutual click (1:1, `on delete cascade`).

### The duplicate DB trigger (split source of truth)
`database/001_schema.sql:329-381` defines `create_mutual_click()` + trigger `create_mutual_click_after_click` (AFTER INSERT on `user_clicks`) that performs the **same** reciprocity → `mutual_clicks` insert + `user_clicks` status flip in plpgsql. The mutual promotion is thus implemented **twice** (app + trigger). They are mutually idempotent (same canonical ordering; the trigger uses `on conflict ... do nothing`). Key differences: the trigger fires **only on INSERT** — so on a re-click (`ON CONFLICT DO UPDATE`) only the *app code* detects the mutual — and the trigger does **not** create `event_proposals` rows, notifications, or emails (those are app-only).

### The dead `expired` enum value
`click_status` (`pending | mutual | expired`) declares `expired` (`001_schema.sql:11`) but **nothing ever writes `status='expired'` to `user_clicks`**. Clicks die by TTL read-filter (`expires_at > now()`) or by hard DELETE (block). Only `event_proposals` rows actually transition to `expired`.

### Table schemas

**`user_clicks`** — the one-way click ledger (`database/001_schema.sql:158-168`):
```sql
create type click_status as enum ('pending', 'mutual', 'expired');   -- :11
create table user_clicks (
  id uuid primary key default gen_random_uuid(),
  clicker_profile_id uuid not null references profiles(id) on delete cascade,
  clicked_profile_id uuid not null references profiles(id) on delete cascade,
  source_event_id uuid references events(id) on delete set null,   -- NULL for discovery clicks
  status click_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  constraint no_self_click check (clicker_profile_id <> clicked_profile_id),
  unique (clicker_profile_id, clicked_profile_id)
);
create index user_clicks_clicked_idx on user_clicks(clicked_profile_id);   -- :396
-- RLS enabled :411. Comment :437: "Anonymous one-way Clicks. Mutual Clicks are
-- created by trigger and unlock an event suggestion, not chat."
```

**`mutual_clicks`** — the symmetric match (`database/001_schema.sql:170-178`):
```sql
create table mutual_clicks (
  id uuid primary key default gen_random_uuid(),
  profile_a_id uuid not null references profiles(id) on delete cascade,
  profile_b_id uuid not null references profiles(id) on delete cascade,
  suggested_event_id uuid references events(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ordered_profile_pair check (profile_a_id < profile_b_id),
  unique (profile_a_id, profile_b_id)
);
create index mutual_clicks_profile_b_idx on mutual_clicks(profile_b_id);   -- :397
-- No status column — a mutual has no lifecycle of its own. RLS enabled :412.
```

**`event_proposals`** — the post-mutual coordination object (`database/019_proposals.sql:15-27`):
```sql
create type proposal_status as enum ('pending', 'confirmed', 'expired');
create table if not exists event_proposals (
  id uuid primary key default gen_random_uuid(),
  mutual_click_id uuid not null unique references mutual_clicks(id) on delete cascade,
  suggested_event_id uuid references events(id) on delete set null,
  status proposal_status not null default 'pending',
  proposed_by uuid references profiles(id) on delete set null,
  alternatives_count integer not null default 0,   -- capped at 3 in app logic
  confirmed_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_proposals_status_idx on event_proposals (status, expires_at);
-- RLS enabled. Business basis: Business plan §1.3 / §7.2 (019_proposals.sql:3-5).
```

---

## After the mutual click — proposals & coordination

The governing principle: **no chat, no free text** — coordination is taps only (Confirm / Suggest-from-catalogue / RSVP). The `/messages` surface was deliberately *retired*, not hidden — the no-chat rule is enforced by deleting the surface (`event-repository.ts:10850-10852`).

### Surfaces after a mutual

**(a) Dashboard mutual-click rail** — `getMutualClicksForSession` (`event-repository.ts:10728-10848`), up to 12 `MutualClickEntry` objects. Three body states:
- **plan suggested** — "{Other} suggested:" / "Your suggested plan:" {event}, with a "Confirm or suggest another →" link to `/proposals`. `suggestedEvent*` resolves to `null` unless the event is still `starts_at > now()`, `live/featured/waitlist`, and **not sold out** (confirmed + live `pending_payment` holds < capacity — bug #177) (`:10768-10781`); `suggestedByOther` attributes the suggestion (`:10840`).
- **no plan yet** — "No plan yet — pick one together, or suggest your own." → "Pick a plan →".
- **both going** 🎉 — "You're both going to {event}!" via the `bothGoing*` lateral subquery (both confirmed for the same upcoming event, or a claimed `guest_spots` row — bug #186, spec 19) (`:10788-10814`).
- **Visibility filter** (`:10815-10827`): a mutual drops off once the 7-day proposal lapses without confirm (`expired`, or `pending` past `expires_at`) — *unless* the pair are already both going.

**(b) The `/proposals` page** — `getProposalsForSession` (`event-repository.ts:11383-11474`), up to 50 `ProposalEntry` objects. Key computed fields: `isExpired` (= `status='expired' OR (pending AND expires_at<=now())`, bug #199, `:11408-11413`); `suggestedEvent*` only if still upcoming + bookable + not sold out (`:11434-11445`); `suggestionUnavailable` (a suggestion existed but vanished — distinct from "none picked yet", `:11464-11465`); `alternativesRemaining = max(0, 3 - alternatives_count)` (`:11466`); `confirmedByMe` drives asymmetric copy (`:11423`). Ordering: pending-and-not-expired first, then `updated_at desc`.

> Both `getMutualClicksForSession` and `getProposalsForSession` swallow all errors and return `[]` — a DB hiccup silently shows an empty rail rather than erroring. (`getPostEventClickPrompts`, `getPostEventClickPromptForEvent`, `getProposalCatalogue`, and `getSuggestedPeople` all do the same.)

### The coordination actions

`assertProposalParticipant` (`event-repository.ts:11478-11504`) is the shared authz guard — joins `event_proposals → mutual_clicks` and verifies the session profile is `profile_a_id`/`profile_b_id`, else `NotFoundError`. So a non-participant cannot act on someone else's proposal.

**`confirmProposal`** (`:11506-11557`) — one transaction:
1. `assertProposalParticipant`.
2. If `status != 'pending'` → no-op return (idempotent).
3. Expiry guard: if `expires_at <= now()`, flip to `'expired'`, commit, and throw `validationError("This proposal has expired.")` (`:11520-11527`).
4. Else `update ... status='confirmed', confirmed_by, confirmed_at` (`:11529-11536`).
5. Notify partner: "Plan confirmed" → `/proposals`, mute-suppressed (`:11538-11548`).
- **Does NOT touch `event_attendees`. No email logged** — in-app notification only.

**`proposeAlternativeForProposal`** (`:11559-11632`) — structured-only:
1. `assertProposalParticipant`; if `status != 'pending'` → `validationError("This plan is already settled.")`.
2. Cap of 3 (`select ... for update`; `>= 3` → `validationError("You've reached the limit of 3 alternative suggestions.")`, `:11578-11585`). The cap is **one shared budget across both people**, not 3 each.
3. **No free text** — the slug must resolve to a real `live/featured/waitlist` upcoming event, else `validationError("Pick an upcoming event from the catalogue.")` (explicit "no free text is ever accepted", `:11587-11601`).
4. Swap `suggested_event_id`, `alternatives_count+1`, `proposed_by=viewer` (`:11603-11611`).
5. Notify partner: "New plan suggested" → `/proposals`, mute-suppressed (`:11613-11623`).

**`getProposalCatalogue`** (`:11642-11680`) — the closed input set: up to 60 events, `live/featured/waitlist`, `starts_at > now()`, not sold out, soonest-first; returns `{ slug, title, startsAt, suburb }`. There is no text field anywhere.

### The cross-RSVP nudge & 24h reminder

Confirming does not book seats; two mechanisms keep the pair in sync.

**(a) Cross-RSVP nudge** — `notifyProposalPartnerOfRsvp` (`event-repository.ts:3125-3162`). When one person RSVPs to the proposal's **current** `suggested_event_id` (`status <> 'expired'`), the *other* participant gets "Your click RSVP'd — your turn" → `/events/<slug>?from=proposal-partner-rsvp`. **Idempotent** per `(partner, event)` via the `action_url` marker. Fires from **two** trigger sites: the free/in-place confirmed-RSVP branch of `registerForEvent` (`:3099`) and the **paid** Stripe-success path (`:9788`). *Caveat:* it only fires if the RSVP'd event exactly matches the current suggestion — RSVP a different event and the partner gets no nudge.

**(b) 24h RSVP reminder** — `remindProposalRsvps` (`:3169-3218`). One-time per participant who still hasn't RSVP'd to the suggested event, 24h+ after the proposal was created (and the event still upcoming): "Don't forget to RSVP" → `/events/<slug>?from=proposal-rsvp-reminder`. Idempotent per `(participant, event)`. Cron: `GET|POST /api/cron/proposal-rsvp-reminders` (`Bearer ${CRON_SECRET}`, 503 until set, 401 on mismatch; handler suggests hourly).

### Post-event click prompts

Three surfaces nudge attendees to click co-attendees, all built on `event_attendees status='confirmed'`, all excluding blocked pairs, all marking `alreadyClicked`. **Their windows differ intentionally:**

| Surface | Function | Window after event end |
| --- | --- | --- |
| Dashboard rail | `getPostEventClickPrompts` (`:11162-11233`) | **12h–14 days** |
| Event-detail card | `getPostEventClickPromptForEvent` (`:11239-11306`) | **0–30 days** (any time after end) |
| Push notification | `notifyPostEventClickPrompts` (`:11315-11358`) | **12h–7 days** |

The push fires "Did you click with anyone?" → `/events/<slug>?from=post-event-click`, **idempotent once per `(attendee, event)`** via the `action_url` marker. Cron: `GET|POST /api/cron/post-event-clicks` (same `CRON_SECRET` guard; handler suggests hourly). None of these post-event functions log `email_events` — they are plain in-app notification inserts.

### Structured-only constraints (summary)
- No chat anywhere; `/messages` retired. Coordination only via the Proposal UI.
- Alternatives must come from the catalogue; any non-matching slug is rejected.
- One-tap actions only — no text body is stored anywhere in `event_proposals`.
- Hard caps: 1 proposal per mutual click; ≤3 alternatives (shared budget); 7-day expiry.

---

## Notifications & emails

The **only** email the Click engine fires is `mutual-click-attendee` (on mutual, to both sides). Everything else in the flow is a plain in-app `notifications` insert (no `logEmailEvent`). All in-app notifications are suppressed for a recipient who has muted the other party via `user_mutes` — but a mute does NOT stop the mutual forming or the email sending.

| Type | Title / template | Trigger site | `action_url` / link | Idempotency |
| --- | --- | --- | --- | --- |
| (nothing) | — | One-way pending click | — | the click is anonymous; **0 notifs, 0 emails** |
| in-app ×2 | **"Mutual Click found"** | `createUserClickForSession`, on mutual, one per side (`:7249-7284`) | `/proposals` | one per participant; mute-suppressed |
| **email ×2** | **`mutual-click-attendee`** — subject *"It's mutual — you and {otherName} both clicked"* (`src/lib/email.ts:158-159`) | `createUserClickForSession` after commit, on mutual only (`:7294-7332`) | `proposalsUrl` | template `emails/mutual-click-attendee.html`; vars `firstName, otherName, suggestionLine, proposalsUrl, supportEmail, unsubscribeUrl` (`supportEmail` hard-coded `hello@click.app`) |
| in-app | **"Plan confirmed"** — "{viewer} confirmed your shared plan." | `confirmProposal` (`:11538-11548`) | `/proposals` | to the other party; mute-suppressed |
| in-app | **"New plan suggested"** — "{viewer} suggested {event}." | `proposeAlternativeForProposal` (`:11613-11623`) | `/proposals` | to the other party; mute-suppressed |
| in-app | **"Your click RSVP'd — your turn"** | `notifyProposalPartnerOfRsvp` (free RSVP `:3099`; paid Stripe success `:9788`) | `/events/<slug>?from=proposal-partner-rsvp` | per `(partner, event)` via marker |
| in-app | **"Don't forget to RSVP"** | `remindProposalRsvps` (24h cron) (`:3169-3218`) | `/events/<slug>?from=proposal-rsvp-reminder` | per `(participant, event)` via marker |
| in-app | **"Did you click with anyone?"** | `notifyPostEventClickPrompts` (post-event cron) (`:11315-11358`) | `/events/<slug>?from=post-event-click` | per `(attendee, event)` via marker |

There is **no "declined" notification path** — declining is not a click action.

---

## The surfaces

### Cards / components

| Surface | File | Buttons → action | Notable states |
| --- | --- | --- | --- |
| **`ClickWithSomeoneUserCard`** (discovery) | `src/components/click-with-someone-user-card.tsx` | "Click privately" → `clickPersonAction` (`people/actions.ts:15`) → `createUserClickForSession({ clickedProfileId })` | "Click privately" → "Sending…" → **"Clicked privately ✓ — pending their Click"** (disabled); `sent = state?.ok === true \|\| person.alreadyClicked` survives reload (`:24`); **does not revalidate** (bug #188) |
| **`PostEventClickCard`** (post-event) | `src/components/post-event-click-card.tsx` | per-row "Click" → `clickCoAttendeeAction` (`dashboard/actions.ts:13`) → `createUserClickForSession({ clickedProfileId, sourceEventId: slug })` | single "Click" label; clicked person removed on re-render (calls `revalidatePath("/dashboard")`); **renders `null` if every co-attendee already clicked** (`:9`) |
| **Mutual-click card** (inline `<li>`, **no standalone component**) | `src/app/dashboard/page.tsx` (the `<section>` is `:293-373`; the `<li>` itself is `:317-369`, rendered via `mutualClicks.map` at `:316`) | nav links to `/proposals` only | three bodies: both-going 🎉 (no CTA) / plan-suggested / no-plan-yet |
| **`ProposalCard`** | `src/components/proposal-card.tsx` | "Confirm this plan" → `confirmProposalAction` (`proposals/actions.ts:20`); "Send suggestion" → `proposeAlternativeAction` (`proposals/actions.ts:41`); "RSVP to {event} →" (nav) | badges Pending / RSVP needed / Wrapped / Expired; `settled = confirmed \|\| isExpired` (`:65`); expired copy *"This proposal expired. Click again at a future event to reopen it."* (reopen not built, `:150`); "{n} of 3 left" |
| **`ClickRadar`** (NOT a click card) | `src/components/click-radar.tsx` | event links only — no click buttons by design | top-of-funnel RSVP on-ramp; "you can only Click after a shared event" |

### Where each is mounted

| Surface | Mounted in |
| --- | --- |
| `ClickWithSomeoneUserCard` | Dashboard rail (`dashboard/page.tsx:8,270`) + People page (`people/page.tsx:5,113`) |
| `PostEventClickCard` | Dashboard (`dashboard/page.tsx:6,385`) + Event detail `/events/[slug]` (`events/[slug]/page.tsx:13,363`) |
| Mutual-click `<li>` | Dashboard (`dashboard/page.tsx:316-369`) |
| `ProposalCard` | Proposals page active + settled lists (`proposals/page.tsx`) |
| `ClickRadar` | Dashboard (`dashboard/page.tsx:7,289`) + People page (`people/page.tsx:4,129`) |

> The `/test-click` walkthrough does **not** import the real card components. Its only imports are `Pill` (`@/components/click-ui`) and `formatIntent` (`@/lib/click-data`). The demo surfaces are **self-contained static clones defined inline** in `click-walkthrough.tsx` — `DemoClickCard` (`:58`), `DemoPostEventCard` (`:103`), `DemoMutualCard` (`:138`), `DemoProposalCard` (`:171`), `DemoConfirmedCard` (`:219`) — hand-built to mirror the real surfaces, with no DB reads and demo data only. There is no real `MutualClickCard` component; the "rose mutual card" is inline JSX in the dashboard page.

### API routes

| Route | Purpose |
| --- | --- |
| `POST /api/clicks` (`src/app/api/clicks/route.ts:26-50`) | REST equivalent of the click action — body `{ clickedProfileId, sourceEventId? }`, calls the same `createUserClickForSession`. **The cards do NOT use this** (they use server actions); it's for `/test` + external callers. Error mapping by name: AuthRequired→401, NotFound→404, Validation→400, DatabaseUnavailable→503, else 500; missing `clickedProfileId`→400 |
| `GET\|POST /api/cron/post-event-clicks` | Fires the post-event "Did you click with anyone?" prompts via `notifyPostEventClickPrompts`; `Bearer ${CRON_SECRET}` guard (503 until set, 401 on mismatch) |
| `GET\|POST /api/cron/proposal-rsvp-reminders` | Fires the 24h "Don't forget to RSVP" reminders via `remindProposalRsvps`; same guard |

All four card server actions auth-guard via `await auth()`, redirect to `/login?callbackUrl=…` when unauthenticated, and validate `profile_id`/`proposal_id` against a UUID regex.

### TypeScript types (all in `src/lib/event-repository.ts`)

| Type | Lines | Notable fields |
| --- | --- | --- |
| `SuggestedPerson` | `:10590-10602` | `sharedInterests[]`, `intents[]`, `alreadyClicked` (drives persistent pending state) |
| `PostEventCoAttendee` / `PostEventClickPrompt` | `:11145-11157` | `coAttendees[]`, `eventSlug`, `endedAt` |
| `MutualClickEntry` | `:10710-10726` | `suggestedEvent*`, `suggestedByOther`, `bothGoingEvent*` |
| `ProposalEntry` | `:11360-11381` | `isExpired`, `suggestionUnavailable`, `alternativesRemaining`, `confirmedByMe` |
| `ProposalCatalogueEvent` | `:11634-11639` | `{ slug, title, startsAt, suburb }` |

---

## Privacy & guardrails

| Guardrail | How it's enforced |
| --- | --- |
| **Private until mutual** | A one-way pending click fires **0 notifications, 0 emails**. The clicked person learns nothing unless/until they click back. The first notification anyone ever gets is "Mutual Click found." |
| **Anonymous** | The `/test-click` "Their screen" panel literally shows **"Nothing."** Table comment: *"Anonymous one-way Clicks."* (`001_schema.sql:437`). |
| **No chat, ever** | A mutual unlocks a **plan, never a chat**. `/messages` was retired (`:10850-10852`). |
| **No free text in proposals** | Alternatives must resolve to a real catalogue event; any non-matching slug → `validationError` ("no free text is ever accepted", `:11587-11601`). No text column exists in `event_proposals`. |
| **One-tap, structured-only** | Confirm / Suggest-from-list / RSVP are the only actions. |
| **Can't click yourself** | App guard `:7018` + DB `no_self_click` CHECK. |
| **Blocking** | A block in either direction prevents new clicks (`:7024-7038`) and **hard-deletes** existing click rows (`:10892-10899`); also hides you in discovery. *Audit caveat:* blocking **after** a mutual leaves the mutual + proposal fully alive — the non-blocked person can still Confirm/Suggest. |
| **Hard caps** | 1 proposal per mutual click; ≤3 alternatives (shared budget across both people); 7-day proposal window; 30-day click TTL. |
| **Expiry = silence** | No reply → click silently expires in 30 days (worst case = silence, costs nothing). Proposal lapses at 7 days → mutual drops off. |
| **Sold-out safety** | If the suggested event fills up, the card shows *"That event filled up — pick another plan."* — you're never booked into anything you didn't choose. |
| **Authz** | `assertProposalParticipant` ensures only the two mutual-click participants can act on a proposal. |

### Known gaps & audit caveats (from `audit-report.tsx` — the explainer's own engineering audit)

The `/test-click` stepper is a **happy-path** explainer; the embedded `ClickAuditReport` band (`src/app/test-click/audit-report.tsx`) walks back several confident claims. Worth flagging to the product owner:

- **Lapsed proposals cannot be reopened.** The proposal card's *"Click again to reopen"* copy is aspirational — the reopen path **isn't built** (`audit:116-124`). The explainer copy has dropped this promise (`audit:24-31`).
- **No status-flip cron.** Nothing flips a lapsed click/proposal to "expired" at the row level for `user_clicks`; expiry is read-time only (`audit:126-132`). The `expired` `click_status` enum value is dead.
- **No withdraw / decline.** There's no way to take back a sent Click or decline a proposal — **blocking is the only hard exit** (`audit:133-140`).
- **Cancelling an RSVP silently un-celebrates "both going"** — no alert to the partner, and can leave a stale "RSVP needed" card (`audit:43-49`). Because "both going" is computed live, it can flip back to a suggestion.
- **A full/waitlist event can be the suggested plan**, so "both going" can never fire for it (`audit:33-41`). "Paid event → Stripe checkout" only holds while seats are available — a full paid event drops to a free waitlist row (`audit:98-105`).
- **A mutual can open with no suggested event** ("No plan yet — pick one together"), so Step 2's auto-suggest is not guaranteed (`audit:66-73`).
- **Re-clicking re-arms a fresh 30-day window with no cooldown** (`audit:51-57`); a mutual only forms while *both* clicks are unexpired (`audit:58-65`).
- **Mute silences only the in-app ping** — the mutual still forms and the email still sends (`audit:83-89`).
- **The post-event prompt uses several time windows, not one clean 12h gate** (12h–14d / 0–30d / 12h–7d) (`audit:91-97`).
- **The "3 of 3 left" cap is one shared budget across both people**, not 3 each (`audit:75-81`).
- The explainer also corrected "ranked by shared interest tags" → "how well you match" (Matching v2 is ON by default), and clarified the 🎉 lives only on the dashboard, never `/proposals`.

---

## Glossary

| Term | Meaning |
| --- | --- |
| **Click** | A private, one-directional tap meaning "I'd see you again." One `user_clicks` row, `status='pending'`, 30-day TTL. Invisible to the recipient. |
| **Discovery click** | A Click started from the dashboard "Click with someone" rail or the People page. No gate, allowed any time. `source_event_id = null`. |
| **Post-event click** | A Click started from a post-event prompt. Gated: both confirmed co-attendees + event ended ≥12h ago. Carries a `source_event` slug. |
| **Mutual / Mutual Click** | The symmetric match formed when both people have live clicks on each other. One `mutual_clicks` row (canonically ordered `profile_a < profile_b`). No status of its own — it exists or it doesn't. |
| **Reciprocity** | The check (`event-repository.ts:7090-7100`) for a still-live reverse click that turns a one-way click into a mutual. |
| **Proposal** | The post-mutual coordination object — one `event_proposals` row per mutual click, 7-day window, holding the current suggested event. The only place coordination happens. |
| **Confirm** | A one-tap action flipping the proposal `pending → confirmed`. **Not a booking** — both people must still RSVP. |
| **Suggest alternative** | Swapping the proposal's suggested event for another **from the catalogue** (no free text), capped at 3 total. |
| **Both going** 🎉 | Computed live (not a stored status) when both participants hold a confirmed RSVP (or claimed guest +1) for the same upcoming event. Shown only on the dashboard. |
| **Catalogue** | The closed list of upcoming bookable events (`getProposalCatalogue`) that "Suggest alternative" picks from. The only proposal input vector. |
| **`user_clicks`** | The one-way click ledger. Enum `click_status: pending \| mutual \| expired` (`expired` is declared but never written). Unique on `(clicker, clicked)`. `database/001_schema.sql:158-168`. |
| **`mutual_clicks`** | The symmetric match table. CHECK `profile_a_id < profile_b_id`, unique on the pair, nullable `suggested_event_id`. No status column. `database/001_schema.sql:170-178`. |
| **`event_proposals`** | The coordination object. Enum `proposal_status: pending \| confirmed \| expired`. Unique on `mutual_click_id` (1:1). `alternatives_count` capped at 3, 7-day `expires_at`. `database/019_proposals.sql:15-27`. |

---

*Companion surfaces: the in-app explainer `/test-click` (`src/app/test-click/page.tsx`) and the public `/how-it-works` page.*