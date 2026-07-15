<!-- Last updated: 2026-06-14 | Revision: v3 (Click seam-fix patch series; version-control scheme begins 2026-06-14) -->
# Click — Life Tags & Personality Quiz System
> Life tags are silent. Users never see their own life tags listed back at them. They are generated from quiz answers, stored privately, used by the matching engine and FOMO system, and shown only in aggregate on event cards — never attributed to an individual.

---

## 0a. Decision record — fragile-state ("vulnerable") tags REMOVED (June 2026)

The six fragile-state tags — `recently-bereaved`, `carer`, `feeling-isolated`, `rebuilding-confidence`, `nervous-but-willing`, `needs-familiarity` — are **cut from the system**. They are not seeded, not collected, not quizzed for, not scored.

**Why:** they only ever drove a *fuzzy* "surface gentler/smaller/familiar events" boost. But a user's own **interest tags already route them to the events they actually want**, and the **concrete** needs are covered without fragility data:
- accessibility → `functional` class, matched to merchant-set event accessibility flags (§4.2a);
- a preference for small or structured events → the non-sensitive `prefers-small-group` / `needs-structure` preference tags.

Holding sensitive data about someone's grief, isolation, or caring burden to power a vague boost their interests mostly achieve anyway is too personal for too little function — and under privacy law, sensitive data you *hold but don't meaningfully use* is a liability, not a neutral. So we don't collect it.

What this leaves: `public` (normal FOMO), `identity` (belonging signal, shared-viewer only), and `functional` (private need ↔ public event attribute). No `vulnerable`-class tag exists.

---

## 0. The Critical Distinction from Interest Tags

Before anything else, understand why life tags are a separate system.

| | Interest Tags | Life Tags |
|---|---|---|
| **Source** | User selects them consciously | Generated silently from quiz answers |
| **User sees their own tags** | ✅ Yes — visible on profile, editable | ❌ No — never shown back to the user |
| **User can edit** | ✅ Yes, anytime | ❌ No direct edit; retaking quiz updates them |
| **Merchant assigns to events** | ✅ Yes — required | ⚠️ Optional — merchant can set target life tags for audience |
| **Shown on event cards** | ✅ As category filters | ✅ In aggregate FOMO copy only ("Mostly over 30s") |
| **Shown on user profiles** | ✅ Public on profile | ❌ Never shown on any profile, even to the user |
| **Admin manages list** | ✅ Full CRUD | ✅ Full CRUD — but changes affect quiz mapping |
| **Used in matching** | ✅ Primary signal | ✅ Secondary signal (life-stage compatibility) |
| **Contains sensitive data** | No | Yes — classes: `public` (normal FOMO), `identity` (shared-viewer belonging FOMO only), `functional` (private need ↔ public event attribute, no FOMO). The former `vulnerable` class was removed (§0a). See §4.4 |

**The privacy rule is absolute:** A user's individual life tags are never displayed to them or anyone else. FOMO cards say "Mostly new parents attending" — they never say "User 4721 is tagged New Parent."

### The shared-only reveal (the "we're the same" moment — June 2026)
There is ONE place an individual life tag may surface to another user: **a non-sensitive life tag that BOTH people share, shown only inside the mutual-click snapshot, only after a mutual click, and only as a warm point of commonality.** Never the full list — only the overlap.

- **Reciprocity gate:** tag X is shown to user B about user A *only if* user A has X **and** user B has X. One-sided tags are never revealed. (You only ever learn a tag about someone by already having it yourself — so you can't extract anything you didn't already disclose about yourself.)
- **Sensitivity gate:** `is_sensitive = true` tags are NEVER revealed this way, even when shared. Two LGBTQ+ users are matched more strongly (silent boost, §4.1) but the snapshot never says "you're both LGBTQ+" — outing, even to each other, even when true, is not ours to do. Same for mood tags and `recently-single`.
- **Copy is belonging-framed, never clinical:** "You're both new to Sydney 🌏" / "You both have dogs 🐶" / "You're both in your 30s" — a spark of recognition, not a data readout. Max 2 shared tags shown, highest-affinity first.
- **Implementation:** a security-definer function `get_shared_life_tags(viewer, other)` returns only `tag_id`s present in BOTH users' active (non-expired) `profile_life_tags` AND `is_sensitive = false`. It runs only when an active mutual exists between the pair (same gate as `get_profile_snapshot`). No raw `profile_life_tags` read is ever exposed.

```sql
create or replace function get_shared_life_tags(p_other uuid)
returns table (label text) as $$
begin
  if not exists (select 1 from mutual_clicks where status='active'
    and ((user_a_id=auth.uid() and user_b_id=p_other)
      or (user_b_id=auth.uid() and user_a_id=p_other))) then
    raise exception 'not_authorised';
  end if;
  return query
    select lt.label
    from profile_life_tags a
    join profile_life_tags b on a.tag_id = b.tag_id
    join life_tags lt on lt.id = a.tag_id
    where a.profile_id = auth.uid() and b.profile_id = p_other
      and lt.is_sensitive = false
      and (a.expires_at is null or a.expires_at > now())
      and (b.expires_at is null or b.expires_at > now())
    order by lt.display_order limit 2;
end; $$ language plpgsql security definer;
```

**Why this is the right behavioural call (psychology of similarity-attraction):** humans bond fastest over *shared* circumstance, not disclosed circumstance. The similarity-attraction effect is strongest when commonality is *discovered mutually* ("oh, you too?") rather than announced. Showing only the overlap, only after both reached toward each other, turns a privacy constraint into the product's warmest moment — the recognition that the person you clicked with is in the same place in life. It also can't be weaponised: you can't fish for someone's life circumstances because the only ones you ever see are the ones you already share.

---

## 1. Database Schema

