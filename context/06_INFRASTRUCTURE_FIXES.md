# 06 — Critical Infrastructure Fixes (Month 1)

**Audience:** Engineering lead, sprint planning
**Format:** Backlog-ready tickets. Each has schema changes, code approach, test cases, rollout plan.
**Source:** Handover doc tech critique (May 2026), items 3–7.

This doc is deliberately a *ticket pack* — each section is self-contained enough that you can paste it into a Jira/Linear issue. Cross-references to other docs are where the canonical detail lives; this doc summarises the engineering work.

---

## Ticket 1 — Pending booking reservation pattern (Stripe race condition fix)

**Priority:** P0 (blocking launch)
**Estimated effort:** 5 dev-days + 2 days QA
**Canonical detail:** `05_BOOKING_LIFECYCLE.md` §2–§3

### Problem

`bookings.status = 'confirmed'` is only set on `checkout.session.completed`. The capacity check at "create checkout" time doesn't reserve a seat, so N users can all pass the check and N can all complete payment. The system overbooks; refunding the losers after the fact requires manual intervention every time.

This is a correctness bug, not a performance bug. It will fire on the first sold-out event and break trust with both merchants and users.

### Solution summary

Introduce `pending_bookings` reservation table. Seat is held from "create checkout" until either `checkout.session.completed` webhook arrives (→ promotes to `bookings` row, deletes pending) or 15 min TTL expires (→ row deleted by cron, seat freed). Capacity is calculated as `capacity - confirmed_bookings - active_pending - offered_waitlist`. Atomic critical section uses `pg_advisory_xact_lock(hashtext(event_id))` to serialise per-event without blocking the whole table.

### Schema changes

```sql
-- New table
create table public.pending_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  ticket_count int not null check (ticket_count between 1 and 4),
  unit_price_cents int not null,
  total_cents int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  client_idempotency_key text not null
);

create unique index uq_pending_idem
  on public.pending_bookings(user_id, event_id, client_idempotency_key);
create index ix_pending_event_active
  on public.pending_bookings(event_id) where expires_at > now();

-- View capacity computation (replaces direct count on bookings)
create or replace view public.event_capacity_v as
  -- ... (full definition in 05_BOOKING_LIFECYCLE.md §2.5 and §4.2)

-- Cron: cleanup expired
-- runs every 60s via pg_cron or Supabase scheduled function
delete from public.pending_bookings where expires_at < now();
```

RLS: select-own only; no user-side writes (all via service role in edge function).

### Code changes

1. **Edge function `create-stripe-checkout`** — full pseudocode in `05_BOOKING_LIFECYCLE.md` §3.1. Key shape:
   - Authenticate user
   - Validate input (event_id, ticket_count 1–4, client_idempotency_key as UUID)
   - Rate limit: max 10 checkout attempts/hour/user
   - Idempotency check: if active pending row exists for same idem key, return its session URL
   - Begin transaction with `pg_advisory_xact_lock(hashtext(event_id))`
   - Lock the event row (`for update`), verify status/timing
   - Verify no existing booking for this user on this event
   - Check `event_capacity_v.available >= ticket_count`
   - Create Stripe Checkout session with 15-min expiry, 10% application fee
   - Insert `pending_bookings` row in same transaction
   - Return checkout URL
2. **Edge function `stripe-webhook` — `checkout.session.completed` handler**: detail in `05_BOOKING_LIFECYCLE.md` §3.2. Promotes pending → confirmed atomically; idempotent on duplicate webhook delivery; handles orphan sessions (refund + log).
3. **Cron `cleanup-expired-pending-bookings`** — 1-line delete, every 60s.
4. **Client RSVP component** — generate `client_idempotency_key` (UUID v4) on button render. Disable button immediately on click. Re-enable on success/failure response. Display checkout URL countdown (15-min TTL).

### Test cases

See `05_BOOKING_LIFECYCLE.md` §8 cases 1–14. Most critical for merge:
- Case 1: 10 concurrent RSVPs for 3 seats → 3 pending, 7 sold_out, no overbooking.
- Case 4: webhook arrives after TTL → refund issued, no booking created.
- Case 5: duplicate webhook → idempotent no-op.
- Case 13: client double-click → single pending row.

Load test: 50 RPS sustained for 60s against a single event with 100 capacity. Capacity should converge to exactly 100 confirmed bookings; remaining requests get `sold_out`.

### Rollout plan

