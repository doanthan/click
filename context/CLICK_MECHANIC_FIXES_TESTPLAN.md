# Click mechanic - fixes, and what to test

Date: 2026-08-24 · Branch: `fix/go-live-blockers`

Follows the UI/UX audit of the mutual-click journey ("The Click Mechanic").
Ten findings fixed. Nothing committed; nothing run against a database.

**Gate status at time of writing:** `npm run lint` clean · `npx tsc --noEmit`
clean · `npm test` 66/66 pass · `npm run build` succeeds · `npm run release:check`
PASS (two pre-existing WARNs: R2 unconfigured, `002_seed.sql` changed after apply).

---

## Read this before testing

`.env.local` points at the **production** database and Stripe is in **live mode**.
`npm run dev` therefore writes production rows. Two consequences for this test plan:

1. **Never hit `/api/cron/click-lifecycle` from local dev.** It now inserts
   notifications, so a local run would fan real notices out to real accounts.
   Point `DATABASE_URL` at a scratch database first.
2. Every scenario below wants seeded data. Seed it in a **separate** database.

The new SQL in `expireClickLifecycles` has **not** been executed or `EXPLAIN`ed
against any database - it is hand-reviewed only. Run test 6 before deploying.

---

## What changed

| # | Fix | Files |
| --- | --- | --- |
| 1 | Suggested event is joined for **identity**, joinability moved to a flag | `event-repository.ts` (`getProposalsForSession`) |
| 2 | `gone` step no longer fires on a started or sold-out event | `coordination-drawer.tsx`, `clicks-list.tsx` |
| 3 | Block / ban / wound-down guards on the partner-RSVP notification | `event-repository.ts` (`notifyProposalPartnerOfRsvp`) |
| 4 | Dashboard keeps an **accepted** plan instead of reverting to "suggest a plan" | `event-repository.ts` (`getMutualClicksForSession`), `dashboard/page.tsx`, `people/page.tsx` |
| 5 | `/people` daily set drops people you've already clicked; adds an end-of-set state | `people/page.tsx` |
| 6 | Endings are announced: mutual wind-down + plan lapse now notify both sides | `event-repository.ts` (`expireClickLifecycles`, new `notifyPairs`) |
| 7 | A click control on `/profile/[userId]` | `profile-click-button.tsx` (new), `profile/[userId]/page.tsx`, `getViewerClickState` |
| 8 | Banned copy: 190 em-dashes and one "You matched on a plan" removed | `event-repository.ts` |
| 9 | The mechanic is explained where it's used, from the real constants | `people/page.tsx` |
| 10 | Two action buttons stop overflowing a 320px card | `click-with-someone-user-card.tsx` |
| 11 | Hardcoded `3` / `'90 days'` wired to `PROPOSAL_ALTERNATIVES_CAP` / `PAIR_SUPPRESSION_DAYS` | `event-repository.ts` |

---

## Tests

### 1. A confirmed plan survives its own event starting

**This was the worst bug: two people with paid seats, standing in the venue,
being told the plan fell through.**

Setup: mutual click between A and B · a `click_proposals` row with
`status='accepted'` pointing at an event · both A and B hold `event_attendees`
rows with `status='confirmed'`.

| When | `/proposals` should show |
| --- | --- |
| Event is upcoming | "You're both going ✨", **Add to calendar** + **View <event>** |
| Event `starts_at` has passed | Still "You're both going ✨". **Add to calendar is gone.** View link stays. |
| Event `status='cancelled'` | "That plan fell through - pick another together." + Suggest another plan |

Fail condition: any "fell through" copy while the event is merely past or full.

Also check the `/proposals` row badge (`clicks-list.tsx`): "Both going" (sage),
not "Pick a plan", for the past-event case.

### 2. A sold-out event reports the seats people actually hold

Setup: as above, but fill the event to capacity (`event_capacity_v.available = 0`)
**after** both RSVP'd.

- Both hold seats → "You're both going ✨". Previously both flags collapsed to
  false and both people saw the same wrong card.
