# CODE_AUDIT.md — Click code→spec migration audit (Step 1)

**Date:** 2026-06-25
**Author:** Claude Code (read-only audit; no code changed)
**Canonical location:** `TECH/implementation/CODE_AUDIT.md` in the `cndykm/click-tech` spec repo. This copy lives in the app repo at `context/CODE_AUDIT.md` (mirrors `context/CLICK_MECHANIC_AUDIT.md`), because the app code (`doanthan/click`) and the specs (`cndykm/click-tech`) are two separate repos.
**Method:** Per `START_HERE.md` Step 1. 8 read-only slice auditors (schema, safety, lifecycle, timers, capacity, matching, UIUX, language) re-read the **actual repo** against the specs, every finding then adversarially re-verified by an independent agent against the cited code + spec lines. 61 findings, 62 agents.
**Specs pinned:** `21_CLICK_MECHANIC.md` v9 · `09` v11 · `13` v7 · `04` v7 · `04_ENGAGEMENT_WEIGHTING_DELTA` v2 · `05_BOOKING_LIFECYCLE` v2 · `19_GUEST_RSVP` v1 · `QA_FEATURE_CHECKLIST` v5 · `CLICK_LANGUAGE` v4. (`VERSION_CHANGELOG` is at v24, newer than START_HERE's "v22" reference — not stale.)
**Source discipline:** Per START_HERE, the triage map's and prior audit's "code does X" columns were copied from an earlier un-reverified read. Every claim below was independently re-read against real line numbers; where this re-read **corrects** the triage/prior-audit, it is flagged.

---

## 0. Bottom line

The application code is **entirely on the old pre-June-2026 model** — confirmed at line numbers, not assumed. The two-process click rewrite (`21` v9) is not started: clicks live in `user_clicks` (one undifferentiated row per pair), proposals in `event_proposals`, and `mutual_clicks` is a 5-column stub with no lifecycle. On top of the rename/reshape work, there are **5 launch-blocking safety defects** that are bugs under *any* model.

**Severity rollup (post-verification):**

| Severity | Count | Examples |
|---|---|---|
| 🔴 Launch-blocking | 5 | block doesn't tear down a mutual; confirm/propose don't re-check block; no ban teardown; no independent age gate |
| 🟠 High | 17 | schema spine (table/enum/index/trigger); RSVP-cancel strands partner; no decline path; full/waitlist events suggested; capacity guard `>=1` not `>=2`; matching engine gaps |
| 🟡 Medium | 9 | enum missing `invalidated`; prompt fires +12h not +2h; window soup; capacity omits guest +1s; `event_capacity_v` missing |
| 🟢 Low | 17 | UIUX/copy + language sweep hits |
| ✅ MATCH (do-not-fix) | 9 | read-time-only expiry, no click-withdraw, `post_event_clicks` correctly absent, booking path counts guests correctly, `/test-click` faithful clone |

**Three findings that correct the migration brief itself** — read these before Step 2:
1. **A live mutual-detection trigger exists** (`create_mutual_click_after_click`, 001_schema.sql:379–381). START_HERE says "the `detect_mutual_click` trigger must not exist" implying it's already gone — it is **not gone**; it's present under a different name *and* the app code (`createUserClickForSession`) **also** detects mutuals in-transaction, so detection runs twice. Step 2.1 must drop the trigger + `create_mutual_click()` function.
2. **`event_capacity_v` does not exist.** Triage D4 says "read `event_capacity_v`; the view already nets guests; code just reads the wrong source." Reality: there is **no view at all**; capacity is computed inline at 6+ sites with *two* divergent formulas (booking paths net guest +1s correctly; suggestion/proposal paths don't). Step 2.3 must **create** the view, then repoint the click sites at it.
3. **The matching engine is the cohort model (`04` v2), not the intent-mode model (`13` §5).** The audit's "does the `locals` row sum to 1.0?" question is N/A — there are no intent-mode weight rows. See §6; these are matching-engine concerns (owned by `09`/`13`/`04`), and START_HERE's Step-2 table has **no matching-migration step**, so they likely sit outside the immediate mechanic migration — flagging for Doan to scope.

---

## 1. Step 2.1 — Schema spine (the migration foundation)

| # | Finding | Location | Sev | Verdict |
|---|---|---|---|---|
| SPINE-01 | Click table is `user_clicks`, not `clicks`; columns are `clicker_profile_id`/`clicked_profile_id`/`source_event_id`, `expires_at default now()+30d`; no `sender/receiver`, no `surface`, no `intent_mode` | 001_schema.sql:158–168 | 🟠 | CODE→SPEC |
| SPINE-02 | No `surface` enum and no nullable-`event_id` two-process split. Discovery vs post-event is decided only by whether `sourceEventId` is passed at call time; both collapse onto the **same row** via `unique(clicker,clicked)` + `on conflict do update`, so the two processes cross-contaminate | 001:158–168; event-repository.ts:7050–7088 | 🟠 | CODE→SPEC |
| SPINE-03 | No `click_surface_event_consistency` CHECK; a single unconditional `unique(clicker,clicked)` instead of the two partial unique indexes `uq_click_discovery` / `uq_click_post_event`. A pair can hold at most one click row total | 001:166–167 | 🟠 | CODE→SPEC |
| SPINE-04 | `click_status` enum is `('pending','mutual','expired')` — missing `'invalidated'`, so block/cancel/event-cancel/ban have no terminal state to write (the only teardown is a hard `DELETE`) | 001_schema.sql:11 | 🟡 | CODE→SPEC |
| SPINE-05 | Proposal table is `event_proposals` (status enum only `pending/confirmed/expired`), not `click_proposals`; no `coord_state` machine on `mutual_clicks`. `09`:716–719 explicitly tombstones `event_proposals` | 019_proposals.sql:13–34 | 🟠 | CODE→SPEC |
| SPINE-06 | `mutual_clicks` exists (separate table is spec-OK) but is a stub: no `status`, `coord_state`, `intent_a/intent_b`, `connected_reason`, `connected_event_id`, `ended_at`, or `expires_at`. The spec's 7-day *mutual* clock has nowhere to live (the only 7-day clock is on the proposal row) | 001:170–178 | 🟠 | CODE→SPEC |
| SPINE-08 | **Live mutual-detection trigger present** — `create_mutual_click()` + `create_mutual_click_after_click AFTER INSERT ON user_clicks`. This is the exact dead pattern `21` §4 retires, under a different name, and it double-fires with app-code detection | 001_schema.sql:329–381; comment 437 | 🟠 | CODE→SPEC |
| SPINE-09 | App-code mutual detection uses naive check-then-insert with **no `FOR UPDATE`** on the reciprocal row (plain SELECT at 7090–7100; insert `on conflict do update` re-arms). `21` §4 requires the single-transaction `FOR UPDATE` lock-ordering pattern, or concurrent reciprocal clicks produce two pending rows / double notifications | event-repository.ts:7076–7100, 7201–7245 | 🟡 | CODE→SPEC |

**The §4 concurrency test (START_HERE mandates writing this):** a real Postgres test where two users click each other simultaneously must produce exactly **one** mutual, no deadlock surfacing as a 500 (a 500 is an anonymity leak). Currently neither the trigger nor the app path is `FOR UPDATE`-locked, so this test would fail today.

---

## 2. Step 2.2 — Safety (LAUNCH-BLOCKING — do first after schema)

| # | Finding | Location | Sev | Verdict |
|---|---|---|---|---|
| SAFE-01 | **Block does not tear down an existing mutual or pending proposal/suggestion** — `blockUser` inserts `user_blocks` then only `DELETE`s pending `user_clicks` both ways. `mutual_clicks`/`event_proposals` are never touched, so the non-blocked party can still confirm/propose and stay "both going." | event-repository.ts:10874–10900 | 🔴 | CODE→SPEC |
| SAFE-02 | **`confirmProposal` never re-checks block (or mute).** Only membership + status/expiry are checked; the sole mute reference gates the *outbound notification*, not the state mutation. A blocked party can still confirm the plan. | 11506–11557 | 🔴 | CODE→SPEC |
| SAFE-03 | **`proposeAlternativeForProposal` never re-checks block/mute** before mutating the shared proposal. A blocked party can keep re-proposing. | 11559–11632 | 🔴 | CODE→SPEC |
| SAFE-06 | **No ban feature exists at all** (only `suspended_at`). `21` §6.7a requires ban → invalidate all pending clicks + expire all active mutuals (permanent). `suspendMemberAsAdmin` sets `suspended_at` but does **not** freeze/teardown clicks or mutuals, so a suspended/auto-suspended user keeps coordinating. | 12496–12521 | 🔴 | CODE→SPEC |
| SAFE-07 | **No independent age gate (≥18) in the click layer.** `createUserClickForSession` checks self-click + block but never asserts sender/receiver age; `getSuggestedPeople` has no `age>=18` filter. `21` §6.7b makes this non-negotiable defence-in-depth on the highest-risk surface. | 6979–7088; 10604–10672 | 🔴 | CODE→SPEC |
| SAFE-04 | RSVP-reminder cron `remindProposalRsvps` re-checks neither block nor mute, and filters on `status='pending'` but **not** `expires_at > now()`, so a lapsed-but-pending proposal can fire a stray reminder. | 3169–3218 | 🟠 | CODE→SPEC |
| SAFE-05 | Mutual-list and proposal-list **read** queries carry no block anti-join — a blocked pair keeps seeing each other's live cards even before the §6.5 teardown is built. | 10815; 11446 | 🟠 | CODE→SPEC |
| SAFE-08 | **No report/block/mute (or decline) affordance from inside a mutual/proposal** — safety controls are wired only on `/profile/[userId]`; `proposal-card.tsx` and the proposals page expose no profile link or safety path. | proposal-card.tsx; proposals/page.tsx | 🟠 | CODE→SPEC |
| SAFE-09 | Muted users are not hidden from discovery (only blocks are anti-joined). **Verifier reclassified this MATCH/do-not-fix:** mute's spec semantics are in-app-ping suppression, not a discovery exclusion (only *block* removes from surfaces). Recorded so it isn't "fixed" by mistake. | 10604–10672 | ✅ | MATCH (was CODE→SPEC) |

> The four enforcement points the spec assumes (block-teardown + re-checks at confirm / propose / RSVP-cron) all read together as one Step-2.2 unit: **a blocked person can currently confirm a plan, propose alternatives, and be reminded to RSVP.** This is the highest-priority work.

---

## 3. Step 2.3 — Capacity & guest +1s

| # | Finding | Location | Sev | Verdict |
|---|---|---|---|---|
| CAP-1 | Suggestion generator guards `available >= 1` (`count(*) < event.capacity`), **not** the required two-person `available >= 2`. A single-free-seat event is suggested to a pair → one gets in, the other is stranded → "both going" dead-ends. | event-repository.ts:7133–7140, 7169–7176 | 🟠 | CODE→SPEC |
| CAP-4 | **Full/waitlisting events are whitelisted into every suggestion/proposal query** — all filters are `status in ('live','featured','waitlist')`. `'waitlist'` means the event is full; `21` §B3.4 requires an absolute full-event exclusion at generation. | 7129, 7165, 10771, 11437, 11592, 11655 | 🟠 | CODE→SPEC |
| CAP-5 | **`proposeAlternativeForProposal` and `confirmProposal` perform no capacity check** at all — a full event can be set as the live proposal via "Suggest alternative", and confirm flips to `confirmed` without re-reading capacity. `21` §B3.4/§B4.1/§B5.1 require propose-time and accept-time re-checks. | 11589–11601; 11506–11557 | 🟠 | CODE→SPEC |
| CAP-2 | The suggestion/proposal `count(*)` omits `guest_spots`, so a guest-+1-full event still looks bookable. The same guest-blind count is copied into 5 sites (generator, proposal-attach, catalogue, both-going re-surface). | 7134–7140, 7170–7176, 11439–11445, 11660–11666, 10775–10781 | 🟡 | CODE→SPEC |
| CAP-3 | **`event_capacity_v` does not exist.** Capacity is computed inline with two divergent formulas — booking/headcount paths net guests; click suggestion/proposal paths don't. The migration must **create** the view (`05` §2.5), then repoint all sites. | database/* (no view); event-repository.ts (6+ sites) | 🟡 | CODE→SPEC |
| CAP-6 | ✅ **Do-not-regress reference:** the booking/headcount paths already net guest +1 seats correctly (`event_attendees` confirmed/held + non-cancelled `guest_spots`). These are the template the suggestion sites should reuse — **do not touch them.** | 2304–2321, 2722–2733, 5774–5784, 8829–8844 | ✅ | MATCH |

---

## 4. Step 2.4 — Timers / windows

| # | Finding | Location | Sev | Verdict |
|---|---|---|---|---|
| TW-1 | Discovery click expiry is `now()+30 days`, **re-armed on every re-click** (revives an already-expired click, no cooldown). Spec: `created_at + 7 days`. | event-repository.ts:7076–7088; 001:165 | 🟠 | CODE→SPEC |
| TW-2 | **No event-anchored post-event expiry exists.** Discovery and post-event clicks share the one `expires_at` column at `now()+30d`; the spec's `event_end + 48h` window is simply not implemented (no `48`-hour interval anywhere in the click path). | 7076–7088; 001:165 | 🟠 | CODE→SPEC |
| TW-3 | Post-event **prompt** fires at `event_end + 12h` with **no 09:00-local deferral**. Spec `21` §6.8: `event_end + 2h`, deferred to 09:00 if it lands 22:00–09:00 — and §6.8 says 2h explicitly **supersedes** the old 12h. | 7058, 11198, 11329 | 🟡 | CODE→SPEC |
| TW-4 | **Four overlapping post-event windows disagree:** action gate `+12h`; dashboard rail `+12h..−14d`; event-page prompt `ends..−30d` (**no 12h gate**); push cron `+12h..−7d`. So the event-page button shows before the action gate opens and submit is rejected. Collapse to one gate. | 7058, 11198, 11277, 11329 | 🟡 | CODE→SPEC |
| RSVP-05 | `expireWaitlistOffers` re-offers freed seats but is coordination-blind — never reconciles a paired plan's proposal/mutual state when a waitlist offer lapses. (Low until waitlist-together exists.) | 8093–8218 | 🟢 | CODE→SPEC |
| TW-5 | ✅ **Do-not-fix:** expiry is read-time-only with **no** status-reconciling cron — this **matches** `21` §5 intent ("never make the cron load-bearing for correctness"). Do **not** add a correctness cron; an optional cosmetic hygiene sweep is allowed but not required. | 7096; 10894; vercel.json | ✅ | MATCH |

---

## 5. Step 2.5 — New surfaces / lifecycle

| # | Finding | Location | Sev | Verdict |
|---|---|---|---|---|
| RSVP-01 | **RSVP-cancel of a confirmed plan strands the partner.** `cancelRegistration` touches zero click/proposal/mutual state — the "both going 🎉" silently vanishes (it's a pure read-time JOIN) and a tapped-Confirm proposal stays `confirmed` forever (stale "RSVP needed" card). The still-going partner is never told. | event-repository.ts:7491–7750 | 🟠 | CODE→SPEC |
| RSVP-02 | `confirmed_together`/"both going" is **read-time-derived only** (no persisted `coord_state`), computed as the soonest shared future event — so it celebrates *any* shared booking (not just the proposed plan) and keeps a lapsed mutual alive, and cancel can fire no "plan broke" logic. | 10788–10827; dashboard/page.tsx:330–340 | 🟠 | CODE→SPEC |
| RSVP-03 | **No decline-proposal path.** Enum is `pending/confirmed/expired`; the card has only "Confirm" + "Suggest alternative". Blocking is the only hard exit. Spec `21` §B4.2 wants first-class **decline** ("Not this one" → `coord_state` open, mutual untouched) + **counter**. | proposal-card.tsx:154–175; 019:13 | 🟠 | CODE→SPEC |
| RSVP-04 | Full/waitlist events auto-suggested → both RSVP → both waitlisted → silent dead-end (capacity arm of CAP-1/CAP-4; both-going counts only `confirmed`). | 7134–7177; 3013–3024; 10794 | 🟠 | CODE→SPEC |
| RSVP-06 | ✅ **Do-not-fix:** there is no click-withdraw, and per `21` §9/§2 there must not be one (clicks are create-only + read-time expiry). The genuine adjacent gap is *proposal*-decline (RSVP-03) — do not conflate. | 7078–7100; 10894 | ✅ | MATCH |

---

## 6. Matching / scoring (owned by `09`/`13`/`04` — likely out of the mechanic-migration scope)

START_HERE lists matching as a Step-1 *audit* dimension but its Step-2 table has **no matching-migration step**, and `CLAUDE.md` notes the v2 ML-fitting job is an external worker. The shipped engine (`src/lib/matching/*`) is the `04` v2 **cohort** model, not the `13` §5 **intent-mode** model — so several audit questions are N/A-by-design. Flagging for Doan to scope; **do not fold into the mechanic branches.**

| # | Finding | Location | Sev | Verdict |
|---|---|---|---|---|
| MS-1 | No intent-mode weight rows exist; the engine uses 6 **cohort** logit vectors (`new_local`, `new_to_sydney`, …). There is no `locals` row, so "does it sum to 1.0?" is N/A — cohort logits aren't normalised by design. The `13` §5 intent-mode formula is not built. | weights.ts:28–127; types.ts:9–18 | 🟠 | CODE→SPEC |
| MS-3 | `engagement_weight` is **entirely absent** — no column in `user_features`, no nightly compute, no `×weight` multiplier, no 0.700 floor. (So the rsvp_count-vs-attendance_count keying question is moot: neither exists.) | 041:35–63; feature-store.ts:224–254; score.ts:146–165 | 🟠 | CODE→SPEC |
| MS-5 | The `relationship_friends`↔romantic hard exclusion (`13` §6) is structurally impossible — **neither intent value exists** in the `connection_intent` enum (it has 8 other values; no `romantic`, no `relationship_friends`). | event-repository.ts:6270–6280; candidates.ts:118–139 | 🟠 | CODE→SPEC |
| MS-2 | The `13` §5 age-band rule (±15y no-penalty, decay to 0.40 floor, ≥1.4-overlap rescue to 0.85, romantic-exempt) is not implemented; only a raw linear `ageCloseness` feature exists. | score.ts:76–80, 102 | 🟡 | CODE→SPEC |
| MS-4 | ✅ **Do-not-fix / don't conflate with MS-3:** cohort *assignment* correctly keys on `attendanceCount` per `04` §2; only the *engagement_weight* feature must key on `rsvp_count`. | cohorts.ts:29–30; feature-store.ts:97–104 | ✅ | MATCH |

---

## 7. Step 2.6 — UIUX / copy + language (detection only; nothing changed)

### Job A — reconcile-to-spec (named pages with canonical copy)

| # | Finding | Location | Sev |
|---|---|---|---|
| UIUX-1 | `/people` lede still says "Ranked by shared interest tags" — should reflect Matching v2 ("how well you match"). | people/page.tsx:46–49 | 🟢 |
| UIUX-4 | `/how-it-works` step 04 promises person-clicking **"during"** the event — forbidden by `21` §7A (event page is context-only; clicking is discovery + post-event only). | how-it-works/page.tsx:34 | 🟡 |
| UIUX-5 | Mutual headline is **"You both tapped."** everywhere — not the §5 locked **"You two clicked."** Push title is "Mutual Click found" not the locked "It's mutual — you two clicked. ✨". | dashboard/page.tsx:300–322; people/page.tsx:58–60; click-walkthrough.tsx:142–146 | 🟡 |
| UIUX-6 | No §5 **intent line** under any mutual headline (non-optional). Depends on the schema migration (the old `mutual_clicks` has no `intent_a/b`). | dashboard/page.tsx:293–373; people/page.tsx:51–100 | 🟢 |
| UIUX-7 | Post-event headings/push miss the §5 locked strings ("Who did you click with?" vs locked "Who'd you click with?"; push is a full rewrite away from "Good night at [Event]? Anyone you clicked with?"). | dashboard/page.tsx:381; post-event-click-card.tsx:16–26; event-repository.ts:11324–11325 | 🟢 |
| UIUX-8 | Discovery/post-event button strings don't use §4/§5 ("Click privately" / bare "Click" → "Click with"; pending state → locked "Clicked — we'll let you know if it's mutual ✨"). | click-with-someone-user-card.tsx:79–83; post-event-click-card.tsx | 🟢 |
| UIUX-11 | `/for-merchants` and `/for-merchants/how-it-works` (Job-A canonical targets) **don't exist** — only `/how-it-works` + `/merchant`. Whether they're required new pages or renamed refs is a product/IA call (DECIDE). | src/app (dir) | 🟢 |
| UIUX-12 | ✅ **Do-not-fix the mechanism:** `/test-click` is a deliberately code-faithful explainer (per `CLAUDE.md` it mirrors `event-repository.ts`, not the spec). It correctly tracks the *current* old model; its copy/timers update **after** Steps 2.1–2.5 land. | click-walkthrough.tsx | ✅ MATCH |

### Job B — language sweep (mechanical tier — apply with per-task diff; judgment tier → Cindy)

| # | Finding | Location | Tier | Sev |
|---|---|---|---|---|
| L1 / UIUX-2 | **Directional "Click on [person]" / "Click someone"** — the one binding §2 break, in live surfaces: `/how-it-works` (:8, :34), `/people` (:47), `/profile/[userId]` (:88), user-signup email (:46, :73), plus `click-data.ts`/comments. | multiple | Mechanical | 🟡 |
| L4 / UIUX-3 | **"match/matched" for the click connection** (banned §3): `/people` "Matched {date}" (:83), `click-data.ts` ("Two private clicks match"), `privacy` ("mutual matches"), `proposals` meta ("people you've matched with"), `/test-click`. Plus missed `dashboard/page.tsx:163` ("…people matches"). | multiple | Mechanical | 🟡 |
| L3 | Capital-C **"Click"** used as the lowercase mechanic verb ("they Click you back", "Click again at a future event"). §1 capitalisation split. (Platform-name capital-C uses are correctly whitelisted.) | multiple | Mechanical | 🟢 |
| L6 | Literal-UI **"click"** for the interaction ("click to upload", "click any row", "Click any chip") — §3 use tap/select. (DOM `onClick` props whitelisted.) | event-create-wizard.tsx; merchant-*-tab.tsx | Mechanical | 🟢 |
| L2 | Discovery button "Click privately" → §4 "Click with"; pending state → §5 locked string. | click-with-someone-user-card.tsx | Mechanical | 🟢 |
| L7 | **"connect/connection"** for the mechanic in terms/safety/privacy prose. Some are arguable product-category positioning → **judgment tier, flag for Cindy**, don't auto-apply. | terms/safety/privacy pages | Judgment | 🟢 |
| L5 | ✅ **Do-not-fix:** the Matching-v2 engine's `match_impressions`/`energy_match`/`scorePair` are the **scoring algorithm** (a different concern owned by `09`/`13`/`04`), not the click connection. Renaming is an engine-scope call, not a language fix. | src/lib/matching/** | ✅ MATCH |
| L8 | ✅ **Do-not-fix:** there's no analytics layer in the app — `click_sent`/`match_*` strings exist only as spec quotes in `coverage-data.ts`. When analytics is wired, use the correct `click_*` names. | coverage-data.ts | ✅ MATCH |

### Notify-preference (DECIDE)

| # | Finding | Location | Verdict |
|---|---|---|---|
| UIUX-9 | The account-settings "Mutual Click alerts" toggle is **never read** — the in-app mutual ping is mute-gated only, `notification_prefs.mutualClick` has zero effect. | event-repository.ts:7249–7284; account-settings/page.tsx:151 | DECIDE |
| UIUX-10 | The mutual **email** isn't even mute-gated — it always sends if an email exists. | event-repository.ts:7294–7332 | DECIDE |

> Verifier note: both downgraded to DECIDE/low because `21` §6 frames mutual as "the lead reassurance" — whether a mutual ping *should* be suppressible is a real product call. Either honour the pref or document that the mutual notification always sends.

---

## 8. ✅ DO-NOT-FIX register (correct-by-spec — changing these moves *away* from canon)

Pulled together so they aren't "fixed" by reflex (the prior audit lists several as gaps because it compares to the `/test-click` explainer, not the spec):

1. **SPINE-07** — `post_event_clicks` table is correctly **absent**. Do not create it; post-event clicks are `surface='who_was_there'` rows on the unified table.
2. **TW-5** — read-time-only expiry, no correctness cron. **Matches** `21` §5. Don't add a load-bearing cron.
3. **RSVP-06** — no click-withdraw, by design (`21` §9). Build *proposal-decline* (RSVP-03) instead — not click-withdraw.
4. **CAP-6** — booking/headcount paths already net guest +1s correctly. Don't touch; reuse as the template.
5. **MS-4** — cohort assignment correctly keys on `attendanceCount`; don't conflate with the (unbuilt) `engagement_weight`.
6. **SAFE-09** — muted ≠ hidden-from-discovery (mute is ping-suppression; only block removes from surfaces).
7. **UIUX-12** — `/test-click` faithful clone tracks current code, by `CLAUDE.md` design; updates *after* the mechanic migration.
8. **L5 / L8** — matching-engine `match_*` identifiers (algorithm scope) and the analytics-name strings (no live analytics) are not language violations to fix now.

---

## 9. Reconciliation with `context/CLICK_MECHANIC_AUDIT.md` (prior human audit)

The prior audit is **accurate on every launch-blocking item** (block teardown, RSVP-cancel stranding, full-event dead-end, capacity ignoring guests, no decline path). This independent re-read **confirms** it and **extends/corrects** it in five ways:

- **Adds** the live `create_mutual_click_after_click` trigger (prior audit credited detection as "symmetric" and didn't flag the double-fire). — SPINE-08
- **Corrects** triage D4: `event_capacity_v` doesn't exist (prior audit/triage assumed the view existed and only the *source* was wrong). — CAP-3
- **Extends** the capacity gap from the generator alone (prior cited 7133–7176) to the proposal-attach, catalogue, both-going re-surface, and propose-alternative/confirm paths, and names the missing `>=2` two-seat rule. — CAP-1/2/4/5
- **Adds** the matching-engine gaps (intent-mode model, engagement_weight, age-band, missing intent enum values) the prior audit didn't cover. — §6
- **Adds** the full language sweep (directional grammar, "match"/"matched" prose, literal-UI "click", capitalisation) the prior audit didn't run. — §7

The prior audit lists C7 (no withdraw) and the no-cron item as 🔴 gaps; against the **spec** they are correct-by-design (DO-NOT-FIX §8). The prior audit's `/people` copy note (E1) is confirmed and joined by a harder §2 grammar break on the same line.

---

## 10. ⛔ GATE — Step 1 complete; stop for Doan's review

Per START_HERE, no code changes until this audit is reviewed. The recommended Step-2 order (one task per branch, diff approved each):

1. **2.1 Schema spine** — build `clicks` (+ surface enum, nullable `event_id`, CHECK, partial unique indexes, `'invalidated'`), `click_proposals` + `coord_state` on a fleshed-out `mutual_clicks`; **drop the `create_mutual_click` trigger + function**; migrate `user_clicks` rows in (confirm: all → `surface='discovery'`?). Move detection into the send-click transaction with `FOR UPDATE`. **Write the §4 concurrency test.**
2. **2.2 Safety (launch-blocking)** — block-teardown of the mutual + proposal; re-check block/mute in confirm / propose-alternative / RSVP-cron; ban teardown; independent age gate; in-flow report/block.
3. **2.3 Capacity** — create `event_capacity_v`; repoint the 6 click sites at it; enforce `available >= 2`; drop `'waitlist'` from suggestion filters; add propose/accept-time re-checks.
4. **2.4 Timers** — discovery `created_at+7d`; post-event `event_end+48h`; prompt `event_end+2h` (09:00 deferral); collapse the four-window soup.
5. **2.5 New surfaces** — decline-proposal; RSVP-cancel partner-notify + proposal reconciliation; persist `confirmed_together`.
6. **2.6 UIUX/copy + language** — reconcile Job-A pages to spec; apply mechanical language fixes; route judgment-tier copy to `LANGUAGE_REVIEW_FOR_CINDY.md` for Cindy.

**Open question for Doan (scope):** the §6 matching findings (MS-1/2/3/5) have no Step-2 slot in START_HERE and belong to the `09`/`13`/`04` engine. Confirm whether they're in scope for this migration or tracked separately.