```sql
-- Life tag master list (admin-managed)
CREATE TABLE life_tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,   -- e.g. 'new-parent', 'over-50s'
  label         text NOT NULL,          -- e.g. 'New Parent', 'Over 50s'
  group_slug    text NOT NULL,          -- e.g. 'life-stage', 'identity', 'personality'
  group_label   text NOT NULL,          -- e.g. 'Life Stage', 'Identity', 'Personality'
  is_sensitive  boolean DEFAULT false,  -- true for any tag never shown as public/cross-audience copy
  sensitivity_class text NOT NULL DEFAULT 'public'
    CHECK (sensitivity_class IN ('public','identity','functional','vulnerable')),
    -- 'public'     = non-sensitive; normal aggregate FOMO to everyone (is_sensitive=false)
    -- 'identity'   = sensitive belonging tag (LGBTQ+, multicultural, faith, neurodivergent,
    --                veteran). is_sensitive=true. Eligible for SHARED-VIEWER belonging FOMO
    --                (only a user who shares the tag sees it) — see §4.4a.
    -- 'functional' = a private NEED paired to a PUBLIC event attribute (accessibility needs →
    --                step-free venues; sober-curious → alcohol-free events). is_sensitive=true
    --                (never displayed about the person), NEVER any FOMO. Drives event scoring
    --                only, by matching the need to a merchant-set event flag (§4.2a). This is
    --                the GOOD pattern: describe events, never label people.
    -- 'vulnerable' = RESERVED, UNUSED (June 2026). The fragile-state tags (bereaved, carer,
    --                isolated, rebuilding-confidence, nervous-but-willing, needs-familiarity)
    --                were REMOVED — see §0a. Collecting sensitive data about someone's worst
    --                moment to drive a fuzzy "gentler events" boost was too personal for too
    --                little function; a user's own interest tags already route them well, and
    --                the concrete needs (accessibility, small-group preference) are covered by
    --                'functional' and non-sensitive preference tags. The enum value is retained
    --                only so historical rows (if any) don't break the constraint; no tag uses it.
  is_active     boolean DEFAULT true,
  archived      boolean DEFAULT false,
  display_order int DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- User ↔ life tag join (the silent store)
CREATE TABLE profile_life_tags (
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id       uuid NOT NULL REFERENCES life_tags(id) ON DELETE CASCADE,
  source       text NOT NULL DEFAULT 'quiz',
              -- 'quiz'       = generated from quiz answer
              -- 'admin'      = admin override (logged in audit_log)
  added_at     timestamptz DEFAULT now(),
  expires_at   timestamptz DEFAULT NULL,  -- NULL = permanent; set for temporary tags (e.g. 'Feeling Lonely')
  PRIMARY KEY (profile_id, tag_id)
);

-- Quiz answer → life tag mapping (admin-maintained static map)
CREATE TABLE quiz_tag_mapping (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_slug  text NOT NULL,   -- which quiz section
  question_slug text NOT NULL,   -- which question within the section
  answer_value  text NOT NULL,   -- the answer that triggers this tag
  tag_id        uuid NOT NULL REFERENCES life_tags(id),
  weight        numeric DEFAULT 1.0,
               -- 1.0 = full tag assigned
               -- 0.5 = partial signal (used in persona scoring, not as hard tag)
  UNIQUE (section_slug, question_slug, answer_value, tag_id)
);

-- Indexes
CREATE INDEX idx_profile_life_tags_tag ON profile_life_tags(tag_id);
CREATE INDEX idx_profile_life_tags_expires ON profile_life_tags(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX idx_quiz_mapping_section ON quiz_tag_mapping(section_slug, question_slug);
```

### RLS — the privacy rules in code

```sql
-- Life tags master list: public read of non-sensitive tags (for FOMO display labels)
CREATE POLICY "life_tags_public_read" ON life_tags
  FOR SELECT USING (is_active = true AND archived = false AND is_sensitive = false);

-- Sensitive tags: admin read only
CREATE POLICY "life_tags_sensitive_admin" ON life_tags
  FOR SELECT USING (is_sensitive = true AND has_role(auth.uid(), 'admin'));

-- Admin manages all life tags
CREATE POLICY "life_tags_admin_all" ON life_tags
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- profile_life_tags: NOBODY reads their own tags via API
-- This is the most important policy in the system.
-- Users trigger quiz → tags are written by edge fn (service role) → user never reads them back
CREATE POLICY "profile_life_tags_no_user_read" ON profile_life_tags
  FOR SELECT USING (false);
  -- ↑ Blocks ALL direct reads. Access only via security-definer functions.

-- Admin reads all (for moderation and tag analytics only)
CREATE POLICY "profile_life_tags_admin_read" ON profile_life_tags
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- No user writes — all inserts/updates via service-role edge function only
CREATE POLICY "profile_life_tags_no_user_write" ON profile_life_tags
  FOR INSERT WITH CHECK (false);
CREATE POLICY "profile_life_tags_no_user_update" ON profile_life_tags
  FOR UPDATE USING (false);
```

**Why block user reads of their own tags:** If a user can call `SELECT * FROM profile_life_tags WHERE profile_id = auth.uid()`, they can see they've been tagged `LGBTQ+` or `Neurodivergent` — tags they didn't explicitly choose and may not recognise from a quiz answer. This is a dignity and trust issue, not a security issue. The solution is that their tags are never readable via the API, only consumed silently by backend functions.

---

## 2. The Click Life Quiz

### Design principles
- Optional — never forced; promoted post-signup
- All questions skippable individually (sensitive questions — disability, neurodivergence, faith, cultural background — are explicitly optional with a visible "prefer not to say", and framed as "this helps us find events and people that fit — only ever shown to you as better suggestions, never to anyone else")
- Friendly, warm tone — not clinical
- 7 sections (8 if dating intent selected)
- Retakable any time via `/quiz`
- Results update `personality_profiles` and `profile_life_tags` silently

### Quiz sections, questions, and what they generate

---

#### Section 1 — Life Stage & Identity
**Purpose:** Capture where someone is in life right now.
**Generates:** Hard life tags stored in `profile_life_tags`

| Question | Answer options | Life tag generated |
|---|---|---|
| "How would you describe where you're at right now?" | I'm a new parent | `new-parent` |
| | I'm a student | `student` |
| | I'm new to Sydney / new to this area | `new-to-town` |
| | I'm recently single | `recently-single` |
| | I'm retired | `retired` |
| | I'm navigating a big life change | `in-transition` |
| | None of these / prefer not to say | *(no tag)* |
| "Do you have a pet?" | Yes, I'm a pet owner | `pet-owner` |
| | No | *(no tag)* |
| "Which of these feels like you?" | I'm in my 20s and figuring things out | `twenty-something` |
| | I'm in my 30s and building | `thirty-something` |
| | I'm over 50 and loving it | `over-50s` |
| | I'd rather not say | *(no tag)* |
| "Do you identify as LGBTQ+?" | Yes | `lgbtq-plus` *(sensitive)* |
| | Prefer not to say | *(no tag)* |
| "Do you live…" | Alone | `living-alone` |
| | With a partner | *(no tag — not relevant)* |
| | With housemates | *(no tag)* |
| | With family | *(no tag)* |

