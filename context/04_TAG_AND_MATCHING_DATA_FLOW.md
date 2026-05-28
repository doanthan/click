# Click — Tag & Matching Data Flow
> How a merchant's event tags connect to a user's profile tags, produce match scores, and surface on every feed. Follow this doc when building or debugging anything in the discovery, matching, or recommendation stack.

---

## 0. The Core Idea in One Paragraph

A merchant assigns tags to an event. A user assigns tags to their profile during onboarding. The matching engine compares those two tag sets, scores the overlap against several other dimensions (persona, life stage, availability, proximity), and writes a ranked score to a pre-computed table. Every feed on the user's dashboard — Suggested for You, Click Radar, You Might Click With, FOMO cards, mutual click suggestions — reads from that pre-computed table rather than re-running the scoring query live. Tags are the input. Scores are the connective tissue. Feeds are the output.

---

## 1. Tag Types & Where They Live

There are three tag types. They are stored differently and behave differently in scoring.

| Tag type | Set by | Where stored | Editable | Used for |
|---|---|---|---|---|
| **Interest Tags** | User (onboarding/profile) + Merchant (event creation) | `profile_interest_tags(profile_id, tag_id)` + `event_interest_tags(event_id, tag_id)` | ✅ User + Admin | Primary matching signal for both event and people scoring |
| **Life Tags** | Auto-generated from Click Life Quiz | `profile_life_tags(profile_id, tag_id)` | ⚠️ Admin only (overrides) | Life-stage compatibility, FOMO card generation |
| **Music Tags** | User (profile) | `profiles.music_tags` (array) | ✅ User | Secondary/soft signal in people scoring + FOMO copy |

**Tag master table:**
```sql
interest_tags(
  id          uuid PRIMARY KEY,
  category_id uuid REFERENCES categories(id),
  label       text NOT NULL,         -- e.g. 'Pottery', 'Live Jazz'
  type        text,                  -- 'user' | 'event' | 'both'
  archived    boolean DEFAULT false
)
```

Tags are admin-curated. Users and merchants select from this fixed list — they cannot create free-text tags.

---

## 2. How Tags Get Assigned

### 2a. User tag assignment (onboarding → profile)

```
User completes Onboarding Step 3 (Interest Tags)
  │
  ▼
For each selected tag:
  INSERT profile_interest_tags(profile_id = auth.uid(), tag_id)

User completes Click Life Quiz
  │
  ▼
Quiz answers mapped to life tag IDs via quiz_tag_mapping table:
  INSERT profile_life_tags(profile_id = auth.uid(), tag_id, source = 'quiz')

User selects music genres
  │
  ▼
UPDATE profiles SET music_tags = ['Jazz', 'Indie', ...] (text array)
```

**quiz_tag_mapping table** (static, admin-maintained):
```sql
quiz_tag_mapping(
  question_id   text,
  answer_value  text,
  tag_id        uuid REFERENCES interest_tags(id),
  weight        float   -- some answers produce partial tag weight
)
```

### 2b. Event tag assignment (merchant event creation)

```
Merchant completes Event Creation Wizard Step 1 (Basics)
  │
  ▼
For each selected tag:
  INSERT event_interest_tags(event_id, tag_id)
  -- Enforced: at least 1 tag required before status can become 'pending_review'
  -- Enforced: tags must exist in interest_tags table (FK constraint)
```

---

## 3. The Scoring Engine

Located in `src/hooks/matching/use-matching-algorithm.ts` (current client-side implementation). **For production at scale this must move to a Postgres function called on a cron schedule** — see §3c.

### 3a. User ↔ Event Score (0–100)

This score determines what appears in "Suggested for You" and Click Radar.

```
score = (interest_overlap × 0.40)
      + (persona_vibe_match × 0.30)
      + (event_style_match × 0.20)
      + (life_stage_match × 0.10)
```

**Interest overlap (40%):**
```
user_tags     = SELECT tag_id FROM profile_interest_tags WHERE profile_id = user_id
event_tags    = SELECT tag_id FROM event_interest_tags WHERE event_id = event_id
shared        = INTERSECT of the two sets
overlap_score = (COUNT(shared) / MAX(COUNT(user_tags), COUNT(event_tags))) × 100
```
Result is normalised 0–100, then weighted × 0.40.