- Only A holds a seat → A sees "You're in ✨ … B hasn't grabbed one yet".
- Neither holds a seat → new third branch: "<event> filled up before you got a
  seat." + **Suggest another plan** + **View <event>**. Never a dead RSVP button.
- Event has started and viewer has no seat → "<event> has already started."

### 3. A pending suggestion that dies says so

Setup: pending proposal, then cancel / fill / age the suggested event.

- Drawer heading reads "<event> was called off / has already started / filled up
  - pick another together."
- **Confirm this plan is not rendered** (it's gated on joinability now, not on
  the slug existing).
- `/proposals` row badge: "Pick a plan" with the matching sub-line.
- `/people` "Live mutuals" row: "<event> is off the table" → **Pick another plan →**.
- Dashboard banner: "<event> is off the table".

### 4. An accepted plan reaches the dashboard

Setup: proposal `status='accepted'`, viewer has **no** seat yet, partner may or
may not have one.

- Dashboard banner: "You agreed on a plan - grab your seat", CTA **RSVP now →**
  linking to `/events/<slug>` (not `/proposals`).
- `/people` live-mutual row: "You both said yes - grab your seat".
- Once both have seats the `both_going` lateral takes over and the pair drops out
  of `yourMove` entirely - confirm the banner disappears rather than duplicating.

Regression to watch: the proposal join became a `lateral … limit 1`. Confirm a
mutual carrying **both** a pending and an accepted row still renders exactly one
card (no fan-out).

### 5. Blocked people cannot reach a blocker's notification tray

Setup: A and B mutual with a proposal on event E · A blocks B · B then RSVPs to E.

- **No** `notifications` row for A. Query:
  `select * from notifications where profile_id = '<A>' and action_url like '%from=proposal-partner-rsvp%'`
  → 0 rows.
- Repeat with B suspended, then B banned, then with `mutual_clicks.status` not
  `'active'` - each must also produce 0 rows.
- Control: no block, mutual active, both fine → exactly **1** row, and a second
  RSVP does not add another (the `action_url` marker is the idempotency key).
- Title reads "Your click RSVP'd - your turn" with a **hyphen**.

### 6. Endings are announced (new SQL - verify this one first)

`expireClickLifecycles` now runs two extra SELECTs and two extra INSERTs.
**Against a scratch database**, `EXPLAIN` them or run the cron once:

```
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3001/api/cron/click-lifecycle
```

- **Mutual wound down**: an `active` mutual past `expires_at` whose
  `coord_state <> 'confirmed_together'` → both sides get "Your click with <name>
  wound down". A `confirmed_together` mutual gets **nothing** (that's a night that
  happened, not a failure).
- **Plan lapsed**: a `pending` proposal past `expires_at` **whose mutual is still
  alive** → both sides get "<event> lapsed". A proposal whose mutual is expiring
  in the same sweep gets only the wind-down notice, never both.
- Guards, each to be tested: blocked pair → nothing · banned or suspended on
  either side → nothing · recipient with `notification_prefs->>'mutualClick'`
  set to `false` → nothing for them, but their partner still gets theirs.
- Re-run the cron immediately: **zero** new rows (the status flip is the guard).
- The returned counts (`mutualsExpired`, `proposalsExpired`) must be unchanged
  by this work.

### 7. You can click from a profile

- Signed in, someone else's profile → **click with <name>** + "Clicking is
  anonymous - we'll only show you if it's mutual."
