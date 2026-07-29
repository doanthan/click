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

## Step 2.5 — New surfaces (split; sequencing decision Doan, 2026-07-24: "fixes first, drawer after")

The 2.5 scope reshaped once the frontend was inventoried: the live Next.js app **never built the coordination drawer** — the "modals frozen at `opacity: 0`" the 2 Jul audit measured were the *design mock* (`context/Click Design System/click-app-v2/coordination.jsx`), not production. The real flow today is routed pages (`/proposals`) + inline cards (`proposal-card.tsx`) + a notification, and it **functions**. So 2.5 = a build-from-scratch drawer PLUS four defects hiding in the working flow. Two of those defects (decline, reveal-seen) are entangled with the drawer (decline needs an "suggest on an open mutual" entry that only the drawer's `open→suggest` step provides; the reveal is a drawer overlay) — doing them standalone = throwaway scaffolding. So the split:

### ✅ Step 2.5a — Proposal-card correctness (C11 + C12) (DONE, verified 2026-07-24)

Migration-free; the two cleanly-standalone defects on the existing routed card.

- **C11 (§B4.1 step 7) — already-booked side never sees a live RSVP.** `getProposalsForSession` now returns `viewerHasSeat` / `otherHasSeat`, computed via `exists(event_attendees … status='confirmed')` against the SAME block-safe upcoming/bookable event join the read already uses (a dead/sold-out event drops both to false → falls to the C12 recovery, not a stale prompt). `proposal-card.tsx`: the booked side renders **"You're in ✨"** (or **"You're both going ✨"** when both hold seats) with a partner-focused status line and a passive **"View event"** link — never a live RSVP button; the badge is **"You're in" / "Both going"** (sage), never a pair-computed "RSVP needed". The unbooked side keeps the live RSVP.
- **C12 (§B0/§B6) — a dead agreed event is not a terminal.** Retired the stuck **"Wrapped"** badge + dead-end copy. A confirmed proposal whose event has died (cancelled/past/sold-out → dropped to null) now renders the re-suggest recovery ("Suggest another plan" + the shared catalogue picker), badge **"Pick a plan"**. `proposeAlternativeForProposal` reopens an `accepted` proposal **only** when its agreed event is truly dead (a `stillLive` guard refuses re-opening a live agreement), resetting `status→pending`, `confirmed_*→null`, `coord_state→'proposed'`; the 3-alternative cap is skipped on a reopen (a fresh plan after a failed one, so no dead-end). No delete button.
- Shared: extracted the catalogue picker into one `picker` const reused by the pending row and the C12 recovery.

**Tests/verification:** `tsc --noEmit` clean · new `scripts/test-click-proposal-states.mjs` PASS (seat flags incl. the dead-event→false guard; C12 reopen fires only on cancelled/past/sold-out, refuses a live agreement; the reopen UPDATE flips status/confirmed/coord_state) · concurrency + safety + capacity + timers regressions all still PASS. **Not yet visually QA'd** in the running app (logic verified via SQL-level tests; a manual pass over the confirmed/booked/dead-event/pending card states is a follow-up).

**Deferred to 2.5b (entangled with the drawer):** decline-proposal first-class (`declined` enum is unwired; needs the open-mutual suggest entry) and the one-time reveal gate (`seen_at_a/b` exist unused; the reveal is a drawer overlay).

### Step 2.5b — Coordination drawer + one-time reveal (in flight; branch `feat/click-2.5b-coordination-drawer`)

Decomposed into landable sub-steps. **i / ii / iii DONE + committed** (backend tested, drawer built + tsc + live-SQL smoke-tested, drawer still unwired); **iv / v remain** (the destructive re-home + the inherently-visual §10 QA).

- **✅ 2.5b-i — one-time reveal gate (commit `dc294d9`).** `getMutualRevealState` + `markMutualSeen` on the unused-till-now `seen_at_a/b` (049, migration-free): the reveal is persisted per user, per mutual, so it fires exactly once and every re-entry (bell/dashboard/Your clicks) skips straight to the drawer's current step — the exact re-fire-on-every-tap regression the live render had (§4). `markMutualSeen` is idempotent (WHERE matches only while the viewer's column is null) and returns first-view-only, which is what tells the drawer to play the reveal. `markMutualSeenAction` wraps it best-effort. `scripts/test-click-reveal.mjs` PASS (11: per-side gate, idempotency, non-participant refusal).
- **✅ 2.5b-ii — decline + suggest backend (commit `fad344a`).** `declineProposalForSession`: a pending plan → `status='declined'`, `coord_state='open'`, mutual stays active, **no blame surfaced to the proposer** (§4/§9 — decline is a within-active transition, not one of the four active-ending exits). `suggestPlanForMutual`: the create-path the send-click auto-suggest comment defers to 2.5 (§B4) — fires only from `open` (a brand-new mutual or one a decline reopened), needs a bookable-for-two catalogue event, inserts a fresh pending proposal + `coord_state='proposed'`, notifies deep-linked to `/proposals?open=<id>`. Re-pointing a *live* pending plan still routes through `proposeAlternativeForProposal` (which owns the 3-alt cap), so `suggest` can't bypass it. Together: **decline → open → suggest is a live loop, never a dead end.** `declineProposalAction` + `suggestPlanAction` wrap them. `scripts/test-click-decline-suggest.mjs` PASS (12).
- **✅ 2.5b-iii — `CoordinationDrawer` component, unwired (commit `717a098`).** The one stepped modal the whole sequence lives in (§1): `reveal → open/proposed suggest → confirmed 'both going ✨' → C12 recovery`, a pure `coord_state`/proposal projection (§2) advancing **in place** (per-action local step override, no route change). Shell mirrors `confirm-dialog` (portal, focus-trap, Escape, scroll-lock). **§5 freeze-safety:** the panel mounts once per open (host keyed on `mutualId`) so the `opacity:0` `step-enter-fwd` entrance completes exactly once; steps swap via plain conditional render off a **visible base**, so no per-step opacity gate exists to stick. Reveal is copy-locked (§4/§8), fires once (`markMutualSeenAction` on dismiss), shows the dating opt-in line only when BOTH opted in. Decline ("Not this one") is a quiet ghost, never destructive-red. Add-to-calendar = a client-built Google Calendar link. SAFE-08 report/block at every step. `getProposalsForSession` extended (mutualId, coordState, revealSeen, shared-intent phrase, bothDating, proposedByMe — cheap, smoke-tested live). Reduced-motion = the global handler. tsc clean.

