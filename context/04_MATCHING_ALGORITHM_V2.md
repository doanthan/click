# Click — Matching Algorithm v2 Specification

> **Audience:** Engineering team implementing the matching engine.
> **Goal:** Replace the static linear-weighted classifier with a learnable, cohort-aware system that has a coherent cold-start path and a real evaluation loop.
> **Status:** Production spec. The handover doc identified six structural problems with v1; this spec addresses each.
> **Last revised:** May 2026

---

## 0. Why v1 is wrong

For the engineers picking this up: the current implementation in `src/hooks/matching/use-matching-algorithm.ts` is a hand-tuned linear combination. Specifically:

| User↔User dimension | v1 weight |
|---|---|
| Interests | 30% |
| Personality (Click Persona) | 25% |
| Life tags | 20% |
| Event vibe preferences | 15% |
| Attendance history overlap | 10% |

These are three problems wearing one hat:

1. **The weights are uniform across users.** A new-to-Sydney user matches on different signals than a long-term resident. A dating-mode user weights age and relationship_type more than a friendship-mode user does. One weight set can't fit all.

2. **The features are too coarse.** `interests = ['yoga']` lumps vinyasa power, hot yoga, and yin restorative into one signal. They predict very different lifestyles. We need sub-tags derived from *what events users actually RSVP to*, not just what they tick at signup.

3. **"Click Persona" isn't predictive.** MBTI-style typology has been shown not to predict relationship outcomes. Keep it as a UI nice-to-have if users like it, but it's noise in a matching score.

v2 fixes these. It's still tractable — not a deep neural net — but it's a *learnable* model with per-cohort weights, and a feature store that grows richer with usage.

---

## 1. Feature engineering

Three categories of features. All stored in a `user_features` materialised table refreshed by background jobs.

### 1.1 Declared features (from onboarding + quiz)

| Feature | Source | Type |
|---|---|---|
| `interest_tag_ids` | `profiles.interest_tag_ids` | array of FK |
| `life_tags` | `personality_profiles.life_tags` | array of slugs |
| `social_energy` | `personality_profiles.social_energy` | enum |
| `availability` | `personality_profiles.availability` | array of slugs |
| `event_vibe_prefs` | `personality_profiles.event_vibe_prefs` | array of slugs |
| `distance_willingness_km` | `personality_profiles.distance_willingness_km` | int |
| `postcode` | `profiles.postcode` | text |
| `intents` | `profiles.intents` | array (dating/friendship/networking/exploring) |
| `dating_age_min`, `dating_age_max`, `dating_interested_in` | `profiles.dating_*` | per §1.1.1 |
| `current_mood` | `personality_profiles.current_mood` | enum (expires after 7 days) |

#### 1.1.1 Dating sub-features

Only computed if `'dating' = ANY(intents)`. Used only for user↔user pair scoring where both users are dating-mode.

### 1.2 Behavioural features (derived from activity)

These are the features that v1 was missing.

| Feature | Source | Update cadence |
|---|---|---|
| `behavioural_sub_tags` | derived from `event_bookings` joined to `events.interest_tag_ids` | nightly batch |
| `attendance_count` | count of `event_bookings WHERE status='confirmed' AND checked_in_at IS NOT NULL` | nightly batch |
| `rsvp_count` | count of `event_bookings WHERE status='confirmed'` | nightly batch |
| `cancellation_rate` | cancelled / confirmed bookings | nightly batch |
| `attended_with_user_ids` | array of user_ids the user has been at the same event as | nightly batch |
| `clicks_made_count` | count of `clicks WHERE clicker_id = user` | nightly batch |
| `clicks_received_count` | count of `clicks WHERE clicked_id = user` | nightly batch |
| `mutual_click_count` | count of mutual clicks user is in | nightly batch |
| `last_active_at` | most recent `events_log` entry | every 5m |
| `event_categories_attended` | distinct primary_category across attended events | nightly batch |
| `event_vibe_realised` | distinct vibe across attended events (vs prefs) | nightly batch |
| `time_of_day_preference` | histogram of start_hour across attended events | weekly batch |
| `cohort_id` | computed (see §2) | weekly batch |

