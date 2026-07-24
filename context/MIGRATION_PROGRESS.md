# Click mechanic migration — build progress

Tracks the Step-2 build that follows `context/CODE_AUDIT.md` (Step 1) and `TECH/implementation/START_HERE.md`. Order is the audit's §10. Each layer lands working + verified before the next.

---

## ✅ Step 2.1 — Schema spine (DONE, verified 2026-06-26)

**Migration:** `database/049_click_mechanic_v2.sql` — applied (pre-production drop+recreate; no row migration needed per CLAUDE.md). Verified live:
- Old objects gone: `user_clicks`, `event_proposals`, the double-firing `create_mutual_click_after_click` trigger + `create_mutual_click()` function (SPINE-08), old `click_status`/`proposal_status` enums.
- New `clicks` (sender_id/receiver_id, nullable `event_id`, `intent_mode`, `surface` CHECK, `mutual_click_id` FK, `'invalidated'` status) — SPINE-01/02/03/04.
- `mutual_clicks` reshaped to the §B2 unified state model: `user_a/b_id`, `intent_a/b`, `status` (active/connected/released/suppressed/expired), `coord_state` (open/proposed/confirmed_together/dormant), `connected_reason`, `connected_event_id`, `mutual_at`, `expires_at`, `ended_at`, `seen_at_a/b`, `unseen_release_shown_at_a/b` — SPINE-05/06.
- `click_proposals` (replaces `event_proposals`) with the full §B4 status enum + `created_at_capacity_ok` (§B5.5). `pair_suppressions` (§B7.1), `click_swaps` (§6.9).
- Partial unique indexes: `uq_click_discovery`, `uq_click_post_event`, `uq_mutual_active` (one active mutual/pair), `uq_one_pending_proposal`.
- Social/safety columns on `profiles`/`event_attendees`/`guest_spots`: `social_visible`, `paused_until`, `is_banned`, `last_active_at`, `default_attend_visibility`, `visible_to_attendees`, `post_event_click_suppressed_until`, `reengagement_clicked_at`.