**Note on age tags (sensitivity + behavioural design):** `twenty-something`, `thirty-something`, `over-50s` are soft self-reported *cohorts*, NOT derived from `profiles.date_of_birth`. Exact age is matched on silently; it is **never shown to another user** — not on the snapshot, not in FOMO. The snapshot's age line uses a *band* ("in their 30s"), never a number, because:
- **Exact age triggers ranking/judgement; a band triggers belonging.** "32" invites comparison ("older/younger than me"); "in their 30s" invites recognition ("same stage as me"). The cohort is the connection signal; the integer is just matching plumbing.
- A user can hold NO age cohort tag ("prefer not to say") and still be matched on real DOB silently — opting out of the *label* never opts them out of good *suggestions*.
- Age bands are non-sensitive for FOMO ("popular with people in their 30s") but exact ages and any age FOMO for under-25s or a single-year granularity are banned — never narrow enough to identify.

---

#### Section 2 — Personality Style
**Purpose:** Measure social energy and communication tendencies.
**Generates:** Persona attributes stored in `personality_profiles.persona_attributes` jsonb — NOT as life tags.

| Question | Answer options | Persona attribute set |
|---|---|---|
| "I tend to recharge by…" | Spending time alone / going inward | `social_energy: introvert` |
| | A mix of both | `social_energy: ambivert` |
| | Being around people / going out | `social_energy: extrovert` |
| "In social situations, I usually…" | Hang back and observe first | Reinforces `introvert` |
| | Jump in and introduce myself | Reinforces `extrovert` |
| | It depends entirely on the vibe | Reinforces `ambivert` |
| "I connect best with people who are…" | Thoughtful and deep | `connection_style: deep` |
| | Fun and spontaneous | `connection_style: playful` |
| | Ambitious and driven | `connection_style: driven` |
| | Warm and caring | `connection_style: warm` |
| "My social pace is best described as…" | I like to take things slowly | `pace: relaxed` |
| | I move fast and love variety | `pace: fast` |
| | Somewhere in the middle | `pace: balanced` |

**Why persona lives in `personality_profiles` not `profile_life_tags`:** Persona attributes are continuous scores and enums used in scoring calculations, not discrete tags used for FOMO copy. Mixing them would complicate both systems.

---

#### Section 3 — Availability
**Purpose:** Identify when users can attend events.
**Generates:** Availability flags in `personality_profiles.availability` (array of slugs) — NOT as life tags.

| Question | Answer options | Availability flag set |
|---|---|---|
| "When are you usually free to attend events?" | Weekday mornings | `weekday-morning` |
| *(multi-select)* | Weekday evenings | `weekday-evening` |
| | Saturday | `saturday` |
| | Sunday | `sunday` |
| | It varies week to week | `flexible` |

**How this drives matching:** Events have `start_time`. The matching engine compares the event's day/time against the user's availability flags. An event on Saturday scores higher for a user with `saturday` flag. This is a soft boost, not a hard filter — users won't be excluded from Friday events just because they ticked Saturday.

---

#### Section 4 — Distance Willingness
**Purpose:** How far will the user travel for an event?
**Generates:** `personality_profiles.distance_willingness_km` (integer)

| Answer | Distance value stored |
|---|---|
| "Just my suburb — I like things close" | 3 km |
| "A short trip — within 20 mins" | 7 km |
| "I'll travel across the city for the right event" | 20 km |
| "Distance doesn't matter to me" | 50 km |

This feeds directly into proximity weighting in event scoring. A user who said "just my suburb" gets a stronger proximity penalty on events in Parramatta vs one who said "I'll travel anywhere."

---

#### Section 5 — Dating Preferences
**Conditional — only shown if `open_to_dating = true` in user profile.**
**Purpose:** Capture romantic compatibility signals.
**Generates:** Dating-specific fields in `personality_profiles` and `profiles`

| Question | Answer options | What is stored |
|---|---|---|
| "I'm interested in meeting…" | Men | `profiles.dating_preference = 'men'` |
| | Women | `profiles.dating_preference = 'women'` |
| | Everyone | `profiles.dating_preference = 'everyone'` |
| "What are you open to?" | Something casual | `personality_profiles.dating_intent = 'casual'` |
| | Dating and seeing where it goes | `personality_profiles.dating_intent = 'dating'` |
| | A serious relationship | `personality_profiles.dating_intent = 'serious'` |
| | Not sure yet | `personality_profiles.dating_intent = 'open'` |
| "Are you open to having children?" | Yes, I want kids | `personality_profiles.wants_children = true` |
| | No, not for me | `personality_profiles.wants_children = false` |
| | I already have kids | `personality_profiles.has_children = true` |
| | Not sure / doesn't matter | *(no flag)* |
| "Preferred age range" | Slider: min / max age | `personality_profiles.dating_age_min`, `dating_age_max` |

These fields are used in dating-mode matching only. They are never shown to other users. The only visible signal from dating preferences is the general intent label: "Here for dating" on the profile snapshot.

---

#### Section 6 — Event Style
**Purpose:** Define the type of event environment the user prefers.
**Generates:** `personality_profiles.event_vibe_prefs` (array of slugs)

| Question | Answer options | Vibe preference set |
|---|---|---|
| "I'd most enjoy an event that is…" | Small and intimate (under 20 people) | `intimate` |
| *(multi-select)* | Medium sized (20–50 people) | `medium-group` |
| | Large and buzzing (50+ people) | `large-social` |
| "The vibe I'm looking for is…" | Creative and hands-on | `creative` |
| *(multi-select)* | Physical and active | `active` |
| | Social and casual | `social` |
| | Educational and stimulating | `educational` |
| | Calm and restorative | `calm` |
| "I prefer events that are…" | Structured with a clear agenda | `structured` |
| | Loose and free-flowing | `unstructured` |
| | Either — I'm flexible | `flexible` |

---

#### Section 7 — Energy & Mood
**Purpose:** Capture the user's current emotional state and what they need from social connection right now.
**Generates:** Temporary life tags (with `expires_at = now() + 30 days`) AND mood weighting in `personality_profiles.current_mood`

This is the most sensitive section. The tags generated here expire automatically — they reflect a moment in time, not a permanent identity.