### 1.3 Sub-tag derivation

A user RSVPs to "Hot Vinyasa at Yoga Studio X." The event has `interest_tag_ids = [yoga_id]` (parent tag). But the event title/description text contains "vinyasa" and "hot." Sub-tags are derived as:

1. **Sub-tag taxonomy** lives in code as a dict per parent tag. Example for `yoga`:
   ```ts
   const SUB_TAG_PATTERNS: Record<string, SubTagPattern[]> = {
     yoga: [
       { sub_tag: 'yoga_vinyasa', patterns: [/vinyasa/i, /flow yoga/i] },
       { sub_tag: 'yoga_hot', patterns: [/hot yoga/i, /bikram/i] },
       { sub_tag: 'yoga_yin', patterns: [/yin yoga/i, /restorative/i] },
       { sub_tag: 'yoga_power', patterns: [/power yoga/i, /ashtanga/i] },
     ],
     wine: [
       { sub_tag: 'wine_natural', patterns: [/natural wine/i, /low-?intervention/i] },
       { sub_tag: 'wine_tasting_event', patterns: [/wine tasting/i, /flight/i] },
       { sub_tag: 'wine_bar', patterns: [/wine bar/i] },
     ],
     // ...
   };
   ```

2. **Event sub-tag tagging** happens at event publish:
   ```sql
   ALTER TABLE events ADD COLUMN sub_tags text[] DEFAULT '{}';
   CREATE INDEX idx_events_sub_tags ON events USING GIN(sub_tags);
   ```
   Edge function `derive-event-sub-tags` runs on publish, matches title+description against patterns for each interest_tag in the event, writes to `events.sub_tags`.

3. **User sub-tag accumulation** is the behavioural signal:
   ```sql
   -- user_features.behavioural_sub_tags maps sub_tag → count
   -- e.g. {'yoga_hot': 4, 'yoga_vinyasa': 2, 'wine_natural': 1}

   -- Nightly job:
   WITH user_subtags AS (
     SELECT eb.user_id, e.sub_tags
     FROM event_bookings eb
     JOIN events e ON e.id = eb.event_id
     WHERE eb.checked_in_at IS NOT NULL  -- attendance, not just RSVP
   ),
   exploded AS (
     SELECT user_id, unnest(sub_tags) AS sub_tag FROM user_subtags
   )
   UPDATE user_features uf
   SET behavioural_sub_tags = sub.counts
   FROM (
     SELECT user_id, jsonb_object_agg(sub_tag, cnt) AS counts
     FROM (SELECT user_id, sub_tag, COUNT(*) AS cnt FROM exploded GROUP BY user_id, sub_tag) t
     GROUP BY user_id
   ) sub
   WHERE uf.user_id = sub.user_id;
   ```

Sub-tags are *additive* — they don't replace interest tags, they refine them. Two users both tagged "yoga" but with `yoga_hot: 6` and `yoga_yin: 5` respectively will have low sub-tag overlap and the model will weight that down accordingly.

### 1.4 user_features table