**Code:** `src/lib/clicks/constants.ts` (new — all tunables). `createUserClickForSession` rewritten:
- Two-process surface (discovery vs who_was_there) from presence of a source event; correct expiry (discovery `created_at+7d`, post-event `event_end+48h`, replacing the old flat 30d / +12h gate — TW-1/2/3).
- §4 mutual detection inside the send transaction with a **per-pair advisory lock** + `FOR UPDATE` reciprocal (SPINE-09). The advisory lock closes the READ-COMMITTED visibility gap the spec's FOR-UPDATE-only pattern leaves open.
- Per-process cap (post-event 3/event; discovery rolling cap), duplicate = quiet no-op (§6.1 P4), intent snapshot onto the click + the mutual.
- Independent age gate ≥18 (§6.7b, partial down-payment on SAFE-07) + ban/social/pause receiver-eligibility refusal.
- §6.1: synchronous response made uniform (mutual revealed only via async notification/email; no status/suggestion leak). **TODO 2.2:** the byte-identical R_* taxonomy + 350ms timing floor (21A harness).
- All other query sites repointed: `getMutualClicksForSession` (filters `m.status='active'`, live proposal only), `getProposalsForSession`/`confirmProposal`/`proposeAlternativeForProposal` (`'accepted'` status + `coord_state='confirmed_together'`, mapped to UI's `confirmed`), `remindProposalRsvps`, `getSuggestedPeople` anti-joins, `blockUser` delete, post-event prompt checks, admin stats, `matching/feature-store.ts`, the dev `supabase-log` route.

**Tests/verification:** `npx tsc --noEmit` clean · `scripts/test-click-concurrency.mjs` PASS 30/30 (exactly one mutual under simultaneous reciprocal clicks, no 500) · schema introspection + matching-cron feature CTE + dashboard/proposals read shapes all execute green.

**Deliberately deferred to later layers (kept working, not spec-complete):** on mutual we still auto-create one `pending` `click_proposals` row carrying the suggested event (keeps `/proposals` working) — the full §B4 propose/decline/counter handshake + read-time multi-suggestion generation is 2.5. Suggestion query still allows `'waitlist'` status / doesn't enforce `>=2` seats / doesn't net guest +1s — that's 2.3. Post-event attendance still keyed on `event_attendees` confirmed only (not guest spots) — 2.5.

---

## ✅ Step 2.2 — Safety (launch-blocking) (DONE, verified 2026-06-26)

All five launch-blocking 🔴 safety defects + the 🟠 read/cron/in-flow gaps closed. New module `src/lib/clicks/teardown.ts` holds the pure-SQL severs + the coordination re-check, shared by block/ban/confirm/propose.

- **SAFE-01 — block teardown.** `blockUser` now runs a transaction: insert `user_blocks` + `severPairCoordination(client, a, b)` → pending clicks `→ invalidated`, active mutual `→ suppressed`/`coord_state=dormant`/`ended_at`, live proposal `→ withdrawn`. (Was: bare DELETE of pending clicks; mutual/proposal untouched.)
- **SAFE-02 / 03 — confirm/propose re-checks.** `confirmProposal` + `proposeAlternativeForProposal` call `pairCoordinationAllowed(client, me, other)` before mutating → neutral "This plan is no longer available." if blocked (either dir) or either party banned/suspended. Mute is NOT a mutation gate (SAFE-09).
- **SAFE-04 — RSVP-reminder cron.** `remindProposalRsvps` now requires `ep.expires_at > now()` + `mc.status='active'` + not-blocked + neither banned/suspended, in both union arms.
- **SAFE-05 — read anti-joins.** `getMutualClicksForSession` + `getProposalsForSession` anti-join `user_blocks` (belt-and-suspenders to the teardown).
- **SAFE-06 — permanent ban.** New `banMemberAsAdmin`/`unbanMemberAsAdmin` (+ `admin/actions.ts` actions + a "Ban (permanent)" item in `admin-members-table.tsx`, plumbing `isBanned` through `AdminMemberRow`). Ban flips the dedicated `profiles.is_banned` and `severAllCoordinationForUser` tears down every pair. **Suspend stays freeze-not-teardown** (reversible; frozen purely by the re-checks). Ban is **decoupled** from `suspended_at`/`social_visible` (it touches only `is_banned`) so unban can't stomp an independent suspension or the user's own §B7.4 opt-out — every social-exclusion surface checks `is_banned` in its own right (suggested-people, both send-path gates, `pairCoordinationAllowed`, RSVP cron, the 3 post-event candidate lists).
- **SAFE-07 — age + eligibility gate.** `getSuggestedPeople` now filters `age >= 18` + `is_banned=false` + `social_visible=true` + not-paused. The send path's independent ≥18 gate (2.1) stands; **added a sender-side ban/suspend gate** so a still-logged-in banned user can't INITIATE a fresh click (review catch — teardown only severs existing coordination). Backfilled null seed ages (11 attendees) so the gate doesn't empty dev discovery.
- **SAFE-08 — in-flow safety.** `proposal-card.tsx` links the partner profile + a "Report or block {name}" deep-link to `/profile/[id]#safety`; `profile-safety-controls.tsx` got the `#safety` anchor + teardown-aware copy.
- **§6.1 probing.** Block-refusal message collapsed to be byte-identical to the age/ban/opt-out/pause refusals (no which-reason leak). `createUserClickForSession` wraps `sendClickInner` with a **350ms timing floor** (`SEND_CLICK_FLOOR_MS`) across every success/throw path.

**Adversarial review:** 10-lens workflow (review → independent refute-verify → synthesize). 9/10 lenses "closed", §6.1 "partial". 2 real medium issues found + **fixed** (sender-side ban gate; ban/suspend column collision → decoupled to `is_banned`-only). Re-verified green after fixes.

**Tests/verification:** `npx tsc --noEmit` clean · `scripts/test-click-safety.mjs` PASS (block teardown, pending-click invalidation, multi-pair ban teardown, suspend=freeze-not-teardown, ban/unban decoupling) · `scripts/test-click-concurrency.mjs` still PASS 30/30 (no regression).

**Deferred (documented, not launch-blocking):** the §6.1 timing floor is a **min-floor, not a constant-time pad** — a mutual-forming send (extra queries + 2 awaited notification inserts) can naturally exceed 350ms while a no-mutual send is padded up to it, so a slow response is still a weak "mutual formed" signal. Full 21A constant-time (fixed deadline above the mutual-path p99, or moving notification side-effects out of the synchronous critical section) is the remaining §6.1 hardening. Rated **low** by the review.

---

## ✅ Step 2.3 — Capacity & guest +1s (DONE, verified 2026-06-27)

- **CAP-3 — the view.** New `database/051_event_capacity_view.sql` → `event_capacity_v` (single source of truth). Reproduces the **exact 3-arm CAP-6 booking-gate formula**: `seats_taken` = confirmed/held `event_attendees` + live `guest_spots` (buyer payment live) + **live waitlist offers** (`event_waitlists` accepted_at null, `offered_until > now()`, joined to a `waitlisted` attendee). `available = greatest(capacity - seats_taken, 0)`. The view counts ALL live seats (no buyer-scoped exclusion — correct conservative behaviour for pair suggestion).
- **CAP-1 — two-seat rule.** `available >= 2` on every GENERATION site: both mutual-formation suggestion queries in `createUserClickForSession`, `proposeAlternativeForProposal`, `getProposalCatalogue`. A one-free-seat event no longer strands a pair.
- **CAP-2 — guest netting.** All click capacity checks read the view (guests + holds + offers netted), replacing the guest-blind inline counts.
- **CAP-4 — full/waitlist exclusion.** Dropped `'waitlist'` from every suggestion/proposal/catalogue/display status filter (`status in ('live','featured')`).
- **CAP-5 — propose + accept re-checks.** `proposeAlternativeForProposal` re-checks `available >= 2` + live status at propose-time; `confirmProposal` re-reads the view and refuses if the event is sold out / waitlisting / cancelled / past, **leaving the proposal pending** so the card's "filled up — suggest alternative" flow takes over (terminal `event_full` + read-time re-propose deferred to 2.5).
- **CAP-6 — do-not-regress.** Booking/headcount inline gates untouched (the reference template).
- **DISPLAY threshold:** `getMutualClicksForSession`/`getProposalsForSession` use `available >= 1` (a mid-progress plan where one of the pair already RSVP'd needs only one seat — `>= 2` would wrongly hide it). With the view now matching the booking gate exactly, the booking layer is the final per-seat arbiter; no stranding.

**Adversarial review:** 7-lens workflow (review → refute-verify → synthesize). 5 issues confirmed + **all fixed**: (1–3) the view was missing the live-waitlist-offer seat arm → a re-offered seat on a still-`live` event over-reported `available` and could let a pair confirm a plan the booking layer would reject (**high**, fixed by adding arm 3 + a test assertion); (4) `confirmProposal`'s CAP-5 query lacked an event status/time guard (**medium**, fixed); (5) migration number `050` collided with `050_event_rejection_reason.sql` (**low**, renumbered to `051` + ledger cleaned). Re-verified green after fixes.

**Tests/verification:** `tsc --noEmit` clean · `scripts/test-click-capacity.mjs` PASS (3-arm seat counting incl. live waitlist offers + expired-hold/cancelled-guest/expired-offer exclusions, two-seat gate, waitlist exclusion, display `>=1`, confirm sold-out re-check) · `scripts/test-click-concurrency.mjs` 30/30 + `scripts/test-click-safety.mjs` still PASS (no regression). Migration `051` applied to the pre-prod DB.

---

## ✅ Step 2.4 — Timers / windows (DONE, verified 2026-07-24)

Pure code (no migration — `events.timezone` already exists, default `Australia/Sydney`; the existing `notifications.action_url` dedupe is kept as the idempotency key, functionally equal to the spec's `post_event_prompts_sent` table per the audit's own note). 4 edits in `event-repository.ts`.

- **TW-3 — prompt fires at +2h, not +12h.** New `POST_EVENT_PROMPT_DELAY_HOURS` (=2) imported from `clicks/constants.ts` and used as the lower gate at all three prompt sites. `getPostEventClickPromptForEvent` gained the lower gate it never had (the audit's named bug: the event-page button showed from `event_end` while submit opened later, so a tap was rejected).
- **TW-3 — quiet-hours deferral.** `notifyPostEventClickPrompts` now sends only when `extract(hour from now() at time zone e.timezone)` is in `[9, 22)` — a prompt whose +2h lands in the 22:00–09:00 event-local band simply stays eligible until the next run past 09:00 (deferral = leave-eligible, no second job; action_url idempotency prevents double-send on the re-fire).
- **TW-4 — four-window soup collapsed to ONE gate.** All three prompt functions (dashboard rail `getPostEventClickPrompts`, event page `getPostEventClickPromptForEvent`, push cron `notifyPostEventClickPrompts`) now share the identical window: **`event_end + 2h <= now() < event_end + 48h`** — exactly the who-was-there click-accept surface's live window (`event-repository.ts:7383`, from 2.1). Retired the disagreeing upper bounds (dashboard `−14d`, event-page `−30d`, cron `−7d`).
  - **Decision (Doan, 2026-07-24):** cron upper bound unified to **+48h** (not retention `§2.1`'s literal 7-day self-heal lookback). Rationale: the who-was-there surface closes at +48h, so a day-3 notification would open a dead surface; the 48h window (`21 §B3.2`) is the newer binding constraint. `§2.1`'s 7d predates it.
- **TW-1 / TW-2 — verified no stragglers.** Send-layer expiry (discovery `created_at+7d`, post-event `event_end+48h`) was already correct from 2.1; grep confirms no `12 hours` / `14 days` / `30 days` post-event bounds remain in the live path. (The `interval '7 days'` at `:5940` is an unrelated rolling-activity count; the `test-click` audit-report / `md` coverage docs still describe the OLD windows by design — historical audit records, not live gates.)
- **TW-5 — respected.** No correctness cron added; expiry stays read-time-only.

**Tests/verification:** `tsc --noEmit` clean · new `scripts/test-click-timers.mjs` PASS (both window edges +2h open / +48h close, plus the four quiet-hours boundary conversions incl. the 09:00 open + 22:00 close edges) · `test-click-concurrency.mjs` 30/30 + `test-click-safety.mjs` + `test-click-capacity.mjs` all still PASS (no regression).

---

## ⏳ Next: Step 2.5 — New surfaces
The biggest remaining piece and effectively launch-blocking (the 2 Jul audit found the live coordination modals frozen at `opacity: 0` — the core mechanic is unusable). Build the **coordination drawer + one-time reveal** (`UIUX/COORDINATION_MODAL_SYSTEM.md` v1): one progressing drawer that's a pure projection of `coord_state`, base state fully visible (no opacity-gated entrance that restarts on re-render), `reveal_seen` persisted per user+mutual so the reveal fires exactly once. Plus: decline-proposal as a first-class state (not block-as-exit); report/block inside the mutual + proposal flow; C11 (already-booked side shows "I'm in", never a live RSVP button); C12 (a dead agreed event routes back to `open`/`dormant`, never a stuck terminal — do NOT add a delete button). Then 2.6 UIUX/language → Step 3 teardown. Matching findings (§6) + the 11 "beyond the mechanic" tasks remain out of scope pending Doan.
