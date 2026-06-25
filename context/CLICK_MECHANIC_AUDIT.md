# Click Mechanic — Audit & Reference

**Date:** 2026-06-24
**Scope:** The end-to-end "Click" mechanic (private tap → mutual → proposal → going together) as actually implemented, vs. how the `/test-click` explainer describes it.
**Method:** Multi-agent audit (6 slice auditors → synthesis → 3 adversarial verifiers), every finding re-checked against the code. Primary sources: `src/lib/event-repository.ts`, `src/components/{click-with-someone-user-card,post-event-click-card,proposal-card}.tsx`, `src/app/dashboard/page.tsx`, `database/019_proposals.sql`, `database/046_guest_spots.sql`.

This doc is the companion to the on-page report at `/test-click` (section "Does this page match the code?").

---

## 1. What a Click is (the one-line model)

A **Click** is a private, one-way tap that says "I'd see this person again." It is **invisible** to the other person and is **not** a like, a DM, or a chat request. It only ever surfaces when it becomes **mutual** — and a mutual unlocks a **plan** (a real event to attend together), never a chat thread. **There is no direct messaging anywhere in the product.**

---

## 2. Exactly what happens (the verified lifecycle)

### Two entry points to send a Click
- **Discovery — "Click privately":** `/dashboard` (one rotating suggestion) + `/people` (full list). No requirement to have met. Allowed any time.
  Pool excludes self, non-attendees, suspended, incomplete profiles, and blocked pairs. Ranked by **Matching v2** (default ON) — the cohort pair model — falling back to shared-tag order only when a profile has no feature-store row.
- **Post-event — "Click":** a `/dashboard` prompt that opens **12 hours after** an event you attended ends, listing confirmed co-attendees you haven't clicked. Gated: both must have been **confirmed** attendees, and the event ended 12h+ ago.

### Step 1 — Private pending Click
- Writes a `user_clicks` row, `status='pending'`, `expires_at = now() + 30 days`.
- 100% silent: no notification, email, or badge to the recipient. The first time anyone is ever told is the mutual.
- Safety: can't Click yourself; a block in either direction blocks the Click.
- Confirmation the sender sees: **"Clicked privately ✓ — pending their Click."**