```sql
CREATE TABLE public.user_features (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Declared (denormalised for fast read; refreshed when source changes)
  interest_tag_ids uuid[] NOT NULL DEFAULT '{}',
  life_tags text[] NOT NULL DEFAULT '{}',
  social_energy text,
  availability text[] NOT NULL DEFAULT '{}',
  event_vibe_prefs text[] NOT NULL DEFAULT '{}',
  distance_willingness_km int DEFAULT 10,
  postcode text,
  intents text[] NOT NULL DEFAULT '{}',
  dating_age_min int,
  dating_age_max int,
  dating_interested_in text[],
  current_mood text,
  age int,  -- computed from DOB

  -- Behavioural
  behavioural_sub_tags jsonb DEFAULT '{}'::jsonb,
  attendance_count int DEFAULT 0,
  rsvp_count int DEFAULT 0,
  cancellation_rate numeric(4,3) DEFAULT 0,
  attended_with_user_ids uuid[] DEFAULT '{}',
  clicks_made_count int DEFAULT 0,
  clicks_received_count int DEFAULT 0,
  mutual_click_count int DEFAULT 0,
  last_active_at timestamptz,
  event_categories_attended text[] DEFAULT '{}',
  event_vibe_realised text[] DEFAULT '{}',
  time_of_day_histogram jsonb DEFAULT '{}'::jsonb,

  -- Meta
  cohort_id text,
  features_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_features_cohort ON public.user_features(cohort_id);
CREATE INDEX idx_user_features_active ON public.user_features(last_active_at DESC);
CREATE INDEX idx_user_features_interests ON public.user_features USING GIN(interest_tag_ids);
CREATE INDEX idx_user_features_subtags ON public.user_features USING GIN(behavioural_sub_tags);

ALTER TABLE public.user_features ENABLE ROW LEVEL SECURITY;

-- Users don't read this directly. Matching surfaces serve sanitised candidate lists.
CREATE POLICY "service role only"
  ON public.user_features FOR ALL
  USING (false)
  WITH CHECK (false);
-- All access via SECURITY DEFINER functions in the matching engine.
```

### 1.5 Feature update triggers

To keep `user_features` fresh:

```sql
-- When profile changes, sync declared features
CREATE OR REPLACE FUNCTION sync_user_features_from_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_features (user_id, interest_tag_ids, postcode, intents, age, ...)
  VALUES (NEW.id, NEW.interest_tag_ids, NEW.postcode, NEW.intents,
          EXTRACT(YEAR FROM age(NEW.date_of_birth))::int, ...)
  ON CONFLICT (user_id) DO UPDATE SET
    interest_tag_ids = EXCLUDED.interest_tag_ids,
    postcode = EXCLUDED.postcode,
    intents = EXCLUDED.intents,
    age = EXCLUDED.age,
    features_updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_update_sync_features
AFTER INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_user_features_from_profile();
```

Similar trigger for `personality_profiles`. Behavioural features update via nightly cron, not triggers — too expensive to recompute synchronously on every booking.

---

## 2. Cohort segmentation

Different cohorts have different predictive features. We learn per-cohort weights.

### 2.1 Cohort definition

A user belongs to **one** cohort, assigned weekly. Cohorts are intentionally simple — too many fragments the training data.

```ts
function assignCohort(user: UserFeatures): string {
  // Intent-first; dating users want different things than networking
  if (user.intents.includes('dating')) {
    if (user.age >= 38) return 'dating_38plus';
    return 'dating_under_38';
  }

  // Recency-of-arrival matters: new-to-Sydney users are exploring, locals are habitual
  if (user.life_tags.includes('new_to_town')) return 'new_to_sydney';

  // Activity level matters: low-activity users get scored against a different baseline
  if (user.attendance_count >= 3) return 'active_local';
  if (user.attendance_count >= 1) return 'engaged_local';

  return 'new_local';  // signed up, hasn't attended yet
}
```

Six cohorts to start:
- `dating_under_38`
- `dating_38plus`
- `new_to_sydney`
- `active_local`
- `engaged_local`
- `new_local`

A user is "in" exactly one cohort at a time. Cohort assignment recomputes weekly. Some users will flip cohorts over time (e.g. `new_local` → `engaged_local` after their first RSVP), which is expected.

### 2.2 Why these cohorts

- **Intent** is the single biggest splitter — dating signals (age range, gender preferences, kids) are irrelevant noise for friendship users.
- **New-to-Sydney** users have no behavioural data yet but have a strong "find anyone, anywhere" affinity. They should be matched primarily on declared interest overlap, with low weight on history-overlap.
- **Active vs new locals** differ in how much we trust behavioural features. For new users, declared features dominate by necessity.

