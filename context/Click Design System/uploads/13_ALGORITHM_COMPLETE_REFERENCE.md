<!-- Last updated: 2026-06-24 | Revision: v7 (matching-correctness fixes: §5 locals intent-weight row corrected 0.25→0.10 interest so the row sums to 1.0 (was 1.15 — inflated every locals-intent base score ~15%); §5 suggestion claim restated as the two-person ≥2-free-seats capacity guard (matches 09 §6), "almost-full" retired as display-badge-only. Prior two-process-model content unchanged from v6.) -->
# Click — Complete Algorithm Reference
> **Read this document first.** It is the single source of truth for how all matching, scoring, and feed population works. It replaces the need to cross-reference multiple docs. Where deeper implementation detail is needed, cross-references point to the canonical doc. Nothing in this document contradicts anything elsewhere — it consolidates and sequences it.

---

## 0. How All the Signals Fit Together

Every user interaction on Click produces a signal. Every signal feeds into scores. Every score feeds into feeds. Here is the complete picture before any detail.

```
USER INPUTS                    SILENT SIGNALS               BEHAVIOURAL SIGNALS
─────────────────              ────────────────             ───────────────────
Interest tags (chosen)    →    Life tags (from quiz)   →    Events attended
Music tags (optional)     →    Persona attributes      →    Events saved/clicked
Intent (6 options)        →    Availability flags      →    Mutual clicks formed
Location / postcode            Distance willingness         Post-event feedback
                               Mood tags (30d expiry)       Sub-tags earned
         │                          │                              │
         └──────────────────────────┴──────────────────────────────┘
                                    │
                            USER FEATURE STORE
                            (user_features table)
                            refreshed nightly + on change
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
          USER ↔ EVENT SCORE              USER ↔ USER SCORE
          (Suggested for You,             (Click with Someone,
           Click Radar)                   Mutual click suggestions)
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                              FEEDS & SURFACES
                    ┌───────────────┬───────────────┬────────────┐
                    │               │               │            │
              Suggested       Click Radar    You Might      FOMO cards
              for You                       Click With      on events
```

---

## 1. The 6 Intents — What They Are and What They Do

Set during onboarding. Stored as `profiles.connection_intent` (text array — users can select multiple).

| Slug | UI Label | What it changes |
|---|---|---|
| `romantic` | Looking to Click Romantically | Enables romantic mode; gender/age gates apply; persona weighted highest in scoring |
| `friends` | Looking to Click as Friends | Standard platonic matching; balanced weights |
| `locals` | Connect with locals | Proximity weighted highest; 10km hard gate on candidates |
| `activities` | Try new activities | Interest tags weighted highest; proximity less important; diversity bias in card selection |
| `networking` | Network for work or side projects | Attendance history weighted higher; not expanded by Flexible Discovery |
| `relationship_friends` | I'm in a relationship, just here for friends | **Permanently excluded from all romantic matching** — hard DB gate, no override |

**Multi-select:** A user can hold multiple intents simultaneously. Their `active_intent` (set on the dashboard toggle) determines which scoring weights and candidate pool apply in the current session.

**Flexible Discovery toggle** (`profiles.flexible_discovery = true`): Expands the candidate pool to include users with adjacent platonic intents (`friends`, `locals`, `activities`, `relationship_friends`). Does **not** expand into `romantic` or `networking`. Does **not** override the `relationship_friends` exclusion.

**`active_intent` vs `connection_intent`:**
- `connection_intent` = what the user is interested in (permanent array set at onboarding)
- `active_intent` = which intent lens is active right now (single value, toggled on dashboard)
- A user can only activate an intent they've selected. Switching intent updates scores served from pre-computed tables — no live recalculation.

---

## 2. The 3 Tag Types — What Each Does in Matching

| Tag type | Set by | Visible to user | Weight in scoring | Used for |
|---|---|---|---|---|
| **Interest tags** | User chooses at onboarding/profile | ✅ Yes — shown on profile, editable | Primary signal (25–35% depending on intent) | Event discovery, user↔user matching, FOMO copy, Click Radar |
| **Life tags** | Generated silently from quiz answers | ❌ No — never shown | Secondary signal (20% fixed) | User↔user life-stage compatibility, event targeting, FOMO copy |
| **Music tags** | User selects optionally | ✅ Yes — editable | Soft modifier (+3pts max bonus) | Subtle user↔user affinity signal only |