- Tap it → button becomes the muted "clicked", line becomes "Sent privately…".
- Reload → still "clicked" (that's `getViewerClickState.alreadyClicked`).
- Already mutual → no click button; a **See your click with <name> →** link to
  `/proposals` instead.
- You have blocked them → no click control at all (safety controls only).
- Your own profile → no click control, **Edit profile** as before.
- Signed out → no click control, the "Sign in to click…" line as before.

**Privacy check, and the important one here:** the button renders for every
signed-in viewer regardless of eligibility, on purpose. Confirm that clicking
someone you share no event with returns the ordinary outcome message and takes
roughly the same time as an eligible click - `SEND_CLICK_FLOOR_MS` (350ms) is what
keeps this page off the probing surface. If the button ever becomes conditional
on eligibility, this page becomes an oracle.

### 8. The daily set ends properly

- Fresh account with suggestions → up to 3 cards.
- Click one → reload → that person is **gone** from the set and the next
  suggestion (if any) has taken their place.
- Click through every suggestion → the set is replaced by "That's everyone for
  now." + **Find an event →**, not three muted "clicked" cards.
- Account with no suggestions at all → the original "add a few interests" state
  (these two must not be confused).

### 9. Copy and layout

- `grep -c "—" src/lib/event-repository.ts` → **0**.
- `grep -rn "matched" src/lib/event-repository.ts` → no user-facing use.
- `/people` → "How clicking works" `<details>` opens with no JS (test with
  JavaScript disabled) and states: private · no chat · 7-day click ·
  7-day mutual · who-was-there at 2h, 48h to click up to 3.
  Numbers come from `clicks/constants.ts` - change a constant and confirm the
  copy moves with it.
- `DISCOVERY_CLICK_CAP` must stay **absent** from that list; the constant is
  documented as silent.
- At 320px width, a people card's actions stack full-width and the card does not
  scroll sideways. Check the longest name you have.

### 10. Regression sweep

- `/dashboard`, `/people`, `/proposals`, `/discover`, `/profile/<id>` all render
  for: no mutuals · one open mutual · one pending proposal · one accepted
  proposal · one both-going pair · one expired mutual.
- `/proposals` drawer keyboard trap, Escape, and the one-time reveal still behave
  (`projectStep` changed; the reveal gate did not).
- "Not feeling it" still writes a `pair_suppressions` row expiring in
  **90 days** (now from the constant).
- A 4th "suggest alternative" is still refused at **3** (now from the constant).

---

## Known-good and deliberately unchanged

- The **privacy contract**: `SEND_CLICK_FLOOR_MS`, the byte-identical
  `SendClickOutcome` union, and the absence of any non-mutual leak on any
  surface. Nothing here touched it. Don't "optimise" the floor away.
- `/how-it-works` still teases rather than explains. That's a marketing decision
  stated in the file; the explainer now lives on `/people` where it's needed.
- The send path enforces the post-event **48h ceiling** but not the 2h floor -
  only the display surfaces apply the 2h delay. Harmless today (you cannot see
  anyone to click before 2h), but the two should agree eventually.
- `/proposals` has no top-nav entry. Reachable from `/dashboard` and from every
  `/people` click row. Adding a 5th nav item was judged worse than the gap.

## Not fixed - needs product decisions, not wiring

- `ACTIVE_MUTUAL_SOFT_CAP`, `REDISCOVERY_COOLDOWN_DAYS`,
  `PROPOSAL_RESPONSE_WINDOW_HOURS`, `SUGGESTION_LEADTIME_FLOOR_HOURS` and
  `SUGGESTION_WINDOW_DAYS` are still imported by **nothing**. These are unbuilt
  spec features, not broken wiring - the file reads as though they're live.
- `ClickWalkthrough` (`src/components/click-walkthrough.tsx`, 739 lines) is a
  complete, good explainer mounted only on `/test-click`, which 404s in
  production. It is also written in the **pre-DS** palette (`--coral` as an
  accent, `--rose`, `hard-shadow`) and would need a full restyle before it could
  ship. The `/people` `<details>` is the interim answer.
- `context/CLICK_MECHANIC_AUDIT.md` (2026-06-24) is **stale**: it describes the
  dropped `user_clicks` table, a 30-day click expiry and a 12-hour post-event
  gate. Delete or rewrite it before someone trusts it.
- A **declined** proposal still ends silently. The pair land back on a live
  surface with a clear next action, so it's the mildest case of the pattern -
  but it is the same pattern.
