# Click — Retention & Engagement Spec
> New document. Covers weekly digest email, activity feed, re-engagement triggers, post-event loop, and no-chat copy framework. These are the mechanisms that bring users back after their first event.

---

## 0. Why This Document Exists

The booking flow gets a user to their first event. This document covers everything that happens after — the loops that make them come back, build identity on the platform, and eventually become the kind of engaged user who refers friends and buys a Click Plus subscription.

Without these loops, Click is a one-time event ticketing tool. With them, it's a social platform with compounding network effects.

---

## 1. The Retention Stack

Five mechanisms work together:

| Mechanism | Fires when | Goal |
|---|---|---|
| Post-event "you went" confirmation | 12h after event end | Close the loop; surface mutual clicks |
| Activity feed | Ongoing | Give users a sense of history and investment |
| Weekly digest email | Every Tuesday; users inactive 14+ days | Pull dormant users back with personalised events |
| Milestone notifications | On achievement | Reward engagement; create shareable moments |
| Quiz prompt | Day 7 or after first event | Improve match quality; deepen platform investment |

---

## 2. Post-Event Loop

### 2.1 Trigger
Edge fn: `post-event-prompt` — cron runs every hour checking:
```sql
SELECT eb.user_id, e.id as event_id, e.title, e.end_time
FROM event_bookings eb
JOIN events e ON e.id = eb.event_id
WHERE eb.status = 'confirmed'
  AND e.end_time BETWEEN now() - interval '13h' AND now() - interval '12h'
  AND NOT EXISTS (
    SELECT 1 FROM post_event_prompts_sent
    WHERE user_id = eb.user_id AND event_id = e.id
  )
```

On match: send prompt + insert `post_event_prompts_sent(user_id, event_id, sent_at)` to prevent duplicates.

### 2.2 In-App Prompt
Card appears at top of dashboard:
> "You went to **[Event Title]** last night 🎉  
> Did you Click with anyone there?"

Two responses:
- **"Yes, I clicked with someone"** → opens attendee picker (up to 5 people from confirmed list, first name + photo only)
- **"Just me this time"** → dismisses warmly; no negative framing

Both responses:
- Write to `user_activity(type='event_attended', payload={event_id, event_title, response})`
- Feed into persona recalculation queue if 5+ new RSVPs since last calc
- Dismiss the card

### 2.3 Post-Event Email
Subject: "How was [Event Title]? 🎉"

```
Body:
Hi [First Name],

You went to [Event Title] at [Venue] last night.
We hope you had a great time.

Did you Click with someone there?
[Yes, I clicked] [Not this time]

These buttons deep-link to /post-event/:event_id with response pre-filled.

---
Your next event could be even better.
[See what's on this week →]   ← deep links to /events?sort=suggested
```

**Tracking:** `event_bookings.post_event_responded = true` when user taps either button (email or in-app).

### 2.4 Post-Event Click Selection
```
User selects attendees they clicked with
  │
  ▼
INSERT post_event_clicks(from_user_id, to_user_id, event_id, created_at)
  │
  ▼
Trigger: detect_mutual_click() — same as real-time click flow
  Mutual → INSERT mutual_clicks → profile snapshot → proposal UI
```

### 2.5 Mutual Click Post-Event Confirmation
When two users attended an event *as a result of* a mutual click suggestion:
- Both receive: "You and [Name] went to [Event] together ✨"
- Writes to `user_activity` for both
- CTA: "See what's next for you two" → reopens proposal UI with new suggestions
- Implemented by checking: `mutual_click_suggestions.event_id = event_bookings.event_id` for both users

---

## 3. Activity Feed

### 3.1 What it is
A read-only chronological record of a user's journey on Click. Shown on `/dashboard` (last 5 items) and `/profile` (full history). Not social — other users don't see your feed. This is a personal record, not a public timeline.

### 3.2 Event types