| Question | Answer options | Tag generated | Expires |
|---|---|---|---|
| "Right now, how would you describe yourself socially?" | Open and curious — ready to meet people | `current-mood: open` *(persona only, no life tag)* | 30 days |
| | Mostly happy, just want to expand my circle | `expanding-circle` *(persona only)* | 30 days |
| | I'm in a great place — just looking for fun | *(no tag — positive baseline, used in persona scoring)* | — |
| | *(June 2026: the "rebuilding confidence / feeling isolated / nervous but willing" answers no longer generate stored life tags — fragile-state tags removed, §0a. If this question is kept at all, treat any such answer as a transient persona signal only, never a stored tag. Recommended: soften or drop the fragile-framed answer options so the quiz doesn't ask people to disclose a low moment Click won't use.)* | — |
| "What would make you feel comfortable at an event?" | Knowing someone else is going | *(June 2026: `needs-familiarity` removed, §0a — no tag. The concrete comfort needs below still map.)* | — |
| | Having a structured activity to focus on | `needs-structure` | 30 days |
| | A small group | `prefers-small-group` | 30 days |
| | No specific requirements — I'm easy | *(no tag)* | — |

**Why mood tags expire:** "Rebuilding confidence after a breakup" is true today and irrelevant in 6 months. Permanent storage of this tag would be both inaccurate and a privacy burden. The 30-day expiry means the system adapts as the user's life changes without requiring them to manually clear it.

**Cron job for expiry:**
```sql
-- Runs nightly
DELETE FROM profile_life_tags
  WHERE expires_at IS NOT NULL AND expires_at < now();
```

---

## 3. Complete Life Tag List

Grouped by type. All tags below are seeded at launch.

### Group 1 — Life Stage
*Permanent tags. Reflect where someone is in life right now.*

| Slug | Label | Sensitive | Notes |
|---|---|---|---|
| `new-parent` | New Parent | No | |
| `student` | Student | No | |
| `new-to-town` | New to Sydney | No | High relevance for Sydney pilot |
| `recently-single` | Recently Single | No | Soft — relates to social openness |
| `retired` | Retired | No | |
| `in-transition` | Life in Transition | No | Catch-all for big changes |
| `empty-nester` | Empty Nester | No | Kids grown and left home |
| `career-pivot` | Career Change | No | |
| `single-parent` | Single Parent | No | Distinct social/scheduling needs from `new-parent` |
| `returning-to-social` | Easing Back In | No | Post-illness, post-caregiving, post-anything — a neutral "I'm getting back out there", not a fragility tag; permanent-ish |
| `veteran` | Veteran | **Yes** (identity) | Strong community-bonding signal; identity belonging FOMO (shared-viewer only), never cross-audience |
<!-- `carer` and `recently-bereaved` REMOVED June 2026 (§0a) — fragile-state tags cut. -->

### Group 2 — Identity
*Permanent. Handle with care — some are sensitive.*

| Slug | Label | Sensitive | Notes |
|---|---|---|---|
| `lgbtq-plus` | LGBTQ+ | **Yes** | Used in matching + LGBTQ-specific event targeting |
| `pet-owner` | Pet Owner | No | Drives dog park and pet-friendly event suggestions |
| `living-alone` | Living Alone | No | Relevant for social isolation matching |
| `traveller` | Frequent Traveller | No | |
| `expat` | Expat / Newcomer to Australia | No | Sydney pilot relevance |
| `neurodivergent` | Neurodivergent | **Yes** | Sensitive; powers sensory-friendly event matching, never surfaced |
| `has-accessibility-needs` | Accessibility Needs | **Yes** | Sensitive; silently boosts step-free / accessible-venue events (requires merchant venue-accessibility flag — see §4.2a) |
| `culturally-diverse` | Multicultural Background | **Yes** | Sensitive; optional self-ID, powers cultural-community event matching |
| `person-of-faith` | Person of Faith | **Yes** | Sensitive; optional, powers faith-community event matching, never surfaced |
| `sober-curious` | Sober / Sober-Curious | No | Drives alcohol-free event matching — increasingly requested, not stigmatising |

### Group 3 — Age Cohort (Self-Reported)
*Permanent. Supplementary to actual DOB — used for FOMO copy only.*

| Slug | Label | Sensitive | Notes |
|---|---|---|---|
| `twenty-something` | In My 20s | No | |
| `thirty-something` | In My 30s | No | |
| `over-50s` | Over 50s | No | |

### Group 4 — Lifestyle Orientation
*Permanent. Derived from combination of quiz answers.*

| Slug | Label | Sensitive | Notes |
|---|---|---|---|
| `fitness-focused` | Fitness-Focused | No | Drives active/sport event boost |
| `wellness-focused` | Wellness-Focused | No | Drives yoga/meditation event boost |
| `creative-type` | Creative Type | No | Drives arts/craft event boost |
| `foodie` | Food & Drink Lover | No | |
| `festival-goer` | Festival Goer | No | |
| `outdoors-person` | Outdoors Person | No | |
| `homebody` | Homebody (occasional events) | No | Lower frequency weighting |
| `social-butterfly` | Social Butterfly | No | Higher frequency weighting |
| `professional-networker` | Active Networker | No | |
| `arts-culture` | Arts & Culture Lover | No | |

### Group 5 — Event Preferences (Temporary — 30-day expiry)
*Plain, non-sensitive preferences — same character as an interest. The fragile-state tags that used to live here were removed June 2026 (§0a).*

| Slug | Label | Sensitive | Expiry |
|---|---|---|---|
| `needs-structure` | Prefers Structured Events | No | 30 days |
| `prefers-small-group` | Prefers Small Groups | No | 30 days |
| `expanding-circle` | Looking to Expand Circle | No | 30 days |
<!-- REMOVED June 2026 (§0a): rebuilding-confidence, feeling-isolated, nervous-but-willing, needs-familiarity. -->

---

## 4. How Life Tags Drive the Platform

### 4.1 User ↔ User matching (life-stage compatibility)

Life tag overlap contributes **20% of the user-user match score** (see `04_MATCHING_ALGORITHM_V2.md`).

```
User A life tags: [new-to-town, thirty-something, wellness-focused]
User B life tags: [new-to-town, thirty-something, fitness-focused]

Shared: [new-to-town, thirty-something]
Overlap = 2 / max(3, 3) = 0.67 → 67/100 on life-stage dimension
This × 0.20 weight = 13.4 points toward user-user match score

Matching engine note: "Both new to town" is highly predictive of connection intent.
New-to-town users are more socially open and actively seeking community.
```

**Sensitive tag matching:** Sensitive tags (especially `lgbtq-plus`) are used as filters, not just weights. A user tagged `lgbtq-plus` will have LGBTQ-specific events surfaced more prominently, and when matching with another user tagged `lgbtq-plus`, the match score receives a significant boost. This is intentional — shared identity is a strong compatibility signal.

### 4.2 Event targeting by merchants (optional)