**Persona / vibe match (30%):**
```
user_persona  = personality_profiles.persona_attributes  -- jsonb: {energy, pace, openness}
event_vibe    = events.vibe_tags                         -- array: ['social', 'creative', 'active']

Mapping (static lookup table event_vibe_persona_map):
  'social'   → favours Extrovert + Ambivert
  'creative' → favours Creative Free-Spirit + Deep Connector
  'active'   → favours Fitness-Focused + Social Adventurer
  'intimate' → favours Introvert + Deep Connector

vibe_score = matched_vibe_count / total_event_vibes × 100 × 0.30
```

**Event style match (20%):**
```
user_style_prefs = personality_profiles.quiz_data->>'event_style'  -- from quiz section 6
event_style      = events.event_style                              -- enum set by merchant

Direct match = 100, partial match (same broad category) = 50, no match = 0
style_score  = raw_score × 0.20
```

**Life-stage match (10%):**
```
user_life_tags  = SELECT tag_id FROM profile_life_tags WHERE profile_id = user_id
event_life_tags = events.target_life_tags  -- optional field; merchant can specify

If event has no target_life_tags: this dimension scores 50 (neutral — not penalised)
If event has target_life_tags: overlap logic same as interest tags above
life_score = result × 0.10
```

**Final event score:**
```sql
-- Stored in: user_event_scores(user_id, event_id, score, computed_at)
-- Updated by: match-rebuild cron (every 4 hours) + on profile tag change
```

### 3b. User ↔ User Score (0–100)

This score determines the "You Might Click With" cards and mutual click suggestions.

```
score = (interest_overlap × 0.30)
      + (persona_match × 0.25)
      + (life_tag_overlap × 0.20)
      + (event_vibe_overlap × 0.15)
      + (attendance_history_overlap × 0.10)
```

**Interest overlap (30%):** Same intersection logic as §3a but comparing two users' `profile_interest_tags`.

**Persona match (25%):**
```
Both users have personality_profiles rows with persona_attributes jsonb.
Compare energy level (Extrovert/Ambivert/Introvert):
  Same energy type = 100
  Adjacent (Extrovert↔Ambivert or Ambivert↔Introvert) = 60
  Opposite (Extrovert↔Introvert) = 20

Compare pace (Fast/Balanced/Relaxed): same scoring ladder.
Average the two sub-scores → persona_score × 0.25
```

**Life tag overlap (20%):** Intersection of `profile_life_tags` for both users. Same normalisation formula.

**Event vibe overlap (15%):**
```
user_a_vibes = distinct event vibes from events user_a has booked/saved
user_b_vibes = same for user_b
overlap = intersect(a_vibes, b_vibes)
vibe_score = (COUNT(overlap) / MAX(COUNT(a), COUNT(b))) × 100 × 0.15
```

**Attendance history overlap (10%):**
```
shared_events = events where both users have a confirmed event_booking
score = MIN(COUNT(shared_events) × 20, 100) × 0.10
-- Caps at 5 shared events = full score on this dimension
```

**Intent filter (applied before scoring, not inside score):**
```
Dating mode:   only score against users where open_to_dating = true
               AND dating_preference matches user's gender
Friends mode:  score against all non-dating-only users
Networking:    score against users with 'networking' in connection_intent
```

**Music tag bonus (soft modifier, not in base score):**
```
shared_music = intersect(user_a.music_tags, user_b.music_tags)
If COUNT(shared_music) >= 2: score += 3 (max bonus 3 points)
-- Subtle influence; doesn't dominate
```

**Final user-user score:**
```sql
-- Stored in: user_match_scores(user_a_id, user_b_id, score, intent_mode, computed_at)
-- Note: store only one row per pair (user_a_id < user_b_id lexicographically)
-- Updated by: match-rebuild cron (every 4 hours)
```

### 3c. Score pre-computation (critical for performance)

**Do not run scoring queries live on page load.** The matching algorithm touches multiple tables with set operations. On 10,000+ users this will time out.