### Step 2 — Mutual Click
- Fires the moment the other person also clicks you **while both clicks are unexpired**.
- Both clicks flip to `mutual`; a `mutual_clicks` row is created; a **7-day** `event_proposals` row opens.
- The system auto-suggests a future, still-bookable event sharing an interest with one or both of you (prefers matching both, soonest first, ideally one neither has RSVP'd).
- Both people get an identical "Mutual Click found" notification (→ `/proposals`) **and** a mutual-click email, at the same moment.

### Step 3 — The Proposal (coordinate, zero chat)
- `/proposals`: "Confirm this plan" (one tap by **either** person) or "Suggest alternative" (pick from a real-events dropdown; **3 total, shared between you**).
- No free text anywhere. The 7-day clock runs from **when you matched**, not the event date.

### Step 4 — Confirm ≠ booking
- Confirming is a soft confirm; it does **not** reserve a seat. Each person still RSVPs (free RSVP, or Stripe checkout for an available paid event).
- One-tap Confirm is only possible while the suggested event is still bookable; if it sold out, you Suggest an alternative first.

### Step 5 — Both going
- The "🎉 You're both going to {event}" card appears **only on the dashboard**, computed live from RSVPs (both hold a confirmed seat, or a claimed guest +1) — independent of whether anyone tapped Confirm.

### Timers
| Clock | Value | Runs from |
| --- | --- | --- |
| Post-event Click gate | 12 hours | event end |
| Pending Click expiry | 30 days | each click/re-click |
| Proposal window | 7 days | mutual formation |
| Waitlist offer hold | 30 minutes | seat offered (RSVP flow) |

---

## 3. ✓ Verified accurate

The `/test-click` walkthrough is correct on all of these:

- A pending Click is genuinely silent — no notification/email/badge until the mutual. *(event-repository.ts:7076-7088, 7111-7332)*
- The mutual is symmetric — same notification (→ /proposals) + email to both, at once. *(event-repository.ts:7249-7331)*
- You can't Click yourself, and a block in either direction blocks the Click. *(event-repository.ts:7018-7038; database/001_schema.sql:166)*
- Confirming a proposal does not book a seat — both still RSVP separately. *(event-repository.ts:11529-11536)*
- One tap by **either** person confirms the plan — no two-sided handshake on the plan. *(event-repository.ts:11506-11536)*
- "Both going 🎉" requires both to hold a confirmed seat or a claimed guest +1. *(event-repository.ts:10788-10814)*
- The proposal surface has no free text — alternatives come from a real-events dropdown. *(proposal-card.tsx:192-207)*
- Discovery Clicks need no shared past event; post-event Clicks are gated to both-confirmed-attendees +12h. *(event-repository.ts:7040-7074)*

---

## 4. Corrections applied to the page

The audit caught these inaccuracies on `/test-click` (now fixed in the copy):

1. **"Click again to reopen"** — a lapsed proposal can't be reopened today. Removed the promise.
2. **"Ranked by shared interest tags"** → "how well you match" — Matching v2 (default ON) re-ranks the pool.
3. **Step 5 "/proposals shows the confirmed plan"** — it never shows the 🎉; both-going is dashboard-only, computed from RSVPs.
4. **Blocking pill** — softened: block governs discovery + new Clicks, not an existing mutual.
5. **Step 4 one-tap Confirm** — noted it only works while the suggested event is still bookable.
6. **7-day clock** — decoupled the demo dates; the clock runs from match time, not the event date.

> The same "ranked by shared interest tags" copy still appears on the live `/people` page — worth fixing there too.

---

## 5. Edge cases

| Sev | Area | Edge case | Code |
| --- | --- | --- | --- |
| 🔴 | Going/RSVP | A **waitlist (full) event can be auto-suggested** as the plan. RSVPing a waitlist event makes you "waitlisted", and both-going only counts "confirmed" seats — so both people RSVP, both land on the waitlist, and the celebration silently dead-ends. | event-repository.ts:7165, 3012-3024, 10794 |
| 🔴 | Going/RSVP | **Cancelling an RSVP silently un-celebrates "both going"** — the 🎉 just disappears for both, with no alert to the still-going partner. An explicitly-confirmed proposal then stays "confirmed" forever (stale "RSVP needed" card). | event-repository.ts:7491-7600, 10788-10814 |
| 🟠 | Sending | **Re-clicking re-arms a fresh 30-day window** and can revive an expired Click — no cooldown. "30 days then expires" isn't a one-shot timer. | event-repository.ts:7076-7088 |
| 🟠 | Mutual | A mutual **only forms while both clicks are unexpired**. If they clicked you 31 days ago, no mutual forms — you just get a fresh pending click. | event-repository.ts:7090-7100 |
| 🟠 | Suggestion | A mutual **can form with no suggested event** — the proposal opens empty ("No plan yet — pick one together"). The auto-suggestion isn't guaranteed. | event-repository.ts:7111-7232; dashboard/page.tsx:357-366 |
| 🟠 | Proposal | The **"3 alternatives" cap is one shared budget** across both people, not 3 each. | event-repository.ts:11578-11611; database/019_proposals.sql:21 |
| 🟠 | Notifications | **Mute silences the in-app mutual ping** — but the mutual still forms and the **email still sends** (the email isn't mute-gated). | event-repository.ts:7201-7245, 7249-7331 |
| 🟠 | Sending | The **post-event prompt uses several windows**, not one clean "12h gate": action +12h; dashboard rail +12h..−14d; event-page prompt end..−30d (no 12h gate); push cron +12h..−7d. So you can see the button on an event page before 12h and have the submit rejected. | event-repository.ts:7058, 11198, 11277, 11329 |
| 🟠 | Going/RSVP | **RSVPing to a full paid event joins the waitlist for free** — Stripe checkout is skipped up front; you only pay if a seat is later offered and accepted. | event-repository.ts:3012-3063 |
| 🟠 | Going/RSVP | **"Both going" celebrates any shared upcoming event**, not just the proposed plan — and reaching it keeps a lapsed mutual alive (overrides the 7-day dead-mutual drop). | event-repository.ts:10788-10827 |

---

## 6. Gaps & not-built-yet

| Sev | Area | Gap | Code |
| --- | --- | --- | --- |
| 🔴 | Proposal | **A lapsed proposal can't be reopened.** Once mutual, the Click button is disabled / the person is filtered out, and the proposal upsert never resets status or expiry. The card's "Click again to reopen" is aspirational. | event-repository.ts:7226-7245; proposal-card.tsx:150 |
| 🔴 | System | **Nothing flips a lapsed proposal / pending Click to "expired"** — expiry is read-time only, no cron sweep. DB state is never reconciled. | event-repository.ts:10894, 11520-11527; vercel.json |
| 🔴 | Sending | **No way to withdraw a sent Click, and no way to decline a proposal.** The click endpoint is create-only; the proposal has only Confirm / Suggest. Blocking is the only hard exit. | api/clicks/route.ts; proposal-card.tsx:154-175 |
| 🔴 | Safety | **Blocking after a mutual leaves the mutual + proposal fully alive.** Block deletes pending clicks only; mutual/proposal queries + confirm/suggest don't re-check blocks, so the non-blocked person can still confirm/suggest. | event-repository.ts:10882-10899, 11446, 11478-11504 |
| 🟠 | Safety | **No report / block / mute inside the Click flow** — only on `/profile/[userId]`. From inside a mutual or proposal there's no path to report a match. | proposal-card.tsx; profile-safety-controls.tsx |
| 🟠 | Notifications | **The RSVP-reminder cron ignores mute/block and has no expiry guard** — a muter can be nudged about a muted person, and a lapsed-but-pending proposal can fire one stray reminder. | event-repository.ts:3169-3218 |
| 🟠 | Suggestion | **Capacity checks ignore claimed guest +1s** — an event that's full once guest spots are counted can still be suggested / proposed / offered as an alternative. | event-repository.ts:7133-7176; database/046_guest_spots.sql:13 |
| 🟠 | Suggestion | **Muted users aren't hidden from discovery**, and already-matched people still occupy a pool slot (disabled). | event-repository.ts:10642-10672 |
| 🟢 | Notifications | The **mutual notification/email ignores the user's notify preference** (only mutes are honored). The "event reminder" toggle is advertised but has no cron. | event-repository.ts:7249-7331; account-settings/page.tsx:149 |
| 🟢 | Suggestion | **`/people` still says "ranked by shared interest tags"** even though Matching v2 (default ON) re-ranks by the pair model. | people/page.tsx:47; event-repository.ts:10680-10693 |

---

## 7. Prioritized recommendations

**Fix first (correctness / safety):**
1. **Exclude waitlist/full events from the suggestion + catalogue** (count guest +1s in capacity) so "both going" can't dead-end. *Most self-contained, high-value.*
2. **On block, dead-end the pair's mutual + proposal**, and re-check block/mute in `confirmProposal` / `proposeAlternative` and the RSVP-reminder cron.
3. **Notify the still-going partner when their match cancels** an RSVP, and reconcile a now-stale confirmed proposal.

**Then (lifecycle hygiene):**
4. Add a sweep cron (or accept read-time-only and remove the "reopen" copy product-wide).
5. Add **withdraw Click** + **decline proposal** affordances.
6. Honor `notify.mutualClick`; either mute-gate the mutual email or document that it always sends.

**Copy:**
7. Fix `/people` ranking copy to match Matching v2.

---

## 8. Code reference map

| Function | Location |
| --- | --- |
| `createUserClickForSession` (send + mutual + suggestion) | event-repository.ts:6979 |
| `getSuggestedPeople` (discovery pool + v2 re-rank) | event-repository.ts:10604 |
| `getMutualClicksForSession` (mutual list + both-going) | event-repository.ts:10728 |
| `getPostEventClickPrompts` / `notifyPostEventClickPrompts` | event-repository.ts:11162 / 11315 |
| `getProposalsForSession` / `confirmProposal` / `proposeAlternativeForProposal` | event-repository.ts:11383 / 11506 / 11559 |
| `registerForEvent` / `cancelRegistration` / `expireWaitlistOffers` | event-repository.ts:2932 / 7491 / 8093 |
| `remindProposalRsvps` | event-repository.ts:3169 |
| Crons | api/cron/{post-event-clicks, proposal-rsvp-reminders, waitlist-expiry} |
| Schema | database/019_proposals.sql, 046_guest_spots.sql; `user_clicks` / `mutual_clicks` (001_schema.sql) |
| Explainer page | src/app/test-click/page.tsx, src/app/test-click/audit-report.tsx, src/components/click-walkthrough.tsx |