Adding more cohorts (e.g. lifestyle subsegments) is a later move once training data supports it. Don't fragment to single-digit-per-cohort populations.

### 2.3 cohort_weights table

```sql
CREATE TABLE public.cohort_weights (
  cohort_id text NOT NULL,
  feature_name text NOT NULL,
  weight numeric NOT NULL,
  trained_at timestamptz NOT NULL,
  training_data_size int NOT NULL,
  PRIMARY KEY (cohort_id, feature_name, trained_at)
);

CREATE INDEX idx_cohort_weights_latest
  ON public.cohort_weights(cohort_id, trained_at DESC);

-- Query latest weights for a cohort:
SELECT DISTINCT ON (feature_name) feature_name, weight
FROM cohort_weights
WHERE cohort_id = $cohort_id
ORDER BY feature_name, trained_at DESC;
```

Versioned so we never overwrite — model rollback is `SELECT...WHERE trained_at < $rollback_date`.

---

## 3. Scoring

### 3.1 User↔User pair score

Per pair (user_a, user_b), compute a feature vector:

```ts
function buildPairFeatures(a: UserFeatures, b: UserFeatures): PairFeatures {
  return {
    interest_overlap: jaccard(a.interest_tag_ids, b.interest_tag_ids),
    sub_tag_overlap: weightedSubTagOverlap(a.behavioural_sub_tags, b.behavioural_sub_tags),
    life_tag_overlap: jaccard(a.life_tags, b.life_tags),
    vibe_pref_overlap: jaccard(a.event_vibe_prefs, b.event_vibe_prefs),
    availability_overlap: jaccard(a.availability, b.availability),
    distance_km: haversine(a.postcode_geo, b.postcode_geo),
    distance_within_willingness: Math.min(a.distance_willingness_km, b.distance_willingness_km) >= distance_km ? 1 : 0,
    attended_same_events: a.attended_with_user_ids.includes(b.user_id) ? 1 : 0,
    energy_match: socialEnergyCompatibility(a.social_energy, b.social_energy),
    age_diff: Math.abs(a.age - b.age),
    age_within_dating_range: (a.intents.includes('dating') && b.intents.includes('dating'))
      ? (b.age >= a.dating_age_min && b.age <= a.dating_age_max &&
         a.age >= b.dating_age_min && a.age <= b.dating_age_max ? 1 : 0)
      : null,
    intent_overlap: jaccard(a.intents.filter(notExploring), b.intents.filter(notExploring)),
  };
}
```

Then score via logistic regression with cohort-specific weights:

```ts
function scorePair(a: UserFeatures, b: UserFeatures): number {
  const features = buildPairFeatures(a, b);
  const cohort = a.cohort_id;  // viewer's cohort drives the weights
  const weights = getLatestWeights(cohort);

  const logit = weights.intercept +
    Object.entries(features).reduce((acc, [k, v]) => {
      if (v === null) return acc;
      return acc + (weights[k] ?? 0) * v;
    }, 0);

  return sigmoid(logit) * 100;  // 0..100
}
```

### 3.2 User↔Event score

Same shape, different feature set:

```ts
function buildUserEventFeatures(user: UserFeatures, event: EventFeatures): UserEventFeatures {
  return {
    interest_match: jaccard(user.interest_tag_ids, event.interest_tag_ids),
    sub_tag_match: subTagMatch(user.behavioural_sub_tags, event.sub_tags),
    life_tag_target_match: jaccard(user.life_tags, event.life_tag_targets),
    vibe_match: user.event_vibe_prefs.includes(event.vibe) ? 1 : 0,
    distance_km: haversine(user.postcode_geo, event.lat_lng),
    distance_within_willingness: user.distance_willingness_km >= distance_km ? 1 : 0,
    time_of_day_fit: timeOfDayFit(user.time_of_day_histogram, event.start_time.hour),
    availability_fit: availabilityFit(user.availability, event.start_time),  // weeknight vs weekend
    category_history: user.event_categories_attended.includes(event.primary_category) ? 1 : 0,
    price_fit: priceFit(user.attendance_history, event.price_cents),  // user's typical price range
    has_existing_interest_in_merchant: user.attended_with_user_ids ? merchantOverlap(user, event.merchant_id) : 0,
  };
}
```