```
Edge fn: match-rebuild (cron, every 4 hours)
  │
  ▼
For each active user (profiles WHERE is_active = true AND onboarding_completed = true):
  1. Compute user ↔ event scores for all published events
     → UPSERT user_event_scores(user_id, event_id, score, computed_at)

  2. Compute user ↔ user scores for top 200 candidates by location proximity
     → UPSERT user_match_scores(user_a_id, user_b_id, score, intent_mode, computed_at)
  │
  ▼
Dashboard queries read from pre-computed tables, not raw tag tables
```

**Also trigger a partial rebuild on:**
- User saves/updates their interest tags → recompute that user's event scores only
- New event published → recompute all users' scores against that event only
- User completes quiz → recompute that user's user-user scores only

These partial rebuilds keep scores fresh without a full 4-hour cycle.

---

## 4. Feed Population — Where Scores Surface

### 4a. Suggested for You

```
Source:  user_event_scores WHERE user_id = current_user ORDER BY score DESC
Filter:  event.status = 'published'
         AND event.start_time > now()
         AND event.capacity > confirmed_booking_count
         AND user has NOT already booked this event
Limit:   Top 6 (5 deterministic top-score + 1 random from rank 6–20 for variety)
Refresh: Read from pre-computed table; no live scoring on render
```

**Displayed on:** `/dashboard` Suggested section + `/events?sort=suggested`

### 4b. Click Radar

Click Radar is not just "events near you" — it's events with tag overlap AND social proof.

```
Score formula:
  radar_score = (tag_overlap_score × 0.40)
              + (people_overlap_score × 0.30)   -- how many of user's matches are attending
              + (trending_score × 0.20)          -- booking velocity in last 24h
              + (proximity_score × 0.10)         -- distance from user's postcode

Source:  user_event_scores JOIN event_bookings JOIN user_match_scores
         to compute people_overlap_score

people_overlap_score:
  attendees = SELECT user_id FROM event_bookings WHERE event_id = X AND status='confirmed'
  matches   = SELECT user_b_id FROM user_match_scores WHERE user_a_id = current_user
              AND score > 50
  overlap   = intersect(attendees, matches)
  score     = MIN(COUNT(overlap) / 5, 1) × 100  -- 5+ matches attending = full score

trending_score:
  recent_bookings = COUNT(event_bookings WHERE event_id = X AND booked_at > now() - interval '24h')
  score = MIN(recent_bookings / 10, 1) × 100     -- 10+ bookings in 24h = full trending score

Refresh: Every 30 minutes (Supabase Realtime subscription on event_bookings INSERT)
Limit:   5 events shown in Click Radar widget
```

**Displayed on:** `/dashboard` Click Radar section

### 4c. You Might Click With

```
Source:  user_match_scores WHERE (user_a_id = current_user OR user_b_id = current_user)
         ORDER BY score DESC
Filter:  Other user is active, verified, onboarding complete
         Other user has NOT already been clicked (no row in clicks table for this pair)
         Other user's intent_mode matches current user's active_intent
Limit:   3 cards shown; rotate every 4 hours (cron flips a 'rotation_slot' flag)
```