### 2.1 Interest Tags

16 categories, 223 tags. Stored in `profile_interest_tags(profile_id, tag_id)` for users and `event_interest_tags(event_id, tag_id)` for events.

**How they score:**
```
interest_overlap = Jaccard similarity between user's tags and candidate's tags
                 = |intersection| / |union|
normalized       = (overlap / MAX(user_tag_count, candidate_tag_count)) × 100
```

Sub-tags refine this further (Phase 0+): a user who RSVPs to "Hot Vinyasa" events accumulates `yoga_hot` as a behavioural sub-tag. Two users both tagged `yoga` but one has `yoga_hot: 6` and the other `yoga_yin: 5` score lower on sub-tag overlap than two users who both have `yoga_hot: 4`. Sub-tag overlap runs as an additional dimension on top of parent tag overlap.

**How they drive FOMO:**
```sql
-- Top tags among event attendees (minimum 2 attendees sharing the tag — pilot threshold):
SELECT it.label, COUNT(*) as count
FROM bookings b
JOIN profile_interest_tags pit ON pit.profile_id = b.user_id
JOIN interest_tags it ON it.id = pit.tag_id
WHERE b.event_id = $event_id AND b.status = 'confirmed'
  AND it.is_sensitive = false
GROUP BY it.label HAVING COUNT(*) >= 2
ORDER BY count DESC LIMIT 2;
```
→ Generates copy: "Popular with yoga fans and wine lovers."

### 2.2 Life Tags

37 tags across 5 groups (June 2026 — 6 fragile-state tags removed, §0a). Stored in `profile_life_tags(profile_id, tag_id, source, expires_at)`. Never readable by users via API (RLS blocks all selects except admin).

**Key tags you asked about:**
| Tag | Sensitive | How generated | How it affects matching |
|---|---|---|---|
| `new-parent` | No | Quiz: "I'm a new parent" | Boosts events targeting new parents; life-stage overlap with other new parents |
| `lgbtq-plus` | **Yes** | Quiz: "Do you identify as LGBTQ+?" | Silently boosts LGBTQ+ events; never in FOMO copy |
| `new-to-town` | No | Quiz: "I'm new to Sydney" | High compatibility boost with other new-to-town users; drives New to Sydney events |
| `pet-owner` | No | Quiz: "Do you have a pet?" | Boosts dog-friendly events; FOMO: "Dog owners love this one" |
| `over-50s` | No | Quiz: "I'm over 50 and loving it" | Cohort grouping; FOMO: "Popular with people over 50" |
| `recently-single` | **Yes** | Quiz: "I'm recently single" | Silent matching signal only — never surfaced anywhere (§9 excludes it from all FOMO/UI). The Discovery "Mostly singles" filter is powered by the `romantic_visible` attendee ratio (`12_DISCOVERY_PAGE.md` §4), NOT by this tag. |