**✅ 2.5b-iv — wire it, the destructive re-home (commit `2d696d8`).** (1) **Read rework — `getProposalsForSession` is now mutual-centric** (FROM `mutual_clicks` LEFT JOIN LATERAL the single pending/accepted plan): an `open` mutual with no live plan (brand-new or one a decline reopened) still shows and routes to the drawer's suggest step — fixing the decline→vanish gap; the lateral+limit-1 means no mutual fans out even on dirty data; `expired` coalesces the mutual clock and never marks an accepted plan. (2) `/proposals` is now the compact **"Your clicks"** list (§7 — same layout, state is an accent) whose rows open the ONE drawer; `ProposalCard`'s inline forms retired (file left for Step-3 teardown, no longer imported → out of the bundle, and with it the §11-banned "Expired" badge). (3) `?open=<mutualId>` deep-links a mutual straight to its step; confirm/propose/suggest notifications now carry it. Rows say **"Wound down"** (§8), never "expired". `test-click-clicks-read.mjs` PASS (7).

**✅ 2.5b-v — §10 acceptance QA, live in Chrome (fixes in commit `c51a975`).** Ran the 12-point script at 375 / 768 / 1440, logged in as the Maya test account. **Two real bugs caught + fixed** (only a live pass finds these):
  - **Advance-in-place was broken** — the drawer used a local optimistic override that a successful action's `revalidatePath` reset, so the LIST advanced ("Waiting on Cindy") while the DRAWER stayed put. Refactor: `ClicksList` OWNS which mutual is open and feeds the drawer the LIVE entry, so revalidate flows the fresh `coord_state` in and the step re-projects (pure §2 projection; removed the window-event Host + override). Re-verified: suggest → "waiting on [name]", decline → back to suggest, both in place, URL never changes.
  - **Reveal re-fired on same-session re-entry** (the exact §4 regression) — server `seen_at` persists across reload/devices, but the in-session list snapshot lagged; a module-level `revealedThisSession` set closes it.
  - **Mobile row overflow at 375** — the grid `<li>` defaulted to `min-width:auto` and pushed the badge off-screen; `min-w-0` lets `truncate` bite.
  - **Verified live:** reveal fires **visible** (computed `opacity:1`, `transform:matrix(1,0,0,1,0,0)` = the entrance animation COMPLETES — the `opacity:0` freeze regression is gone), once-only (server + session), in-place advance (no URL change), both-going + real Google-Calendar link, decline→open, mobile full-width bottom-sheet, resize torture keeps it visible, no coordination step is a routed page, banned-string grep clean. `prefers-reduced-motion` holds by construction (the global handler forces the `both`-fill animation to its `opacity:1` end state). tsc + full click suite (8 scripts) green.