**Card content pulled from:**
- `profiles`: first_name, age (derived from date_of_birth), suburb
- `profile_interest_tags` JOIN `interest_tags`: top 3 shared tags (intersect with current user's tags)
- `user_match_scores.score`: match percentage display (optional — product decision)

**Displayed on:** `/dashboard` Click with Someone section + `/people`

### 4d. FOMO Cards

FOMO cards appear on locked event pages. They give social proof without exposing individual identities.

```
For a given event_id, compute:

1. Attendee interest tag cluster:
   SELECT it.label, COUNT(*) as count
   FROM event_bookings eb
   JOIN profile_interest_tags pit ON pit.profile_id = eb.user_id
   JOIN interest_tags it ON it.id = pit.tag_id
   WHERE eb.event_id = X AND eb.status = 'confirmed'
   GROUP BY it.label
   ORDER BY count DESC
   LIMIT 3

2. Attendee life tag cluster:
   Same query but against profile_life_tags

3. Overlap with current user:
   user_tags = SELECT tag_id FROM profile_interest_tags WHERE profile_id = current_user
   attending_user_ids = SELECT user_id FROM event_bookings WHERE event_id = X
   matches_attending = SELECT COUNT(*) FROM user_match_scores
     WHERE (user_a_id = current_user AND user_b_id IN (attending_user_ids))
        OR (user_b_id = current_user AND user_a_id IN (attending_user_ids))
     AND score > 50

FOMO card copy generated from these three data points:
  "4 people you might click with are attending."         ← from overlap count
  "Mostly [top life tag] joining this weekend."          ← from life tag cluster
  "Popular with [top interest tag 1] and [tag 2] fans."  ← from interest tag cluster
```

**Privacy guard:** Only surface FOMO cards when total confirmed attendees ≥ 5. Below 5, show generic "A small group is attending" to prevent de-anonymising early RSVPs.

**Stored in:** `event_fomo_cache(event_id, fomo_data jsonb, computed_at)` — recomputed on each new booking via trigger on `event_bookings INSERT`.

**Displayed on:** `/events/:id` (locked state) sidebar

---

## 5. Mutual Click → Shared Event Suggestion

This is the full end-to-end flow from one user clicking another to a shared event appearing for both.

```
Step 1: User A clicks User B
  INSERT clicks(from_user_id = A, to_user_id = B, created_at = now())

Step 2: DB trigger detect_mutual_click() fires on clicks INSERT
  SELECT id FROM clicks
    WHERE from_user_id = B AND to_user_id = A
    AND created_at > now() - interval '30 days'
  │
  ├─ No row found: nothing happens. B never knows A clicked.
  │
  └─ Row found (mutual):
       INSERT mutual_clicks(user_a_id = A, user_b_id = B, matched_at = now(),
                            expires_at = now() + interval '7 days')

Step 3: Shared event selection
  -- Find best event for both users:
  SELECT ues_a.event_id, (ues_a.score + ues_b.score) / 2 AS combined_score
  FROM user_event_scores ues_a
  JOIN user_event_scores ues_b ON ues_a.event_id = ues_b.event_id
  JOIN events e ON e.id = ues_a.event_id
  WHERE ues_a.user_id = A
    AND ues_b.user_id = B
    AND e.status = 'published'
    AND e.start_time > now()
    AND e.capacity > (SELECT COUNT(*) FROM event_bookings
                      WHERE event_id = e.id AND status = 'confirmed')
  ORDER BY combined_score DESC
  LIMIT 1

  INSERT mutual_click_suggestions(mutual_click_id, event_id, suggested_at,
                                   expires_at = mutual_clicks.expires_at)

Step 4: Both users notified
  INSERT notifications(user_id = A, type = 'mutual_click', payload = {mutual_click_id})
  INSERT notifications(user_id = B, type = 'mutual_click', payload = {mutual_click_id})
  Edge fn: send mutual-click email to both (Resend)

Step 5: Proposal UI surfaces for both users
  -- Reads from mutual_click_suggestions JOIN events
  -- User can accept (→ RSVP flow) or propose alternative (restricted to event catalog)
```

**Expiry handling:**
```sql
-- Cron job (daily): expire stale mutual clicks
UPDATE mutual_clicks
  SET status = 'expired'
  WHERE expires_at < now() AND status = 'active' AND renewed = false;

UPDATE mutual_clicks
  SET status = 'expired'
  WHERE expires_at < now() AND status = 'active' AND renewed = true;
-- renewed = true allows one extension; second expiry is final
```

---

## 6. Profile Tag Change → Score Invalidation

When a user updates their tags, their pre-computed scores are stale. Handle this explicitly.

```
User updates interest tags on /profile/edit
  │
  ▼
UPDATE profile_interest_tags (delete old, insert new)
  │
  ▼
DB trigger: on profile_interest_tags change for user_id X:
  UPDATE user_event_scores SET needs_rebuild = true WHERE user_id = X
  UPDATE user_match_scores  SET needs_rebuild = true
    WHERE user_a_id = X OR user_b_id = X

  -- Do NOT delete scores immediately — stale scores are better than no scores
  -- match-rebuild cron will pick up needs_rebuild = true rows in next cycle
  -- For immediate feel: client can re-run a lightweight top-5 score on page load
  --   using the raw tag intersection query (acceptable for <100 events)
```

**Same pattern applies to:**
- Quiz completion → invalidate user_match_scores for this user
- New event published → invalidate user_event_scores for this event_id (all users)
- Event tags edited by admin → same as new event published

---

## 7. Full Data Flow Diagram (Narrative)

```
MERCHANT
  Creates event → assigns Interest Tags + Vibe Tags
  → event_interest_tags rows written
  → Admin approves → events.status = 'published'
  → Triggers partial match-rebuild for this event_id

                    ↓

MATCHING ENGINE (Postgres function / Edge fn cron)
  Reads: event_interest_tags, profile_interest_tags,
         profile_life_tags, personality_profiles,
         events (vibe, style, location)
  Computes: user_event_scores (every user × every new event)
            user_match_scores (every user × nearby users)
  Writes:   user_event_scores, user_match_scores, event_fomo_cache

                    ↓

USER DASHBOARD (reads pre-computed scores only)
  Suggested for You  ← user_event_scores ORDER BY score DESC
  Click Radar        ← user_event_scores + people_overlap + trending
  Click with Someone ← user_match_scores ORDER BY score DESC
  FOMO cards         ← event_fomo_cache for events in user's feed

                    ↓

USER ACTIONS feed back into the engine
  Books event        → attendance_history_overlap score improves for co-attendees
  Clicks a person    → detect_mutual_click() → shared event suggestion
  Completes quiz     → personality_profiles updated → score rebuild queued
  Updates tags       → needs_rebuild = true → picked up next cron cycle
  Post-event click   → feeds mutual_clicks + future suggestions
```

---

## 8. Tables Required for This System

The following tables must exist for the full tag-to-surface pipeline to function. Some are not yet in the current data model — flagged with ⚠️.

| Table | Purpose | Status |
|---|---|---|
| `interest_tags` | Master tag list | Exists |
| `categories` | Tag categories (16) | Exists |
| `profile_interest_tags` | User ↔ tag join | Exists |
| `event_interest_tags` | Event ↔ tag join | Exists |
| `profile_life_tags` | User ↔ life tag join | Exists |
| `personality_profiles` | Quiz outputs, persona attributes | Exists |
| `clicks` | One-way click actions | Exists |
| `mutual_clicks` | Confirmed mutual pairs | ⚠️ Planned |
| `mutual_click_suggestions` | Shared event per mutual click | ⚠️ Needs building |
| `user_event_scores` | Pre-computed user ↔ event scores | ⚠️ Needs building |
| `user_match_scores` | Pre-computed user ↔ user scores | ⚠️ Needs building |
| `event_fomo_cache` | Aggregated FOMO data per event | ⚠️ Needs building |
| `quiz_tag_mapping` | Maps quiz answers to life tag IDs | ⚠️ Needs building |
| `event_vibe_persona_map` | Maps event vibes to persona types | ⚠️ Needs building |

**The current implementation runs scoring client-side on every render against raw tag tables. This works in dev with small data but will not survive production load. Building `user_event_scores` and `user_match_scores` as pre-computed tables with a cron rebuild is the single most important infrastructure task before launch.**

---

## 9. Scoring Edge Cases

| Scenario | Correct behaviour |
|---|---|
| User has no interest tags (skipped onboarding step 3) | Interest overlap = 0 on all events. Algorithm readiness score shown as prompt. Do not block — surface popular/trending events as fallback. |
| User has not completed quiz | persona_vibe_match and life_stage_match dimensions default to 50 (neutral). Score still computes; just less personalised. |
| Event has no life_tags set by merchant | life_stage_match dimension defaults to 50 (neutral) — event not penalised for missing optional field. |
| Two users have no shared tags at all | user-user score will be low but not 0 (attendance history + vibe overlap can still contribute). They won't appear in each other's top-3 cards unless the pool is very small. |
| New user (day 1, no attendance history) | attendance_history_overlap = 0. This is expected. Score weight on this dimension is only 10% so it doesn't cripple new user matching. |
| Very popular event (100+ bookings) | people_overlap_score in Click Radar caps at 5 overlapping matches = full score. Does not inflate further. |
| Mutual click suggestion event becomes full before both users act | Proposal UI checks capacity in real time at RSVP step. If full, offer next-best event from `mutual_click_suggestions` (store top 3, not just top 1). |