| Type | Trigger | Copy |
|---|---|---|
| `event_booked` | `event_bookings` INSERT | "You booked [Event Title]" |
| `event_attended` | post-event prompt response | "You went to [Event Title] at [Venue]" |
| `mutual_click` | `mutual_clicks` INSERT | "You and [First Name] clicked ✨" |
| `event_together` | Both users attend mutual click event | "You and [First Name] went to [Event] together" |
| `quiz_completed` | `personality_profiles` INSERT/UPDATE | "You completed the Click Quiz — your matches just got better" |
| `first_booking` | First row in `event_bookings` | "You booked your first Click event 🎉" |
| `milestone_5` | 5th confirmed booking | "You've been to 5 Click events 🌟" |
| `milestone_10` | 10th confirmed booking | "10 events on Click — you're a regular ✨" |

### 3.3 DB schema
```sql
user_activity(
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id),
  type        text NOT NULL,
  payload     jsonb,          -- {event_id, event_title, other_user_id, other_user_name, etc.}
  created_at  timestamptz DEFAULT now()
)

CREATE INDEX user_activity_user_id_idx ON user_activity(user_id, created_at DESC);

-- RLS: user reads own rows only
CREATE POLICY "activity_self" ON user_activity
  FOR ALL USING (auth.uid() = user_id);
```

### 3.4 Triggers populating activity feed

```sql
-- On event booking confirmed:
CREATE OR REPLACE FUNCTION after_booking_confirmed() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO user_activity(user_id, type, payload)
      VALUES(NEW.user_id, 'event_booked',
        jsonb_build_object('event_id', NEW.event_id));

    -- First booking milestone:
    IF (SELECT COUNT(*) FROM event_bookings
        WHERE user_id = NEW.user_id AND status = 'confirmed') = 1 THEN
      INSERT INTO user_activity(user_id, type, payload)
        VALUES(NEW.user_id, 'first_booking', '{}'::jsonb);
    END IF;

    -- 5 and 10 event milestones:
    IF (SELECT COUNT(*) FROM event_bookings
        WHERE user_id = NEW.user_id AND status = 'confirmed') IN (5, 10) THEN
      INSERT INTO user_activity(user_id, type, payload)
        VALUES(NEW.user_id, 'milestone_' || (
          SELECT COUNT(*) FROM event_bookings
          WHERE user_id = NEW.user_id AND status = 'confirmed'
        ), '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- On mutual click:
CREATE OR REPLACE FUNCTION after_mutual_click() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_activity(user_id, type, payload)
    VALUES
      (NEW.user_a_id, 'mutual_click',
        jsonb_build_object('other_user_id', NEW.user_b_id)),
      (NEW.user_b_id, 'mutual_click',
        jsonb_build_object('other_user_id', NEW.user_a_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3.5 Dashboard display
Last 5 activity items shown in a compact strip below Upcoming Events. Each item: icon + copy + timestamp. "See your full story →" links to `/profile#activity`.

Empty state (new user):
> "Your Click story starts here. Book your first event to get started."
> [Browse events →]

---

## 4. Weekly Digest Email

### 4.1 Who receives it
- All users where `profiles.is_active = true`
- AND `notification_settings.weekly_digest = true` (default on)
- AND no confirmed booking in the last **14 days**

Users who are actively booking don't need the digest — it's a re-engagement tool for dormant users, not a newsletter for everyone.

### 4.2 Send schedule
Every **Tuesday at 8:00am AEST**. Cron edge fn: `send-weekly-digest`.