**Step 2.5 is DONE.**

---

## ✅ Step 2.6 — UIUX / copy + language sweep (DONE, verified 2026-07-29)

Branch `feat/click-2.6-language` (off the 2.5b tip). **Critical finding up front:** the language canon `context/Click Design System/uploads/CLICK_LANGUAGE.md` is **v14 (2026-06-27) — newer than CODE_AUDIT.md (Jun 25)**, and had *superseded* several of the audit's "locked strings" (headline "You two clicked." → **"You clicked with [Name]."**; post-event "Who'd you click with?" → **"Did you click with anyone?"**; button cap-C "Click with" → lowercase **"click with [name]"**; pending pill → **"clicked"** no ✨). Treated **v14 as canon** (per `CLAUDE.md` it is *the* binding copy doc) and reconciled to it, not the stale audit strings.

**The live worklist was small** — most §7 findings were **already fixed** during the DS restyle + 2.5b (verified, no change needed): drawer reveal + dashboard mutual card already render v14 "You clicked with [Name]." + the §5 intent line + the both-opted-in dating line (UIUX-5/6 done); post-event heading already "Did you click with anyone?" (UIUX-7); buttons already lowercase "click with [name]" (UIUX-8); `/people` lede + "Matched {date}" already gone (UIUX-1, L4); `/proposals` meta already "clicked with" (L4); `/how-it-works` clean of the "during"-clicking break (UIUX-4).

**Applied (mechanical + Job-A that remained):**
- **UIUX-5 — the one live headline miss: the mutual push notification.** `event-repository.ts` (both sides of the freshly-formed mutual) → v14 locked title **"It's mutual - you clicked with [Name]. ✨"** (name from the recipient's POV; also killed a latent em-dash → ` - ` per `CLAUDE.md`). Title moved from an inline SQL literal to a bound param. **Bonus:** `action_url` now deep-links `/proposals?open=<mutualId>` (was bare `/proposals`) so the one-time reveal lands on the right mutual - completing 2.5b-iv's notification deep-link sweep, which had missed the mutual-formed ping.
- **L1/L4 — `click-data.ts` banned strings** ("Click privately on people" → "click privately with people"; "Two private clicks match"/"Potential match" → mutual-click language). These are **dead exports** (`roleCards`/`notificationRows`/`dashboardSections` have no consumer) but fixing them keeps the banned-string grep clean; they're Step-3 teardown candidates.

**Routed, NOT auto-applied (spec defers — the discipline point):**
- **L7 connect/connection** (terms/safety/privacy, 9 spots) → new **`context/LANGUAGE_REVIEW_FOR_CINDY.md`** for Cindy to rule on (product-category positioning vs mechanic language). Stripe **Connect** left alone (payment product).
- **UIUX-9/10** (never-read "Mutual Click alerts" toggle; always-send mutual email), **UIUX-11** (`/for-merchants` IA), and **`/test-click`** (the faithful explainer now narrates the *old* mechanic - "Mutual Click found" push, "Click again to reopen", 7-day-or-dies, "Who did you click with?", "12h after event end"; needs its own re-diff now that 2.1-2.5 landed) → flagged to Doan, listed in the Cindy doc's tail.

**Tests/verification:** `tsc --noEmit` clean · full click regression suite (8 scripts: concurrency 30/30, safety, capacity, timers, proposal-states, reveal, decline-suggest, clicks-read) all PASS - the push-string change touches only the `notifications` insert, not the read/detect paths, and the suite confirms no regression. Not separately browser-QA'd (copy-only + one notification string; no new UI surface).

**Next: Step 3 teardown** — drop the retired `src/components/proposal-card.tsx` (no importers since 2.5b-iv; still carries the §11-banned "expired" string + a cap-C "Click again to reopen"), remove the dead `click-data.ts` reference exports, and the `/test-click` re-diff (or split that out). Matching findings (§6) + the 11 "beyond the mechanic" tasks remain out of scope pending Doan.