Same logistic regression apply, with `user.cohort_id` selecting weights.

### 3.3 Why logistic regression and not something fancier

- **Interpretable** — investor diligence will ask. "We weight X heavier for new-to-Sydney users because that's what predicts mutual clicks in that cohort" is a real answer. "Our 12-layer transformer learns embeddings" gets you laughed out of the room at this scale.
- **Tractable at our data volume** — we have hundreds of users per cohort in Phase 0, not millions. Linear models work fine and don't overfit.
- **Easy to inspect failures** — when a bad match happens you can read the feature contributions.
- **Trains fast** — minutes, not hours, on our data.

If at 100k+ users per cohort we want to upgrade, gradient boosted trees (xgboost/lightgbm) are the obvious next step. Not now.

---

## 4. Cold-start

Pre-launch, there's no behavioural data. Training a model needs labels. So Phase 0 ships with hand-curated weights derived as follows.

### 4.1 Phase 0 (Month 0–2, first ~500 users)

**Human-curated prior with community manager.**

The community manager (or founder, in earliest weeks) reviews candidate pairs daily in a lightweight admin UI:

```
[ User A — Sarah, 28, dating, yoga + wine, Surry Hills ]
[ User B — Mia, 30, dating, yoga + pottery, Newtown ]

Predicted score: 67
Would you introduce these two? [ Yes, strong fit ] [ Maybe ] [ No ]
Why?: _______________________________________________

Submit
```

These judgments are stored:

```sql
CREATE TABLE public.curated_match_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id),
  user_b uuid NOT NULL REFERENCES auth.users(id),
  judgment text NOT NULL CHECK (judgment IN ('strong_fit', 'maybe', 'not_a_fit')),
  reason text,
  labeler_id uuid NOT NULL REFERENCES auth.users(id),
  features_snapshot jsonb NOT NULL,  -- capture features AT TIME of labeling
  created_at timestamptz NOT NULL DEFAULT now()
);
```

The community manager labels ~30 pairs per day → 200/week → 800/month. Combined with observed mutual click rates as a noisy signal, this is enough to fit cohort weights by end of Month 2.

### 4.2 Why human-curated and not "popular events for everyone"

Falling back to popular events skips the matching problem entirely. That defeats Click's value prop. The hand-curated prior keeps matching *active* even at zero data — it just routes through human judgment instead of a model. Users see well-matched candidates from day one. The model learns from human judgment + early mutual click data, then phases the human out around Month 2.

If we punted with "popular events," users would correctly conclude the platform isn't matching them at all, and the early reviews would say so.

### 4.3 Transition (Month 2–3)

Once we have ≥ 50 mutual clicks per cohort and ≥ 50 curated labels per cohort, fit cohort weights:

```python
# Pseudocode for monthly batch job (Python in edge function or external worker)
for cohort_id in cohorts:
    # Positive examples: pairs that mutual-clicked within 30 days
    # Negative examples: pairs shown (in match_impressions) but didn't mutual-click
    # Plus: curated labels as additional positives/negatives

    X, y = load_training_data(cohort_id)

    model = LogisticRegression(penalty='l2', C=1.0, max_iter=1000)
    model.fit(X, y)

    # Cross-validate, log AUC, log calibration
    auc = cross_val_score(model, X, y, cv=5, scoring='roc_auc').mean()
    log_metric('matching_auc', auc, cohort_id=cohort_id)

    # Reject if AUC < 0.60 — too weak, keep previous weights
    if auc < 0.60:
        alert_engineering('cohort_weights_auc_too_low', cohort_id, auc)
        continue

    # Write new weights as a new versioned row
    for feature, weight in zip(feature_names, model.coef_[0]):
        insert_cohort_weight(cohort_id, feature, weight, training_data_size=len(y))
    insert_cohort_weight(cohort_id, 'intercept', model.intercept_[0], len(y))
```

