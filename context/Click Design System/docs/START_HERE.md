# START_HERE.md — Click code→spec migration (execution spec for Claude Code)

**You are Claude Code with full access to this repo.** This file is your entry point and table of contents. Follow it top to bottom. Do not improvise beyond it. If a spec is silent on something, stop and ask the human (Doan) — do not invent behaviour.

## Version manifest — THE single manifest for this package (as of 2026-07-05)

This table is the one place the package pins spec versions; every other package/HANDOVER doc points here instead of carrying its own copy. **Tripwire (bidirectional):** if any spec's line-1 header differs from this table IN EITHER DIRECTION — the file is older (stale repo copy) OR newer (this manifest is stale) — **stop and tell Doan/Cindy** before doing any work that reads that spec. Do not guess which side is right.

| Spec (in `TECH/`) | Rev | Spec | Rev |
|---|---|---|---|
| `21_CLICK_MECHANIC.md` | v17 | `03_ADMIN_JOURNEY.md` | v3 |
| `21A_PROBING_ATTACK_TEST.md` | v3 | `06_INFRASTRUCTURE_FIXES.md` | v4 |
| `09_CLICK_WITH_ME_AND_RADAR.md` | v17 | `06_RETENTION_AND_ENGAGEMENT.md` | v7 |
| `CLICK_LIFECYCLE_PROCESS_MAP.md` | v6 | `12_DISCOVERY_PAGE.md` | v6 |
| `05_BOOKING_LIFECYCLE.md` | v7 | `22_ANALYTICS.md` | v9 |
| `05_BOOKING_AND_EVENTS.md` | v6 | `10_ROMANTIC_INTENT_AND_DATING_MODE.md` | v11 |
| `02_MERCHANT_JOURNEY.md` | v7 | `13_ALGORITHM_COMPLETE_REFERENCE.md` | v17 |
| `19_GUEST_RSVP.md` | v3 | `04_TAG_AND_MATCHING_DATA_FLOW.md` | v6 |
| `20_REFERRAL_INVITE.md` | v4 | `04_MATCHING_ALGORITHM_V2.md` | v12 |
| `00_MASTER_INDEX.md` | v17 | `04_ENGAGEMENT_WEIGHTING_DELTA.md` | v3 |
| `QA_FEATURE_CHECKLIST.md` | v14 | `07_INTEREST_TAGS.md` | v5 |
| `01_USER_JOURNEY.md` | v6 | `08_LIFE_TAGS.md` | v8 |
| `VERSION_CHANGELOG.md` | v79 | | |