1. **Week 1, days 1–3:** Implement schema + edge functions in staging. Wire up new `event_capacity_v`. Migrate existing `bookings` table to add new status enum values + columns.
2. **Week 1, days 4–5:** Test cases 1–14 in staging. Concurrent-RSVP load test against staging Stripe (test mode).
3. **Week 1 weekend:** Soak test — leave staging running with a synthetic-traffic worker hitting RSVP on test events at 5 RPS for 24 hours. Watch for stuck pending rows, capacity drift, refund failures.
4. **Week 2, day 1:** Ship to prod behind feature flag `rsvp_use_pending_bookings` (default off). All new RSVP attempts hit old path.
5. **Week 2, day 2:** Enable for internal team accounts only (10 users). Manual smoke test.
6. **Week 2, day 3:** Enable for 10% of users (hashed by user_id). Monitor `events_log` for `checkout_abandoned` rate (expect 20–40% baseline, the pending pattern doesn't *cause* abandonment, it just makes existing abandonment visible).
7. **Week 2, day 4:** 50% of users.
8. **Week 2, day 5:** 100%. Old path stays in code but is dead.
9. **Week 3:** Delete old path. Drop any deprecated columns.

**Rollback condition:** if `sold_out` rate jumps >20% above pre-rollout baseline within a 4h window, kill the feature flag. The likely cause would be a bug in capacity view that double-counts.

### Failure modes worth naming

- **Advisory lock contention on very hot events.** Per-event serialisation means a viral event with 1000 concurrent RSVPs serialises through one lock. The transaction is short (Stripe call + 1 insert, target <500ms), so this is fine up to ~50 RPS per event. Beyond that, expect timeouts. Mitigation: don't gate this on first-launch; for a 100-cap event we'll see ~200 attempts total over a few hours, not 1000/sec.
- **Stripe API outage.** If `stripe.checkout.sessions.create` fails, the user sees a generic error. They retry. No dirty state — Stripe failure happens *before* the DB insert in §3.1.
- **DB insert fails after Stripe session created.** Orphan Stripe session. Cleared up by orphan-handler in webhook (refund + log). Acceptable.
- **Webhook never arrives.** Stripe retries for 3 days. If still nothing after 15-min TTL, user paid and got refunded (Stripe Checkout sessions are auto-cancelled by Stripe on expiry, so the charge never settles unless we got the webhook). This case is extremely rare.

---

## Ticket 2 — Pull-on-focus refetches for realtime-subscribed views

**Priority:** P1 (correctness, ship before public launch)
**Estimated effort:** 2 dev-days
**Canonical detail:** `01_USER_WORKFLOW.md` §5.2

### Problem

Supabase Realtime subscriptions silently drop. Symptoms:
- User backgrounds the tab → reopens → dashboard shows stale data with no indication
- Connection drops on flaky Wi-Fi → never reconnects until a hard refresh
- Server-side: postgres_changes replication slot lag delays events by minutes under load

Treating realtime as the *source of truth* for dashboard state is the failure mode. The fix is: realtime is an enhancement (faster UI updates), not a correctness mechanism (refresh on focus is the correctness mechanism).

### Solution summary

Every component that subscribes to a `postgres_changes` channel must also:
1. Refetch on tab focus (`document.visibilitychange` → `visible`)
2. Refetch on network reconnect (`window.online`)
3. Display a "Last updated HH:MM" timestamp
4. Provide a manual refresh button on long-lived views

The realtime stream is allowed to be lossy. The refetch guarantees eventual consistency.

### Schema changes

None. This is a client-side pattern + a useful new column on a few tables.

Optional but recommended: add `updated_at timestamptz default now()` to `bookings`, `events`, `notifications` if not present, with a trigger to maintain it. Client uses `max(updated_at)` as a cursor for delta fetches.

### Code changes

1. **New hook `useLiveTable<T>(query, options)`** — wraps the realtime subscription with focus/online refetch logic. Replaces direct use of `supabase.channel(...)` across the app.

   ```ts
   function useLiveTable<T>(
     queryKey: string[],
     fetcher: () => Promise<T[]>,
     channelConfig: { table: string; filter?: string }
   ) {
     const [data, setData] = useState<T[]>([]);
     const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

     const refetch = useCallback(async () => {
       const rows = await fetcher();
       setData(rows);
       setLastUpdated(new Date());
     }, [fetcher]);

     // Initial fetch
     useEffect(() => { refetch(); }, [refetch]);

     // Realtime — enhancement only
     useEffect(() => {
       const ch = supabase.channel(`live:${channelConfig.table}:${channelConfig.filter ?? ''}`)
         .on('postgres_changes',
             { event: '*', schema: 'public', table: channelConfig.table, filter: channelConfig.filter },
             () => refetch())  // simplest: refetch on any change
         .subscribe();
       return () => { supabase.removeChannel(ch); };
     }, [refetch, channelConfig.table, channelConfig.filter]);

     // Pull on focus
     useEffect(() => {
       const onVisible = () => {
         if (document.visibilityState === 'visible') refetch();
       };
       document.addEventListener('visibilitychange', onVisible);
       return () => document.removeEventListener('visibilitychange', onVisible);
     }, [refetch]);

     // Pull on network reconnect
     useEffect(() => {
       const onOnline = () => refetch();
       window.addEventListener('online', onOnline);
       return () => window.removeEventListener('online', onOnline);
     }, [refetch]);

     return { data, lastUpdated, refetch };
   }
   ```

2. **`<LastUpdated />` UI component** — small footer-style element. Renders `Updated 3s ago` / `Updated 2 min ago`, ticks every 30s. Click to manually refetch.

3. **Audit pass** — grep for `supabase.channel(` and `.on('postgres_changes'` across the codebase. Wrap every callsite with `useLiveTable` or its non-React equivalent. Likely affected components: Dashboard, Click Radar sidebar, notifications widget, event detail page (RSVP count), merchant dashboard cards, admin moderation queue, attendee list, waitlist views.

4. **Polling fallback for views without a clean realtime channel** — if a view aggregates across multiple tables (e.g. dashboard's "upcoming events with available capacity"), don't try to wire postgres_changes to every contributing table. Use a 60s `setInterval` poll plus the focus/online triggers. Equivalent UX, cleaner code.

### Test cases

| # | Scenario | Expected |
|---|---|---|
| 1 | User backgrounds tab for 5 min, returns | Data is fresh; LastUpdated shows ~0s |
| 2 | User loses Wi-Fi, regains | Data refetches on `online` event |
| 3 | Realtime channel drops silently (server-side replication lag) | LastUpdated still shows recent time due to focus-driven polls |
| 4 | User leaves tab open overnight | Every visibility change refetches; no stale dashboard data |
| 5 | Same component rendered twice on one page | Only one channel subscription per `queryKey` (use Supabase channel key with React Query for dedup) |
| 6 | Manual refresh button click | Refetches and updates LastUpdated immediately |

### Rollout plan

Two-pass refactor:
1. Implement `useLiveTable` hook + audit grep. Land in a single PR with no behavioural changes (existing components still use raw channels).
2. Migrate components one at a time, behind no flag (no rollout risk — it's a strict improvement over silent-drop). Order: dashboard first (highest user impact), then merchant dashboard, then admin, then less-trafficked surfaces.

Estimated: hook + audit in 0.5 day, 4 component migrations in 1.5 days.

### Failure modes worth naming

- **Refetch storms.** If 100 users all return to the dashboard at 9am Monday, that's 100 simultaneous queries. Mitigation: dashboard query should be cached at the view/RPC level. Most dashboard widgets read materialised views (per `04_MATCHING_ALGORITHM_V2.md` §6) which are cheap.
- **Tab focus thrashing.** User flipping between tabs every second triggers a refetch per focus. Add debounce: don't refetch more than once per 2s.
- **Initial load + realtime + focus race.** Initial fetch completes at T=0. Realtime event arrives at T=0.5. Focus event at T=1. All three trigger refetches. Use React Query (or equivalent) with `staleTime: 1000` to dedupe.

---

## Ticket 3 — Sub-tag schema and behavioural sub-tag derivation

**Priority:** P1 (foundational for matching v2)
**Estimated effort:** 4 dev-days
**Canonical detail:** `04_MATCHING_ALGORITHM_V2.md` §2–§3

### Problem

Current schema has interest tags only at the parent level (e.g. "Yoga", "Running", "Cooking"). But vinyasa-yoga and yin-yoga people don't match each other well; trail-running and track-running attract different demographics. The matching engine can't distinguish them because the data doesn't exist.

Asking users to declare sub-tags at onboarding would balloon the wizard (`01_USER_WORKFLOW.md` §3 — already 5 steps). The richer signal is **behavioural**: derive sub-tags from the events a user RSVPs to.

### Solution summary

- Each interest tag has a defined set of valid sub-tags (in code, not DB — small enough).
- Events declare their sub-tags at publish time, derived from event title + description + merchant-supplied sub-tag selections.
- User behavioural sub-tag profile = aggregate of sub-tags from events they've RSVP'd to or attended.
- `user_features.sub_tags` is a JSONB column: `{"yoga": {"vinyasa": 4, "hot": 2}, "running": {"trail": 3}}` — counts, not booleans.
- Matching uses sub-tag overlap as a feature (see `04_MATCHING_ALGORITHM_V2.md` §4).

### Schema changes

```sql
-- events table gains sub_tags
alter table public.events
  add column sub_tags jsonb not null default '{}'::jsonb;
-- Format: { "yoga": ["vinyasa", "hot"], "running": ["trail"] }
-- Keys must match an interest_tag slug; values must be from SUB_TAG_PATTERNS in code.

create index ix_events_sub_tags on public.events using gin (sub_tags);
```

`user_features.sub_tags` already specified in `04_MATCHING_ALGORITHM_V2.md` §3.4. Maintenance triggers run on `bookings` insert/update to recompute.

### Code changes

1. **Sub-tag taxonomy in code** — `src/lib/subTags.ts`:

   ```ts
   export const SUB_TAG_PATTERNS: Record<string, string[]> = {
     yoga: ['vinyasa', 'hot', 'yin', 'restorative', 'power', 'ashtanga', 'aerial'],
     running: ['trail', 'road', 'track', 'parkrun', 'social', 'race'],
     cooking: ['italian', 'asian', 'pastry', 'plant_based', 'cocktails', 'wine_pairing'],
     // ...one entry per interest_tag.slug
   };
   ```

2. **Edge function `derive-event-sub-tags`** — runs on event publish. Inputs: title, description, merchant's optional sub-tag declarations. Logic:
   - For each interest_tag the event declares, lookup `SUB_TAG_PATTERNS[tag]`.
   - Run case-insensitive substring match on `title + ' ' + description`.
   - For each sub-tag pattern that matches, include it.
   - Union with merchant-declared sub-tags (merchant UI in event creation wizard has multi-select per interest_tag).
   - Write result to `events.sub_tags`.

3. **Trigger `update_user_sub_tags_on_booking()`** — on `bookings` insert with `status = 'confirmed'`, recompute the user's sub-tag profile by summing over their confirmed bookings:

   ```sql
   create or replace function update_user_sub_tags_for(p_user_id uuid) returns void as $$
   declare
     v_sub_tags jsonb := '{}';
   begin
     select coalesce(jsonb_object_agg(tag_key, tag_counts), '{}'::jsonb)
     into v_sub_tags
     from (
       select
         tag_key,
         jsonb_object_agg(sub_tag, cnt) as tag_counts
       from (
         select
           tag_key,
           sub_tag_val::text as sub_tag,
           count(*) as cnt
         from public.bookings b
         join public.events e on e.id = b.event_id
         cross join lateral jsonb_each(e.sub_tags) as parent(tag_key, sub_tag_array)
         cross join lateral jsonb_array_elements_text(sub_tag_array) as sub_tag_val
         where b.user_id = p_user_id and b.status in ('confirmed', 'no_show')
         group by tag_key, sub_tag_val
       ) flat
       group by tag_key
     ) grouped;

     update public.user_features
        set sub_tags = v_sub_tags,
            updated_at = now()
      where user_id = p_user_id;
   end;
   $$ language plpgsql security definer;
   ```

   Called from the `bookings` AFTER INSERT/UPDATE trigger when status transitions touch confirmed/no_show.

4. **Merchant event creation wizard sub-tag UI** — per `02_MERCHANT_WORKFLOW.md` §6.2 step 1, multi-select sub-tag chips appear under each selected interest tag. Pre-populated from `SUB_TAG_PATTERNS`. Optional.

### Test cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Merchant publishes "Hot Vinyasa Flow" yoga event with no sub-tag declarations | `events.sub_tags = {"yoga": ["hot", "vinyasa"]}` (substring match) |
| 2 | Merchant adds 'yin' to a "Hot Vinyasa Flow" event manually | sub_tags = {"yoga": ["hot", "vinyasa", "yin"]} |
| 3 | User RSVPs to 3 hot-yoga events and 1 yin-yoga event | `user_features.sub_tags.yoga = {"hot": 3, "vinyasa": 3, "yin": 1}` |
| 4 | User cancels (refunded) one of the events | Sub-tag counts recomputed; that event's tags removed |
| 5 | Event has no sub-tag matches in title/description | `sub_tags` is `{}`; parent interest tag still applies; no error |
| 6 | Backfill: existing events pre-launch get sub_tags derived | Run derive-event-sub-tags as one-off for each `events` row |

### Rollout plan

1. **Day 1:** Schema migration + `SUB_TAG_PATTERNS` constant in code. Edge function `derive-event-sub-tags`. Trigger on event publish.
2. **Day 2:** Merchant UI for sub-tag selection.
3. **Day 3:** Trigger on bookings → `update_user_sub_tags_for`. Backfill `user_features.sub_tags` for any existing users.
4. **Day 4:** Backfill `events.sub_tags` for existing events. Smoke test matching pipeline (`04_MATCHING_ALGORITHM_V2.md` §4) reads sub-tags correctly.

No feature flag needed — additive change. If something breaks, sub_tags defaults to `{}` and matching falls back to parent-tag overlap (current behaviour).

### Failure modes worth naming

- **Substring matches are noisy.** "Hot chocolate cooking class" matches "yoga.hot" if the patterns aren't scoped. Mitigation: pattern matching is scoped per parent tag — only check `SUB_TAG_PATTERNS["yoga"]` if the event declared `interest_tag = yoga`.
- **Merchant disagrees with auto-derived sub-tags.** Merchant UI lets them edit. Stored sub-tags = union of derived + manual edits (last-write-wins on the manual list).
- **Sub-tag drift.** Adding new sub-tags to `SUB_TAG_PATTERNS` doesn't backfill old events. That's fine; new events pick them up; long-tail signal grows over time.

---

## Ticket 4 — Remove social scraping from onboarding

**Priority:** P0 (legal/privacy risk — must not ship with this feature live)
**Estimated effort:** 1 dev-day
**Canonical detail:** This ticket is canonical. Handover doc tech critique item 5.

### Problem

The v1 spec/early codebase referenced an onboarding step that asks users to connect Instagram/Facebook accounts to scrape their profile content for interest derivation. Multiple issues:

- **Platform ToS violation.** Meta's developer ToS prohibits scraping or unauthorised data extraction. The Instagram Graph API only exposes the authenticated user's own media — if "scraping" means anything beyond that, it's unauthorised. Even *with* the Graph API, the data we'd be allowed to retrieve isn't rich enough to derive meaningful interest signals.
- **GDPR + Australian Privacy Act risk.** Storing third-party profile data without an explicit lawful basis tied to *user benefit they understand* is risky. "We scraped your Instagram to guess your interests" is hard to defend at a Privacy Commissioner inquiry.
- **Better signal exists.** Behavioural sub-tags from event RSVPs (Ticket 3) are a richer, consent-clear, fully owned data source. No external dependency, no platform risk, improves with usage.

### Solution summary

Remove all references to social scraping from the onboarding flow, copy, codebase, and any DB columns that would store scraped data. Replace the onboarding step (if it exists in UI) with a "show your style" step that asks users to upload 0–3 photos for their profile (clearly framed as profile photos, no scraping).

### Investigation needed (day 0)

Before writing the ticket as "ship it," the implementer needs to grep the codebase for:
- Anything matching `instagram|facebook|meta_oauth|social_scrape|profile_import`
- Any `auth.users.app_metadata` or `profiles` columns named `instagram_handle`, `social_*`, etc.
- Any onboarding step components named like `SocialConnect`, `ConnectSocial`, `ImportFromInstagram`, `ProfileImport`.

If found, document the surface area in the ticket. If genuinely absent (i.e. the spec mentioned it but no code shipped), this becomes a docs-only update — strike the references from internal specs and ship.

### Schema changes (if scraping code exists)

```sql
-- Drop columns that store scraped data (audit grep first)
alter table public.profiles
  drop column if exists instagram_handle,
  drop column if exists scraped_interests,
  drop column if exists social_connections;

-- Drop any related tables
drop table if exists public.social_imports;
drop table if exists public.scraped_interests;

-- Drop OAuth credentials if stored
drop table if exists public.oauth_tokens_meta;
```

### Code changes

1. **Onboarding wizard** — remove the "Connect your socials" step. The wizard goes from 6 steps to 5 (matching `01_USER_WORKFLOW.md` §3).
2. **Replace with photo upload step** if not already present. Limit: 3 photos, 5MB each, stored in Supabase Storage `profile-photos` bucket.
3. **Delete edge functions** — `instagram-oauth-callback`, `import-social-profile`, anything similar.
4. **Delete client components** — `<ConnectSocial />`, `<ImportFromInstagram />`.
5. **Remove copy** — any UI strings referencing "connect your Instagram", "import from social", "we'll use your social profile to..." etc.
6. **Privacy policy update** — coordinate with whoever owns the privacy policy. Remove any clause that authorised social import. Make sure the new clause about photo upload is clear.

### Test cases

| # | Scenario | Expected |
|---|---|---|
| 1 | New user onboards | No social-connect step appears |
| 2 | Existing user with scraped data in profile | Data deleted from DB; profile shows only their explicit declarations |
| 3 | Search codebase for `instagram` / `facebook` / `meta_` / `social_` | Zero results in non-test code (test fixtures may reference for regression, that's fine) |
| 4 | Privacy policy reviewed by legal | Sign-off documented |

### Rollout plan

1. **Day 0 (investigation):** Audit grep. Document existing surface area.
2. **Day 1 morning:** Remove from onboarding UI. Add photo upload replacement step.
3. **Day 1 afternoon:** Drop schema. Delete edge functions. Delete client components.
4. **Day 1 EOD:** Privacy policy revision committed. Deploy.

This is destructive — no feature flag. If scraping code is in production, it should never ship publicly. If it's behind a feature flag already (because we knew it was risky), just leave the flag off and remove the code in a follow-up.

### Failure modes worth naming

- **Some users completed onboarding via social import** in test or beta. Their declared interests may be partly derived from scraped data. The migration should preserve `profiles.interest_tags` (user got to confirm them at the end of onboarding, they're consented declarations) but delete the raw scraped data columns.
- **Marketing or growth team has plans that depended on this feature.** Cancel them. Behavioural data + onboarding-quiz data is the path.

---

## Ticket 5 — Structured post-mutual-click proposal UI and data model

**Priority:** P0 (MVP-defining — without this there's no coordination layer at all)
**Estimated effort:** 6 dev-days
**Canonical detail:** `01_USER_WORKFLOW.md` §7

### Problem

When two users mutually click on each other, the v1 spec says "the system suggests a shared event." That's not enough. Users will need to:
- Confirm a specific event date and time
- Suggest a different event if the proposed one doesn't work
- Cancel or back out
- Coordinate "we're both attending — find each other at the venue"

Without a structured coordination layer, users will leak coordination off-platform (exchange Instagram handles in profile bios → DM on Instagram → Click loses the engagement loop and the data). The product decision (May 2026) is **no free-text DMs / no chat**. Structured proposals are the canonical replacement.

This makes structured proposals the only place coordination can happen on the platform. They have to be good.

### Solution summary

When a mutual click is detected, the system auto-creates an `event_proposals` row with a system-suggested event (selected by matching algorithm from events both users could attend). Either user can:
- **Accept** — both users now have a shared "going together" record on the event
- **Decline (with optional reason)** — proposal closes; system surfaces a new suggestion after 24h cool-down
- **Propose alternative** — pick a different event from the candidate set (UI shows up to 5 alternatives both could attend)
- **Add a one-line message** — single 200-char free-text field, validated against blocklist (no URLs, no phone numbers, no email patterns, no social handles)

No multi-turn messaging. No file/photo sharing. No reactions. The single-line note is the only freeform expression; everything else is structured.

### Schema changes

```sql
create type proposal_status as enum (
  'new',                  -- system-created, neither user has acted
  'event_proposed',       -- one user has selected/confirmed an event
  'accepted',             -- both users accepted; shared booking intent
  'declined',             -- one user explicitly declined; proposal closed
  'expired',              -- 7 days passed with no acceptance from second party
  'attended',             -- both attended a shared event together
  'dormant'               -- 30 days no activity, soft-archived
);

create table public.event_proposals (
  id uuid primary key default gen_random_uuid(),
  mutual_click_id uuid not null references public.mutual_clicks(id) on delete cascade,
  user_a_id uuid not null references auth.users(id),
  user_b_id uuid not null references auth.users(id),
  status proposal_status not null default 'new',

  -- Currently-proposed event (mutable as users counter-propose)
  proposed_event_id uuid references public.events(id),
  proposed_by_user_id uuid references auth.users(id),
  proposed_at timestamptz,

  -- One-line note (optional, validated, replaces chat)
  note text check (note is null or length(note) <= 200),
  note_by_user_id uuid references auth.users(id),
  note_at timestamptz,

  -- Acceptance tracking — both users must accept for status='accepted'
  accepted_by_user_a bool not null default false,
  accepted_by_user_b bool not null default false,
  accepted_at timestamptz,         -- when both flips became true

  declined_by_user_id uuid references auth.users(id),
  declined_at timestamptz,
  decline_reason text,             -- enum-ish: 'cant_make_it' | 'not_interested' | 'other'

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',

  constraint user_a_b_distinct check (user_a_id <> user_b_id),
  constraint user_a_lower check (user_a_id < user_b_id)  -- canonical ordering, prevents dup proposals
);

create unique index uq_proposal_pair_active
  on public.event_proposals(user_a_id, user_b_id)
  where status in ('new', 'event_proposed');

create index ix_proposals_user_a on public.event_proposals(user_a_id, status, updated_at desc);
create index ix_proposals_user_b on public.event_proposals(user_b_id, status, updated_at desc);
create index ix_proposals_expiring on public.event_proposals(expires_at)
  where status in ('new', 'event_proposed');
```

The `user_a_lower` constraint ensures `user_a_id < user_b_id` in canonical order — prevents creating two proposal rows for the same pair just because the click direction was different.

RLS:

```sql
alter table public.event_proposals enable row level security;

create policy proposals_select_own
  on public.event_proposals for select
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

create policy proposals_no_user_inserts
  on public.event_proposals for insert
  with check (false);   -- all inserts via edge function

create policy proposals_update_own
  on public.event_proposals for update
  using (user_a_id = auth.uid() or user_b_id = auth.uid())
  with check (
    -- Allow only specific column changes via RPC; raw UPDATE forbidden
    false
  );
```

Updates flow through edge function RPCs only — never raw UPDATE from client.

### Code changes

1. **Trigger `on_mutual_click_create_proposal()`** — fires AFTER INSERT on `mutual_clicks`. Calls edge function async via `pg_notify` to:
   - Pick a candidate event both users could attend (from `match_candidates_user_event` materialised view, intersected for both users; see `04_MATCHING_ALGORITHM_V2.md` §6)
   - Create `event_proposals` row with `status='new'`, `proposed_event_id` = top candidate
   - Insert notifications for both users (`mutual_click` notification type, payload includes proposal_id)

2. **Edge function `proposal-accept`**
   - Auth: caller must be user_a or user_b of the proposal
   - Sets `accepted_by_user_X = true` for the calling user
   - If both flags now true → status = 'accepted', accepted_at = now()
   - Notify the other user

3. **Edge function `proposal-decline`**
   - Auth check
   - Sets status = 'declined', declined_by_user_id = caller, decline_reason = input
   - Notify the other user
   - Schedule re-suggestion in 24h (insert a delayed `notifications` row or use cron)

4. **Edge function `proposal-counter`** — propose a different event
   - Auth check
   - Input: `event_id` (must be in the candidate set both users qualify for)
   - Validate the event hasn't passed, hasn't sold out, both users aren't already booked
   - Reset accept flags to false (counter-proposal requires re-acceptance)
   - Set `proposed_event_id`, `proposed_by_user_id`, `proposed_at = now()`, status = 'event_proposed'
   - Notify other user

5. **Edge function `proposal-add-note`**
   - Auth check
   - Input: `note` (≤200 chars)
   - Validate against blocklist regex: URLs (`https?://`, `www\.`), email patterns (`\w+@\w+`), phone patterns (`\+?\d{8,}`), social handles (`@\w+`, `#\w+` if it looks like a handle context)
   - If validation fails: return `invalid_content` with reason
   - Set `note`, `note_by_user_id`, `note_at = now()`
   - Notify other user

6. **Edge function `proposal-list-alternatives`** — returns up to 5 events both users could attend
   - Query: events where both users are in candidate set, where neither user is currently booked, where event hasn't started, sorted by combined match score
   - Used by the "Propose alternative" UI

7. **Cron `expire-stale-proposals`** — runs daily
   - `update event_proposals set status = 'expired' where status in ('new', 'event_proposed') and expires_at < now()`
   - 30 days after last update without attended status → mark `dormant`

8. **Client UI components**:
   - **ProposalCard** — shown on dashboard when active proposal exists. States: new (you have a suggestion), event_proposed (other user countered, your turn), accepted (you're both going), declined (closed), expired.
   - **PropALEventPicker** — modal with 5 alternative events as cards. Pick one → calls `proposal-counter`.
   - **NoteInput** — single-line text input with character counter (200 max), client-side blocklist warning, submit calls `proposal-add-note`.
   - **DeclineModal** — three radio buttons for reason. Submit calls `proposal-decline`.

### Test cases

| # | Scenario | Expected |
|---|---|---|
| 1 | User A clicks B, then B clicks A | Mutual click trigger fires, proposal row created with suggested event |
| 2 | User A accepts | accepted_by_user_a=true, status still 'new', user B notified |
| 3 | User B accepts after A | Both flags true, status='accepted', accepted_at set, both notified |
| 4 | A declines | status='declined', B notified, 24h re-suggestion scheduled |
| 5 | A counters with different event | accept flags reset, proposed_event_id updated, B notified |
| 6 | User attempts to add note with phone number "call me 0412345678" | rejected with `invalid_content` |
| 7 | User attempts URL injection "let's chat at https://signal.me/abc" | rejected |
| 8 | User attempts "find me on insta @username" | rejected (social handle pattern) |
| 9 | Innocuous note "looking forward to meeting!" | accepted |
| 10 | Proposal sits 7 days with no acceptance | Cron flips to 'expired' |
| 11 | Two users have a 'declined' proposal, mutually click again later | New proposal row created (unique constraint allows because previous was declined, not active) |
| 12 | Counter-proposal lists alternatives | Up to 5 events both users qualify for, none past, none already booked by either |
| 13 | User tries to direct-update proposals.note via PostgREST | RLS blocks (only edge functions can write) |

### Rollout plan

1. **Week 1:** Schema, trigger, edge functions for new/accept/decline. No UI yet — test via direct API calls in staging.
2. **Week 2:** Counter-propose + alternatives function. Note + blocklist validation.
3. **Week 3:** Client UI components, integrated into dashboard. Internal QA.
4. **Week 4:** Soft-launch to beta cohort (internal team + 50 invited users). Watch metrics for week 4–5: proposal acceptance rate, time-to-acceptance, decline reasons, note-validation rejection rate.
5. **Public launch:** ship with platform launch.

**Coordinated with:** `/messages` route deprecation per `01_USER_WORKFLOW.md` §7.7. The deprecation ships in the same deploy as the proposal UI flag flip — users are never in the "no messages, no proposals" state. Implementer of T5 reads §7.7 before sequencing the release.

### Failure modes worth naming

- **No mutually-attendable events exist.** Both users live in inner Sydney, but there's literally no event in the next 60 days that both qualify for (sold-out, already-booked, mismatched-cohort filter). System should still create the proposal row but with `proposed_event_id = null` and surface to user as "We're looking for an event you'd both enjoy — check back soon." Don't dead-end the mutual click silently.
- **Note blocklist false positives.** "I'm @ the cafe" might trigger the @handle filter. Calibrate the regex to require a word character before/after with no whitespace. Tune the regex against a corpus of innocuous notes during beta.
- **Users find creative ways to share contact info.** "My number is twoseven six...". This is unavoidable in any single-line text field. The defence is: (a) blocklist common patterns, (b) signal-to-noise — most notes are innocuous, and explicit blocklist evasion is rare, (c) report button on the proposal lets the other user flag the note (per `03_ADMIN_WORKFLOW.md` §4).
- **Counter-proposal ping-pong.** A and B keep countering each other indefinitely. Soft limit: after 5 counter-proposals on a single mutual click, lock the proposal until accepted/declined. Avoids edge-case spam.
- **Both accept then one cancels.** The proposal stays `accepted`, but if either user cancels their booking on the event, the proposal status doesn't change — Click doesn't unilaterally re-evaluate it. The other user gets a `proposal_partner_cancelled` notification. They can decline the proposal manually if they want to back out too.

---

## Summary — sequencing across all 5 tickets

| Week | Tickets shipping | Tickets in progress |
|---|---|---|
| 1 | T4 (remove scraping) | T1, T2 |
| 2 | T1 (pending bookings), T2 (pull-on-focus) | T3, T5 |
| 3 | T3 (sub-tags) | T5 |
| 4 | T5 stage 1 (schema + edge fns) | T5 stage 2 (UI) |
| 5 | T5 stage 2 | — |

T4 first because it's a legal risk on every day it stays in code. T1 next because it's a correctness bug that fires on the first sold-out event. T2 because it's foundational for dashboard trust. T3 unblocks T5 and matching v2. T5 last because it's the largest scope and depends on the others being stable.

After Week 5, the platform has: correct booking semantics, a real coordination layer (no DMs), behavioural matching signal, and is legally clean to launch.