**Event-preference tags (temporary, 30-day expiry):** `prefers-small-group`, `needs-structure` — shift event scoring toward small, structured formats. Non-sensitive stated preferences. Never shown in any UI. (June 2026: the fragile-state mood tags — rebuilding-confidence, feeling-isolated, etc. — were removed; `08` §0a. A user's interest tags + these plain preferences cover the same ground without holding sensitive data.)

**How life tags score (user↔user):**
```
life_tag_overlap = Jaccard similarity between both users' life_tags
                 = |intersection| / |union| × 100
Fixed weight: 20% of total user↔user score regardless of intent mode
```

**Sensitive tag rule:** Tags marked `is_sensitive = true` are excluded from all FOMO queries and all public UI. Used only in silent matching and event surfacing.

### 2.3 Music Tags

Stored as `profiles.music_tags` (text array). Fixed list of 25 genres defined in code.

**How they score:**
```
shared_music = intersect(user_a.music_tags, user_b.music_tags)
IF COUNT(shared_music) >= 2: score += 3 points (max bonus)
```

This is a **soft modifier only** — it adds at most 3 points to a 0–100 score. It never dominates a result. Its purpose is to break ties between otherwise equal candidates.

Music tags do **not** drive event discovery. They do not appear in the Explore page filters. They are a subtle social affinity signal — "people who both love jazz are slightly more likely to enjoy an event together."

---

## 3. Persona Attributes — The Silent Personality Layer

Generated from the Click Life Quiz (Sections 2, 3, 4, 6). Stored in `personality_profiles`. Not the same as life tags — these are continuous scoring inputs, not discrete labels.

| Attribute | Values | Role in matching |
|---|---|---|
| `social_energy` | introvert / ambivert / extrovert | User↔user persona compatibility (same = 100, adjacent = 60, opposite = 20) |
| `pace` | relaxed / balanced / fast | Same scoring ladder as above |
| `event_vibe_prefs` | array: creative / active / social / calm / educational | User↔event vibe match (20–30% of event score) |
| `availability` | array: weekday-morning / weekday-evening / saturday / sunday | Soft boost for events on matching days |
| `distance_willingness_km` | 3 / 7 / 20 / 50 | Hard penalty for events beyond this distance |
| `current_mood` | single slug (temporary) | Shifts event scoring — e.g. `prefers-small-group` down-ranks events with capacity > 30 |

**Persona match formula (user↔user):**
```
energy_score = 100 if same / 60 if adjacent / 20 if opposite
pace_score   = same scale
persona_score = (energy_score + pace_score) / 2
```

**Important:** Persona is **not** Click Persona (the UI label — Curious Explorer, Deep Connector etc.). Those labels are UX only and are not used in scoring. The scoring uses `social_energy` and `pace` from `personality_profiles` directly.

---

## 4. User ↔ Event Score (Suggested for You + Click Radar)

**Phase 0 formula (static weights — implement now):**

```
user_event_score = (interest_overlap    × 0.40)
                 + (persona_vibe_match  × 0.30)
                 + (event_style_match   × 0.20)
                 + (life_stage_match    × 0.10)
```

**Step by step:**

**Interest overlap (40%)**
```sql
-- User's tags vs event's tags
user_tags  = SELECT tag_id FROM profile_interest_tags WHERE profile_id = $user
event_tags = SELECT tag_id FROM event_interest_tags WHERE event_id = $event
shared     = COUNT(intersect)
overlap    = shared / MAX(COUNT(user_tags), COUNT(event_tags)) × 100
score      = overlap × 0.40
```

**Persona vibe match (30%)**
```
event_vibe  = events.vibe_tags (array set by merchant: social/creative/active/intimate/calm)
user_prefs  = personality_profiles.event_vibe_prefs

score = (|intersect(event_vibe, user_prefs)| / |event_vibe|) × 100 × 0.30
If event has no vibe tags:  score = 50 (neutral)
If user has no vibe prefs (quiz not done): score = 50 (neutral)
```
> **Patched June 2026:** the previous version routed this through Click Persona labels
> (Deep Connector, Fitness-Focused, etc.). Click Persona is UI-only and explicitly
> removed from scoring as non-predictive (`04_MATCHING_ALGORITHM_V2.md` §0 problem 3) —
> 30% of the launch event score must not ride on it. Direct vibe ↔ `event_vibe_prefs`
> intersection only. The `event_vibe_persona_map` table is dead — do not build it.

**Event style match (20%)**
```
user_style  = personality_profiles.quiz_data->>'event_style'
event_style = events.event_style (set by merchant)

Direct match  = 100 × 0.20
Partial match = 50  × 0.20
No match      = 0   × 0.20
If event has no style: score = 50 × 0.20 (neutral)
```

**Life stage match (10%)**
```
user_life_tags  = profile_life_tags for this user
event_targets   = event_target_life_tags (optional — set by merchant)

If event has no targets: score = 50 × 0.10 (neutral — event not penalised)
If event has targets:    overlap formula same as interest tags × 0.10
```

**Stored in:** `user_event_scores(user_id, event_id, score, computed_at)`
**Rebuilt:** Every 4 hours via cron + immediately when user changes tags (async)

---

## 5. User ↔ User Score (Click with Someone + Mutual Click Suggestions)

**Phase 0 formula — weights vary by active intent:**

```
user_user_score = (interest_overlap        × intent_interest_weight)
                + (persona_match           × intent_persona_weight)
                + (life_tag_overlap        × 0.20)   ← fixed
                + (event_vibe_overlap      × 0.15)   ← fixed
                + (attendance_overlap      × 0.10)   ← fixed
                + (proximity              × intent_proximity_weight)
```

**Intent-mode weights (sum always = 1.0):**

| Intent | Interest | Persona | Life tags | Vibe | History | Proximity |
|---|---|---|---|---|---|---|
| `romantic` | 0.25 | 0.30 | 0.20 | 0.15 | 0.10 | — (absorbed into above to = 1.0) |
| `friends` | 0.30 | 0.25 | 0.20 | 0.15 | 0.10 | — |
| `locals` | 0.10 | 0.20 | 0.20 | 0.15 | 0.10 | 0.25 (proximity-first; interest dropped 0.25→0.10 so the row sums to 1.0 — fix 2026-06-24) |
| `activities` | 0.35 | 0.20 | 0.20 | 0.15 | 0.10 | — (proximity at 0.05, interest absorbs) |
| `networking` | 0.20 | 0.20 | 0.20 | 0.15 | 0.25 | — (history replaces some interest) |
| `relationship_friends` | 0.30 | 0.25 | 0.20 | 0.15 | 0.10 | — |

**Music tag bonus (applied after formula):**
```
IF COUNT(shared music tags) >= 2: score += 3 (capped, never pushes over 100)
```

**Age-band affinity (non-romantic intents only — applied after the music bonus, before engagement weighting):**
```
-- Friendship/social intents should not pair an 18yo with a 70yo by default.
-- A strong soft band, NOT a hard wall: inside ±AGE_BAND age barely matters; far
-- outside it candidates are heavily down-weighted (effectively hidden) UNLESS genuine
-- compatibility on other axes pulls them back ("with exceptions").
-- Romantic intent is EXEMPT here — it has its own hard age gate (10 §2.4 / is_romantically_compatible).

AGE_BAND = platform_settings.friend_age_band_years   -- default 15

gap = abs(age_a - age_b)

IF intent = 'romantic':
    age_factor = 1.0                       -- romantic uses its own hard gate; no soft band
ELSE IF gap <= AGE_BAND:
    age_factor = 1.0                       -- inside the band: no penalty
ELSE:
    -- Outside the band: decay from 1.0 toward a floor as the gap widens.
    -- 0.40 floor at gap = 2×band (e.g. 30y apart). Linear between.
    over = gap - AGE_BAND
    age_factor = greatest(0.40, 1.0 - 0.60 × (over / AGE_BAND))

-- THE EXCEPTION ("with exceptions"): strong shared-interest + life-stage overlap
-- rescues an out-of-band pair. If combined interest+life-stage overlap is high,
-- lift the floor so genuine compatibility can still surface.
IF age_factor < 1.0 AND (interest_overlap_norm + life_stage_overlap_norm) >= 1.4:  -- both strong (~0.7 each)
    age_factor = greatest(age_factor, 0.85)   -- rescued: only a light touch remains

ranked_score = score × age_factor
  -- Non-romantic only. A wide age gap with nothing in common sinks far down the list
  -- (≈0.40×) and effectively never appears; a wide gap WITH strong shared interests +
  -- life stage stays visible (≈0.85×). Life-stage overlap (the 0.20 term, quiz-derived:
  -- new-parent, student, etc.) feeds the rescue so two people at the same life point but
  -- different ages aren't wrongly separated. Bounded [0.40, 1.0]; never zero, never a hard
  -- block — discovery can always be overridden by real compatibility.
```

**Engagement weighting (applied after age-band, before the store):**
```
ranked_score = score × candidate.engagement_weight
  -- candidate = the person being ranked in the VIEWER's list. Down-ranks low-engagement
  -- people in others' browse/suggestion lists; never gates eligibility or clickability.
  -- Bounded [0.700,1.000], default 1.000. Full spec + binding invariant: 04 §3.6 / §6a.
```

**Stored in:** `user_click_scores(user_a_id, user_b_id, score, intent_mode, computed_at)` — `score` is the ranked_score.
**One row per pair per intent mode.** `user_a_id < user_b_id` always (consistent ordering).
**Rebuilt:** Every 4 hours via cron + immediately on quiz completion or tag change (async)

---

## 6. Hard Gates — Who Gets Excluded Before Scoring

These run **before** any scoring. A failed gate = candidate never scored, never shown.

### Universal gates (all intents)
```sql
-- Candidate must be:
is_active = true
onboarding_completed = true
email_verified = true
avatar_url IS NOT NULL          -- THE photo gate (LOCKED June 2026): photo is
                                -- required to click / appear in cards. Booking is NOT
                                -- required to click in the new model — discovery clicks
                                -- (Process 1, 21 v8) are bookless; post-event clicks
                                -- (Process 2) require attendance, not just a photo.
id != current_user_id           -- not themselves
-- Not already clicked in this intent mode (within last 30 days)
-- Not already a mutual click (active)
-- Not dismissed in last 7 days
```

### Romantic mode — additional gates
```sql
'romantic' = ANY(candidate.connection_intent)
candidate.romantic_visible = true
current_user.romantic_visible = true
-- NOT 'relationship_friends' = ANY(candidate.connection_intent)   ← hard safety rule
-- Mutual gender preference compatibility (bidirectional)
-- Age range compatibility (if set)
```

### relationship_friends — absolute exclusion
```sql
-- This runs for ALL intent modes, always:
AND NOT (
  'relationship_friends' = ANY(candidate.connection_intent)
  AND current_user.active_intent = 'romantic'
)
AND NOT (
  'relationship_friends' = ANY(current_user.connection_intent)
  AND candidate.active_intent = 'romantic'
)
-- flexible_discovery = true does NOT override this.
-- There is no exception to this rule.
```

### locals mode — proximity gate
```sql
ST_Distance(user_location, candidate_location) / 1000 <= 10  -- km
```

### networking mode — explicit intent gate
```sql
'networking' = ANY(candidate.connection_intent)
-- flexible_discovery does NOT expand networking
```

### friends / activities / relationship_friends — shared intent gate
```sql
-- Candidate must share at least one platonic intent, OR
-- either user has flexible_discovery = true
current_active_intent = ANY(candidate.connection_intent)
OR current_user.flexible_discovery = true
OR candidate.flexible_discovery = true
```

---

## 7. Romantic Mode — Extra Layer

Romantic intent has its own visibility toggle (`profiles.romantic_visible`) separate from intent selection. A user can have `romantic` in their `connection_intent` but `romantic_visible = false` (paused).

**`dating_preference` is required before `romantic_visible = true` is permitted.** If not set, the `set_romantic_visible()` function raises `dating_preference_required` and the client sends the user to Account Settings → Dating Preferences tab. This prevents the bug where two users with incompatible preferences (e.g. two women who both prefer men) appear in each other's romantic feeds.

**Visibility rules:**
- Both users must have `romantic_visible = true` AND `dating_preference` set
- Bidirectional gender preference compatibility enforced via `is_romantically_compatible()`
- `romantic_visible = false` removes user from all romantic candidate pools immediately
- Toggling off: confirmation dialog. Toggling on: instant if `dating_preference` is set
- Existing mutual clicks unaffected when toggling off

**Dating Preferences settings:** Account Settings → Dating Preferences tab. Visible only when `romantic` is in `connection_intent`. Contains: visibility toggle, interested in (required), age range (optional), what I'm open to (optional), remove dating intent. Full spec: `10_ROMANTIC_INTENT_AND_DATING_MODE.md` §2.4
```sql
-- Only runs for users where romantic_visible = true:
SELECT COUNT(*) AS romantic_count
FROM bookings b
JOIN profiles p ON p.id = b.user_id
WHERE b.event_id = $event_id
  AND b.status = 'confirmed'
  AND p.romantic_visible = true
  AND is_romantically_compatible(current_user_id, p.id) = true

-- Show if romantic_count >= 3: "Some singles are going to this event"
-- Show nothing if < 3 (privacy — too identifiable at small numbers)
```

Full romantic mode spec: `10_ROMANTIC_INTENT_AND_DATING_MODE.md`

---

## 8. Click Radar Score — the Social Discovery Layer

Click Radar is different from Suggested for You. It adds a social proof layer on top of event relevance.

```
radar_score = (tag_overlap_score    × 0.40)   ← from user_event_scores
            + (people_overlap_score × 0.30)   ← how many of user's matches are attending
            + (trending_score       × 0.20)   ← booking velocity last 24h
            + (proximity_score      × 0.10)   ← distance from user's postcode
```

**People overlap (the key differentiator):**
```sql
-- How many of this user's top matches are confirmed attendees?
WITH compatible_users AS (
  SELECT CASE WHEN user_a_id = $user THEN user_b_id ELSE user_a_id END AS person_id
  FROM user_click_scores
  WHERE (user_a_id = $user OR user_b_id = $user)
    AND score > 50 AND intent_mode = $active_intent
),
event_attendees AS (
  SELECT user_id FROM bookings WHERE event_id = $event AND status = 'confirmed'
)
SELECT LEAST(COUNT(*)::numeric / 5, 1) * 100 AS people_overlap_score
FROM compatible_users JOIN event_attendees ON person_id = user_id;
-- 5+ matches attending = full score (100) on this dimension
```

Stored in: `click_radar_scores(user_id, event_id, base_score, people_overlap, trending_score, proximity_score, radar_score, click_count, computed_at)`

Refreshed: Every 30 minutes via cron. Partial update via Realtime trigger when a new booking is confirmed (recalculates people_overlap for that event only).

---

## 9. FOMO Cards — What Generates the Social Copy

FOMO cards appear on locked event pages. They use aggregate signals only — never individual attribution.

**Priority order for FOMO copy:**

| Priority | Signal | Example copy | Requires |
|---|---|---|---|
| 1 | Match-based people overlap | "4 people you might click with are going" | click_count ≥ 2 |
| 2 | Interest tag aggregate | "Popular with yoga fans and wine lovers" | tag count ≥ 2 attendees sharing it |
| 3 | Life tag aggregate (non-sensitive) | "Mostly people in their 30s going" | life tag count ≥ 2, non-sensitive |
| 4 | Trending signal | "Getting popular this week" | trending_score ≥ 80 |
| 5 | Saves count | "47 people saved this" | saves ≥ 1 (no minimum) |

**Privacy rules — non-negotiable:**
- Minimum **3 total confirmed attendees** before any FOMO card shows (pilot threshold)
- Tags marked `is_sensitive = true` never appear in FOMO copy — even in aggregate
- `lgbtq-plus`, `recently-single`, all mood tags → excluded from FOMO always
- "X people you might click with" requires X ≥ 2 and the user has ≥ 3 total matches (prevents identity inference)
- Saves count has no minimum — fires from the first save

Cached in: `event_fomo_cache(event_id, total_count, save_count, top_tags, top_life_tags, computed_at)`
Recomputed via trigger on every `bookings` INSERT and `bookmarks` INSERT/DELETE.

---

## 10. The Complete Scoring Pipeline — End to End

```
User completes onboarding
  │
  ├─ Selects interest tags → profile_interest_tags
  ├─ Selects intents → profiles.connection_intent
  ├─ Sets romantic visible (if romantic) → profiles.romantic_visible
  │
  ▼
user_features sync trigger fires
  → user_features row created/updated (declared features)
  │
  ▼
click-scores-rebuild cron (every 4 hours)
  │
  ├─ For each user: candidate generation
  │    Hard gates applied (§6 above)
  │    Top 200 candidates per user per intent mode
  │
  ├─ Scoring
  │    User↔User: formula from §5
  │    User↔Event: formula from §4
  │    Scores stored in user_click_scores, user_event_scores
  │
  └─ Click Radar: radar_score computed from §8
       Stored in click_radar_scores
  │
  ▼
Nightly batch
  │
  ├─ Behavioural features updated (sub-tags, attendance history, etc.)
  └─ user_features.behavioural_sub_tags, attendance_count, etc. refreshed
  │
  ▼
Dashboard reads pre-computed scores (NEVER live scoring on page load)
  │
  ├─ Suggested for You   → user_event_scores ORDER BY score DESC
  ├─ Click Radar         → click_radar_scores ORDER BY radar_score DESC
  ├─ Click with Someone  → user_click_scores ORDER BY score DESC (top 3)
  └─ FOMO cards          → event_fomo_cache for events in user's feed
  │
  ▼
TWO CLICK PROCESSES (21 v8 — pre-event clicking removed; event page is context-only)
  │
  ├─ PROCESS 1 — Discovery click (anonymous, person-bound, NO event):
  │    send-click edge fn inserts clicks(sender_id, receiver_id, event_id=NULL,
  │      intent_mode, surface='discovery'); expires_at = now()+7 days
  │    Resolves mutual in the SAME transaction (21 §4) — matches a reciprocal
  │      DISCOVERY click (both event_id IS NULL). No trigger.
  │
  ├─ PROCESS 2 — Post-event click (event-bound, attendance-gated):
  │    surface='who_was_there', event_id set; expires_at = event_end+48h
  │    Matches a reciprocal click ON THE SAME EVENT (21 §4).
  │
  ├─ Mutual detection (both processes) is PAIR-SCOPED, not mode-scoped: a reciprocal
  │    click forms ONE active mutual regardless of intent mix (21 rule 6; both intents
  │    stored as intent_a/intent_b and disclosed). uq_active_mutual_per_pair (partial,
  │    WHERE status='active') guarantees exactly one. relationship_friends↔romantic is
  │    blocked upstream at send time, so no unsafe mutual can form. The two processes
  │    NEVER cross-match (a discovery click and a post-event click between the same pair
  │    do not form a mutual with each other — 21 rule 3).
  │    If mutual: INSERT mutual_clicks → generate shared event suggestion (09 §6)
  │
  └─ Shared event suggestion (EVERY mutual, both processes — activity-first):
       Top event from intersection of both users' user_event_scores;
       MUST share ≥1 interest/life tag AND must have ≥2 free seats (two-person capacity
       guard, 09 §6 Step 1 `available >= 2` — fix 2026-06-24; "almost-full" was a display
       badge only, never the suggestion guard);
       Top 3 stored as fallbacks (if rank 1 fills, fall back to rank 2).
       (No pre-event-mutual / meeting-point variant — removed June 2026.)
  │
  ▼
Post-event
  │
  ├─ event end + 2h: post-event prompt (deferred to 09:00 local if it lands 22:00–09:00).
  │    Canonical: 21 §6.8 — this supersedes the old "12h" figure. One prompt, never repeated.
  ├─ User selects attendees → ONE clicks row each (surface='who_was_there', 21 §3)
  ├─ Mutual resolved pair-scoped inside the 21 §4 send-click txn (no trigger, not mode-scoped)
  ├─ Feedback (loved it / had a good time / wasn't for me)
  │    → event_feedback table
  │    → feeds persona recalculation
  │    → weights future suggestions away from disliked event style
  │
  └─ user_features_dirty entry created
       → next cron cycle picks up and refreshes this user's scores
```

---

## 11. Phase 0 vs Phase 2–3 — When Things Change

```
PHASE 0 (launch → Month 2)        PHASE 2–3 (Month 2+)
────────────────────────           ────────────────────
Static weights (§5 table)    →     Cohort-learned weights
                                   (04_MATCHING_ALGORITHM_V2.md)
Hand-curated match labels    →     Logistic regression trained on
(community manager labels          mutual click data + curated labels
30 pairs/day)
No sub-tag scoring           →     Behavioural sub-tags active
(sub-tag infrastructure            (yoga_hot vs yoga_yin etc.)
built but not yet weighted)
```

**Nothing architectural changes between phases.** The feature vector is identical. The `user_features` table structure is the same. The only change is: scoring reads from hardcoded weights → reads from `cohort_weights` table. This is a one-line code change once the ML pipeline is running.

**Build both phases' infrastructure at launch.** The community manager labelling UI and `curated_pair_labels` table (Phase 2–3 data collection) should go live immediately — you need Month 0–2 data to train on. Don't wait.

---

## 12. Document Map — Where Full Detail Lives

| What you need | Read |
|---|---|
| Interest tag full list (223 tags, 16 categories) | `07_INTEREST_TAGS.md` |
| Life tag full list (37 tags), quiz mapping, privacy rules | `08_LIFE_TAGS.md` |
| Life tags on the platform — every surface they appear | `08_LIFE_TAGS_UPDATE.md` |
| Romantic mode — toggle, visibility, event signals | `10_ROMANTIC_INTENT_AND_DATING_MODE.md` |
| Click with Someone full flow + edge cases | `09_CLICK_WITH_ME_AND_RADAR.md` §1–8 |
| Click Radar full flow + edge cases | `09_CLICK_WITH_ME_AND_RADAR.md` §9–15 |
| Phase 0 static scoring formulas | `04_TAG_AND_MATCHING_DATA_FLOW.md` §3 |
| Phase 2–3 ML pipeline + cohort weights | `04_MATCHING_ALGORITHM_V2.md` |
| user_features table schema + sync triggers | `04_MATCHING_ALGORITHM_V2.md` §1.4 |
| How tags flow from merchant → user feeds | `04_TAG_AND_MATCHING_DATA_FLOW.md` §1–2 |
| FOMO card generation in full | `04_TAG_AND_MATCHING_DATA_FLOW.md` §4d |