Merchants can optionally specify target life tag audiences when creating an event. This is advisory — it influences the matching engine's event scoring but does not hard-filter which users can see or book the event.

```sql
-- Events can have optional target life tags
CREATE TABLE event_target_life_tags (
  event_id   uuid REFERENCES events(id) ON DELETE CASCADE,
  tag_id     uuid REFERENCES life_tags(id),
  PRIMARY KEY (event_id, tag_id)
);
```

Examples of merchant use:
- A singles wine night → target `recently-single`, `thirty-something`
- An LGBTQ+ social → target `lgbtq-plus`
- A mums group → target `new-parent`
- A new-to-Sydney meetup → target `new-to-town`, `expat`

When set, these target tags boost the event's score for matching users by adding weight to the life-stage dimension. A user with `new-to-town` tag will see a New to Sydney Meetup higher in their Suggested for You feed than someone without it — even if their interest tags are identical.

#### 4.2a Accessibility & sober matching require a merchant venue attribute
Some sensitive tags only help if events can be matched to them. Merchants set event/venue attributes (NOT life tags — these describe the event, not a person):
- `events.accessibility` (jsonb): `step_free`, `accessible_bathroom`, `quiet_space`, `hearing_loop` etc.
- `events.is_alcohol_free` (boolean).
A user with `has-accessibility-needs` silently boosts events with the matching accessibility attributes; `sober-curious` boosts `is_alcohol_free` events. This is the difference between *labelling people* (which we minimise) and *describing events* (which we encourage) — the matching happens by pairing a private need with a public event attribute, never by exposing the need.

### 4.3 FOMO card generation (aggregate only)

Life tags power the qualitative copy in FOMO cards. **They are never attributed to individuals.**

```
Event attendees have life tags:
  new-parent × 4
  thirty-something × 7
  wellness-focused × 5
  lgbtq-plus × 2   ← sensitive; excluded from FOMO copy (see §4.4)

FOMO copy generated:
  "Popular with people in their 30s."
  "Mostly wellness-focused attendees going."
  NOT: "LGBTQ+ attendees going." ← sensitive tag; never surfaced in FOMO
```

### 4.4 FOMO copy by sensitivity class

There are three rules, one per class. The viewer's own tags decide what they can see.

#### Public tags → aggregate FOMO to everyone (unchanged)
`sensitivity_class = 'public'`: shown to all viewers, aggregate, ≥3 cohort floor, with counts.
```sql
SELECT lt.label, COUNT(*) as count
FROM profile_life_tags plt
JOIN life_tags lt ON lt.id = plt.tag_id
JOIN bookings b ON b.user_id = plt.profile_id
WHERE b.event_id = $1 AND b.status = 'confirmed'
  AND lt.sensitivity_class = 'public'
GROUP BY lt.label
HAVING COUNT(*) >= 3
ORDER BY count DESC LIMIT 2;
```

#### 4.4a Identity tags → SHARED-VIEWER belonging signal (June 2026)
`sensitivity_class = 'identity'` (LGBTQ+, multicultural, faith, neurodivergent, veteran). The belonging signal — "others like you are here" — shown **only to a viewer who holds the same tag**, never to anyone else, never with a name, never with a number. This gives the warmth to the people it's *for* while staying invisible to everyone else.

**Four guardrails make it foolproof at small N:**
1. **Viewer must share the tag.** An LGBTQ+ user sees the LGBTQ+ signal; a non-LGBTQ+ user sees nothing about it. (Same reciprocity gate as the shared-only reveal §0 — you only see what you already are.)
2. **Higher cohort floor: ≥4 OTHERS excluding the viewer** (vs ≥3 for public). A signal that resolves to one identifiable person is banned — at an intimate event a viewer must never be able to deduce who the "other" is.
3. **Never a number, never a name.** Copy: *"You're not the only one — others from the LGBTQ+ community are going too."* Never "4 people," never who.
4. **Viewer excluded from the count** so it never reads as "you + 1."

```sql
-- Belonging signal: only fires for a viewer who holds the identity tag.
SELECT lt.label
FROM profile_life_tags viewer
JOIN life_tags lt ON lt.id = viewer.tag_id AND lt.sensitivity_class = 'identity'
WHERE viewer.profile_id = $viewer_id            -- the viewer must hold the tag
  AND (viewer.expires_at IS NULL OR viewer.expires_at > now())
  AND (
    SELECT COUNT(DISTINCT plt.profile_id)
    FROM profile_life_tags plt
    JOIN bookings b ON b.user_id = plt.profile_id
    WHERE b.event_id = $1 AND b.status = 'confirmed'
      AND plt.tag_id = viewer.tag_id
      AND plt.profile_id <> $viewer_id          -- exclude the viewer themselves
  ) >= 4;                                        -- ≥4 OTHERS, never a number shown
```
Consent copy at quiz time (shown when selecting any identity tag): *"This stays private — we'll never put it on your profile or tell anyone you selected it. We may quietly let others in the same community know they're not the only one here — never who."*

#### 4.4b Functional tags → NEVER any FOMO (event-attribute matching only)
`sensitivity_class = 'functional'` (`has-accessibility-needs`, `sober-curious`). **No FOMO of any kind.** These are private needs matched to *public event attributes* (§4.2a) — e.g. accessibility needs boost events the merchant flagged step-free; sober-curious boosts alcohol-free events. The need is never displayed about the person; only the event's public attributes are. This is the deliberately-kept "good pattern" — describe events, never label people.

> **June 2026:** the former `vulnerable` class (bereaved, carer, isolated, rebuilding-confidence, nervous-but-willing, needs-familiarity) was **removed** (§0a). There is no fragile-state FOMO rule to state because there are no fragile-state tags. A user's own interest tags route them to events they want; concrete comfort needs (small-group, structured) are plain non-sensitive preferences below.

Sensitive tags (identity + functional) remain fully used in silent matching — they're just governed for *display* by the rules above (identity: shared-viewer belonging FOMO only; functional: no FOMO, event-attribute matching only).

### 4.5 Preference tags and event recommendations

Temporary preference tags shape which events are surfaced. These are non-sensitive stated preferences — the same character as an interest tag.

| Preference tag | Effect on event scoring |
|---|---|
| `prefers-small-group` | Hard filter: events with capacity > 30 are scored 20% lower. |
| `needs-structure` | Boosts events with clear descriptions, defined activities, and start/end times. Reduces open-ended "just drinks" type events. |
| `expanding-circle` | Standard scoring — no boost or penalty. Signals user is baseline open to anything. |