### 4.4 Steady state (Month 3+)

Weights retrain monthly. If a cohort's AUC degrades > 0.05 between trainings, alert. If new cohort labels diverge significantly from model predictions, that's the signal to add a cohort split.

---

## 5. Candidate generation & scoring strategy

You cannot score all N² user pairs. With 10k users that's 50M pairs per refresh; at 100k users it's 5B. Need cheap candidate generation, then expensive scoring on candidates only.

### 5.1 User↔User candidate generation

For each user, candidate set is generated daily by:

```sql
-- Pre-filter: hard constraints first (these are cheap)
WITH viewer AS (SELECT * FROM user_features WHERE user_id = $viewer_id),
candidates AS (
  SELECT uf.*
  FROM user_features uf, viewer v
  WHERE uf.user_id != v.user_id
    AND uf.last_active_at > now() - interval '30 days'
    AND uf.intents && v.intents  -- at least one shared intent
    AND (
      -- Geo prefilter using postcode lookup table (PostGIS or simple range)
      uf.postcode = ANY(v.nearby_postcodes)
    )
    AND (
      -- At least one shared interest tag (cheap GIN index lookup)
      uf.interest_tag_ids && v.interest_tag_ids
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks
      WHERE (blocker_id = v.user_id AND blocked_id = uf.user_id)
         OR (blocker_id = uf.user_id AND blocked_id = v.user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM match_impressions
      WHERE viewer_id = v.user_id AND shown_user_id = uf.user_id
        AND created_at > now() - interval '14 days'
    )
)
SELECT * FROM candidates LIMIT 200;
```

200 candidates per user. Score all 200 with the logistic model. Pick top 3 to show.

For dating intent, additional hard filter on age range / interested_in_gender symmetry.

### 5.2 User↔Event candidate generation

Tighter constraints — events have a natural pool size (the events table itself):

```sql
SELECT *
FROM events
WHERE status = 'published'
  AND start_time > now() + interval '2 hours'
  AND start_time < now() + interval '60 days'
  AND interest_tag_ids && $user.interest_tag_ids  -- at least one shared tag
  -- distance filter via PostGIS or coarse postcode match
ORDER BY start_time
LIMIT 100;
```

Score all 100. Top 6 surface to dashboard.

### 5.3 Materialised views for serving

Refresh cycles:

| View | Source | Refresh |
|---|---|---|
| `match_candidates_user_user` | scored top-30 candidates per user | every 4h |
| `match_candidates_user_event` | scored top-20 events per user | every 30m |
| `event_radar` | trending events with tag-density aggregates | every 30m |

`match_candidates_user_user`:

```sql
CREATE MATERIALIZED VIEW public.match_candidates_user_user AS
SELECT
  viewer_id,
  candidate_id,
  score,
  ROW_NUMBER() OVER (PARTITION BY viewer_id ORDER BY score DESC) AS rank,
  now() AS computed_at
FROM (
  SELECT
    viewer_id,
    candidate_id,
    score_user_user(viewer_features, candidate_features) AS score
  FROM candidate_pairs_generated_today
) ranked
WHERE rank <= 30;

CREATE UNIQUE INDEX ON match_candidates_user_user (viewer_id, candidate_id);
CREATE INDEX ON match_candidates_user_user (viewer_id, rank);
```

