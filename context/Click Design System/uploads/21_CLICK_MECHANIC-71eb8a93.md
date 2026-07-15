<!-- Last updated: 2026-06-26 | Revision: v10 (consume the raised capacity floor: §8/§4 now state the suggestion guard as platform_settings.suggestion_capacity_floor (default 3, structural min 2), owned by 09 §6; floor reduces-not-eliminates the async-follow race, atomic accept (B5.1) + waitlist (B5.4) are the seat-safety. No state-model change; prior v9 content intact.) -->
# Click — Post-Event Click Mechanic Spec
## `21_CLICK_MECHANIC.md`
**Audience:** Doan (implementation)
**Status:** Spec for build — **canonical owner of the click mechanic end to end.** Two parts: **Part A — the SEND layer** (schema, the two click processes — discovery + post-event, window, caps, detection transaction, expiry, invalidation, prompt timing) and **Part B — POST-MUTUAL COORDINATION** (the propose→confirm handshake, full-event handling, capacity races, dormant/revival, mutual lifecycle). The *matching/scoring* engine that decides who to suggest (`mutual_clicks` scoring, suggestion *generation*, snapshot access, discovery cards/Radar) is owned by `09_CLICK_WITH_ME_AND_RADAR.md`. Ownership map: `00_MASTER_INDEX.md`.
**Consolidation note (June 2026):** the former standalone `23_POST_MUTUAL_COORDINATION.md` is now Part B of this file — send and coordinate are one mechanic. `09` stays separate (it's the matching engine, a different concern).
**Foolproofing pass (June 2026):** added the explicit check-ordering rule + window-edge outcome to §6.1 (closes the capped-attacker and boundary probes), the cap-stranding swap path to §6.9 (+ `click_swaps` schema), the no-show-guard gap note to §6.4, the complete end-to-end **journey scenario matrix B8.5** (every send/mutual/coordination/ending state with its foolproof guarantee), and replaced the dead loss-framed "winding down" copy. `09` was reconciled to this file's canonical model in the same pass (its stale `clicks`/per-mode-mutual schema, dead `detect_mutual_click` trigger, `renewed`-boolean expiry, and `event_proposals` handshake are all marked dead and point here). `21A` gained four test arms for the §6.1 additions.
**Last updated:** June 2026
**Supersedes:** any prior model with pre-event clicking on the event page (removed June 2026). Clicking is now two processes: discovery (Process 1) + post-event (Process 2); the event page is context-only.


---

# PART A — THE SEND LAYER

## 1. Product decision

**Two click processes, two surfaces (locked June 2026 — supersedes the prior pre-event/post-event model).** Person-clicking NEVER happens on a live event page. The event page is context-only (it shows who's going and your shared tags, for recognition — see §7A). Clicking a person happens in exactly two places:

| Process / Surface | Moment | What happens | Prompted? |
|---|---|---|---|
| **Process 1 — "Click with someone"** (discovery / dashboard, `09` + `12_DISCOVERY_PAGE.md`) | Anytime, browsing people | A clicks a compatible person (shared interest/life tags, quiz, +/- open-to-dating). **Anonymous, person-bound — no event.** Stays live **7 days**, then silently expires if not reciprocated. If the other person clicks back within the window → **mutual** (the reveal) → suggest a shared-tag, has-capacity event. | **Never.** It exists for users who go looking — the restraint keeps Click from feeling like a dating app. |
| **Process 2 — "Did you click with someone?"** → Who-was-there (§7B) | Post-event, end + 2h | The conversion moment: you **attended** (held a booking at event end), now click someone you met. **Event-bound** (`event_id` set). 48h window. Mutual-gated. Two yes-branches: "we clicked" (offline closure, no suggestion) vs "we clicked — suggest another" (mutual → next shared-tag event). | **Yes — the one prompted moment.** One prompt, never repeated. |

The behavioural sequence the whole mechanic exists to produce: **(Process 1)** discovery click → mutual → suggested event → attend; **and/or (Process 2)** attend → prompted post-event → click → mutual → suggested next event → **second booking together**. The last arrow is the retention engine. **Activity-first is preserved by a binding rule: a mutual ALWAYS produces a shared-event suggestion, never a chat (no DMs, ever).** The click means "let's do something together"; the only post-mutual surface is an event proposal.

**Language rule (binding, code + copy):** it is always **"click with someone"** — never "click on someone." `click_with`, `clicked_with` in identifiers. Never "match" anywhere, including variable names, comments, and analytics event names.

---

## 2. Core rules

1. A user can click with another user via **two paths**: **(Process 1, discovery)** anonymously, from the people-discovery surface (`09`/`12`), with no event required — the click is person-bound; or **(Process 2, post-event)** from the Who-was-there surface of an event they **attended** (held a confirmed booking or claimed guest spot at event end, `19_GUEST_RSVP.md` §9). **Person-clicking never happens on a live/upcoming event page** — that surface is context-only (§7A). Unclaimed guests have no profile and structurally cannot click or be clicked with.
2. Clicks are anonymous and one-way until mutual. Non-mutual clicks are never revealed, ever — including after expiry. **There is no "Likes You" queue:** a click that expires is gone; a later click is a fresh click needing its own reciprocation (no Bumble-style durable like — this is required by the anonymity contract, since a persistent unilateral like would have to be shown to the receiver to be reciprocable).
3. Mutuality is evaluated at the **pair level, within a process**: a discovery click (Process 1) matches a reciprocal **discovery** click; a post-event click (Process 2) matches a reciprocal click **on the same event** (`event_id` equal). The two processes never cross-match (a discovery click and a post-event click between the same pair are different contexts and do not form a mutual with each other) — but either, reciprocated within its own process, forms the one pair-level mutual. **One active mutual per pair regardless of which process formed it** (the partial unique index on `status='active'` enforces this).
4. Click window per row depends on process: a **discovery** click is active from creation for **7 days** (person-bound, no event anchor); a **post-event** click is active from creation until `event_end_time + 48h` of its event. Expired rows can never participate in a mutual.
5. **Click budgets, per process.** **Post-event:** max 3 clicks per user per attended event (the room you were in). **Discovery:** a separate rolling cap (`platform_settings.discovery_click_cap`, default tunable — prevents unlimited swiping; not an event budget). Both hard-enforced at the API layer inside the insert transaction. Receiving has no cap. **Surface rule (binding):** the post-event "N clicks left" counter renders only on Who-was-there (§7B). The discovery cap is enforced silently (a browse feed should not feel like a depleting budget); never show "0 clicks left" on discovery.
6. Intent travels with the click (`clicks.intent_mode` — the sender's active intent at send time; romantic mode is send-gated by `10_ROMANTIC_INTENT_AND_DATING_MODE.md` compatibility rules). The mutual surfaces **both** users' intents: equal → "You're both here for friends"; different → both shown ("You're here for friends · they're open to more"). **One active mutual per pair regardless of intent mix** — this supersedes the earlier per-mode coexistence model (`09` §1, June 2026). Reciprocal clicks *while a mutual is already active* are a no-op (they're already connected — don't create a duplicate). But a pair whose mutual has ended — `connected`, `released`, or `expired` — can absolutely click again and start a fresh cycle (B7.8). "We clicked" closes a chapter; it never locks the door.

---

## 3. Schema

```sql
create type click_status as enum ('pending', 'mutual', 'expired', 'invalidated');

create table clicks (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id),
  receiver_id uuid not null references profiles(id),
  event_id uuid references events(id),      -- NULLABLE (June 2026): NULL for Process-1 discovery
                                            -- clicks (person-bound, no event); SET for Process-2
                                            -- post-event clicks. Two-process model — see §2 rule 1.
  intent_mode text not null,                -- sender's intent at send time (rule 6)
  surface text not null check (surface in ('discovery', 'who_was_there')),
                                            -- 'discovery' = Process 1 (people surface, no event);
                                            -- 'who_was_there' = Process 2 (post-event). Feeds the
                                            -- 22_ANALYTICS surface split. 'event_page' is DEAD —
                                            -- pre-event clicking removed June 2026.
  status click_status not null default 'pending',
  expires_at timestamptz not null,         -- discovery: created_at + 7 days; post-event:
                                            -- event_end_time + 48h. Denormalised at insert (§5).
  mutual_click_id uuid references mutual_clicks(id),
                                            -- FK to the RELATIONSHIP layer (09), not a self-FK:
                                            -- mutual_clicks owns lifetime/renewal/terminal-success(connected, =09's legacy 'converted')/suggestions
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint no_self_click check (sender_id <> receiver_id),
  -- event_id presence must match surface (integrity guard):
  constraint click_surface_event_consistency check (
    (surface = 'discovery'      and event_id is null) or
    (surface = 'who_was_there'  and event_id is not null)
  )
);

-- Two partial unique indexes replace the old single uq_click (which assumed event_id NOT NULL):
--   Process 1 (discovery): one LIVE discovery click per ordered pair at a time.
create unique index uq_click_discovery on clicks (sender_id, receiver_id)
  where event_id is null and status = 'pending';
--   Process 2 (post-event): one click per ordered pair per event (as before).
create unique index uq_click_post_event on clicks (sender_id, receiver_id, event_id)
  where event_id is not null;

create index idx_clicks_receiver_pending on clicks (receiver_id, status) where status = 'pending';
create index idx_clicks_expiry on clicks (expires_at) where status = 'pending';

-- Post-event budget swap (§6.9): at most ONE swap per sender per event, so releasing +
-- re-spending a click can never become an unlimited-clicks loophole. The swap itself is an
-- invalidate (released pending click) + insert (new click) in one transaction; this row is
-- the guard that caps it at one.
create table click_swaps (
  sender_id uuid not null references profiles(id),
  event_id  uuid not null references events(id),
  released_click_id uuid not null references clicks(id),
  new_click_id      uuid not null references clicks(id),
  created_at timestamptz not null default now(),
  primary key (sender_id, event_id)   -- one swap per sender per event, hard-enforced
);
```

**RLS:** sender can select own sent rows (but the API must never return whether a reciprocal pending row exists — see §6.1). Receiver can never see pending rows addressed to them. Both parties can see rows with `status = 'mutual'`. Write access via Edge Function only — no direct client inserts. `click_swaps` is service-role write only; never client-readable (it would reveal which receivers a sender released, a soft anonymity leak).

---

## 4. Mutual detection — race condition handling

Two users clicking with each other near-simultaneously is the *expected* hot path (post-event, both on their phones on the bus home). Naive check-then-insert produces either two pending rows that never resolve, or double notifications.

**Required pattern — single transaction with lock ordering:**

```sql
-- inside one transaction, in the insert Edge Function
-- $surface ∈ ('discovery','who_was_there'); $event is NULL for discovery, set for post-event.
-- $expires = (discovery) now() + interval '7 days' : (post-event) event_end + interval '48 hours'.
begin;

insert into clicks (sender_id, receiver_id, event_id, surface, intent_mode, expires_at)
values ($sender, $receiver, $event, $surface, $intent, $expires)
on conflict do nothing       -- hits uq_click_discovery OR uq_click_post_event per surface
returning id into v_click_id;

-- lock and check the reciprocal row — MATCH WITHIN THE SAME PROCESS (rule 3):
--   discovery click matches a reciprocal DISCOVERY click (event_id IS NULL on both);
--   post-event click matches a reciprocal click ON THE SAME EVENT (event_id = $event).
select id into v_reciprocal_id
from clicks
where sender_id = $receiver
  and receiver_id = $sender
  and status = 'pending'
  and expires_at > now()
  and (
        ($surface = 'discovery'     and event_id is null)
     or ($surface = 'who_was_there' and event_id = $event)
      )
order by created_at
limit 1
for update;

if v_reciprocal_id is not null then
  -- Create the relationship-layer row. The 09 detect_mutual_click() TRIGGER is DEAD —
  -- this transaction replaces it (and preserves its business rules: block gate and
  -- self-click guard run as pre-checks in this edge fn).
  insert into mutual_clicks (user_a_id, user_b_id, intent_a, intent_b,
                             mutual_at, expires_at, status)
    values (least($sender, $receiver), greatest($sender, $receiver),
            /* intent_mode of a's click */, /* intent_mode of b's click */,
            now(), now() + interval '7 days', 'active')
    on conflict do nothing      -- partial unique idx: one ACTIVE mutual per pair, any intent mix
    returning id into v_mutual_id;

  if v_mutual_id is not null then
    update clicks set status = 'mutual', mutual_click_id = v_mutual_id, updated_at = now()
      where id in (v_click_id, v_reciprocal_id);
    -- enqueue ONE mutual notification job keyed on v_mutual_id (idempotent).
    -- BOTH processes resolve to the same outcome: reveal + a SHARED-EVENT SUGGESTION
    -- (09 §6, must share a tag + have >= platform_settings.suggestion_capacity_floor free seats
    -- 2026-06-24; "almost-full" was display-badge only, never enforced here). No pre-event-mutual
    -- meeting-point variant any more (pre-event clicking removed June 2026) — the mutual
    -- always produces a suggested event, never a chat (activity-first, §1).
  end if;
end if;

commit;
```

Because both concurrent transactions attempt `FOR UPDATE` on each other's row, one blocks until the other commits; the second transaction then sees a committed `pending` row and resolves the mutual. Postgres-level, no advisory locks, no external queue needed for correctness.

**Notification idempotency:** job key = `mutual:{mutual_click_id}`. Unique constraint on the jobs table prevents double-send on Edge Function retries.

**Cap check (rule 5) lives inside this same transaction, before the insert** — and differs by process:
- **Post-event:** `select count(*) from clicks where sender_id = $sender and event_id = $event and status <> 'invalidated'` must be < 3 (per attended event).
- **Discovery:** `select count(*) from clicks where sender_id = $sender and event_id is null and status = 'pending'` must be < `platform_settings.discovery_click_cap` (rolling live-discovery-click cap, not an event budget).

Same-transaction counting is what keeps the enforcement count and the analytics count from drifting (`22_ANALYTICS.md` §2.4). Invalidated clicks refund budget — a click voided by a cancellation shouldn't burn one of the post-event three.

---

## 5. Expiry

**Two distinct click timers, by process (binding).** A **post-event** click expires at `event_end_time + 48h` — event-anchored, because it means "I noticed you at THIS event," and once the event is ~2 days past the context is gone. A **discovery** click expires at `created_at + 7 days` — person-bound (no event to anchor to), Hinge-like: it stays live a week waiting for the other person, then silently expires if not reciprocated. Separately, the *mutual* (once formed, either process) runs its own 7-day relationship clock (Part B) — do not conflate the discovery-click 7-day window with the mutual's 7-day clock; they are different rows on different tables. There is no persistent "Likes You" queue: an expired click is gone, and a later click is a fresh one needing its own reciprocation (§2 rule 2).

**Correctness via read-time filtering, not cron.** Every query that evaluates mutuality or lists clicks filters `expires_at > now()` for pending rows. A row past expiry is *functionally* expired the moment the clock passes, regardless of its status column.

**Hygiene via scheduled job (pg_cron, daily):**

```sql
update clicks set status = 'expired', updated_at = now()
where status = 'pending' and expires_at < now();
```

This ordering means a missed or delayed cron run can never cause incorrect behaviour — only stale status labels. Never make the cron job load-bearing for correctness.

---

## 6. Edge cases and failure modes

### 6.1 Probing attack (critical)
The API response for "send click" must be **identical** whether or not it created a mutual. The mutual is revealed only via the asynchronous notification. If the synchronous response differs in shape, timing pattern, or status code, a client can detect "they already clicked with me" before committing — which breaks anonymity.

**The full contract, fixtures, timing floor, and runnable test suite live in `21A_PROBING_ATTACK_TEST.md`** — a required pre-launch gate, not optional hardening. Four states are probeable, not one: mutual (P1), blocked (P2 — blocked sends return the normal success response, never an error), **privately-attending vs absent (P3 — both return the identical `not_eligible` response, or the visibility toggle is defeated by API)**, and duplicate sends (P4 — quiet success, budget not re-spent). The send-click fn carries a constant response-time floor (`FLOOR_MS ≈ 350ms`, above the slowest path's p99) because the mutual path's extra in-transaction work is otherwise extractable from latency over a few hundred samples.

**Check-ordering rule (binding — closes the capped-attacker probe).** The handler MUST evaluate **all receiver-eligibility branches before any sender-own-state branch**, OR compute every branch and select the response at the very end. Concretely the order is: (1) receiver eligibility → may yield `R_NOT_ELIGIBLE`; (2) block gate → folds into `R_OK`; only then (3) sender photo → `R_PHOTO`; (4) sender cap → `R_CAP`. If sender-state were checked first, a deliberately-capped or photo-less attacker could send to a `hidden` vs `absent` receiver and, if the short-circuit differed, distinguish them — defeating P3 through a capped account. `R_CAP`/`R_PHOTO` are safe to distinguish **only because they depend on nothing about the receiver**; that property holds only if they are evaluated *after* eligibility has already collapsed hidden/absent/expired into one outcome. 21A carries an explicit arm for this (capped attacker → hidden vs absent must stay byte-identical).

**Window-edge outcome (binding).** A send to an event whose click window has closed (`now() > event_end_time + 48h`) returns **`R_NOT_ELIGIBLE`** — byte-identical to hidden and to absent. Expiry is read-time (§5), so "window closed" must never surface as a distinct shape, a different status class, or a faster/slower path; it is just another input that collapses to not-eligible. There is no fifth outcome at the boundary.

### 6.2 Booking cancelled / refunded after clicking
Cancellation or refund of the booking that grounded a click → `status = 'invalidated'` on all of that user's clicks (sent *and* received) for that event, inside the same transaction as the cancellation. An invalidated row never participates in mutuality. If the click was already `mutual`, the mutual stands — the connection happened; we don't retroactively unmake it.

### 6.3 Event cancelled by merchant
All non-mutual clicks for the event → `invalidated`, in the same transaction as event cancellation. Existing mutuals stand.

### 6.4 No-shows
Optional merchant check-in EXISTS in MVP (decided June 2026 — the `02` door list sets `bookings.checked_in` / `guest_spots.attended`; `19` badge gating, `22` attendance metrics and the `06` copy gate use it) — but **clicking never requires it**: for click purposes "attended" = "held a confirmed booking or claimed guest spot when the event ended." A no-show can therefore click with people they never met. Accepted MVP risk — the 3-click cap and the attendance requirement bound the abuse. Log it; revisit if reports correlate with no-show senders. Never make check-in load-bearing for the mechanic.

**Phase-2 forward-note (no launch change) — no-show + click abuse surface.** Because "attended" = held-booking-at-event-end (not check-in), a user could adversarially book many events solely to reach Who-was-there and click people they never met, never attending. Low severity at pilot trust levels; not fixed for launch. Recommended Phase-2 mitigation, reusing the trusted-merchant auto-revoke pattern (admin-only): a trust-flag decay on a high book-but-never-checked-in ratio. Recorded here so it isn't rediscovered as a surprise — no behavioural change at launch. The free-event no-show suppression (Part B §B7.3 — lose the post-event surface for 30d after 2 no-shows in 90d) keys on `bookings.attended = false`, which is only ever set when the merchant runs the optional door list. **If a merchant never checks anyone in, `attended` is never false, and the suppression never fires for that event** — the guard silently doesn't exist where check-in is skipped. This is accepted for MVP because (a) the cap + attendance-window already bound the blast radius, and (b) making the guard depend on check-in would make check-in load-bearing, which is banned above. Mitigation if abuse appears: treat a confirmed booking on an event the merchant *did* run a door list for, where the user was *not* on it, as the only `attended=false` signal; never infer no-show on un-checked events. Track `no_show_clicks` (a click whose sender was `attended=false`) so the rate is visible even on events with check-in, and revisit thresholds from data rather than assumption.

### 6.5 Block / report
Block in either direction → all non-mutual click rows between the pair `invalidated`, both users permanently excluded from each other's attendee and "who was there" lists, and the pair excluded from future mutuality evaluation (enforce in the insert function, not just UI). If a mutual already exists, block tears it down: the pair's click rows → `invalidated`, the `mutual_clicks` row → `'expired'` (silently — corpus convention, `01_USER_JOURNEY.md` §6.3), any pending event suggestion between them cancelled.

### 6.6 Visibility toggle ("attend privately")
Users can hide themselves from attendee/who-was-there lists per event or globally. Consequence the user must be told at toggle time: **"While you're hidden, others can't click with you."** Hidden users can still see lists and send clicks — but their outbound clicks can only ever become mutual if the receiver later appears in a shared event where the hidden user is visible, which in practice means: hidden = receiving disabled. Surface this honestly in the toggle copy; do not let users discover it by silence.

**Schema (this toggle previously had none):**
```sql
alter table bookings    add column visible_to_attendees boolean not null default true;
alter table guest_spots add column visible_to_attendees boolean not null default true;  -- claimed guests get the same control
alter table profiles    add column default_attend_visibility boolean not null default true; -- seeds the per-booking flag at booking time
```
Both surfaces (§7A, §7B) filter on it. The toggle lives on the booking confirmation screen and the booked event page; copy shown at toggle time, as above.

### 6.7 Account deletion
All click rows where the user is sender or receiver are hard-deleted with the account (not soft-deleted — this is PII-adjacent relational data). Counterparty experiences silent disappearance of any pending click; mutuals disappear from their list. No notification.

### 6.7a Ban / suspension tears down the social graph (SAFETY — critical)
A ban or suspension is usually a *consequence of a safety report* (`03_ADMIN_JOURNEY.md` §5) — so it must not leave the offender connected to the people they're being removed to protect.
- **On ban (`profiles.is_banned = true`):** all the user's `pending` clicks → `invalidated`; all their `active` mutuals → `expired` (the permanent terminal, like a block — NOT `released`, which is re-clickable); they vanish from every Who's-going / Who-was-there / discovery surface immediately (already gated by the suspension RLS, but the *mutual teardown* must be explicit). Counterparties experience silent disappearance, exactly like a block from the other side — no "X was banned" notice (that's both a privacy issue for the banned user and a distress signal for the counterparty).
- **On suspension (temporary, `suspended_until`):** clicks/mutuals are **frozen, not torn down** — the user can't act (send, propose, accept) while suspended, and is hidden from discovery, but `active` mutuals are preserved so a wrongful/expired suspension doesn't destroy legitimate connections. On reinstatement they resume where they were (subject to the normal 7-day coordination clock, which is paused during suspension).
- **Urgent-report auto-suspension** (`03` §5 — safety_threat/underage/inappropriate auto-suspend social visibility pending review) uses the suspension path: frozen, hidden, reversible if the report is dismissed. Only a confirmed ban tears the graph down permanently.

### 6.7b Age gate in the click layer (SAFETY — non-negotiable)
The platform is 18+ (`01_USER_JOURNEY.md` signup age-gate), but the click layer asserts it **independently** rather than trusting the signup gate alone — defence in depth on the highest-risk surface:
- A user whose `date_of_birth` does not compute to ≥18 **cannot send or receive clicks, cannot appear in any attendee/discovery surface, and cannot form a mutual** — enforced in `send_click()` and the candidate-eligibility query, not just at signup. If an under-18 account exists for any reason (data error, DOB later corrected, a region defining "minor" above 18), the click mechanic refuses it structurally.
- Any account flagged `underage` by a report (`03` §5) is frozen immediately (account-level, per the safety system) — which by 6.7a freezes all their clicks/mutuals pending verification.
- This is the one gate that is *never* softened for funnel/engagement reasons. A platform that arranges in-person meetings cannot have a minor in the social graph, full stop.

### 6.8 Clock edge — clicking during the event
Window opens at booking, so in-event clicking is allowed. Fine. The *prompt* ("Did you click with someone?") fires at `event_end_time + 2h` — late enough that they've left, early enough that the night is fresh — **deferred to 09:00 local when +2h lands between 22:00–09:00** (a midnight push after a 10pm class is hostile; the deferral is one line in the cron). **This supersedes the 12h timing previously specced in `01`/`06`/QA — those docs now defer here.** The prompt carries the four locked responses (`06_RETENTION_AND_ENGAGEMENT.md` §2.2 — they capture attendance and feedback, not just clicks), and "Loved it — clicked with someone" opens Who-was-there (§7B). One prompt only. If notifications are disabled, the post-event state appears in-app on next open. Never re-prompt.

### 6.9 Receiver has hit nothing — sender at cap
3-click cap is per sender per event. Receiving has no cap. Enforce cap in the Edge Function with a count query inside the insert transaction (the unique constraint doesn't protect against 4 clicks to 4 different people).

**Stranding is largely dissolved by the two-process model.** The old stranding case — "spent all 3 clicks pre-event on photos, then met someone post-event and hit the cap" — **no longer exists**, because there is no pre-event clicking: the 3-per-event budget is spent *only* post-event, on people you actually met. So the budget is now naturally aligned with the valuable case from the start.

What remains is the simpler honest-cap UX:
1. **The post-event picker shows remaining budget before the user invests attention.** Who-was-there (§7B) selection cap = remaining budget; if remaining = 0 the surface opens in a **spent state**, not a picker: *"You used your 3 clicks for this event already. They're with the people you picked earlier."*
2. **The post-event "swap" still exists** as a courtesy: within the 48h window the user may release one of their own still-`pending` post-event clicks for this event and re-spend it (e.g. clicked the wrong person, or met someone better later in the window). Hard rules unchanged: (a) only `pending` post-event clicks releasable — a `mutual` is never releasable; (b) exactly **one** swap per event (`clicks_swapped` per sender/event); (c) the released receiver is **never notified** (silent, anonymity holds); (d) `R_OK` either way, same timing floor.
3. **If all 3 became mutuals** — three mutuals from one event is success, not a failure to paper over; the next event is the next budget.

Discovery clicks (Process 1) have their own rolling cap (rule 5) and no event-budget interaction — they never strand a post-event click and vice versa.

---

## 7A. The event page — context only (NO clicking)

**Pre-event person-clicking is removed (June 2026).** The unlocked event page shows *who's going* purely as context — recognition and anticipation, never a click surface. You cannot click a person from an event page, before or during the event. Clicking happens only via Process 1 (discovery, `09`/`12`) or Process 2 (post-event, §7B).

- Lives on the **event page, unlocked state only** (confirmed booking or claimed guest spot), as a section below the event details. Event-first by layout: the activity is the page, the people are context.
- **Privacy threshold:** renders only when ≥ `platform_settings.fomo_min_cohort` (3) attendees are *visible*; below that it is absent (not an empty state). Same de-anonymisation rail as FOMO (`04_TAG` §4d).
- Shows visible attendees (`visible_to_attendees`, §6.6): first name, photo, **shared interest/life tags, quiz overlap, and "open to dating" only if BOTH are** (`10` §6 — romantic signal is bidirectional-consent). Sensitive life tags never shown (FOMO privacy rails). Unclaimed guests structurally absent. Blocked pairs mutually invisible.
- **No "Click with" button anywhere on this surface.** Its job is "here's who you'll meet and what you share," so people can recognise each other in the room. The click comes afterward (Process 2), once they've actually met.
- Section heading copy: **"Who's going"** (plain language — never "See who's clicking in", per `CLICK_LANGUAGE.md`).

## 7B. The post-event surface ("Who was there") — Process 2

- Available from `event_end_time` until window close (event_end + 48h), to attendees who **held a confirmed booking or claimed spot at event end** (attendance-gated — booking alone isn't enough; you must have been there).
- Shows visible attendees with first name, photo, shared interest/life tags, and intent label. Clicking: `surface = 'who_was_there'`, `event_id` set, post-event budget (3 per event, rule 5).
- **The two-branch "yes" (binding).** The post-event prompt's positive paths split:
  - **"We clicked" (offline / sorted)** — they swapped numbers or are otherwise sorted. Recorded as a connection signal; **NO event suggestion follows.** This is the graceful "we're good, don't suggest anything" path. Maps to `connected_reason = 'we_clicked'` if/when mutual (or simply a logged post-event click otherwise).
  - **"We clicked — suggest another event"** — wants to do another thing together. Produces a suggested event **only if mutual** (the other person also clicked, either branch). One-sided never triggers a suggestion (anonymity: A never learns B didn't reciprocate).
- **Already-clicked card-states (still apply on this surface):** an attendee the viewer already has an `active` mutual with shows **"You two clicked ✨"** (taps to the existing mutual, no new click); an attendee the viewer has a still-`pending` **post-event** click to (this event) shows **"Clicked — we'll let you know if it's mutual ✨"** (derived only from the viewer's own outgoing click — never reveals the other side). `connected`/`released` pairs stay clickable (re-click is first-class, B7.8); `suppressed`/`expired`/blocked attendees are not shown.
- Entry points: the post-event prompt ("Did you click with someone?"), and the event card in "Your past events."
- **Selection cap = remaining post-event budget** (3 minus this event's earlier sends). The "select up to 5" previously in `01`/`06`/QA is dead.
- Empty/expired state: *"This one's wrapped up. Your next event is where the good stuff happens."* → feed link.
- After the window closes the list is gone. Scarcity is the feature: the 48 hours is what makes people act. Do not extend it on request.

---

## 8. Mutual click → event suggestion

On mutual (either process): both users get the notification (copy in `click_mechanic_explainer_copy.md`), then a read-only snapshot of the other person (served via `get_profile_snapshot()`, `01` §6.1) and a **suggested shared event** — there is one outcome now, not a pre/post split:

- **Every mutual → 1–3 suggested upcoming events** ranked by overlap of both users' interest/life tags, with the first-mutual price bias (`09` §6 — the reward for reciprocated interest must never be a 2×$40 paywall). **Every suggested event must share at least one tag with the pair and must have at least `platform_settings.suggestion_capacity_floor` free seats** (capacity guard — a mutual is a two-person plan; the generator enforces it at generation, `09` §6 Step 1 owns the predicate). The floor is a tunable setting, **default 3** (raised from the bare structural 2 on 2026-06-26): the structural minimum to seat a pair is 2, but suggesting an event with exactly the pair's 2 seats left routes them at an event about to sell out — if a stranger books between A and B in the async-follow case (§B5.4, no atomic hold), B is stranded. The buffer (default 3) gives the slower side booking room; never set it below the structural 2. The floor *reduces* but does not *eliminate* the race — atomic accept (§B5.1) and waitlist-or-re-suggest (§B5.4) are the real seat-safety. "Almost-full" was never numerically enforced in the suggestion path (the `capacity*0.15` figure is a `12_DISCOVERY_PAGE` display badge only); the binding guard is the ≥2-seat check. Booking either side's spot flows through the normal booking path. This is the rebooking engine — instrument it: `mutual_to_suggestion_view`, `suggestion_to_booking` are the two conversion metrics that matter most in the whole product.
- **Exception — both already booked the same future event** (can happen via Process 1 if the suggested event was one they'd each independently booked, or via re-click): Step-0 `already_attending` short-circuit → `confirmed_together` + a warm "you're both going to [event]" notification (`09` §6 Step 0, §B8 row 7). This is the *only* "see-you-there" case; it is detected from existing bookings, not a separate pre-event-mutual flow.

No chat. The suggestion screen is the only coordination surface (per locked May 2026 decision). **The full handshake — propose/accept/decline/counter, full-event handling, the accept-time capacity race, dormant + auto-revival, and the rule that no event-level failure ever kills the mutual — is Part B of this document.** §8 here is the entry point; Part B is the machine.

> **The dual-intent line is a snapshot (binding).** `mutual_clicks.intent_a` and `intent_b` are captured at the moment the mutual forms (the sender's active intent on each side at click-time) and are **immutable for the life of that mutual**. The intent line therefore means *"what you were each here for when you clicked"* — a record of that moment, not a live readout. If either user later changes their `connection_intent` or toggles `romantic_visible`, **the existing mutual's line does not change.** This is deliberate: the line documents the context the connection was formed in, and a later change of heart should not retroactively rewrite the history of how two people met. (A *new* click between the same pair after a terminal state spawns a fresh `mutual_clicks` row, §B7.8, which snapshots the *then*-current intents — so future connections always reflect current intent without mutating past ones.) **Safety note:** this is display-only and cannot produce an unsafe match — the only safety-critical intent rule (the `relationship_friends` ↔ romantic hard exclusion) is enforced **live** at send-time and candidate-generation (`10` §3, `13` §6) and never reads the frozen snapshot; GAP-5 only ever over-states openness in copy, never creates openness the live gates don't permit.

---

## 9. Analytics events (names are binding)

`click_sent` (with `surface` property ∈ `discovery`/`who_was_there`), `click_mutual`, `click_expired`, `click_invalidated`, `click_swapped` (post-event budget swap, §6.9), `post_event_prompt_opened`, `discovery_click_sent`, `who_was_there_viewed`, `mutual_to_suggestion_view`, `suggestion_to_booking`. Never `match_*`. (`pre_event_mutual` and `whos_going_viewed` are DEAD — pre-event clicking removed June 2026.) These map 1:1 to `22_ANALYTICS.md` §2.4 — the `click_events.action` enum is `sent | mutual | expired | invalidated` (`withdrawn` is dead: no withdraw feature exists for *clicks*; the proposal-level `withdrawn` in Part B is a separate `click_proposals.status`, not a click action). A swap is recorded as an `invalidated` (the released click) plus a `sent` (the new one) on the click table, with the `click_swapped` analytics marker tying them together.

---

## 10. Out of scope (do not build yet)

- Check-in / attendance verification
- Extending or reopening expired windows
- "Click back" prompts on received-but-unrevealed clicks (this would leak anonymity)
- Cross-event click suggestions ("people you've attended with before")


---

# PART B — POST-MUTUAL COORDINATION
> Was the standalone Part B; merged here June 2026. Closes the gap between "mutual fired" and "both confirmed at one event". Section numbers below are prefixed `B` to stay distinct from Part A's §1–10.
> **Depends on:** `05_BOOKING_LIFECYCLE.md` (pending_bookings, event_capacity_v, waitlist), `09_CLICK_WITH_ME_AND_RADAR.md` §6 (suggestion generation it consumes), `08_LIFE_TAGS.md`/quiz (time preferences), and Part A (mutual states).

## B0. The problem this solves

A mutual click is worthless until both people are confirmed at the same future event. Between those two points sit a dozen failure modes the prior specs hand-waved as "1–3 suggestions": the picked event fills up, one person proposes and the other never answers, both propose different events at once, no shared-interest event exists in the next month, one cancels after accepting, the mutual expires mid-negotiation. Each is a place the connection silently dies. This spec makes every one of them a defined, recoverable state.

**Design spine:** the mutual is the asset; an event is just the current attempt to realise it. **A failed attempt (full, declined, cancelled, expired) never kills the mutual — it returns to a state from which another attempt can start.** The only things that kill a mutual are a block (Part A §6.5) or both users going cold past the revival window (§B7).

---

## B1. Two paths into coordination (decided by you earlier, restated)

| Path | Who drives | Spec |
|---|---|---|
| **Click suggests** | System picks 1–3 ranked future events; either user proposes one to lock it | §3 generation (`09` §6) → §4 handshake |
| **User picks & proposes** | A user browses events and proposes any published, future, has-capacity event to their click | §4 handshake (same machinery, different entry) |

Both converge on the **same proposal handshake** (§4). Suggestions are a *convenience* that pre-fills good options; they are never a constraint — a user can always propose something off-list.

---

## B2. State model

**THE UNIFIED STATE MODEL (single source of truth — reconciles the two axes).**
A mutual has exactly two orthogonal fields. Do not invent a third. Every word used anywhere
else in this doc (`connected`, `released`, etc.) maps to a value below — see the glossary.

```sql
-- AXIS 1 — lifecycle: is this mutual alive, and if not, how did it end?
alter table mutual_clicks
  alter column status set default 'active',
  drop constraint if exists mutual_clicks_status_check,
  add constraint mutual_clicks_status_check check (status in (
    'active',     -- alive: coordinating or open to it. THE ONLY state the active-5 cap counts.
    'connected',  -- SUCCESS TERMINAL: "We clicked" tapped, or both attended a together-event.
                  --   Rests in "Past clicks". Re-clickable (B7.8) -> spawns a NEW 'active' row.
    'released',   -- soft-expired after 7-day silence (B7.3). Rests in "Past clicks". Re-clickable.
    'suppressed', -- "Not feeling it" (B7.5): hidden from each other 90d, then lapses. Re-clickable after.
    'expired'     -- hard end: block or account deletion. NOT re-clickable while the cause persists.
  ));
-- Timestamp the transition to any terminal state — the rediscovery cooldown (B7.9) and
-- "Past clicks" ordering both read it:
alter table mutual_clicks add column if not exists ended_at timestamptz;
-- set ended_at = now() whenever status moves active -> connected/released/suppressed/expired.

-- How a mutual reached the 'connected' success terminal — so analytics can separate the
-- defensible headline (verified co-attendance) from the softer self-report ("We clicked 👍").
-- NULL until status = 'connected'. Set in the same transition that sets status + ended_at.
alter table mutual_clicks add column if not exists connected_reason text
  check (connected_reason in ('co_attended', 'we_clicked'));
  -- 'co_attended' = both users held a confirmed booking / claimed guest spot at the SAME event
  --                 when it ended, AFTER the mutual formed (behavioural; set by the post-event
  --                 reconciliation job, B5.2 / B7.8 — does NOT require merchant check-in).
  -- 'we_clicked'  = either user tapped "We clicked 👍" (self-reported; B7.1).
  -- If both happen, 'co_attended' wins (the stronger signal). A "We clicked" tap on an
  -- already-co-attended pair does not downgrade it.
alter table mutual_clicks add column if not exists connected_event_id uuid references events(id);
  -- The event where co-attendance happened (NULL for we_clicked-only). Lets analytics report
  -- "of which, on a Click-suggested event" without a separate join — see 22 §3.2a.

-- The partial unique index is on status='active' ONLY, so non-active history rows never block
-- a fresh 'active' mutual for the same pair. This single mechanism makes the cycle both
-- repeatable (B7.8) and recoverable (B7.3).

-- AXIS 2 — coordination: WHILE active, where are the two in arranging an event?
-- (only meaningful when status='active'; frozen for terminal states)
alter table mutual_clicks add column coord_state text not null default 'open'
  check (coord_state in (
    'open',              -- active, no live proposal — suggestions shown, either may propose
    'proposed',          -- one proposed an event, awaiting the other (a live click_proposals row)
    'confirmed_together',-- both hold confirmed bookings/claimed spots on the agreed event
    'dormant'            -- active but no viable shared event right now; parked, 4h auto-revival (B6)
  ));
```

**Glossary — every term in this doc maps to one (status, coord_state) pair. No orphans:**

| Word used in prose | `status` | `coord_state` | Re-clickable? |
|---|---|---|---|
| "a live mutual" / "active" | `active` | open / proposed / dormant | n/a (already live) |
| "a plan" / "going together" | `active` | `confirmed_together` | n/a |
| "We clicked" / "connected" / "converted" (1) | `connected` | frozen | yes -> new `active` |
| "released" / "softly expired" (2) | `released` | frozen | yes -> new `active` |
| "not feeling it" / "suppressed" | `suppressed` | frozen | yes, after 90d |
| "blocked" / "deleted" | `expired` | frozen | no, while cause persists |

(1) `'converted'` (the word `09` used for "both attended") is **renamed to `'connected'`** — one terminal-success word, not two. Update `09` references accordingly.
(2) the loss-framed word "winding down" is dead (`CLICK_LANGUAGE.md` §5a); the state is `released`, copy is opportunity-framed.

**Foolproof guarantees, as invariants Doan can test:**
1. **Exactly one `active` mutual per pair, ever** (partial unique index). No duplicates; no race creates two.
2. **A mutual leaves `active` only via four named exits:** -> `connected` (success), `released` (silence), `suppressed` (soft no), `expired` (block/deletion). No fifth, no stuck state.
3. **Three of the four exits are re-clickable** (`connected` / `released` / `suppressed`-after-90d) -> a fresh `active` row. Only `expired` is a real door, and only while its cause holds.
4. **No coordination dead-end:** every coord_state has an explicit transition out (B7.2 + edge-case table). `dormant` is the catch-all for "no event right now," actively revived, never terminal.
5. **The cycle is infinite by design:** connected -> re-click -> active -> confirmed_together -> attend -> connected -> ... each lap clean, no residue. That is the streamlined end-to-end mechanic.

`mutual_clicks.expires_at` (the 7-day relationship clock from `09`) governs the *mutual*; `click_proposals.expires_at` governs a single *proposal*. They are different timers — §B4.3 and §7 keep them from fighting.

---

## B3. Suggestion generation — gaps closed

Extends `09` §6. The Step-1 query already filters to published, future, has-capacity, neither-booked events ranked by combined score with the first-mutual price bias. Add:

### B3.1 Time/day preference from the quiz (your ask)
The Click quiz captures availability. Wire it into ranking — a perfect-interest event on a night someone can't do is a bad suggestion.

```sql
-- profiles (or personality_profiles) carries availability from the quiz:
--   preferred_days   text[]   e.g. {'fri','sat','sun'}
--   preferred_window text     'weekday_evening' | 'weekend_day' | 'weekend_evening' | 'flexible'
-- Ranking gains a soft bonus (never a hard filter — a great event on a "wrong" night
-- still beats no event):
ORDER BY
  (CASE WHEN is_first_mutual AND e.price_cents = 0     THEN 0
        WHEN is_first_mutual AND e.price_cents <= 2000 THEN 1
        ELSE 2 END),
  -- time-fit bonus: event day/time in BOTH users' preferred set
  (CASE WHEN day_of_week(e.start_time) = ANY(a.preferred_days)
         AND day_of_week(e.start_time) = ANY(b.preferred_days) THEN 0 ELSE 1 END),
  combined_score DESC
```
If either user has no quiz availability (`flexible` or null), the bonus is a no-op for that user — never penalise a missing preference.

### B3.2 The suggestion window: 48 hours to 30 days (the load-spreader)
Suggestions for a mutual sit in a **48h–30 day window**, and this window is not just "ample time" — it is the primary mechanism that makes many mutuals manageable (the answer to "User A has 8 mutuals, how do they attend all those events?").

- **Floor — 48 hours:** an event tonight is not a viable first plan with someone you've only met at an event. Near-events are blocked from suggestion (the user can still *propose* one off-list — the window governs system *suggestions*, never manual proposals).
- **Ceiling — 30 days:** the sweet spot, not a hard cut (the §B3.3 ladder may widen to 60d only when 30d yields nothing). 30 days of runway means A's mutuals **spread across the calendar** — pottery with B next Tuesday, a wine night with C the following week, a run with D after that. Eight mutuals become eight evenings over a month, not eight people competing for one Saturday. **The calendar absorbs the load; this is why the active-mutual cap (B7.2) can be generous rather than punishing.**
- **Spread rule (anti-collision):** when generating suggestions for A across multiple mutuals, down-weight any event on a date where A already holds a `confirmed_together` plan. Two different mutuals must not both get pushed at the same slot — steer them to different dates so A can actually attend both. (Same date is allowed if A explicitly wants it; it's a down-weight, not a block.)
- **Distinct from the rediscovery cooldown (B7.9):** this 30-day *suggestion window* (how far ahead events are suggested) is a different clock from the 30-day *rediscovery cooldown* (when a released pair can resurface). Same number, unrelated timers — do not conflate.
- **The three coincidental 48-hour constants (fix 2026-06-24): same number, unrelated timers — do not conflate, and tune independently.** (a) **suggestion leadtime floor** — events sooner than 48h are not *suggested* (this §B3.2); (b) **proposal response window** — a sent proposal expires 48h after it's sent (§B4.2); (c) **post-event click window** — a post-event click stays live until `event_end + 48h` (§5/§7B). All three are the literal value `48h` today by coincidence, not dependency. Each should be its own `platform_settings` key (`suggestion_leadtime_floor_h`, `proposal_response_window_h`, `post_event_click_window_h`) so tuning one never silently moves another.

Near-events and full events are always blocked from suggestion (B3.4).

### B3.3 Window widening ladder (replaces the single 30→60 broaden)
Run in order, stop at the first that yields ≥1 event:
1. Shared interest tags, 48h–30 days, time-fit preferred
2. Shared interest tags, 48h–30 days, time-fit ignored
3. Shared interest tags, 48h–60 days, time-fit ignored
4. **Either user's** top-scored events (not just shared-tag overlap), 48h–60 days, capacity-checked — a coordinated outing doesn't require identical taste; one person's strong interest the other is open to is a valid plan
5. None found → `coord_state = 'dormant'` (§B6) — NOT a dead end

Past events are never suggested (locked — Part A §10). Only future.

### B3.4 Suggestions exclude full and self-booked events at generation
`event_capacity_v.available > 0` and neither user already booked (existing filter) — but capacity is checked again at propose-time and accept-time, because it changes (§B5).

**Full-event guards (bugs #176, #177 — "what if the suggested event is full / I'm not attending it"):**
1. **At generation:** a full event (`available <= 0`) is NEVER suggested — absolute filter; a mutual must never see "go to [Event] together" for an event neither can book.
2. **Between generation and propose** (it filled in the gap): the propose-time pre-check (§B4.1) returns `event_full` and offers "grab the waitlist together" (§B5.2) or re-suggest; the stale suggestion drops on next view (capacity re-read).
3. **Neither user already attending it** (bugs #105, #115): suggestions are for a NEW shared plan; an event one already booked uses the `needed=1` path (§B5.1), never the suggestion list.
4. If every candidate is full → the §B3.3 ladder widens; if all widened candidates are full too → `dormant`, 4h auto-revival re-checks capacity. Never a dead end.

---

## B4. The proposal handshake — the core loop

### B4.1 Propose (either user, from a suggestion or a free browse)
Edge fn `propose-click-event`:
```
1. Auth: caller is one of the two users in mutual_click_id; mutual is 'active' (not expired/blocked)
2. Guard coord_state:
     'confirmed_together' → 409 already_confirmed (idempotent: if proposing the SAME event, no-op)
     'proposed'           → see 4.4 (collision / counter-propose)
3. Validate event: published, start_time > now() + 48h, NOT past, neither user already booked it
4. Capacity pre-check: event_capacity_v.available > 0
     IF 0 → return {status: 'event_full'} + offer to waitlist-propose (§B5.2). Do NOT create a pending proposal.
5. INSERT click_proposals(status='pending', expires_at = least(
       now() + interval '48 hours',           -- proposal response window
       event.start_time - interval '2 hours',  -- never let a proposal outlive its event
       mutual.expires_at))                      -- never outlive the mutual (§7 may extend)
6. mutual_clicks.coord_state = 'proposed'
7. Notify the OTHER user: "[Name] suggested you two go to [Event] · [date]. Want in?"
   [Save my spot] [Suggest another] [Not this one]
   — **"Save my spot" books the event directly** (the normal booking path) and that booking IS the signal back: no separate "let them know" tap. On success the booker sees a toast — *"You're going! We'll let [Name] know."* — and the proposer is notified the plan is on. One action, not two. (Rationale: they're already mutual; making them confirm a plan with an extra "notify" tap is redundant friction. The booking is the confirmation.)
   — If the booker already holds a booking on this event (`needed=0` on their side, §B5.1), "Save my spot" is replaced by **"I'm in"** (no re-booking) — same single tap, same toast.
```

### B4.2 Respond
Edge fn `respond-click-proposal`:

| Response | Effect |
|---|---|
| **Accept** | §5 booking-coordination flow (the part that must not race) |
| **Decline** ("Not this one") | proposal → `declined`; `coord_state` → `open`; proposer told gently: "[Name] would rather find something else — pick another?" Both returned to suggestions. The mutual is untouched. |
| **Counter** ("Suggest something else") | proposal → `superseded`; caller immediately proposes their pick (4.1); roles swap. Prevents propose-pong: see 4.4. |
| **No response by `expires_at`** | proposal → `expired`; `coord_state` → `open`; BOTH nudged once: "Still keen to meet [Name]? Here's what's on." Never auto-pick for them. **Never auto-return BEFORE `expires_at`** even if the receiver looks inactive — early return forks the one-pending-proposal slot (`uq_one_pending_proposal`, §B4.4) and can yank a live proposal as the receiver opens the app. The proposer's *honesty* fix for a receiver who may never have seen it is COPY ONLY (`01` §7: soften "waiting on [Name]" to "[Name] hasn't been on in a bit — we'll make sure they see it" after 24h of receiver inactivity per `last_active_at`); it changes no timer or state. Receiver's opportunity is protected until the real expiry; proposer gets their attempt back when the existing timer fires. |

### B4.3 Proposal expiry vs mutual expiry (the timer conflict)
The proposal window is 48h, but the mutual's 7-day clock may be shorter near its end. `expires_at = least(48h, event_start−2h, mutual.expires_at)`. **Accepting OR proposing renews the mutual's 7-day clock** (active coordination = alive; this is the `renewed` flag in `09` §1). So a pair who keep proposing never lose the mutual to the 7-day timer — only genuine silence expires it (§B7).

### B4.4 Simultaneous proposals (both pick at once)
The partial unique index `uq_one_pending_proposal` makes this deterministic: the first INSERT wins the pending slot; the second hits the conflict. The second user's edge fn, on conflict, does NOT error — it reads the existing pending proposal and returns `{status: 'crossed', existing_proposal}` so the UI shows: "You both reached out! [Name] suggested [Event A] — accept that, or send yours instead?" The second user's intended event becomes a one-tap counter (4.2). No proposal is silently lost.

---

## B5. Accept → booking coordination (the part that must not race)

Two people booking the last 1–2 seats of an event they just agreed on is the highest-stakes race in the product. "We're going together!" followed by "sold out" for one of them is the worst possible failure — it poisons the mutual.

### B5.1 Capacity at accept-time
The accepter's tap does NOT assume the proposer is already booked (they usually aren't — proposing ≠ booking). Required seats = count of the pair not yet confirmed (1 or 2).

```
Edge fn accept-click-proposal (single transaction):
  pg_advisory_xact_lock(hashtext(event_id))         -- same lock domain as 05 §3.1
  needed := (proposer booked ? 0 : 1) + (accepter booked ? 0 : 1)   -- normally 2
  IF event_capacity_v.available < needed:
     → abort, proposal.status = 'event_full', coord_state = 'open'
     → notify both: "[Event] just filled up. Want to grab the waitlist together, or pick another?" (§B5.2)
     → DO NOT book one and strand the other
  -- Reserve BOTH seats atomically before either pays:
  create pending_bookings for each unbooked user (05 §2.1), linked by a shared
    coord_group_id so the booking flow knows they're a pair
  proposal.status = 'accepted'; coord_state stays 'proposed' until both confirm
```

### B5.2 Paid events — the two-sided payment problem
Each user pays for their own spot (no one pays for the other — that's a gift-flow we don't build). But "reserve both, then each pays separately" means one might pay and the other abandon. Rules:
- Both pending_bookings hold their seats for the standard 15-min window (`05` §2).
- Each user completes their own Stripe Checkout. **Neither booking confirms until paid** — they are independent bookings sharing a `coord_group_id`, not a transaction.
- **If one pays and the other's window expires:** the payer is confirmed and keeps their spot (they're in the event regardless); the mutual returns to `coord_state = 'open'` with a specific nudge to the non-payer: "[Name] saved their spot at [Event] — grab yours before it's gone." This is honest: the payer got what they paid for; the connection isn't dead; the laggard has a clear path. Never refund the payer because the other flaked.
- **Free events:** both `reserve-free-spot` calls run inside the accept transaction — no payment window, both confirm together or neither does (capacity permitting).

### B5.3 Reaching `confirmed_together` — the "you're both going" moment
When both of the pair hold a confirmed booking (or claimed guest spot) on the same event:
```
coord_state = 'confirmed_together'
mutual_clicks renewed (clock extended past the event)
```
**This is a celebrated moment, not a silent state change — both users get a clear, warm confirmation that they're attending together** (it's the whole point of the mechanic finally landing):
- **Both notified (push + in-app):** *"It's on! You and [Name] are both going to [Event] · [date] 🎉 See you there."*
- The shared event shows a **"Going with [Name]"** badge on the event card and in each user's Upcoming, so the togetherness is visible every time they look at their plans — not just a one-off notification.
- This fires **however they both got there** — through the proposal handshake (B4) OR independently (B5.4, one books then the other books the same event). The moment both confirmed bookings exist on one event with an active mutual between them, the congrats fires. Detection: on any booking confirm, check for an active mutual with another confirmed attendee of that event → if found and not already `confirmed_together`, transition + congrats.

This is the success state — the `suggestion_to_booking` conversion metric (`22` §B5.2) fires here. After the event, if both attended, the mutual flips to `connected` and post-event suggestions resume for the *next* outing (B7.8 re-click cycle).

### B5.4 One books ahead of the other (the "it filled up before B acted" race)
The handshake (B4–B5.1) reserves both seats atomically — but it only applies when the pair go through *propose → accept together*. The common real case is looser: **A just books an event they like (solo, no proposal), and B — who's mutual with A — wants to follow days later, by which time it may be full.** A is not *inviting* B (they're mutual clicks, not a couple coordinating a date); A is just living their life. So there is **no seat hold** — holding merchant inventory on the speculation that a mutual *might* follow is wrong at any scale, and forcing an "invite" step puts a coupley obligation on a low-stakes connection. Instead, three layers, speed-first:

1. **Fast, honest notify (the primary fix).** The moment A's booking confirms, every *active mutual* of A who is **not** already booked on that event gets: *"[Name] is going to [Event] · [date] — join them?"* showing **live availability** ("4 spots left"). Most races are prevented here: B acts while seats exist. (Respects B's `social_visible` and block state; never reveals A's other bookings beyond this one.)
2. **Escalating honest urgency.** If the event A booked drops to ≤3 available with an un-acted mutual notified, B gets one stronger time-sensitive nudge: *"Only 3 spots left at [Event] with [Name]."* This is the FOMO mechanic working *for* the connection — true scarcity, not manufactured.
3. **Fallback when it fills anyway (B chooses — no auto-enrolment).** If B taps through and it's full, B is told honestly and offered a **choice**, never auto-enrolled: *"[Event] just filled up. Join the waitlist — if a spot opens you're in with [Name] — or find another event together?"* → **waitlist-together** (B joins the waitlist via `05` §4; on promotion B confirms and the pair reaches `confirmed_together` + the B5.3 congrats) **OR** re-suggest (back to the §B3 ladder). The mutual is **untouched** — a filled event is a failed *attempt*, recoverable like every other (the design spine).

No seat is ever frozen on speculation; the keen pair is protected by *speed and honesty*, and the waitlist is the safety net if the race is lost. This is distinct from B5.1 (simultaneous accept, both reserved atomically) — B5.4 is the asynchronous, one-leads case.

### B5.5 Contended fill (a pair lost the seats to *another* pair)

B5.1 protects a pair from stranding *each other*. It does not, on its own, distinguish the case where two *different* coordinated pairs (mutual-AB and mutual-CD) both accept the same scarce event's last seats in parallel. Both `accept-click-proposal` calls serialize on the same `pg_advisory_xact_lock(hashtext(event_id))` (B5.1, the `05` §3.1 domain), so **seat accounting is correct — no overbooking, no double-book.** The gap is purely *experience*: the pair that loses the lock race hits `available < needed` and, without this rule, is routed to the generic B5.2 "the event filled up" path — which reads as bad luck, when in fact another pair just took their agreed seats. The losing pair's mutual takes the emotional hit §B0 exists to prevent, and their re-suggest isn't prioritised over a cold dormant pair.

When `accept-click-proposal` aborts at the B5.1 capacity check, the edge fn already knows *why*. Distinguish two causes:

```
-- inside accept-click-proposal, at the abort branch (B5.1):
IF event_capacity_v.available < needed THEN
   -- Did the proposal's own propose-time pre-check (§B4.1.4) pass? i.e. did this fill
   -- happen DURING the handshake, not before it?
   v_contended := (proposal.created_at_capacity_ok = true);   -- recorded at propose-time

   proposal.status   := 'event_full';
   mutual.coord_state := 'open';

   IF v_contended THEN
     -- CONTENDED FILL: prioritise this pair's re-suggest; neutral, no-fault copy.
     mark mutual for PRIORITY re-suggestion (next click-scores-rebuild treats this
       mutual as head-of-queue for the §B3.3 ladder, ahead of cold/dormant pairs)
     notify both: "That one filled up just now — here's another for you two."
   ELSE
     -- Event was already full before they engaged (stale suggestion); standard path.
     notify both (existing §B5.2 copy): "[Event] just filled up. Grab the waitlist
       together, or pick another?"
   END IF;

   -- BOTH branches still offer waitlist-together (§B5.2) as the alternative.
   -- DO NOT book one and strand the other (the §B5.1 invariant is unchanged).
END IF;
```

Schema — one boolean carried on the proposal, set at propose-time:

```sql
alter table click_proposals
  add column created_at_capacity_ok boolean not null default true;
-- Set true when §B4.1.4 propose-time pre-check passed (event had room when proposed).
-- If it's later found full at accept-time, the fill happened in the window between
-- propose and accept → contended. Cheap, no new query, no new lock.
```

Why this shape: **correctness is untouched** (the advisory lock already prevents overbooking — this only changes recovery experience and re-suggest priority, never seat math); **no new race** (`created_at_capacity_ok` is written once at propose-time inside the existing transaction, read once at accept-time inside the existing lock); **honest copy** ("filled up just now" is true and blameless — never "you were too slow", which would violate the no-loss-framing rule `CLICK_LANGUAGE.md` §5a, and never reveals the other pair); **the losing pair is protected** (priority re-suggest jumps them ahead of cold dormant mutuals — the §B0 spine: a failed *attempt* returns to a *better* recoverable state, not a worse one).

---

## B6. `dormant` — no viable event right now (not a dead end)

When the §B3.3 ladder yields nothing (very different tags, or they've booked everything going):
```
coord_state = 'dormant'
UI (both): "No perfect match for you two right now — new events drop every week.
            We'll nudge you the moment something fits."
A 'browse events together →' CTA always remains (manual propose still works).
```
**Auto-revival:** the `click-scores-rebuild` cron (every 4h, `09`) re-runs the §B3.3 ladder for every `dormant` mutual that is still `active`. First hit → `coord_state = 'open'`, insert fresh suggestions, notify both once: "Found something for you and [Name] — [Event] this [day]." A dormant mutual is a warm lead the system keeps working, not a failure.

Dormant does NOT stop the 7-day mutual clock by itself — but the system actively tries to revive it, and any successful revival + the user re-engaging renews the clock. If a pair stays dormant with zero engagement through the revival window, §B7 applies.

---

## B7. Mutual lifecycle — sustainable by design

The lifecycle is built on one behavioural principle: **a click is a low-stakes invitation, never a debt.** Click's job is not to own the relationship — it is to keep generating the next opportunity and to learn from what happened. People click, meet, and then it's theirs: they swap numbers offline, or they don't click again, or they click someone new next time. **None of those is a failure.** The mechanic stays light because nothing is ever owed and the events layer stands alone for anyone who wants nothing social.

### The status surface (engineering states → what the user sees)
Internally a mutual is two fields: `status` (active / connected / released / suppressed / expired) and, while active, `coord_state` (open / proposed / confirmed_together / dormant) — see the Unified State Model above. The user is **never shown these words.** They see at most three things: *a plan* (an upcoming shared event), *an invite waiting* (someone proposed), and *people to discover*. `dormant` and `released` never surface as states — they surface as content (a quiet "past clicks" shelf) or not at all.

### Lifecycle transitions
| Event | Outcome |
|---|---|
| Active coordination (propose / accept / counter / viewing suggestions) | Renews the 7-day clock — stays `active` |
| `confirmed_together` | Renewed past the event; → `connected` on attendance |
| Proposal declined / expired / event full / merchant-cancelled | Mutual UNTOUCHED — returns to `open`/`dormant`; another attempt can start |
| **Both attended → `connected`** | **A success terminal state, not a holding pattern** (see B7.5). No nagging to re-click the same person. The mutual rests in "past clicks" history; the system moves on to new people and events. A quiet `connected` mutual is the WIN condition — never churn — and is re-clickable anytime (B7.8). |
| **"We clicked 👍"** (either user, B7.1) | → `connected` immediately, celebrated, all coordination prompts for the pair stop. This is the offline-numbers-exchanged case turned into data — the cleanest success signal there is. |
| **"Not feeling it"** (either user, B7.1) | → `'released'` silently; the pair is suppressed from each other's suggestions for 90 days (short of a block, no notification to either side). |
| **Soft release at 7-day silence** (B7.6) | → `'released'`, **not** loss-framed. Moves to the "past clicks" shelf with face-saving copy; re-clickable if they cross paths again; frees an active-mutual slot. One opportunity-framed nudge at day 5 only (B7.6). |
| **7-day terminal but one side NEVER saw the mutual** (B7.6a) | Goes to the single `released` terminal like any silence — but that side's release **copy is gated at read-time**: instead of "didn't line up" (a lie for someone never told), their next app-open shows a first-open interstitial revealing the missed mutual as a live opportunity; acting re-clicks a fresh `active` (B7.8). No separate status; awareness is a read-time branch on `seen_at_[side]`, never cron-dependent. |
| Either user blocks | → `'expired'` immediately, proposals `withdrawn`, pair permanently invisible (Part A §6.5) |
| Either deletes account | Mutual + proposals hard-deleted; counterparty sees silent disappearance (Part A §6.7) |
| **Re-click after `connected`, `released`, or `expired`** | A NEW `active` mutual forms normally — the prior row is history, the unique index is on `status='active'` only, so a new active mutual for the same pair is always allowed (B7.8). This is how two people who clicked once go again. |

**The one rule that makes it foolproof:** *only a block, account deletion, or an explicit "not feeling it" ends a connection for good. Silence releases it gently (re-clickable later); every event-level failure is recoverable; "we clicked" completes it as a win.*

### B7.8 Clicking again — repeating the cycle with the same person
"We clicked 👍" is a chapter break, not a door lock. The whole point of the mechanic is recurring real-world connection, so going again must be frictionless.

- **Same-person re-click is first-class.** When a `connected` pair share another event (either attends one the other's at, or they meet again at a new one), each can click the other again from that event's Who's-going / Who-was-there surface exactly like the first time. A new `active` mutual forms (the `connected` row stays as history; the partial unique index on `status='active'` permits it).
- **The "Past clicks" shelf carries a "Click again" affordance.** A connected pair appears in each other's Past clicks; tapping a person there shows their upcoming events (the ones either could join), so re-connecting is one tap → propose, NOT a cold restart. This is the warm path: "you two had a good time — here's where you could do it again."
- **It does NOT auto-recreate.** Re-clicking is always a deliberate, mutual act — the system never silently reopens a closed mutual or nudges "click them again" unprompted (that would undo the low-stakes, never-owed principle). The affordance is *available*, never *pushed*.
- **Counts against the active-5 cap only once active.** A re-clicked pair occupies one active slot like any other live mutual; the historical `connected` rows never count.
- **Repeat connections are the strongest retention signal in the product.** Instrument `mutual_reformed` (a new active mutual between a pair with a prior `connected` row) — two people choosing to go again, repeatedly, is the deepest PMF evidence Click can have, deeper than a single conversion. `22_ANALYTICS` should track reform rate and repeat-cadence per pair.
- **Lifecycle is identical the second time:** propose → confirm_together → attend → "We clicked" (or it rests). There is no special-casing; the cycle simply runs again. Someone can connect, go to five events together over months, each a fresh clean cycle — or click once and never again. Both are success.

This closes the asymmetry: "We clicked" gives *closure without finality*. The connection is marked as having worked, the prompts stop, the slot frees — and the door to going again is always one tap away on the Past clicks shelf.

### B7.9 Rediscovery — released pairs resurface (the Bumble pattern)
A `released` mutual (soft-expired after silence, B7.3) or one where no event ever got coordinated is **not gone forever** — only `expired` (block / account deletion) is permanent. Like Bumble resurfacing a past match:

- **Cooldown: 30 days** after release. During cooldown the pair is suppressed from each other's discovery (a just-released pair re-appearing next day feels broken). This is the *rediscovery cooldown* — a different clock from the 30-day *suggestion window* (B3.2).
- **After cooldown, the pair re-enters the discovery pool** and can be shown to each other again as a normal `Click-with-Someone` candidate; clicking re-forms a fresh `active` mutual (B7.8). Neither is told "this is a re-match" — it's just a candidate again.
- **Surfaced when the fresh pool is thin, or on manual refresh** (not constantly — recycling every day feels stale). Discovery is fresh-candidates-first; released pairs are a warm second layer that fills in when a user has seen everyone new or taps "refresh." This directly answers "what happens when people run out / want to refresh" — rediscovery is the supply.
- **`suppressed` ("not feeling it") pairs** also resurface, but only after their longer 90-day window (B7.5) — a deliberate soft-no gets more distance than a passive fizzle.
- **`expired` (blocked / deleted) NEVER resurfaces.** Block is the one permanent exit. This is the clean line: released/suppressed = "didn't line up, maybe later"; blocked = "never again."

### B7.10 Reminder cadence for a mutual (in-app rich, push/email sparse)
Channel split (locked): **in-app notifications carry the weight** (pull — the user sees them when they open the app, so they can be richer/more frequent); **push + email stay sparse** (interruptive — only the moments that genuinely need to reach the user when they're not in the app). A mutual that rots for lack of a nudge is a wasted connection; a mutual that nags is deleted. The cadence:

| Moment | In-app | Push/email |
|---|---|---|
| Mutual forms | ✅ "You clicked with [Name] ✨ — here's what you could do together this month" + suggestions | ✅ push (this is the payoff moment — worth interrupting for) |
| A mutual books an event you could join (B5.4) | ✅ "[Name] is going to [Event] — join them? (4 spots left)" | ✅ push (time-sensitive — seats are finite; this is the one-books-ahead race) |
| That event drops to ≤3 spots, you haven't acted | ✅ "Only 3 spots left at [Event] with [Name]" | ✅ push (true urgency) |
| You're both confirmed on the same event (B5.3) | ✅ "Going with [Name]" badge on the plan | ✅ push: "It's on! You and [Name] are both going to [Event] 🎉" |
| Day 3, no proposal yet | ✅ "Still keen on [Name]? [specific event] this [day] could work" (concrete, actionable — not just "do something") | ❌ in-app only (don't interrupt for a soft nudge) |
| Proposal sent → awaiting other | ✅ proposer sees "waiting on [Name]"; receiver sees the proposal top-of-feed | ✅ push to the **receiver** (a proposal needs a timely answer or the event window closes) |
| Proposal accepted → must RSVP | ✅ "[Name]'s in — save your spot for [event] to lock it" | ✅ push (RSVP is time-sensitive; the seat can fill) |
| 24h before the confirmed event | ✅ reminder | ✅ push (standard pre-event reminder, `06`) |
| Day 5–6 of silence (pre-release) | ✅ the one opportunity-framed nudge (B7.3) | ❌ in-app only (a fizzling mutual isn't worth a push) |

Principle: **push/email only for the time-sensitive, two-sided moments** (mutual formed, proposal awaiting answer, RSVP needed, event tomorrow) — the ones where *not* reaching the user costs a real plan. Everything else is in-app, where the user opted in by opening the app. RSVP reminders are mandatory because a coordinated plan that nobody books is the most heartbreaking failure mode — both wanted it, neither locked it.

### B7.1 Three soft-exit paths (short of blocking)
After any mutual, both users always have, in the click detail view:
- **"We clicked 👍"** — the closure ritual. Humans need to complete things; this lets the user mark the win, which is satisfying AND gives Click gold-standard data (this pair succeeded). Celebrated, not an exit door, and re-clickable later (B7.8). → `connected`.
- **"Not feeling it"** — the graceful no. Silent 90-day mutual-suppression of the pair (`pair_suppressions` table), no notification, no drama. The path for "nice person, no spark" that doesn't warrant a block.
- **Block** — the hard, immediate, permanent, safety path (Part A §6.5). Unchanged.

```sql
create table pair_suppressions (
  user_a_id uuid not null, user_b_id uuid not null,  -- a<b canonical
  reason text not null check (reason in ('not_feeling_it')),
  expires_at timestamptz not null,                   -- now() + interval '90 days'
  created_at timestamptz default now(),
  primary key (user_a_id, user_b_id)
);
-- Checked in suggestion generation (B3) and candidate eligibility (Part A) exactly like
-- blocked_users, but TIME-BOXED and SILENT. Distinct from a block: no invisibility on
-- shared event surfaces, no teardown of an existing confirmed plan — just "don't suggest
-- these two to each other again for a while."
```

### B7.2 Coordination load — cap mutuals, never sends (the User-A-has-40 problem)

**The cap counts active mutuals, NOT clicks sent.** Sending is cheap and healthy — a user who sends 6 clicks a day and gets 1 mutual is *browsing*, not overwhelming anyone, and must never be throttled (the per-event 3-click budget is the only send limit, Part A rule 5). The thing that creates strain — and strands the people on the other side — is **unactioned mutuals**, because each one is a real person expecting a real plan. So the load is measured in mutuals, and only the ones that actually demand action.

**What counts toward the cap: `active` mutuals that are *actionable* — i.e. a viable shared event exists in the window (`open`/`proposed`, NOT `dormant`).** A `dormant` mutual (no shared event right now, B6) demands nothing of the user and does **not** count — it's resting and auto-revived. `confirmed_together` (a plan is locked) doesn't count either — it's handled. `connected`/`released`/`suppressed`/`expired` are history. So the cap is specifically: *"how many mutuals are asking you to plan something right now."*

**Soft cap: 8 actionable mutuals.** Generous on purpose, because the 48h–30d suggestion window (B3.2) spreads them across a month — 8 plans over 30 days is a full but human social calendar, not an inbox. Why 8 and not 5: with event-spreading doing the real work, the cap is a backstop against genuine pile-up, not the primary control.

**At/over the cap — down-rank and prompt, never hard-block:**
1. **New incoming clicks toward A still form mutuals** — never block the new person, who did nothing wrong (hard-blocking strands exactly the healthy, keen User B this whole rule exists to protect).
2. **A is down-ranked in discovery** (`09` §card-generation) — shown to *fewer* new people while over capacity. Logic: a user already over their actionable-mutual ceiling doesn't need *more* discovery, they need to act on what they have; surfacing them to new people just manufactures more stranded Bs. Down-rank, don't remove — they still appear, just lower and less often, so they're never invisible.
3. **A is prompted honestly, framed as warmth not restriction:** *"More people are hoping to click with you than you can plan with right now — wrap a few up to make room."* This is simultaneously the "people want to click with you" engagement signal AND the nudge to act. It reframes the cap from a punishment into a status.
4. **Attention is steered by event-urgency:** A's mutual list is ordered by *soonest actionable shared event first* — a mutual where B has an event this weekend is surfaced loudly ("plan with B before [event] fills"); a mutual whose only events are 3 weeks out waits its turn. This is what makes 8 mutuals tractable: A isn't asked to act on all 8 at once, just the one with the nearest window.

**No hard ceiling.** The further over 8, the harder the down-rank and the more insistent (but never nagging — B7.10 cadence) the "wrap some up" prompt. The system never slams a door; it makes accumulation visibly costly so A self-regulates — exactly how a popular user on a healthy platform should be steered, not punished.

**The asymmetry this fixes (User A overloaded, User B keen with 2 mutuals):** B is never penalised for A's overload. B's mutual with A is `active` and B can propose freely; if A is too swamped to respond, A's *coordination clock with B* runs the normal 7 days (B7.3) and, if nothing's planned, soft-releases — but because A is down-ranked while overloaded, A stops accumulating *new* mutuals, which structurally clears A's backlog so existing Bs get a turn. B can also re-click A later (rediscovery, B7.9). The healthy user is always protected from the overloaded one.

### B7.3 No-show handling — payment is the commitment
**Paid events are self-policing: no consequence.** A paid no-show already lost their money — sunk cost + no refund IS the deterrent (`05_BOOKING_LIFECYCLE` refund policy). Don't double-punish.
**Free events need a light guard.** After **2 free-event no-shows** (`bookings.attended = false` on `total_cents = 0` bookings) in a rolling 90 days, the user **loses the post-event click surface (Part A §7B) for 30 days.** They can still book, still see who's going (the context-only event page), still be discovered/clicked via Process 1, still be clicked by others — they just lose the post-event surface where you click people you (didn't) meet. This kills the no-show-clicks-strangers abuse (Part A §6.4) precisely where it lives (free events) without touching honest users or paid bookings.
```sql
-- suppression check before opening Who-was-there for a user:
-- count(*) free-event no-shows in last 90d >= 2  → post_event_click_suppressed_until = now()+30d
```

### B7.4 Opting out of the click layer entirely (the couples/explorers case)
Not everyone wants to be clickable. A couple exploring the city, someone who just wants an events app — they must be able to use Click fully without ever entering the social layer. New flag, separate from `romantic_visible`:
```sql
alter table profiles add column social_visible boolean not null default true;
```
- **Merchant accounts are never clickable until they complete attendee onboarding as a user (bug #101).** A merchant who hasn't onboarded as a user has no user profile to surface — they generate no candidate rows in Who's-going, Who-was-there, or Click-with-Someone, exactly like the phantom-user rule (`03` §5 / `AUDIT_LIVE_BUGS_END_TO_END.md` Bug 5b). Merchant identity never appears in the social layer. Only once a merchant completes their OWN user onboarding (their real name, photo, tags) do they become clickable — and then only with `social_visible = true`.
- `social_visible = false`: the user does NOT appear in Who's-going / Who-was-there, cannot be clicked, generates no candidate rows. **But** they still book events, still attend, **and still get the post-event prompt** (B7.7) — Click keeps the attendance + sentiment data, which is valuable from everyone. They can still choose to click others if they opt back in per-event; off by default means fully private.
- One plain-language setting: **"Show me in event attendee lists"** (default on), with honest copy: *"Off means people at your events can't click with you. You'll still see everything and book anything."*
- This is the global, first-class version of the per-booking `visible_to_attendees` toggle (Part A §6.6); the per-booking flag still works for one-off privacy.

### B7.4a Pause — "take a break" from the social layer (temporary, reversible, lossless)
Distinct from B7.4's permanent opt-out (the couples case): **pause is a temporary breather** for someone who's busy, overwhelmed, or just wants to use Click as an events app for a while — without losing the connections they have. This is the difference between "I'm not a social user" (B7.4, a setting) and "not right now" (a snooze).
```sql
alter table profiles add column paused_until timestamptz;  -- null = not paused; future ts = paused
```
While paused (`paused_until > now()`):
- **Invisible in discovery and unclickable** — generates no candidate rows, doesn't appear in Who's-going / Who-was-there, can't receive new clicks (same surfaces as `social_visible = false`).
- **Still fully browses, books, attends, sees existing mutuals** — pause only hides them from the *social/discovery* layer; the events app is untouched.
- **Existing mutuals: A's side freezes and is restored; B's side gently rests — and the whole thing is silent on both ends.** This is the subtle part, designed so neither user is harmed and A's pause is never *exposed* to B (see B7.4a-i below). When A pauses, each active mutual A holds is preserved for A (clock + suggestions frozen, restored intact on return), while for the *other* user (B) the mutual quietly rests into their "Past clicks" exactly like any naturally-released connection — no status line, no "on hold" banner, no reason given. When A returns, those mutuals simply become re-surfaceable again, naturally, with nothing announced about A having paused or returned.
- **Reversible anytime, instantly, lossless** — un-pause (or `paused_until` elapses) and everything resumes exactly where it was.
- Offered as preset durations + manual: **"Pause for a week / a month / until I turn it back on."** Copy: *"Taking a break? You'll still see and book everything — you just won't show up for new clicks, and your current clicks will be here when you're back."*
- **Auto-suggested, never forced:** if a user hits the over-capacity prompt (B7.2) repeatedly, offer pause as a gentle option ("Lots going on? You can pause new clicks and focus on your plans"). Pause is the pressure-release valve for overwhelm.

#### B7.4a-i What happens to a mutual when A pauses (the A↔B case)

A pausing must never (a) strand B waiting, (b) make B feel ignored or rejected, or (c) expose to B that A paused or why. The model — borrowing the dating-app truth that *most matches quietly don't become a date, and that's normal and no-fault, not a failure*:

- **B is never shown a status about A.** No "[A] is taking a break," no "on hold," no "[A] isn't planning events right now" — any such line turns A's absence into *a thing B is staring at*, which is precisely what makes a quiet connection feel like rejection. Silence about A is the privacy-preserving AND the behaviourally-kindest choice.
- **For B, the mutual simply rests into "Past clicks"** the same way any mutual that didn't turn into a plan does. From B's side it is indistinguishable from a naturally-rested connection — a normal, no-fault outcome. **B's active-cap slot frees immediately**, so B keeps clicking and planning with others freely and is never stuck waiting on someone who isn't coming.
- **B is never deterred**, because nothing signals fault or rejection — it's just one of the many mutuals that rest, exactly as on any healthy platform where not every match becomes a meeting.
- **A's side is genuinely frozen and restored** — when A returns, A is NOT greeted by a pile of expired mutuals; the connections rested and are intact, so A isn't penalised for taking a break.
- **On A's return, paused mutuals re-surface naturally** — the pair re-enters each other's discoverable/re-clickable pool (reusing the B7.9 rediscovery machinery), with **nothing announced**. No "A is back" notification, no "they're planning again" callout — that would leak A's pause/return behaviour. It just naturally reappears, like any rested connection becoming live again. If B already re-clicked someone else or moved on, no harm; if the spark's still there, the connection is simply available again.
- **The asymmetry is correct and harmless:** A knows they paused (it's their action); B never needs to. B loses nothing by not knowing and is spared the "left waiting" feeling; A's behaviour stays private.

This is the same principle as the no-mutual experience (`06` §2.6): connections that don't become events are the norm, never surfaced as failure — and a paused partner is just one more flavour of "this one rested," handled so it never deters B and never exposes A.

**Locked surviving-partner string (binding — covers pause, block, account-deletion, and ban).** When a coordinating partner exits for ANY reason that ends the mutual server-side (pause B7.4a, block §6.5, account deletion §6.7, ban §6.7a), the surviving user's now-empty coordination surface shows ONE neutral line and routes forward to discovery — never a reason, never a status word, never the partner's name resurfaced as having-left:

> *"That one's run its course — here's who else you might click with."*  → `See who else →`

The surviving user can never distinguish a block from a pause from a deletion from this copy — by design (it preserves the blocker's/leaver's privacy AND is the kindest framing). The snapshot is revoked the instant the mutual ends: `get_profile_snapshot()` returns null for a torn-down/soft-deleted target, and the client renders this neutral end-state rather than a half-empty card pointing at someone gone. The teardown of any pending `click_proposals` row runs in the SAME transaction as the block-insert / soft-delete / pause, so there is no window where the survivor can tap "accept" against a counterpart who just vanished; if accept races the exit, the §B5.1 advisory lock serialises them and a losing accept aborts to this end-state, never to a booking against a ghost. The strongest this copy ever gets is "run its course" — forward, never loss-framed (`CLICK_LANGUAGE.md` §5a).

### B7.4b Silent / inactive users — the click as a liveness test (your design)
A user who's gone dark (not opened the app in weeks) shouldn't keep appearing as a *fresh* candidate — clicking a ghost who never responds is the stranded-clicker problem again, caused by inactivity instead of overload. But events are episodic (a healthy user might book once a month), so inactivity is **down-ranked, never hard-removed on a timer** — and a click is used as a re-engagement signal that doubles as a liveness test:

```sql
alter table profiles add column last_active_at timestamptz default now();  -- bump on app open / action
alter table profiles add column reengagement_clicked_at timestamptz;       -- set when a click-triggered
                                                                           -- re-engagement email is sent to
                                                                           -- an inactive user; cleared on return
```
- **≥30 days inactive → down-ranked in discovery** (same decay mechanism as over-capacity, `09` ranking): shown lower and less often, not removed. A monthly-cadence user barely notices; a truly dormant one stops crowding fresh candidates.
- **If an inactive user receives a click → fire the email/push re-engagement signal** (this is the one moment worth interrupting a lapsed user for): *"Someone clicked with you on Click — come see who's going to events near you."* The click itself becomes the hook to pull them back. **Anonymity preserved:** the email says *someone*, never who, and tapping through lands them in-app where, if they reciprocate, the mutual forms normally. A recovered user AND a new connection — the best outcome.
- **If they ignore even that** (still inactive N days after a click-triggered re-engagement email — suggest ~14 days) **→ fully hidden from discovery** until they return. Not deleted, not expired — just not surfaced, because they've now failed the liveness test. The instant they open the app again, `last_active_at` updates and they're eligible again.
- **Pending clicks toward a now-hidden inactive user** simply expire on the normal window with no mutual — the clicker is never told "they're inactive" (that's both a privacy leak and discouraging); it's just a click that didn't land (`06` §2.6 no-mutual framing).
- This is distinct from a *paused* user (B7.4a — explicit, mutuals frozen) and from a *banned* one (§6.7a — permanent teardown). Inactive = "gone quiet, gently de-prioritised, instantly recoverable."

### B7.5 What `connected` means (the cycle continues, or doesn't — both fine)
After both attend (or either taps "We clicked"), the mutual is `connected`. From here the cycle is **opt-in, never owed**:
- The pair may never interact again on Click (they exchanged numbers / it ran its course) — **this is success, not churn.** No re-click nagging.
- OR either may click the other again at a *future* shared event — a fresh `active` mutual forms (B7 last row).
- Meanwhile both continue clicking **new** people freely. `connected` mutuals don't count against the active-5 cap, so a successful connection never crowds out new discovery — and the same pair can re-click anytime (B7.8).
The product's growth comes from *new* clicks and *repeat bookings*, not from squeezing a closed connection. Let won connections rest.

### B7.6 Soft release — expiry without a loss frame
A mutual with zero engagement from both sides for 7 days **softly releases** — it does not "expire and fail."
- **Day 5, one opportunity-framed nudge** (never loss-framed): *"[Name]'s still around — [specific upcoming event] this weekend could be the one."* Sent only if a viable shared event exists; framed as a door opening, not closing. Loss frames ("winding down", "about to expire") spike anxiety and make the app a chore — banned here.
- **Day 7, silent release:** → `'released'`, moves to the "past clicks" shelf (B7 status surface). No funeral, no alarm, no "you missed your chance." Re-clickable if they meet again. Frees an active slot.
- This replaces the old loss-framed "winding down" nudge entirely.

### B7.6a Awareness gate on release framing (the never-seen mutual)
A mutual can form and reach its 7-day silence terminal without the recipient ever learning it existed: push disabled, mutual email unopened, app unopened the whole window. The clock still runs (we do not fork it per-recipient — single-timer stays simple). The soft-release shelf copy is neutral and no-fault ("Still out there…", CLICK_LANGUAGE §5 v4), so a never-seen mutual resting onto the shelf is no longer *dishonest* — but it would be near-invisible, a quiet shelf entry the user never realises was a real reciprocated connection. **So awareness still earns a distinct path — not to avoid a lie (the neutral copy already handles that), but to actively recover a missed real mutual:** a user who never saw it gets one first-open interstitial that surfaces the connection as a live opportunity ("you two clicked — you just hadn't seen it yet") rather than letting a genuine mutual decay unnoticed on a shelf. This is a retention/connection win, not just defensive copy.

**This is a read-time branch, NOT a new status (correctness-via-read-time, §5).** The mutual still goes to the single `released` terminal exactly as B7.6 — there is no `released_unseen` status, because a status that depends on a per-recipient "did they see it?" decision would make the hygiene cron load-bearing for correctness, which §5 forbids. Instead, awareness is a column the client reads at the moment it would render release copy, the same way expiry is evaluated at read-time:

```sql
-- Two nullable timestamps on the mutual; written at first in-app view of THIS mutual's
-- snapshot/coordination surface. NULL = that side never opened it. No new status, no cron.
alter table mutual_clicks add column seen_at_a timestamptz;
alter table mutual_clicks add column seen_at_b timestamptz;
```

**Awareness signal (reuses the B7.4b liveness model — no new timer):** for the side being rendered, the mutual counts as "seen" if `seen_at_[side] IS NOT NULL` (they opened its surface) OR the mutual push was delivered AND `profiles.last_active_at` advanced after delivery (they opened the app while it was live). Email-open is a bonus signal, never required.

**At read-time, when a `released` mutual would surface to a given side:**
- **That side saw it** (`seen_at_[side] IS NOT NULL` or liveness-after-delivery) → standard soft-release shelf copy (B7.6). Unchanged. This is the overwhelming majority.
- **That side never saw it** (`seen_at_[side] IS NULL` and no liveness-after-delivery) → suppress the "didn't line up" copy. On that user's next app-open, before any release framing, render the **first-open interstitial** ONCE: the mutual shown as a live opportunity they missed (the §8 reveal), not a past failure.
  - **Fire-once WITHOUT lying on dismissal (binding).** The "show once" marker is a *separate* column, `unseen_release_shown_at_[side]` — NOT `seen_at_[side]`. Stamping `seen_at` here would be wrong: it would mark the user as having "seen the mutual," so if they dismiss the interstitial without acting, their NEXT open would fall into the "that side saw it" branch and show them the soft-release shelf. After dismissal the mutual simply rests on the "past clicks" shelf with the **neutral no-fault shelf copy** ("Still out there — if you cross paths again, you can pick it back up" — CLICK_LANGUAGE §5, v4; this copy makes no verdict claim about either person, so resting a never-seen mutual onto it is honest even without the interstitial). `seen_at_[side]` is stamped ONLY if the user actually opens the mutual's detail/coordinate surface from the interstitial — i.e. it tracks genuine awareness, never mere exposure to the recovery prompt.
  - **Partner still reachable** (mutual not `expired` by block/deletion, AND partner not `paused`/`suspended`, AND partner not themselves long past release) → interstitial offers the normal coordinate path; acting **re-clicks** to form a fresh `active` mutual (B7.8 — the prior `released` row stays history; this is NOT an in-place "revival" of a terminal row, which would muddy the lifecycle). **Reachability is the full set, not just block/delete:** a paused (B7.4a) or suspended (§6.7a) partner cannot coordinate, so for the never-seen user they count as "moved on for now" — show the partner-gone variant, never an invitation to coordinate with someone who can't answer. (Exposing the difference would also leak the partner's pause/suspension, which B7.4a-i forbids.)
  - **Partner gone** (`expired`, or released and rediscovery-cooled) → interstitial is honest, forward-facing, never loss-framed (copy: `click_mechanic_explainer_copy.md` §5E, second variant).
- **Neither side ever saw it** → each side independently hits the read-time branch on its own next open; whoever opens and acts re-clicks first.

```sql
-- one more nullable marker per side: "we showed the recovery interstitial once" —
-- deliberately distinct from seen_at (genuine awareness) so a dismissed interstitial
-- never flips the user into the false "didn't line up" copy.
alter table mutual_clicks add column unseen_release_shown_at_a timestamptz;
alter table mutual_clicks add column unseen_release_shown_at_b timestamptz;
```

**Why read-time, not a stored sub-state:** a never-seen mutual is *functionally* "released-but-unshown" the instant the clock passes — identical in shape to how a pending click is functionally expired at `expires_at` regardless of its status label (§5). The hygiene cron can stamp `released` whenever it runs; correctness (which copy the user sees) never waits on it, because the seen/unseen branch is evaluated live at render. A delayed cron can only ever delay the *label*, never show the wrong framing. No enum value added; two nullable columns; zero new cron.

**Anonymity unchanged:** the interstitial only ever fires for a user about THEIR OWN reciprocated mutual — it reveals nothing a normal mutual notification wouldn't have at formation. A partner who has gone is disclosed only as "moved on for now," never a reason, never a status word.

**The recovery re-click bypasses the B7.9 rediscovery cooldown (binding).** B7.9's 30-day cooldown suppresses a released pair from *algorithmic discovery* (so a just-released pair doesn't reappear next day feeling broken). The never-seen interstitial is NOT discovery — it is a direct, deliberate recovery of a mutual the user was never even told about. Suppressing it for 30 days would lock a user out of a real reciprocated mutual they never saw, which is absurd. The re-click from the interstitial therefore routes through the direct re-click path (B7.8), never the discovery-eligibility check, and is never gated by the B7.9 cooldown. (This is the one place a `released` pair re-forms inside the cooldown window — and correctly so, because the suppression's purpose, avoiding stale-feeling rediscovery, doesn't apply to a first-ever reveal.)

### B7.7 The post-event prompt is universal (data from everyone)
The post-event prompt ("Did you click with someone?" + the four `06` responses) fires for **every** attendee — including `social_visible = false` users and people with no mutuals. Social visibility gates being *clickable*, never the *prompt*. A couple at a pottery class still gets "Did you have a good time?" → you get attendance + sentiment + retention signal; they were never pestered to click anyone. Universal prompt, optional clicking.

---

## B8. Full edge-case table

| # | Scenario | Handling |
|---|---|---|
| 1 | Suggested event fills before either proposes | Caught at propose-time pre-check (§B4.1.4) → `event_full`, offer waitlist-together or re-suggest. Suggestion list auto-refreshes on next view (capacity re-checked). |
| 2 | Event fills between accept-tap and transaction | §B5.1 lock + `available < needed` → nobody booked, both offered waitlist-together. Never strand one. |
| 3 | Both propose different events simultaneously | §B4.4 `crossed` — first wins pending slot, second becomes a one-tap counter. No loss. |
| 4 | One accepts, pays; other abandons checkout | §B5.2 — payer confirmed and keeps spot; non-payer nudged; mutual returns to `open`. No refund to payer. |
| 5 | No shared-interest event in 60 days | §B3.3 ladder → `dormant` → 4h auto-revival. Not a dead end. |
| 6 | Only past events match their interests | Never suggested (locked). Treated as "no future event" → `dormant`. |
| 7 | One user already booked the proposed event | `needed` = 1 (only the other books); §B5.1 handles. If BOTH already booked it independently → §3 Step 0 `already_attending` short-circuit, straight to `confirmed_together`. |
| 8 | Proposal sits unanswered | §B4.2 expiry at 48h → `open`, both nudged once, never auto-picked. |
| 9 | Mutual 7-day clock expires mid-negotiation | §B4.3 — any proposal/accept renews the clock; only true silence expires it. T−24h last-chance nudge. |
| 10 | Proposed event cancelled by merchant before the date | All proposals for it → `event_cancelled`; if `confirmed_together`, the cancellation refund flow runs (`05` §3.5) AND the pair is re-suggested ("Your plan with [Name] was cancelled by the venue — here's another"). Mutual survives. |
| 11 | Accepter's quiz says they can't do that day | Time-fit is a ranking bonus, not a block (§3.1) — they can still accept; the decline path exists if the day truly doesn't work. |
| 12 | Paid event, one user has click credit (Phase 1) | Credit redeems on their own booking only (`20` §8.3 — ≤50%, cash-only qualifies); does not affect the other's payment. |
| 13 | One user blocks mid-handshake | §B7 — mutual `'expired'`, pending proposal `withdrawn`, silent. The other sees the connection quietly gone, no reason given. |
| 14 | Capacity = exactly 1 on a free event, both unbooked | §B5.1 `needed=2 > available=1` → neither booked, both offered waitlist-together (§B5.2 free variant: both join waitlist, promoted as a pair when 2 seats free, else sequentially with the "saved their spot" nudge). |
| 15 | Suggestion generation finds an event but it's `pending_review` again (merchant edited) | Excluded — only `status='published'` is ever suggested or proposable (§3, §B4.1.3). |
| 16 | Proposer withdraws before a response | New `withdrawn` status via `withdraw-click-proposal`; `coord_state` → `open`; other user not notified of the withdrawal (nothing happened from their side). |
| 17 | A user in an active mutual is **banned** | Their mutuals → `expired` (permanent, like a block), pending clicks → `invalidated`, vanish from all surfaces; counterparty sees silent disappearance, no "banned" notice (§6.7a). |
| 18 | A user in an active mutual is **suspended** (temp / auto-suspend pending report review) | Mutuals/clicks **frozen, not destroyed** — can't act, hidden from discovery, 7-day clock paused; resumes on reinstatement (§6.7a). Protects against wrongful suspension destroying real connections. |
| 19 | An **under-18** account reaches the click layer (slipped signup, DOB corrected, region defines minor >18) | `send_click()` + candidate-eligibility refuse structurally — cannot send/receive/appear/mutual. A reported `underage` account is frozen (§6.7b). Never softened. |
| 20 | A click is **not reciprocated** (the majority case) | Never surfaced as rejection/failure — sender simply doesn't hear back (anonymity, §6.1); success is reframed as *attending*, with an aggregate "getting noticed" warmth signal for those who've received clicks (`06` §2.6). The modal experience is designed, not left blank. |
| 21 | A user attends lots, clicks, **never gets a mutual** | Gentle, opportunity-framed help ONLY if a fixable profile gap exists (no photo/bio/tags); otherwise silence. Never "you have no mutuals," never a count, never comparison (`06` §2.7). |
| 22 | A user (A) **pauses** ("take a break") | A: invisible/unclickable, still browses/books, mutuals frozen & restored on return, lossless. B (A's mutual): the mutual quietly rests into B's "Past clicks" with NO status/reason shown, B's cap slot frees, B never waits or feels rejected. On A's return the pair re-surfaces naturally (no "A is back" announcement — A's pause/return is never exposed to B). §B7.4a + B7.4a-i. |
| 23 | A user goes **silent/inactive** (no app open ≥30d) | Down-ranked in discovery (not removed — events are episodic). If clicked while inactive → re-engagement email ("someone clicked with you," never who) as a liveness test (§B7.4b). |
| 24 | Inactive user **ignores** the click re-engagement (still gone 14d after) | Fully hidden from discovery until they return; pending clicks toward them expire normally with no mutual; clicker never told they're inactive (§B7.4b + `06` §2.6). Instantly recoverable on next app open. |
| 25 | Two coordinated pairs accept the **same event's last seats** in parallel | Both serialize on `pg_advisory_xact_lock(hashtext(event_id))` — no overbooking. Lock winner books both their seats; lock loser hits `available < needed` → §B5.5 **contended fill**: neutral "filled up just now" copy + priority re-suggest + waitlist-together offer. Never strands one of the losing pair; never blames them; never reveals the winning pair. |
| 26 | Mutual forms but the **recipient never sees it** (push off, email unopened, app unopened through the 7-day window) | §B7.6a awareness gate — goes to the normal `released` terminal, but release copy is gated at READ-TIME on `seen_at_[side]`: the never-seen side is NOT shown "didn't line up" (a lie for someone never told); their next app-open renders a first-open interstitial revealing the missed mutual as a live opportunity (re-clicks to fresh `active` if they act). No new status, no cron — a read-time branch like expiry itself (§5). Anonymity intact (only ever their own reciprocated mutual). |

---

## B8.5 The complete journey — every scenario, start to end (the foolproof map)

This is the single place that walks a connection from *first click* to *every possible ending and
re-beginning*. Every row names the canonical handling and confirms the invariant: **no state is a
dead end, anonymity never leaks, and only block / deletion / explicit "not feeling it" ends a
connection for good.** If a scenario isn't here, it resolves to the nearest row by the same spine
(§B0: the mutual is the asset; an event is just the current attempt; a failed attempt returns to a
recoverable state).

### Stage 1 — Sending a click (Part A)
| # | Scenario | Outcome | Foolproof? |
|---|---|---|---|
| S1 | Fresh click, receiver eligible, no reciprocal | `R_OK`, pending row created | ✓ |
| S2 | Fresh click, reciprocal pending exists | `R_OK` + **one** mutual formed (revealed only via async notif) | ✓ exactly-one (21A P1) |
| S3 | Duplicate send (same sender/receiver/event) | `R_OK`, budget NOT re-spent | ✓ (21A P4) |
| S4 | Send to someone who blocked you (or you blocked) | `R_OK`, silent, no mutual can form | ✓ block invisible (21A P2) |
| S5 | Send to a privately-attending receiver | `R_NOT_ELIGIBLE` — byte-identical to absent | ✓ (21A P3) |
| S6 | Send to someone not attending at all | `R_NOT_ELIGIBLE` | ✓ |
| S7 | Send after the 48h window closed | `R_NOT_ELIGIBLE` (window-edge folds in, §6.1) | ✓ no 5th outcome |
| S8 | Sender at 3-click cap | `R_CAP` (sender-own state, checked AFTER eligibility) | ✓ ordering rule §6.1 |
| S9 | Sender has no profile photo | `R_PHOTO` (sender-own state, checked AFTER eligibility) | ✓ |
| S10 | At cap, then meets someone post-event | One-time post-event **swap** of a pending click (§6.9) | ✓ real connection never denied |
| S11 | No-show clicks a stranger | Allowed (clicking ≠ check-in); bounded by cap + free-event suppression (§B7.3), gap noted §6.4 | ✓ bounded |
| S12 | Booking cancelled/refunded after clicking | All that user's clicks for the event → `invalidated`, budget refunded; existing mutual stands (§6.2) | ✓ |
| S13 | Sender hidden, clicks others | Outbound allowed; can only mutual if sender later visible — hidden ≈ receiving-disabled, disclosed at toggle (§6.6) | ✓ honest |

### Stage 2 — Mutual forms (Part A §4 / §8)
| # | Scenario | Outcome | Foolproof? |
|---|---|---|---|
| M1 | Both click near-simultaneously | `FOR UPDATE` ordering → exactly one `active` mutual, one notif | ✓ no double row |
| M2 | Mutual where both already booked the same future event | Step-0 `already_attending` short-circuit → `confirmed_together` + warm "you're both going to [event]" notif (§8 exception, §B8 row 7). NOT a separate pre-event-mutual flow (removed June 2026). | ✓ |
| M3 | Post-event mutual | 1–3 ranked suggestions, first-mutual price bias (§8, 09 §6) | ✓ rebooking engine |
| M4 | Mutual forms but both already booked the same future event | Step-0 short-circuit → `confirmed_together` / `already_attending` warm notif (§B8 row 7, 09 §6 Step 0) | ✓ |
| M5 | Mismatched intent (friends × open-to-more) | One mutual, dual intent line rendered; romantic *send* gated upstream (09 §3, rule 6) | ✓ disclosed not hidden |
| M6 | Notification retried (edge fn) | Idempotent on `mutual:{id}` — exactly one send | ✓ |

### Stage 3 — Coordinating to a shared event (Part B)
| # | Scenario | Outcome | Foolproof? |
|---|---|---|---|
| C1 | One proposes, other accepts | §B5 booking coordination, both-or-neither | ✓ |
| C2 | Suggested event fills before propose | Propose-time pre-check → `event_full`, waitlist-together or re-suggest (§B4.1.4) | ✓ |
| C3 | Event fills between accept-tap and transaction | §B5.1 lock; nobody stranded, both waitlist-together | ✓ never strand one |
| C4 | Both propose different events at once | §B4.4 `crossed` — first wins, second becomes one-tap counter | ✓ no loss |
| C5 | One pays, other abandons checkout | §B5.2 — payer keeps spot, mutual → `open`, laggard nudged, no refund | ✓ honest |
| C6 | Proposal sits unanswered | §B4.2 expiry → `open`, both nudged once, never auto-picked | ✓ |
| C7 | No shared-interest event in 60 days | §B3.3 ladder → `dormant` → 4h auto-revival | ✓ not a dead end |
| C8 | Only past events match | Never suggested → treated as `dormant` | ✓ |
| C9 | Proposed event cancelled by merchant | Proposals → `event_cancelled`; if confirmed, refund flow + re-suggest; mutual survives | ✓ |
| C10 | Mutual 7-day clock nears expiry mid-negotiation | Any propose/accept renews the clock (§B4.3); only true silence expires | ✓ |
| C11 | One blocks mid-handshake | Mutual → `expired`, proposal `withdrawn`, silent (§B8 row 13) | ✓ safety path |
| C12 | Capacity = exactly 1, both unbooked | `needed=2 > available=1` → both waitlist-together (§B8 row 14) | ✓ |
| C13 | Proposer withdraws before response | `withdrawn`; `coord_state` → `open`; other side not notified (§B8 row 16) | ✓ |
| C14 | At 5 active mutuals, a 6th forms | Oldest **zero-engagement** `open` mutual soft-releases to make room (§B7.2); new connection never blocked | ⚠ see note below |

> **C14 sharp edge (named, not hidden):** auto-releasing the oldest zero-engagement `open` mutual
> could retire a warm-but-slow thread that was about to bear fruit. Mitigation already in spec:
> only `open` mutuals with **zero** engagement are eligible, `proposed`/`confirmed_together` are
> never touched, and the release is a **soft** `released` (re-clickable anytime, lands on Past
> clicks, day-5 nudge already fired if a viable event existed). A released-by-housekeeping pair is
> therefore one tap from reforming — the connection is parked, never destroyed. If data shows
> housekeeping releases correlate with would-be connections, raise the cap before changing the
> retire rule.

### Stage 4 — Endings, and re-beginnings (Part B §B7 — the part that must never feel like loss)
| # | Scenario | Terminal `status` | Re-clickable? | Frame |
|---|---|---|---|---|
| E1 | Both attend the together-event | `connected` | yes → new `active` (§B7.8) | success, celebrated |
| E2 | Either taps "We clicked 👍" | `connected` | yes, anytime | closure-as-win, prompts stop |
| E3 | 7-day silence | `released` | yes, if they meet again | opportunity-framed, day-5 nudge only, **never** loss-framed |
| E4 | Either taps "Not feeling it" | `suppressed` | yes, after 90d | silent, no drama, no block |
| E5 | Either blocks | `expired` | **no**, while block persists | hard safety; pair invisible to each other |
| E6 | Either deletes account | rows hard-deleted | n/a | counterparty sees silent disappearance |
| E7 | Connected pair meets again, re-clicks | new `active` row | — | the cycle simply runs again (§B7.8) |
| E8 | Re-click race on a previously-`connected` pair | exactly one new `active` (partial index on `status='active'` only) | — | ✓ history rows don't block |

**The five guarantees this matrix exists to prove (testable invariants — §B2):**
1. Every Stage-1 send maps to exactly one of four responses; receiver-state never leaks (21A).
2. Every mutual is exactly one `active` row per pair; no race makes two (M1, E8).
3. Every coordination state has an explicit exit; `dormant` is the catch-all and is actively revived (C7).
4. A mutual leaves `active` only via the four named exits (E1–E6); three of them are re-clickable.
5. The cycle is infinite by design: connected → re-click → active → confirmed_together → attend → connected → … each lap clean, no residue. **There is no state from which a willing pair cannot reach "going together again."**

---

## B9. Copy (warm, low-pressure, brand-compliant — `CLICK_LANGUAGE.md`)

| Moment | Copy |
|---|---|
| Proposal received | "[Name] suggested you two go to [Event] · [day]. Want in?" |
| Proposal accepted → confirmed | "You're both going to [Event] · [date]. See you there ✨" |
| Declined | "[Name] would rather find something else — want to pick one?" |
| Event full at propose | "[Event] just filled up — grab the waitlist together, or find another?" |
| Both crossed | "You both reached out! [Name] suggested [Event] — accept theirs, or send yours?" |
| Dormant | "No perfect match for you two right now — new events drop every week. We'll nudge you the moment something fits." |
| Revival | "Found something for you and [Name] — [Event] this [day]." |
| One paid, other lagging | "[Name] saved their spot at [Event] — grab yours before it's gone." |
| Merchant-cancelled the plan | "Your plan with [Name] was cancelled by the venue — here's another." |
| Day-5 silence nudge (opportunity-framed, replaces "winding down") | "[Name]'s still around — [Event] this weekend could be the one." |
| Soft release at day 7 (no notification; shelf copy only) | *(silent — appears on the "Past clicks" shelf, never pushed)* "You and [Name] clicked. Cross paths again and you can pick up right where you left off." |

Never "match." Never "click on." Always "click with." Lowercase "click" mid-sentence. **Never loss-frame** a mutual ("expired", "winding down", "about to end", "you missed your chance") — `CLICK_LANGUAGE.md` §5a; the old "winding down" T−24h line is **dead**, replaced by the day-5 opportunity nudge above (§B7.6).

## B10. Analytics (extends `22` §2.4 / §5.2)
New events: `proposal_sent`, `proposal_accepted`, `proposal_declined`, `proposal_expired`, `proposal_event_full`, `coord_dormant`, `coord_revived`, `confirmed_together`. The coordination funnel that matters: `click_mutual → mutual_to_suggestion_view → proposal_sent → proposal_accepted → confirmed_together`. Drop-off at each step tells you whether the problem is suggestion quality (no proposals), proposal friction (sent, not accepted), or capacity/payment (accepted, not confirmed). Track `coord_dormant` rate — high = supply density problem in those suburbs, not a mechanic problem.

## B11. Out of scope (deferred)
- Chat / free-text between clicked users (locked — coordination UI only)
- One user paying for both (gift flow)
- Group coordination (3+ people from one event)
- Proposing past events or "people you've attended with before" (locked, Part A §10)