> The fragile-state boosts that used to sit here (rebuilding-confidence → small/familiar events, feeling-isolated → social-proof events, etc.) were removed with their tags (§0a). The intent behind them — don't drop an anxious newcomer into a 150-person party — is still served, just without fragility data: their *interest* tags and the `prefers-small-group` preference already pull them toward fitting events, and `functional` accessibility matching handles concrete needs.

---

## 5. Persona Attributes vs Life Tags — The Distinction

These live in `personality_profiles`, not `profile_life_tags`. They are scoring inputs, not tags.

| Attribute | Values | Used for |
|---|---|---|
| `social_energy` | `introvert` / `ambivert` / `extrovert` | User-user persona match score |
| `pace` | `relaxed` / `balanced` / `fast` | User-user persona match score |
| `connection_style` | `deep` / `playful` / `driven` / `warm` | User-user persona match score |
| `event_vibe_prefs` | Array of slugs (creative, active, social, etc.) | User-event vibe match score |
| `availability` | Array of slugs (weekday-morning, saturday, etc.) | Event time match boost |
| `distance_willingness_km` | Integer (3–50) | Event proximity scoring |
| `current_mood` | Single slug | Temporary event score modifier |
| `dating_intent` | `casual` / `dating` / `serious` / `open` | Dating-mode matching only |
| `wants_children` | boolean | Dating-mode matching only |
| `has_children` | boolean | Dating-mode matching only |
| `dating_age_min` | integer | Dating-mode matching only |
| `dating_age_max` | integer | Dating-mode matching only |

```sql
CREATE TABLE personality_profiles (
  user_id                uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  social_energy          text,          -- introvert / ambivert / extrovert
  pace                   text,          -- relaxed / balanced / fast
  connection_style       text,          -- deep / playful / driven / warm
  event_vibe_prefs       text[],        -- array of vibe slugs
  availability           text[],        -- array of availability slugs
  distance_willingness_km int DEFAULT 10,
  current_mood           text,          -- temporary; should be cleared after 30d
  dating_intent          text,          -- dating-mode only
  wants_children         boolean,       -- dating-mode only
  has_children           boolean,       -- dating-mode only
  dating_age_min         int,           -- dating-mode only
  dating_age_max         int,           -- dating-mode only
  quiz_completed_at      timestamptz,
  quiz_version           int DEFAULT 1, -- increment when quiz structure changes
  updated_at             timestamptz DEFAULT now()
);

-- RLS: user reads and writes their own
CREATE POLICY "personality_profiles_self" ON personality_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Admin reads all (for analytics only)
CREATE POLICY "personality_profiles_admin_read" ON personality_profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
```

---

## 6. Quiz Submission — Data Flow

```
User completes quiz sections (all or some)
  │
  ▼
Client sends quiz answers to edge fn: submit-quiz
  Payload: { user_id, answers: [{ section, question, answer_value }] }
  │
  ▼
Edge fn (service role — bypasses RLS):

  1. For each answer, look up quiz_tag_mapping:
     SELECT tag_id, weight FROM quiz_tag_mapping
       WHERE section_slug = $section AND question_slug = $question
         AND answer_value = $answer

  2. Insert life tags (weight = 1.0 only; weight < 1.0 goes to persona scoring):
     FOR EACH tag_id WHERE weight = 1.0:
       INSERT INTO profile_life_tags(profile_id, tag_id, source='quiz', expires_at)
         ON CONFLICT (profile_id, tag_id) DO UPDATE SET added_at = now()
         -- Re-taking quiz refreshes the timestamp; doesn't create duplicates

  3. Update personality_profiles with persona attributes derived from quiz answers

  4. Queue user_features_dirty entry for this user:
     INSERT INTO user_features_dirty(user_id, reason='quiz_completed')
       ON CONFLICT DO UPDATE SET marked_at = now()

  5. Insert user_activity(type='quiz_completed'):
     INSERT INTO user_activity(user_id, type, payload={quiz_version})

  6. Return { success: true }
  -- User never sees which tags were set
```

---

## 7. Admin Management of Life Tags

Admins can manage the life tag taxonomy. More care is required here than with interest tags because changes affect the quiz mapping.

### What admins can do

| Action | Notes |
|---|---|
| Create new tag | Must add corresponding quiz mapping rows, or the tag will never be auto-generated |
| Edit label | Cascades to FOMO card copy — review existing FOMO templates after editing |
| Toggle `is_sensitive` | Marking a tag sensitive immediately removes it from FOMO copy and public analytics |
| Archive tag | Tag stops being generated by quiz; existing `profile_life_tags` rows preserved |
| Override a user's life tags | Possible but must be logged in `admin_audit_log`; use only for data correction |
| View aggregate tag distribution | E.g. "12% of users are tagged new-to-town" — for platform analytics |

### What admins cannot do (safely)
- **Delete a life tag** if any `profile_life_tags` rows reference it — DB FK constraint blocks this. Archive instead.
- **Change a tag slug** after launch — slugs are used in quiz_tag_mapping and code constants. Changing a slug breaks the mapping. Add a new tag and migrate instead.
- **Manually bulk-tag users** — not available in the UI. Tag assignment is quiz-driven only. Admin overrides are individual and audit-logged.

### Editing quiz_tag_mapping
This is the most consequential admin operation in the life tag system. Changing a mapping changes what tags future quiz submissions generate. It does **not** retroactively update existing `profile_life_tags` rows.

If a mapping change is material (e.g., a question was reworded and the answers are now different), consider:
1. Incrementing `personality_profiles.quiz_version`
2. Prompting users to retake the quiz ("We updated the quiz — retake it for better matches")
3. Archiving the old tags and creating new ones

---



---

## 10. Where Life Tags Surface — Every Touchpoint

### 10.1 Matching engine (silent — user never sees this)

Life tags contribute **20% of the user↔user match score**. Two users tagged `new-to-town` score higher compatibility than two users where only one has the tag. Two users tagged `over-50s` match better on the life-stage dimension.

```sql
-- Life tag overlap in user↔user scoring:
SELECT COUNT(*) AS shared_life_tags
FROM profile_life_tags plt_a
JOIN profile_life_tags plt_b
  ON plt_a.tag_id = plt_b.tag_id
WHERE plt_a.profile_id = user_a_id
  AND plt_b.profile_id = user_b_id
  AND plt_a.expires_at IS NULL OR plt_a.expires_at > now()
  AND plt_b.expires_at IS NULL OR plt_b.expires_at > now();
```

### 10.2 Event suggestions — Suggested for You feed