### 4.3 Content assembly
For each recipient:
```sql
-- Pull top 4 personalised events:
SELECT e.id, e.title, e.start_time, e.price, e.venue_suburb, ues.score
FROM user_event_scores ues
JOIN events e ON e.id = ues.event_id
WHERE ues.user_id = $1
  AND e.status = 'published'
  AND e.start_time > now()
  AND e.start_time < now() + interval '14 days'
  AND NOT EXISTS (SELECT 1 FROM event_bookings
    WHERE event_id = e.id AND user_id = $1)
ORDER BY ues.score DESC
LIMIT 4;

-- Pull 1 featured/editorial event (admin_featured = true):
SELECT e.id, e.title, e.start_time, e.price, e.venue_suburb
FROM events e
WHERE e.admin_featured = true
  AND e.status = 'published'
  AND e.start_time > now()
LIMIT 1;
```

If personalised events < 4 (cold start / no scores): supplement with trending events.

### 4.4 Subject line rotation
Rotate through subject line variants per user, testing open rates:

| Variant | Subject |
|---|---|
| A | "5 things happening in [suburb] this week" |
| B | "Your matches are going to these events" |
| C | "New near you — [Event Title] and 4 more" |
| D | "[First Name], these are this week's picks for you" |

Store which variant was sent in `email_sends(user_id, type, variant, sent_at, opened)`. After 500 sends per variant, compute open rate and weight toward best performer.

### 4.5 Email template structure
```
Subject: [variant]
From: hello@click.com.au
Reply-to: (none — do not accept replies to this address)

Hi [First Name],

[Heading: "This week in Sydney" or "Your matches are going to these"]

[Event Card 1]
[Event Title] · [Day] · [Suburb] · [Free / $X]
[One-tap RSVP button] → deep link to /events/:id?source=weekly_digest

[Event Card 2] ...
[Event Card 3] ...
[Event Card 4] ...

[Featured Pick — if different from above]
"Handpicked: [Event Title]" — [one line description]
[See it →]

---
[Unsubscribe from weekly emails] | [Update my preferences]
```

### 4.6 Attribution tracking
```sql
-- One-tap RSVP links include source parameter:
/events/:id?source=weekly_digest&email_send_id=:id

-- On booking created from this source:
UPDATE event_bookings SET source='weekly_digest', email_send_id=$id
  WHERE id = new_booking_id

-- This enables: "X bookings this month came from weekly digest"
```

### 4.7 Preference management
```sql
notification_settings(
  user_id                  uuid REFERENCES profiles(id),
  rsvp_reminders           boolean DEFAULT true,
  mutual_click_alerts      boolean DEFAULT true,
  post_event_prompts       boolean DEFAULT true,
  weekly_digest            boolean DEFAULT true,
  merchant_marketing       boolean DEFAULT false,
  updated_at               timestamptz DEFAULT now()
)
```

Unsubscribe link in email sets `weekly_digest = false` via a signed token URL — no login required to unsubscribe (legal requirement).

---

## 5. Milestone Notifications

### In-app + email milestones

| Milestone | Copy | Email? |
|---|---|---|
| First booking | "Your first Click event is booked! Here's what to expect →" | ✅ |
| First event attended (post-event response) | "You went to your first Click event 🎉" | ❌ (in-app only) |
| 5 events attended | "You've been to 5 Click events — you're part of something" | ✅ |
| First mutual click | "You have your first Click match ✨" | ✅ |
| First mutual click event attended | "You and [Name] went to your first event together" | ❌ (in-app only) |
| 10 events attended | "10 events on Click. We're glad you're here." | ✅ |

Milestone emails are warm, brief, and never pushy. They do not upsell. They acknowledge a moment.

---

## 6. Quiz Re-engagement Prompt

The Click Life Quiz dramatically improves match quality but is not in onboarding. Surface it at the right moment.

### When to prompt
Trigger (whichever comes first):
- User has been registered 7 days AND has not completed quiz
- User attends their first event AND has not completed quiz

### Where to prompt
1. Dashboard persistent card (dismissible):
   > "Know who you'll click with better — take the 3-minute Click Quiz"
   > [Take quiz] [Later]

2. Post-first-event email (separate from standard post-event prompt):
   > "You went to your first event! Want better matches next time?  
   > The Click Quiz takes 3 minutes and makes your suggestions a lot more relevant."
   > [Take the quiz →]