*(Manifest refreshed 2026-07-05 at the SESSION CLOSE-OUT (changelog v78; copy-sign-off bumps 08 v8 / 10 v11 / 21 v17 / 06_RET v7 / 09 v17 / 12 v6 / 02 v7 / 20 v4): the 2026-07-05 session is COMPLETE - the audit fix pass F0-F5, the decision landings, the life-tag/quiz implementation, the scale-ready sweep, and the copy sign-off are ALL in; every flagged user-facing string is ✅ signed off (Cindy, 2026-07-05) - no pending copy blocks the build; remaining OPEN items are the 22 §1 city-two MV-grain decision (parked) and the business-side GST/merchant-onboarding items (README). Prior refresh same day at the scale-ready straggler close-out (changelog v75; 01 v6 + 04_TAG v6 + 22 v9): 01 §9 digest summary + 04_TAG expiry-cron comment off AEST onto `service_area_tz`; 04_TAG's stale `renewed`-flag comments replaced [no such flag - renewal pushes `expires_at`, 21 §B4.3]; 22 parks the OPEN-at-city-two merchant-tz-vs-service-area-tz MV-grain decision. Prior refresh same day at the scale-ready sweep, commit 3 - SWEEP COMPLETE (changelog v74; QA v14 + the new beyond-the-mechanic task row below: service-area/timezone parameterisation, acceptance = changing platform_settings.service_area + service_area_tz re-homes every location-locked surface; QA §14.6 is the acceptance block). Prior refresh same day at the sweep's commit 2 (changelog v73; 02 v6 + 06_RETENTION v6 + 22 v8 + 00 v17): service-area + timezone parameterisation - NEW platform_settings.service_area [name + boundary; pilot "inner Sydney"] + service_area_tz [IANA; pilot Australia/Sydney], owner 02 §6, registered in 00; 02 §6 gate reads "within the service area", 06_RET digest + 22 refresh/buckets follow service_area_tz; changing the two keys re-homes every location-locked surface. Prior refresh same day at the sweep's commit 1 (changelog v72; 12 v5 + 20 v3): Cindy directive - Sydney is the STARTING city, not a product assumption; 12 §4 distance filter = radius chips 1/3/5/10 km + Any distance [pure radii, never area names - "Inner/Greater Sydney" labels dead]; 20 §4.2 share default de-Sydney'd. Prior refresh same day at the life-tag taxonomy decision (changelog v71; 08 v7 + 13 v17 + 00 v16 + QA v13): seed is 19 life tags across 4 groups [reachable-only - lifestyle group culled, identity/accessibility tags deferred post-pilot]; five tags newly quiz-wired and FOMO-only [aggregate FOMO yes, never per-person - 08 §4.4c; get_shared_life_tags predicate changed]; the migration's Week-1 seed task uses the NEW 08 §9 SQL incl. `fomo_only`. Prior refresh same day at the cutover close-out (changelog v70): D-cutover-surface resolved - ALL migrated `user_clicks` rows become `surface='discovery'`, `event_id NULL`; the Step 2.1 cutover block now carries zero open confirms - and the POST-AUDIT ADDENDUM below the phases is new: Phase 1 seeds the five `platform_settings` defaults, and a beyond-the-mechanic task list is worked after Phase 2. Prior refresh same day at the decision-landing pass (post fix-pass F1a–F5; changelog v66–v69) — five decisions by Cindy 2026-07-05: **`discovery_click_cap` default = 21 per rolling 7 days** (21 v16 / 00 v15 — OPEN box closed; seed `platform_settings.discovery_click_cap = 21`, silent enforcement unchanged); **cohort fallback tree adopted** (04_V2 v12 — romantic cohorts → pooled romantic → global, others → global; ≥50 = fit with parent prior, ≥200 = stand alone); **romantic-signal reciprocity** (10 v10 / 09 v16 / 13 v16 / QA v12 — every romantic-specific signal renders ONLY for `romantic_visible = true` viewers, supersedes the F4 paused-state resolution); **locked-unit-price supplemental seats + guest `cancelled` on merchant cancel CONFIRMED** (19 v3 / 05 v7). Prior F5 close-out headline stands: 21 v15 [attended → checked_in in §6.4/§B7.3], 00 v14 [ghost refs + tunables], language-sweep bumps across 12/01/13/QA/09/06_INFRA/06_RETENTION/05_AND_EVENTS/07/08/10. Headline for the migration: check-in columns are `checked_in`/`checked_in_at` on BOTH `bookings` and `guest_spots` — no `attended` column anywhere; the free-event no-show signal counts only on door-listed events. Prior F4 headline stands: `match_candidates_*` MVs + `refresh-match-candidates` RETIRED — serving layer = `user_click_scores` [4h] + `user_event_scores` [30m]; interest-tag seed count 220.)*

**The situation:** the live application code is a full model behind the specs. The click mechanic was rewritten (June 2026, two-process model); the code still runs the OLD pre-rewrite version. Your job: migrate the code up to the specs — **audit first, then one task per branch.** Never attempt "make the code match the specs" in a single pass; it half-applies and leaves a broken hybrid.

---

## Table of contents — execute in this order

| Step | What | Output | Gate |
|---|---|---|---|
| 0 | Orient — read the specs + reference | (none) | — |
| 1 | **Audit** the code read-only | `TECH/implementation/CODE_AUDIT.md` | **STOP — Doan reviews before Step 2** |
| 2.1 | Migrate: schema spine | branch + migration | diff approved per task |
| 2.2 | Migrate: safety (LAUNCH-BLOCKING) | branch | diff approved per task |
| 2.3 | Migrate: capacity | branch | diff approved per task |
| 2.4 | Migrate: timers | branch | diff approved per task |
| 2.5 | Migrate: new surfaces | branch | diff approved per task |
| 2.6 | Migrate: UIUX / copy + **language application** | branch | diff approved per task; **judgment-rule copy → `LANGUAGE_REVIEW_FOR_CINDY.md`, Cindy approves before merge** |
| 3 | Teardown — remove migration scaffolding | branch | final commit |

---

## STEP 0 — Orient (read-only)

Read, in order: `CLAUDE.md` (root) → this file → `TECH/implementation/CLICK_CODE_VS_SPEC_TRIAGE.md` (the line-by-line code↔spec map with severities) → `TECH/21_CLICK_MECHANIC.md` (current rev per the manifest above). Pull `09`, `13`, `04`, `05_BOOKING_LIFECYCLE.md`, `19_GUEST_RSVP.md`, `QA_FEATURE_CHECKLIST.md` as each task needs them. For the coordination frontend (Step 2.5) also read `UIUX/COORDINATION_MODAL_SYSTEM.md` (v1, 2026-07-10 - the drawer + one-time-reveal contract).

---

## STEP 1 — AUDIT (read-only; produce `TECH/implementation/CODE_AUDIT.md`; change nothing)

Read the application code and report, per finding: **file:line · what the code does now · what the spec requires (cite section) · severity** (use the triage's classes). Cover at least:

**Click mechanic — schema:**
- Click table: `user_clicks` (OLD) or `clicks` with `surface` enum + nullable `event_id` (TARGET, `21` §3)? Report columns, indexes.
- Proposal table: `event_proposals` (OLD) or `click_proposals` + `coord_state` (TARGET, `21` §B2a DDL / §B2 state model)?
- Dead objects present? `detect_mutual_click` trigger, `post_event_clicks` table → must not exist.
- Mutual detection: trigger (OLD) or inside the send-click transaction (TARGET, `21` §4)?

**Click mechanic — behaviour:**
- Expiry windows: discovery (TARGET `created_at + 7d`), post-event (TARGET `event_end + 48h`).
- Post-event prompt fire time (TARGET `event_end + 2h`, 09:00-local deferral).
- Block after mutual: does it tear down the mutual + proposal (TARGET yes, `21` §6.5)?
- Do `confirmProposal` / `proposeAlternative` / RSVP-reminder cron re-check block/mute?
- RSVP cancel: is the still-going partner notified + the confirmed proposal reconciled?
- Decline-proposal path present (TARGET yes, `21` §B4)?
- Event-suggestion capacity: requires `available >= platform_settings.suggestion_capacity_floor` (default 3, structural min 2) and reads `event_capacity_v` (TARGET yes)?
- `avatar_url` NULL-until-real-upload (P4 pre-launch verify, `HANDOVER/CLICK_POST_LAUNCH_CONSIDERATIONS.md`): does any signup/profile path write a default placeholder URL? The photo gate (`13` §6) checks `avatar_url IS NOT NULL` — a placeholder silently unenforces it. Report yes/no; QA v8 §3 (onboarding Step 4) carries the acceptance line.

**Matching/scoring (`13` §5, `04`):**
- Intent-mode weights; `locals` row must net 1.0; age-band; engagement weight `rsvp_count`-keyed, floor 0.700.

**UIUX/copy:**
- `/people` ranking copy ("ranked by shared interest tags" → should reflect Matching v2); explainer/how-it-works surfaces vs the spec mechanic; `notify.mutualClick` honoured.
- **Coordination drawer/reveal render (`UIUX/COORDINATION_MODAL_SYSTEM.md`):** are the coordination steps routed full pages (OLD) or one progressing drawer (TARGET)? Do the modals render visible - computed opacity at 375 AND 1440 (the 2 Jul audit measured them frozen at `opacity: 0` on their entrance animations)? Does the reveal re-fire on notification tap (OLD bug) or is there a per-user+mutual `reveal_seen` (TARGET)? Report state only; the fix is Step 2.5.

**Language — code identifiers + analytics names (binding; `UIUX/CLICK_LANGUAGE.md` §2-§3, mechanical tier):**
This is a read-only *detection* sweep — report every hit, change nothing (application happens in Step 2.6). Grep the whole codebase (TS/TSX, SQL, edge functions, analytics calls, comments) and report `file:line · offending token · rule · proposed fix`:
- **Banned `match` family in identifiers/keys/comments:** `match`, `matches`, `isMatch`, `matchScore`, `matched`, `match_*` analytics names. It is a *click*, never a match (`CLICK_LANGUAGE.md` §3). **Whitelist — do NOT flag these** (legitimate, not the banned word): `rematch`-free codebase aside, the SQL/JS keyword senses `.match()` (regex), `match`/`when` control-flow, `ts-pattern`, and library APIs. Flag only *domain* uses that mean "two people connected".
- **Directional click grammar:** `click_on`, `clickOn`, `clicked_on`, `"clicked on"` in any string/identifier/analytics name → must be `click_with` / `clicked_with` (`CLICK_LANGUAGE.md` §2).
- **Literal-UI "click" in user-facing strings/analytics:** "click here", "click the button", "click to…" → `tap`/`select`. **Whitelist — do NOT flag:** a DOM `onClick` handler name is fine (`CLICK_LANGUAGE.md` §3 note); this rule is about user-visible language and analytics naming, not React event props.
- **Binding analytics event names (`21` §9) — these are CORRECT, do NOT flag as violations:** `click_sent`, `click_mutual`, `click_expired`, `click_invalidated`, `click_swapped`, `post_event_prompt_opened`, `discovery_click_sent`, `who_was_there_viewed`, `mutual_to_suggestion_view`, `suggestion_to_booking`. Flag only `match_*` and any DEAD names if present (`pre_event_mutual`, `whos_going_viewed`).
- Classify every hit **mechanical** (banned token / directional grammar / literal-UI / dead name) — these are safe for the agent to fix directly in Step 2.6. Do not attempt voice/framing judgements in the audit; those are a Step 2.6 copy concern, flagged for Cindy, never auto-applied.

Reconcile against `CLICK_MECHANIC_AUDIT.md` if present (a prior human audit) and note differences. **Then STOP. Wait for Doan to review before any edits.**

---

## STEP 2 — MIGRATE (only after the audit is reviewed; one task per branch)

For **every** task: (1) name the task + the spec section that defines "done"; (2) show Doan the migration SQL + code diff + touched call-sites **before** applying; (3) apply only on confirmation; (4) test against the spec section + the matching `QA_FEATURE_CHECKLIST.md` items; (5) stop. **Do not refactor beyond the named task.**

### 2.1 — Schema spine
- Build `clicks` (`surface` enum `discovery`/`who_was_there`, `event_id` nullable, CHECK constraint, partial unique indexes `uq_click_discovery` + `uq_click_post_event`, `21` §3). Migrate `user_clicks` rows in per the data-cutover block below — the surface question is RESOLVED (D-cutover-surface): ALL migrated rows become `surface='discovery'`.
- Build `click_proposals` (canonical DDL: `21` §B2a, incl. `uq_one_pending_proposal` + the edge-fn-only RLS) + `coord_state` on `mutual_clicks` (`21` §B2/§B4). Retire `event_proposals` per the cutover mapping below.
- Drop the `detect_mutual_click` trigger (detection moves into the send-click transaction, `21` §4) and `post_event_clicks` if present.

**Data cutover (RESOLVED — Cindy, 2026-07-05; owner: Cindy, executor: Doan).** The three rules below ARE the decisions — implement as stated, do not re-open. The cutover block carries **zero open confirms**. (This also settles the owner question this package previously stated two ways: cutover decisions are owned by Cindy; Doan executes them.)

- **D-cutover-surface (RESOLVED — Cindy, 2026-07-05):** ALL migrated `user_clicks` rows become `surface = 'discovery'` with `event_id = NULL`. The old model had no event-anchored clicks in the canonical sense, so nothing maps to `who_was_there`. Expiry per D-cutover-expiry below.
- **D-cutover-expiry:** migrated `user_clicks` rows get `expires_at = LEAST(old 30-day expiry, created_at + 7 days)` — grandfather, never extend. Rows already past that value are **marked `expired` at migration** (an analytics label, consistent with the `21` §5 read-time rule), not deleted.
- **D-cutover-proposals:** old `event_proposals` rows map to `coord_state`: confirmed → `'confirmed_together'` (with `connected_event_id`), pending (unexpired) → `'proposed'` (a `click_proposals` row is created from it), declined/expired/everything else → `'open'`.

| Old `event_proposals` row | Cutover result |
|---|---|
| `confirmed` | `mutual_clicks.coord_state = 'confirmed_together'`; `connected_event_id` = the agreed event |
| `pending` AND unexpired | `coord_state = 'proposed'`; a `click_proposals` row is created from it (same proposer/event; `status = 'pending'`; expiry carried across, clamped to the `21` §B2a `least(...)` formula — never extended) |
| `declined` / `expired` / everything else | `coord_state = 'open'`; no `click_proposals` row (old rows stay readable in `event_proposals` until the Phase 7 / Step 3 drop) |

**Per-phase rollback (binding, applies to 2.1–2.6):** every phase's migration ships a paired **down-migration** in the same diff — a phase is not reviewable without its rollback. Phase 1 additionally documents the point of no return: the old tables (`user_clicks`, `event_proposals`) are **NOT dropped here** — the drop is deferred to Step 3 teardown, so Phases 1–6 stay reversible. The app dual-reads nothing: cutover is atomic per phase, and the rename ships with every updated call-site in the same deploy.

**Phase 1 acceptance line (add to the diff review):** *RLS contract re-verified per `21` §3/§6.1 post-rename (receiver can never read pending rows; edge-fn-only writes)* — and `click_proposals` mirrors that contract per `21` §B2a.

### 2.2 — Safety (LAUNCH-BLOCKING — do first after schema)
- Block tears down the mutual: clicks→`invalidated`, mutual→`expired`, pending suggestion cancelled (`21` §6.5). **Highest priority** — a blocked person can currently still confirm/propose.
- Re-check block/mute in `confirmProposal` / `proposeAlternative` / RSVP-reminder cron.
- Notify the still-going partner on RSVP cancel; reconcile the now-stale confirmed proposal (triage C5 — anchor is `21` §B5.6, launch-blocking: same-transaction teardown to `coord_state='open'` unless another shared confirmed event re-points it, markers torn down for both, the survivor's ONE locked-string notification, priority re-suggest. QA v8 §19 "Safety teardown & re-checks" → the partner-RSVP-cancel line).
- **`confirmed_together` fires on independent booking (triage C10 — the win condition must never silently fail).** The "you're both going" transition + congrats fire on ANY booking-confirm where an active mutual's other side is also a confirmed attendee of that event — not only the proposal-accept path (`21` §B5.3: "This fires however they both got there"). Fix site: add the §B5.3 detection to `checkout.session.completed` AND the free-event reserve fn. Pairs with the C5 cancel-notify task above — same lifecycle, opposite direction. QA v8 §19 "Invalidation & lifecycle" → "`confirmed_together` fires on independent booking (§B5.3)".

### 2.3 — Capacity
- Event-suggestion guard `available >= platform_settings.suggestion_capacity_floor` (default 3; structural min 2 — a mutual is a two-person plan; `09` §6 Step 1 owns the predicate, raised 2→3 for sell-out buffer 2026-06-26).
- Confirm capacity reads `event_capacity_v` (sums `ticket_count`). Guest +1s are seats counted at **booking** (`19` §0/§2) — never a `count(*)` of bookings or named claims. The audit's "capacity ignores guest +1s" = code reading the wrong source.

### 2.4 — Timers
- Discovery expiry `created_at + 7d`; post-event expiry `event_end + 48h`; post-event prompt `event_end + 2h` (09:00 deferral). Collapse the overlapping post-event windows into the single gate.

### 2.5 — New surfaces
- **Coordination modal system - the drawer + one-time reveal (`UIUX/COORDINATION_MODAL_SYSTEM.md` v1; effectively launch-blocking - the audit found the live modals invisible, which makes the core mechanic unusable).** The whole sequence (reveal → suggest → waiting → both-going + recovery/terminal moments) is ONE progressing modal/drawer over the current page, never routed pages; the drawer is a pure projection of `coord_state` (`21` §B2). Base state fully visible - no opacity-gated entrance animations that restart on re-render; motion mount-once, reduced-motion respected. `reveal_seen` persisted per user+mutual so the reveal fires exactly once and every re-entry (bell / dashboard / Your clicks) lands on the current step. Acceptance = that doc's §10 12-point checklist (incl. the re-render torture test and the banned-string grep) + the matching QA §19 lines.
- Decline-proposal (`21` §B4) — first-class state, not blocking-as-exit.
- Report/block inside the mutual + proposal flow (currently profile-only).
- **Already-booked side never sees a live RSVP button (triage C11).** On the proposal/RSVP card, when the viewer already holds a confirmed booking (`needed=0` their side), the action renders **"I'm in"** — never a live "Save my spot"/"RSVP" button, never a pair-computed "RSVP NEEDED" badge; the status line is partner-focused (`21` §B4.1 step 7). Tapping must never fire a second booking attempt. QA v8 §19 "Invalidation & lifecycle" → "Already-booked side shows 'I'm in', not a live RSVP (§B4.1)".
- **No stuck "WRAPPED" terminal — four-exits invariant (triage C12).** A cancelled/filled agreed event is a failed *attempt*, never a terminal: route the mutual back to `coord_state='open'` (re-suggest) or `'dormant'` (4h revival), and let the EXISTING 7-day silence clock clear a dead-quiet pair → `released` (`21` §B0 spine / §B2 invariant 2 — the only exits from `active` are the canonical four / §B6). Do NOT "fix" by adding a delete button (that legitimises a fifth state). QA v8 §19 → "Dead event after agreement is NOT a terminal (§B0/§B6/§B7)".

### 2.6 — UIUX / copy + language application (low risk; last before teardown)

This step has **two jobs with different sources of truth** — do not conflate them.

**Job A — reconcile-to-spec (named pages that already have a canonical, language-compliant copy spec).**
For these, the task is *make the live page render the canonical copy verbatim* — NOT a language sweep, NOT a rewrite. The spec is already correct; the live page is what's stale. Reconcile each live page to its spec, string for string:
- Live consumer **`/how-it-works`** → `UIUX/click_how_it_works_web_v1.md`.
- Live merchant **`/for-merchants/how-it-works`** → `UIUX/click_how_it_works_merchant_v1.md`.
- Live **`/` (root landing)** → `UIUX/click_landing_page_prelaunch_v1.md` (pre-launch) or `UIUX/click_landing_page_golive_v1.md` (go-live) — use whichever matches the current launch phase; ask Doan which is live if unclear.
- Live **`/for-merchants`** → `UIUX/click_landing_page_merchant_v1.md`.
- In-product mechanic surfaces (onboarding, discovery "Click with" card, context-only event page, post-event prompt, Who-was-there, mutual notification, see-you-there, visibility toggle, FAQ) → `UIUX/click_mechanic_explainer_copy.md` (the §5 locked strings in `CLICK_LANGUAGE.md` are binding and must appear verbatim — never improvise placeholder copy; placeholders ship).
- Where a live string diverges from its spec, change the live string to the spec. Where the spec is silent on a string that exists live, treat it under Job B (sweep).

**Job B — language sweep (every other user-facing string with no copy spec: toasts, errors, empty states, settings labels, email templates, button labels).**
Audit against `UIUX/CLICK_LANGUAGE.md` and split every finding into two tiers:
- **Mechanical (apply directly):** banned `match`/`matches`/`isMatch` tokens & `match_*` analytics names; `click on`→`click with` grammar; literal-UI `click`→`tap`/`select`; capital-C `Click` misused for the mechanic (lowercase) or lowercase `click` misused for the platform (capital); `connect`/`connection` used for the mechanic → `click`; the dead analytics names. These are unambiguous — fix them, show Doan the diff per the per-task rule.
- **Judgment (flag, do NOT auto-apply):** desire-not-deficit framing (`CLICK_LANGUAGE.md` §6.1); opportunity-not-loss lifecycle copy (§5a — "expire", "winding down", "missed your chance", "last chance"); intent-neutrality / never romantic-default (§6.3); the brand verb earning its place vs. forced "click" decoration (§4); any "just" before an intent label (§6.6). These are brand-voice calls Cindy owns. For each, write `file:line · current string · which rule · proposed rewrite` to **`TECH/implementation/LANGUAGE_REVIEW_FOR_CINDY.md`** and leave the live string untouched. An agent rewriting voice unsupervised produces technically-compliant copy that sounds wrong — so it gets surfaced, never silently changed.

**Output of this step:** (1) reconcile-to-spec diffs (Job A) + mechanical-fix diffs (Job B) shown to Doan per-task before applying; (2) `LANGUAGE_REVIEW_FOR_CINDY.md` (Job B judgment tier) for Cindy to approve — those land only after her sign-off, as a follow-up edit, not in this step.

**Adjacent-fix flag (do not silently fold):** if you edit `UIUX/click_landing_page_merchant_v1.md` or `UIUX/click_how_it_works_merchant_v1.md`'s rendered page, those two docs still carry non-canonical hex (`#fdfaf6`/`#b7a8f2`); the live page must use the canonical palette (`UIUX/CLICK_PALETTE.md` — cream `#F9F6F0`, lavender `#C8B8F8`). Apply the canonical hex in the *code*; note it for Doan rather than editing the merchant copy docs' palette line unprompted.

**Other UIUX (unchanged from prior scope):**
- `/people` ranking copy → reflect Matching v2 (not "shared interest tags").
- Honour `notify.mutualClick`, or document that the mutual email always sends.
- The `CLICK_LANGUAGE.md` audit checklist (§7, twelve checks) is the acceptance gate for this step: a page/surface passes when all twelve are clean (mechanical) or logged for Cindy (judgment).

---

## STEP 3 — Teardown (final commit)
Remove the migration scaffolding so it stops claiming a migration that's done: the "⚠️ ACTIVE MIGRATION" block in `CLAUDE.md` (fold any still-relevant rules into permanent sections) and the migration-pointer line in `README.md`. This is also where the old tables (`user_clicks`, `event_proposals`) are finally dropped — the point of no return deferred from Phase 1 (Step 2.1 rollback rule). Commit: `Remove click-migration scaffolding — code now on two-process model (21 vCURRENT — read the line-1 header)`.

---

## POST-AUDIT ADDENDUM (2026-07-05) - read after the phases

The spec corpus had a **full audit + fix pass on 2026-07-05** (changelog v31-v69): sensitivity-leak closes, serving-layer retirement, language sweeps, tunable registrations, and five product decisions landed in one day. The version manifest at the top of this file is the tell - if you read any spec before that date, **re-read it at its current line-1 revision before building against it**; the section you remember may have moved or been superseded.

**Phase-task deltas (fold into the phases above):**
- **Phase 1 (Step 2.1) also seeds `platform_settings` with the decided defaults** (owners per `00_MASTER_INDEX.md` Conflicts rows): `discovery_click_cap` = **21 per rolling 7 days** · `suggestion_capacity_floor` = **3** · `suggestion_leadtime_floor_h` = **48** · `discovery_pool_size` = **3** · `fomo_min_cohort` = **3**. All tunable, none hardcoded at call-sites.

### Beyond the click mechanic - spec changes needing code work

These are NOT part of the 7-phase migration. Work them as **separate tasks AFTER Phase 2**, same one-task-per-branch discipline, same prompt pattern (name the task + spec section, show the diff, apply on confirmation, test against QA, stop). **Order guidance: money-path + safety items first, matching/quiz after.**

| Task | Spec anchor | One-line acceptance |
|---|---|---|
| Refund-pipeline ordering + fee absorption | `05_BOOKING_LIFECYCLE.md` §3.4 (v7) | Refunds execute in the §3.4 pipeline order with the specced fee-absorption rules at each tier boundary |
| Publication gate widened | `02_MERCHANT_JOURNEY.md` v5 §2/§6 | Gate covers price edits (free→paid) + material-edit re-review + capacity-floor guard triggers, at UI AND edge-fn level |
| Add-seats = supplemental Checkout session | `19_GUEST_RSVP.md` §4.4 (v3) + `05` §3.2a | Adding seats runs a supplemental Checkout session at the booking's locked `unit_price_cents` and increments `ticket_count` on completion |
| Waitlist offer-accept capacity math + promote-on-pending-expiry | `05_BOOKING_LIFECYCLE.md` §4.4/§3.3 | Offer accept re-checks `event_capacity_v`; an expiring `pending_bookings` row promotes the next waitlist offer |
| Romantic-signal reciprocity gating | `10_ROMANTIC_INTENT_AND_DATING_MODE.md` v10 §4 | Every romantic-specific/singles signal renders ONLY for `romantic_visible = true` viewers |
| Quiz life-tag changes + FOMO-only display class | `08_LIFE_TAGS.md` (v7, 2026-07-05 taxonomy revision) | Quiz captures the five kept life tags; FOMO-only class enforced (aggregate FOMO yes; profile / `get_shared_life_tags` / People-Card never) |
| Serving-layer consolidation | `04_MATCHING_ALGORITHM_V2.md` v12 §5.3 | `user_click_scores` + `user_event_scores` are the ONLY serving tables; `match_candidates_*` MVs are never built |
| `checked_in`/`checked_in_at` columns | `05_BOOKING_LIFECYCLE.md` §2.2 | Both columns exist on `bookings` AND `guest_spots`; no `attended` column anywhere |
| Report categories + SLA | `03_ADMIN_JOURNEY.md` §5 (v3) | Report reasons match the §5 category list; SLA clocks recorded and reportable |
| Analytics per-surface expiry sweep + referral-abuse rail | `22_ANALYTICS.md` §2.4/§5.5 (v7) | Cosmetic per-surface expiry sweep exists (never load-bearing); referral-abuse rail events fire |
| Post-event prompt cron window fix | `06_RETENTION_AND_ENGAGEMENT.md` §2.1 | Prompt cron fires at `event_end + 2h` with the 09:00-local deferral (aligns with the Phase 4 timer work - do not implement twice) |
| Service-area/timezone parameterisation - no hardcoded city/AEST in product surfaces or schedules | `02` §6 / `06_RETENTION` §4.2 / `22` §3.1 (`platform_settings.service_area` + `service_area_tz` keys, registered in `00`; QA §14.6) | Changing the two settings re-homes every location-locked surface (merchant gate + copy, digest send hour, analytics refresh/buckets, {area} strings); distance filter renders radii only, never area names |

---

## Constraints (apply throughout)

**Dead — replace, never extend:** `user_clicks` → `clicks`; `event_proposals` → `click_proposals`; `post_event_clicks` (dead); `detect_mutual_click` trigger (dead).

**Resolved decisions — implement as stated:** discovery expiry 7d · post-event window 48h · post-event prompt +2h (09:00 deferral) · single `clicks` table · guest +1 = seat in `ticket_count` at booking, read `event_capacity_v`.

**Do NOT build (correct-by-spec; building these moves away from canon):**
- ❌ withdraw-click — clicks are create-only + read-time expiry by design; the real gap is *proposal*-decline (do build that).
- ❌ correctness expiry cron — read-time filtering (`expires_at > now()`) is the chosen mechanism; current read-time-only is correct.

**One test you must WRITE (not just read):** the reciprocity transaction (`21` §4) — a real Postgres concurrency test: two users clicking each other simultaneously produce exactly ONE mutual, no deadlock surfacing as a 500 (a 500 is an anonymity leak — an error distinguishes a state the four-outcome contract requires indistinguishable).

**Engineering bar (from `CLAUDE.md`):** every change handles race conditions, failure modes, edge cases — not the happy path. Name structural problems plainly with file refs. Specs win where they speak; where silent, ask Doan.

**Regression sims (live in `SIM/`, repo root):** `SIM/match_sim.py` + `SIM/test_match.py` (run `python3 test_match.py` from `SIM/`) validate matching rule logic; `SIM/click_sim.py` + `SIM/click_sim_adversarial.py` / `click_sim_dedup.py` / `click_sim_expiry_volume.py` audit the click state machine, races/probing, dedup/re-click, and expiry/volume at SPEC level. None of them tests real Postgres concurrency — the §4 concurrency test above is still mandatory. Keep them green. *(The stale duplicate `TECH/implementation/match_sim.py` was deleted 2026-07-05 — byte-identical to the `SIM/` copy, which is the only one.)*