When a merchant targets an event at specific life tags (via `event_target_life_tags`), users with matching life tags see that event boosted in their Suggested for You feed.

Examples:
- "New Mums Yoga" targets `new-parent` → users with `new-parent` tag see this higher in their feed
- "New to Sydney Meetup" targets `new-to-town` → users with `new-to-town` see this first
- "Over 50s Trivia Night" targets `over-50s` → boosted for users tagged `over-50s`
- LGBTQ+ social events target `lgbtq-plus` → **silently** boosted for those users; never labelled publicly

This is a scoring boost, not a hard filter. A user without `new-parent` can still see and book "New Mums Yoga" — they just see it lower in their personalised feed.

### 10.3 FOMO cards on event pages (aggregate only, privacy-safe)

Non-sensitive life tags generate FOMO copy when ≥3 confirmed attendees share the tag.

**What can appear:**
- "Mostly new parents attending" — from `new-parent` ≥3
- "Popular with people over 50" — from `over-50s` ≥3
- "Lots of locals attending" — from `new-to-town` ≥3
- "Dog owners love this one" — from `pet-owner` ≥3 (used for dog-friendly events)

**What never appears in FOMO copy:**
- Anything from a tag marked `is_sensitive = true`
- `lgbtq-plus` and all `identity`-class tags — never in aggregate FOMO (identity tags get shared-viewer belonging FOMO only, §4.4a)
- `functional`-class tags (`has-accessibility-needs`, `sober-curious`) — never in FOMO; they drive event-attribute matching only (§4.4b)
- `recently-single` — borderline sensitive; treat as sensitive in FOMO context

### 10.4 Discovery page — "Mostly Singles" filter

On the Explore/Discovery page, a filter option "Mostly Singles" surfaces events where a high proportion of confirmed attendees have `recently-single` OR `romantic_visible = true`. This is a life-tag-powered filter but it uses the aggregate, not individual attribution.

**Implementation note:** This filter uses a computed signal, not a direct life tag query. See `12_DISCOVERY_PAGE.md` §4 for the full filter spec.

### 10.5 Click Radar — social proof copy

Click Radar event cards use life tags in the social proof line alongside interest tags:

- "3 pet owners going" — from `pet-owner` attending
- "Popular with new parents" — from `new-parent` attending
- "Lots of locals going" — from `new-to-town` attending

Same rules: sensitive tags excluded, minimum 3 attendees with the tag.

### 10.6 Merchant event targeting (optional)

When a merchant creates an event, they can optionally set target life tag audiences. This is in the event creation wizard as an optional "Who is this for?" step.

UI: multi-select chips from a curated list of **non-sensitive** life tags only:
- New Parents
- New to Sydney
- Over 50s
- Pet Owners
- Students
- Busy Professionals
- Fitness Focused
- Wellness Focused

**LGBTQ+ is available as a target tag** but is handled differently — a merchant can tag an event as LGBTQ+ friendly, and it will be boosted for LGBTQ+ users. It will NOT appear as a FOMO signal or public label on the event card. The event appears in LGBTQ+ users' feeds silently; they see it as a relevant event, not as an explicitly labelled space (unless the merchant's own event title/description makes that explicit).

### 10.7 Weekly digest email

The weekly digest uses life tags to personalise subject lines and content:

- User with `new-to-town` → subject: "Discover your new city — events in Sydney this week"
- User with `pet-owner` → subject: "Dog-friendly events happening near you"
- User with `new-parent` → subject: "Events that work around the little one"
- User with `over-50s` → subject: "What's on in Sydney this week — picked for you"

These subject line variants only fire when the user has the corresponding tag AND the tag is non-sensitive. Default subject lines apply otherwise.

### 10.8 Post-event feedback loop

Post-event feedback writes to `event_feedback(sentiment, reason)`. When a user with `new-parent` consistently marks wellness events positively and large-group social events negatively, the matching algorithm learns this pattern and adjusts their scoring — even without them explicitly updating tags. Life tags + feedback together create a continuously improving personal model.

---

## 11. What Users Know About Life Tags

Users know they exist in the abstract (the quiz tells them it personalises their experience) but they never see their own tag list. This is intentional.

**What the quiz tells users:**
> "Your answers help us find events and people that match where you're at in life. We don't show your answers to anyone — they just make your suggestions better."

**What the settings page tells users:**
Under Privacy:
> "Click uses information from your quiz to improve your suggestions. This information is never shown to other users — except that people in the same community as you may see that they're not the only one at an event, never who."
> [Retake quiz →] [Delete my quiz data →]

**Users can change their answers anytime — this is a first-class, encouraged action, not a buried one.** Retaking the quiz (or editing a single section) re-runs the tag mapping: tags whose triggering answer is no longer selected are removed, new answers add new tags, and mood tags reset their 30-day clock. Life circumstances change — someone stops being "new to town," a grief tag should be retired early if they're ready — and the user must always be able to update without friction. The quiz is editable section-by-section (not only a full retake) so changing one answer (e.g. removing an identity tag they no longer wish to carry) is a two-tap action. Removing an identity tag immediately stops them seeing/contributing to that tag's belonging signal.

Deleting quiz data: sets all `profile_life_tags` rows to deleted (soft delete), clears `personality_profiles`. User's suggestions revert to interest-tag-only until they retake the quiz.

---

---

## 8. Privacy Principles — Summary

| Principle | Implementation |
|---|---|
| User never sees their own life tags | RLS blocks all SELECT on `profile_life_tags` except admin |
| Sensitive tags never appear in FOMO copy | `is_sensitive = true` filter in all FOMO queries |
| Temporary mood tags expire automatically | `expires_at` + nightly cron delete |
| Admin overrides are logged | `admin_audit_log` entry required for any manual life tag change |
| Tags never attributed to individuals in UI | FOMO copy uses aggregate counts only, never user IDs or names |
| Dating preference data siloed | `dating_intent`, `wants_children` etc. only used in dating-mode matching; never shown in profiles |
| LGBTQ+ tag used for matching and event targeting only | Never surfaces in FOMO, never visible to other users, never shown on profile |
| Shared-only reveal (mutual click) | `get_shared_life_tags()` returns only NON-sensitive tags BOTH users hold, only after a mutual, max 2, belonging-framed. Sensitive/mood/age-exact never revealed. You can only see a tag you already share. |
| Accessibility/sober matched via event attributes, not labels | Private need (life tag) paired with public event attribute (`events.accessibility`, `is_alcohol_free`); the need is never exposed |
| Exact age never shown | Snapshot shows age BAND ("in their 30s"); integer is matching-only |
| Identity belonging FOMO | Only a viewer who SHARES the identity tag sees it; ≥4 others (excl. viewer); never a number or name. §4.4a |
| Functional tags never FOMO'd | Accessibility/sober-curious: zero FOMO; event-attribute matching only (§4.4b). The former vulnerable class (bereaved/carer/isolated/etc.) was removed entirely — §0a. |
| Quiz fully editable anytime | Section-by-section edit or full retake; removing a tag stops its belonging signal immediately |