Refreshed by edge function `refresh-match-candidates` on a 4h cron. `REFRESH MATERIALIZED VIEW CONCURRENTLY` so dashboard doesn't see empty results during refresh.

### 5.4 Cache invalidation

When does a user's matches need to refresh outside the cron cycle?

- They update their interest tags → triggers refresh for them
- They take/retake the Life Quiz → triggers refresh for them
- A tag merge happens (admin op) → triggers refresh for all affected users
- New events publish in their area → next 30m cycle picks it up

Implementation: a `user_features_dirty` table. Triggers add rows. Refresh job processes dirty users first, then batches the rest:

```sql
CREATE TABLE public.user_features_dirty (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  marked_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger on profiles update:
INSERT INTO user_features_dirty (user_id, reason)
VALUES (NEW.id, 'profile_changed')
ON CONFLICT (user_id) DO UPDATE SET marked_at = now();
```

The refresh job processes dirty rows first, then handles the regular cron load.

---

## 6. Online vs batch

| Operation | Mode |
|---|---|
| Score one pair at viewing time | Read pre-computed score from `match_candidates_user_user` (fast SELECT) |
| Score all candidate pairs for a user | Batch, 4h cron |
| Update declared features | Trigger, real-time |
| Update behavioural features | Batch, nightly |
| Recompute cohort assignment | Batch, weekly |
| Train cohort weights | Batch, monthly |

**Nothing expensive runs at query time.** The dashboard reads pre-computed rows. Even mutual-click shared-event selection (§7.2 of `01_USER_WORKFLOW.md`) uses the cached `match_candidates_user_event` — no live scoring.

### 6.1 Why not real-time scoring?