### After quiz completion
- Show: "Your matches just got a lot better" confirmation with confetti animation
- Insert `user_activity(type='quiz_completed')`
- Queue `user_match_scores` rebuild for this user
- Dismiss the prompt permanently (`profiles.quiz_prompted = true`, `profiles.quiz_completed_at = now()`)

---

## 7. No-Chat Copy Framework

Click has no messaging. This is a product feature, not a missing feature. Every user touchpoint must frame it that way. Below is the canonical copy for each surface.

### Onboarding completion screen
> **Click is different.**  
> No inboxes. No read receipts. No "hey" that goes nowhere.  
> When you both Click on someone, we find a real event you'd both enjoy — and suggest you go together.  
> Connection through experience, not screens.

### Mutual click notification
> **You and [Name] clicked ✨**  
> You both liked the look of each other. Now let's make it real.  
> [See what's on for you two →]

**Do not write:** "You have a new match — send them a message"  
**Do not write:** "Start a conversation"  
**Do not write:** "Message [Name]"

### Proposal UI header
> **You two might get along.**  
> We picked an event you'd both enjoy. No awkward intros — just show up.

### Expired mutual click
> **Your Click with [Name] has expired.**  
> That's okay — more people like them are out there.  
> [See who might click with you →]

### "Why can't I message them?" FAQ copy (Help section)
> **Click doesn't have direct messaging, and that's intentional.**  
> Most connection apps become inboxes. We wanted something different — a place where  
> connection happens through real experiences, not screens.  
> When you both Click, we suggest an event. Show up. See if it's real.  
> If you want to stay in touch after — you'll have had a reason to exchange details in person.

### In-app 404 if user navigates to /messages (deprecated)
> **Messages aren't a thing here.**  
> We know — it feels weird. But trust us.  
> [See your mutual Clicks instead →]

---

## 8. Re-engagement Trigger Summary

| Trigger | Timing | Channel | Goal |
|---|---|---|---|
| Post-event prompt | 12h after event end | In-app + email | Close loop, surface mutual clicks |
| Weekly digest | Tuesday 8am (if 14d inactive) | Email | Pull back dormant users |
| Quiz prompt | Day 7 or post-first-event | In-app + email | Improve match quality |
| Mutual click notification | On match | In-app + email | Drive proposal UI engagement |
| Waitlist offer | On spot opening | In-app + email | Convert waitlisted users |
| 24h event reminder | 24h before start_time | In-app + email | Reduce no-shows |
| Milestone | On achievement | In-app + email (selected) | Reward engagement |
| Match attending event user saved | On booking | In-app only | Drive FOMO booking |

---

## 9. Tables Added by This Document

```sql
-- Already in other docs but confirm existence:
user_activity(id, user_id, type, payload, created_at)
notification_settings(user_id, rsvp_reminders, mutual_click_alerts,
                      post_event_prompts, weekly_digest, merchant_marketing, updated_at)
post_event_prompts_sent(user_id, event_id, sent_at)  -- idempotency for cron

-- New:
email_sends(
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES profiles(id),
  type           text,     -- 'weekly_digest' | 'post_event' | 'mutual_click' | 'milestone'
  variant        text,     -- A/B test variant
  sent_at        timestamptz DEFAULT now(),
  opened         boolean DEFAULT false,
  opened_at      timestamptz,
  clicked        boolean DEFAULT false,
  clicked_at     timestamptz,
  booking_created boolean DEFAULT false  -- true if user booked from this email
)

onboarding_preview_events(
  id           uuid PRIMARY KEY,
  intent_type  text,  -- 'dating' | 'friends' | 'networking' | 'exploring'
  title        text,
  description  text,
  image_url    text,
  display_order int
)
-- Static curated content for onboarding Step 2.5 preview screen
-- Managed by admin; no merchant connection
```