---

## 9. Seed Data — Life Tags at Launch

The following tags should be seeded before pilot launch (expanded June 2026 for fuller life-circumstance coverage — see §3 groups for sensitivity flags).

```sql
-- Life Stage (11 — carer + recently-bereaved REMOVED June 2026, see §0a)
INSERT INTO life_tags (slug, label, group_slug, group_label, is_sensitive) VALUES
  ('new-parent',         'New Parent',            'life-stage', 'Life Stage', false),
  ('student',            'Student',               'life-stage', 'Life Stage', false),
  ('new-to-town',        'New to Sydney',         'life-stage', 'Life Stage', false),
  ('recently-single',    'Recently Single',       'life-stage', 'Life Stage', false),
  ('retired',            'Retired',               'life-stage', 'Life Stage', false),
  ('in-transition',      'Life in Transition',    'life-stage', 'Life Stage', false),
  ('empty-nester',       'Empty Nester',          'life-stage', 'Life Stage', false),
  ('career-pivot',       'Career Change',         'life-stage', 'Life Stage', false),
  ('single-parent',      'Single Parent',         'life-stage', 'Life Stage', false),
  ('returning-to-social','Easing Back In',        'life-stage', 'Life Stage', false),
  ('veteran',            'Veteran',               'life-stage', 'Life Stage', true);
  -- is_sensitive=true: veteran is promoted to sensitivity_class='identity' below.
  -- Every identity tag MUST have is_sensitive=true (consistency guard at end of file).

-- Identity (10)
INSERT INTO life_tags (slug, label, group_slug, group_label, is_sensitive) VALUES
  ('lgbtq-plus',         'LGBTQ+',                'identity', 'Identity', true),
  ('pet-owner',          'Pet Owner',             'identity', 'Identity', false),
  ('living-alone',       'Living Alone',          'identity', 'Identity', false),
  ('traveller',          'Frequent Traveller',    'identity', 'Identity', false),
  ('expat',              'Expat / New to AU',     'identity', 'Identity', false),
  ('neurodivergent',        'Neurodivergent',          'identity', 'Identity', true),
  ('has-accessibility-needs','Accessibility Needs',    'identity', 'Identity', true),
  ('culturally-diverse',    'Multicultural Background', 'identity', 'Identity', true),
  ('person-of-faith',       'Person of Faith',         'identity', 'Identity', true),
  ('sober-curious',         'Sober / Sober-Curious',   'identity', 'Identity', false);

-- Age Cohort (3)
INSERT INTO life_tags (slug, label, group_slug, group_label, is_sensitive) VALUES
  ('twenty-something',   'In My 20s',             'age-cohort', 'Age Cohort', false),
  ('thirty-something',   'In My 30s',             'age-cohort', 'Age Cohort', false),
  ('over-50s',           'Over 50s',              'age-cohort', 'Age Cohort', false);

-- Lifestyle Orientation (10)
INSERT INTO life_tags (slug, label, group_slug, group_label, is_sensitive) VALUES
  ('fitness-focused',    'Fitness-Focused',       'lifestyle', 'Lifestyle', false),
  ('wellness-focused',   'Wellness-Focused',      'lifestyle', 'Lifestyle', false),
  ('creative-type',      'Creative Type',         'lifestyle', 'Lifestyle', false),
  ('foodie',             'Food & Drink Lover',    'lifestyle', 'Lifestyle', false),
  ('festival-goer',      'Festival Goer',         'lifestyle', 'Lifestyle', false),
  ('outdoors-person',    'Outdoors Person',       'lifestyle', 'Lifestyle', false),
  ('homebody',           'Homebody',              'lifestyle', 'Lifestyle', false),
  ('social-butterfly',   'Social Butterfly',      'lifestyle', 'Lifestyle', false),
  ('professional-networker', 'Active Networker',  'lifestyle', 'Lifestyle', false),
  ('arts-culture',       'Arts & Culture Lover',  'lifestyle', 'Lifestyle', false);

-- Event Preference / Temporary (3 — the 4 fragile-state tags rebuilding-confidence,
-- feeling-isolated, nervous-but-willing, needs-familiarity were REMOVED June 2026, see §0a.
-- What remains are plain, non-sensitive preferences — same character as an interest.)
INSERT INTO life_tags (slug, label, group_slug, group_label, is_sensitive) VALUES
  ('needs-structure',       'Prefers Structured Events','mood', 'Mood', false),
  ('prefers-small-group',   'Prefers Small Groups',    'mood', 'Mood', false),
  ('expanding-circle',      'Looking to Expand Circle','mood', 'Mood', false);

-- Set sensitivity_class (June 2026). Default is 'public'; override the non-public tiers:
UPDATE life_tags SET sensitivity_class = 'identity'
  WHERE slug IN ('lgbtq-plus','culturally-diverse','person-of-faith','neurodivergent','veteran');
-- 'functional' = private need paired to a public event attribute (§4.2a). Sensitive (never
-- displayed about the person) but NOT a belonging signal and NOT fragile-state; drives
-- event-attribute matching only.
UPDATE life_tags SET sensitivity_class = 'functional', is_sensitive = true
  WHERE slug IN ('has-accessibility-needs','sober-curious');
-- NOTE: no 'vulnerable' UPDATE — the fragile-state tags were removed (§0a). The enum value
-- still exists (reserved) but no row carries it.
-- 'veteran' is promoted to identity-sensitive for the belonging signal (community pride),
--   though it carries low outing-risk; keep is_sensitive=true so it's never cross-audience FOMO.
-- 'has-accessibility-needs' / 'sober-curious' are 'functional' (never a belonging signal):
--   they drive event-attribute matching (§4.2a) and are never surfaced about the person.

-- Consistency guard (run after seeding):
-- SELECT slug FROM life_tags WHERE sensitivity_class IN ('identity','functional') AND is_sensitive = false;
-- (must return zero rows — every identity and functional tag must be is_sensitive=true)
-- ('vulnerable' is intentionally not checked: it is reserved/unused, no row carries it — §0a)
```