Real-time scoring sounds nice, but:
- Logistic-regression scoring is fast individually (sub-ms), but candidate generation isn't
- Batch lets us amortise the cost across users and serve cached results fast
- A 4h refresh is invisible to users (most don't return more than 4h apart) and keeps the matching surface feeling intentional, not over-eager

If we ever want sub-4h freshness for high-engagement users, add a "warm-cache-on-login" pattern: trigger a refresh of that user's matches at login time, async. Don't block on it.

---

## 7. Evaluation

How do we know matching is improving? Three loops, three timescales.

### 7.1 Online metrics (live dashboards)

Tracked weekly in the admin analytics dashboard (per `03_ADMIN_WORKFLOW.md` §8):

| Metric | Definition | Direction |
|---|---|---|
| Mutual-click rate | mutual_clicks / clicks_made | up is good |
| Click-through on suggestions | clicks_made / match_impressions | up is good |
| Proposal acceptance rate | proposals_accepted / proposals_sent | up is good |
| Suggestion → RSVP rate | RSVPs from suggested-event impressions / impressions | up is good |
| Second-event attendance rate | users with ≥ 2 attended events / users with ≥ 1 | up is good |

Each metric tracked **per cohort**. A single global number hides cohort-specific regressions.

### 7.2 Offline evaluation (each model retrain)

When monthly retraining runs, log:

- **AUC-ROC** on holdout (5-fold CV)
- **Precision@10** — of the top-10 predicted matches, how many actually mutual-clicked within 30 days
- **Calibration** — Brier score and reliability diagram
- **Feature importance** — which features moved most

Reject a new model if AUC drops by > 0.03 from previous. Alert if a feature's weight flips sign unexpectedly.

### 7.3 A/B testing harness (Phase 1+, not Phase 0)

```sql
CREATE TABLE public.match_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  variant_a_model_version text,
  variant_b_model_version text,
  traffic_split numeric DEFAULT 0.5,
  started_at timestamptz,
  ended_at timestamptz,
  primary_metric text,
  result jsonb
);
```

User-cohort hashed into A/B bucket. Two model versions serve. Compare metrics over 4 weeks. Roll out winner.

Don't build this until you have one fitted model in production and it's working. Phase 0 has one model. Don't over-engineer.

### 7.4 Honest tradeoffs

- **Cold-start is genuinely hard.** The human-curated phase is not a "scrappy MVP hack" — it's the *only* way to bootstrap a matching model without behavioural data. Don't oversell it. Treat the labelling as a serious ops investment.
- **Per-cohort weights can overfit at low N.** L2 regularization helps. Reject models below AUC 0.60. Until a cohort has 200+ labelled examples (mutual clicks + curated), use the parent cohort's weights as a prior.
- **Sub-tag derivation depends on event title/description quality.** Junk events produce junk sub-tags. Merchant event-creation UX matters here — fixed title field hints, description length minimums, the lot.

---

## 8. The data flywheel — Series A talking point

What an investor's technical diligence partner needs to hear:

1. **Per-cohort learned weights, not hand-tuned.** "We learn what predicts mutual clicks for new-to-Sydney users separately from what predicts them for dating-mode users in their 30s."
2. **Behavioural sub-tags that refine declared interests.** "We don't just know you like yoga — we know you've RSVPed to hot yoga events but not yin yoga events. We match that."
3. **Closed-loop training data.** Every mutual click is a training label. Every proposal accept/decline is a training label. Every "did you click with anyone at the event?" feedback is a training label. The flywheel improves every cohort retrain.
4. **Defensibility = local geographic concentration of behavioural data.** A Sydney-inner-ring merchant ecosystem with thousands of attended events produces match quality no horizontal competitor can match without first replicating the event ecosystem itself.

**What it specifically is NOT:**
- An AI moat in the model architecture (logistic regression — nothing proprietary about the math)
- Network-effect-from-network-size (you're early)
- Switching costs (low; users could leave easily)

The moat *is* the geo-concentrated event-attendance graph. Be honest about which it is. That graph is more defensible than people give credit for, because rebuilding it requires merchant acquisition in the same suburbs at scale.

---

## 9. Removed from v1 / explicit non-features

- **Click Persona as a matching signal** — gone. UI label only, see `01_USER_WORKFLOW.md` §4.2.
- **Social media scraping** — gone, see `06_INFRASTRUCTURE_FIXES.md` §4. Behavioural sub-tags replace it.
- **Music tags as a primary signal** — kept as a low-weight feature only. Not a category-level signal.
- **Static linear weights** — gone, replaced with cohort-specific learned weights.

---

## 10. Phase 0 build order

1. `user_features` table + sync triggers from `profiles` and `personality_profiles`
2. Sub-tag taxonomy in code + `events.sub_tags` column + `derive-event-sub-tags` edge function
3. Cohort assignment function + weekly cron
4. Nightly behavioural feature update job
5. Candidate generation queries (user↔user and user↔event)
6. Scoring with hand-curated initial weights (no ML yet)
7. Materialised views + 4h / 30m refresh crons
8. Pull-on-focus refetch pattern on dashboard (per `01_USER_WORKFLOW.md` §5.2)
9. `match_impressions` table for impression tracking (anti-repeat + future ML labels)
10. Curated match labels UI + table for cold-start ops (community manager tool)
11. Logistic regression training pipeline (monthly cron)
12. Evaluation metrics dashboard

Items 1–9 are blocking for launch. 10 ships pre-launch but only used Month 0–2. 11–12 ship by end of Month 2.

---

## 11. What this spec does NOT cover

- **Real-time embedding-based matching** — not needed at our scale, not part of v2.
- **Multi-armed bandit for surfacing tradeoffs** — future work, Phase 2+.
- **Conversational/intent-detection matching** ("I want to meet someone for a Saturday morning run") — future work.
- **Group-of-users matching** (couples seeking other couples, friends-of-friends) — future work.
- **Cross-city matching** (when Melbourne launches) — separate cohort, separate weights, otherwise same model.

The goal of v2 is to ship a learnable, defensible matching system that fits the actual data Click will have in its first 12 months. Don't gold-plate.
