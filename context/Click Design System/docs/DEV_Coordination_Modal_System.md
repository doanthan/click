# COORDINATION_MODAL_SYSTEM.md - v1 (2026-07-10) - the drawer + one-time-reveal contract

**Audience:** the dev who already has the site code. This is the gap-closing doc: what the modal system (the click coordination concept) must do in production, what the live render got wrong, and the acceptance checklist to call it done.

**Repo home:** save as `click-tech/UIUX/COORDINATION_MODAL_SYSTEM.md`. Referenced from `START_HERE.md` Step 1 (audit coverage) and Step 2.5 (the implementation task). Same discipline as every other task: one branch, show the diff before applying, test against the acceptance checklist, stop.

**Sources of truth (repo - these win where they speak):**
- `TECH/21_CLICK_MECHANIC.md` (rev per the START_HERE manifest) - the mechanic: §4 mutual detection in the send-click transaction, §B the coordination state model (`coord_state`), §B4-B6 proposal/decline/exits.
- `TECH/CLICK_LIFECYCLE_PROCESS_MAP.md` - the state machine.
- `UIUX/CLICK_LANGUAGE.md` §5 - the locked strings (verbatim; never improvise).
- `QA_FEATURE_CHECKLIST.md` - the matching acceptance lines.

**Design references (in the design project, not the repo):**
- `Click_Design_Prompt_ClickMechanic` v2 - the design-side mechanic prompt this doc distils.
- `Click Site Audit - 2 Jul 2026` - the audit that measured the live modals frozen at `opacity: 0`.
- `click-app-v2/coordination.jsx` + `Click App Screens v2.html` - the working mockup of the drawer + reveal (compare behaviour, don't copy code).

---

## 1. The one-sentence concept

The entire coordination sequence - mutual reveal → suggest a plan → waiting → both going → recovery/terminal states - is **ONE progressing modal/drawer over the current page**, like a checkout. It is never a set of full pages with site nav and footer.

If the user ever sees a URL change, the site header, or the footer while moving between coordination steps, the implementation is wrong.

## 2. The state machine (bind to `coord_state` - do NOT invent a parallel enum)

UI flow: click → wait → mutual reveal → suggest → waiting on [Name] → both going ✨ → attend → post-event → connected.

In code, the drawer is a **pure projection of `mutual_clicks.coord_state`** (`21` §B2). Drawer step per state:
- `open` - mutual exists, nothing pending → suggest step (Click's pick or your own)
- `proposed` - one side suggested/RSVP'd → "You're in - waiting on [Name]" or "[Name]'s keen for [event] - you in?" depending on which side the viewer is
- `confirmed_together` - "You're both going ✨" + Add to calendar (fires on ANY both-booked detection, not only proposal-accept - `21` §B5.3)
- `dormant` - calm holding/revival state
- `released` - soft release: "Still out there - if you cross paths again, you can pick it back up."

Recovery moments (proposal unanswered, seat filled first, nothing lines up) are **transitions back to `open`/`dormant` rendered with their locked copy inside the drawer** - never new states, never routed pages. The only exits from active are the canonical four (`21` §B0/§B6); a dead agreed event is a failed attempt, never a terminal.

The reveal itself is NOT a `coord_state` - it is a one-time per-user overlay gated by `reveal_seen` (§4 below). "Not feeling it" is a silent exit, never surfaced to the other person.

A mutual exists the **instant** the second person clicks - detected in the send-click transaction (`21` §4), no cron, no delay.

## 3. The drawer shell (architecture)

- One component (call it `CoordinationDrawer`), stepped internally; steps advance **in place** with no navigation.
- Container: ~480-560px centred modal over a dimmed page, or a right side-drawer. Full-width bottom sheet on mobile. Never a phone-width column floating in a 1440 screen - that is the app-native tell.
- Every step keeps a close (✕) that returns to where the user was (Your clicks or dashboard) - never relies on browser back.
- Steps: `reveal` (one-time) → `suggest` → `waiting` → `both_going`, plus the recovery/terminal states above rendered as drawer states.
- Opening a Live mutual from Your clicks opens the drawer **at its current step**.

## 4. The mutual reveal - show it EXACTLY ONCE

The #1 behaviour bug class. Rules:

- Per user, per mutual: persist a `reveal_seen` flag (server-side, per user+mutual pair).
- The user who **completes** the mutual sees the reveal fire live over the page they are on (if they are on a click surface: click page, who-was-there, profile drawer).
- The user who was **waiting** gets: bell dot + optional push ("It's mutual - you clicked with [Name]. ✨") + the dashboard moment ("✨ you clicked with [Name] - suggest a plan →"). Opening ANY of these shows their one-time reveal, then never again.
- Once `reveal_seen`, every re-entry (bell, dashboard card, Your clicks) goes **straight to the drawer at its current coordination step** - never the reveal again. The live render re-fired the reveal on every notification tap; that is the exact regression to test against.

Reveal content (locked): headline **"You clicked with [Name]."** + intent line "You're both here for [shared intent]." + up to 2 shared NON-sensitive life tags + "you're both open to dating" only if BOTH have dating on. One action: **"Suggest something to do"**. Quiet "How clicking works →" link.

## 5. The known animation bug (and the required fix pattern)

The audit measured the live drawer and reveal frozen at `opacity: 0`, stuck on frame one of their `ckCoord` / `ckRise` / `ckPop` entrance animations - only the scrim rendered. Cause: opacity-gated entrance animations restart on re-render and never complete.

**Required pattern (already applied in the mockup and previously in onboarding/`ckSheetUp`):**
- The base state of every modal/drawer/step is **fully visible**. No `opacity: 0` starting states in CSS that depend on an animation completing.
- Entrance motion, if kept, must survive re-renders: trigger it once on mount (e.g. a class added in an effect, or `animation-fill-mode` none with visible base), never re-run it on state/prop changes.
- Respect `prefers-reduced-motion` - swap motion for the static visible state.
- Budget: reveal moment ~400-600ms one-time; everyday feedback 100-300ms; no looping motion, no confetti.

## 6. Optimistic UI (the send)

- Clicking a person updates the button **instantly** to its muted pending state, lowercase label "clicked" - same button footprint, no ✨, no spinner, no page load.
- A one-way click is NEVER revealed to the other person - no "likes you" queue, no "someone clicked you" notification. Positive-only signals: the mutual is the only notification.
- Anonymous reassurance renders once at the TOP of a click surface, never on cards: "🔒 Clicking is anonymous - we'll only show you if it's mutual."

## 7. Where a mutual lives after the reveal

- **Your clicks** is the durable home: Live mutuals (open/proposing, Sage accent) → Plans (both going, Lavender accent) → Past clicks (neutral).
- Same outcome-card layout everywhere; state is an accent, not a different layout.
- Dashboard shows at most ONE mutual moment at a time, never a stack.
- Activity feed gets one quiet line ("✨ You clicked with [Name].").
- Pending one-way clicks are never listed anywhere.

## 8. Copy locks (do not paraphrase)

- "You clicked with [Name]." (never "It's a match", never "You two clicked.")
- Push: "It's mutual - you clicked with [Name]. ✨"
- "You're in - waiting on [Name]" / "[Name]'s keen for [event] - you in?"
- "You're both going ✨" + Add to calendar
- "We clicked 👍" → "Love that. That's what Click's for. ✨"
- Soft release: "Still out there - if you cross paths again, you can pick it back up." (banned: expired / missed / didn't line up)
- Never expose internals: no timers, caps, ranking, refresh cadence, or "outcomes only" explainers. Link "How clicking works →" instead.

## 9. Guardrails (fail any of these = not shippable)

- No chat, ever. No message thread, no inbox, no composer.
- Never reads as a dating app: no hearts, no "match", no couple imagery; of any example set of 3 people, at most 1 shows "Open to dating".
- Intent line names a desire, never a status.
- Sensitive life tags never render, even when shared.
- Who-was-there stale URLs redirect to Discover (the closed/ineligible/empty mock states were deliberately deleted from the mockup; production needs the redirect).
- Language rules are binding down to identifiers and analytics names (`CLICK_LANGUAGE.md` §2-§3): it is a click, never a match; `click_with`, never `click_on`. The correct analytics names for this flow are in `21` §9 (`click_mutual`, `mutual_to_suggestion_view`, `suggestion_to_booking`).

## 10. Acceptance checklist (QA script)

Run at 375 and 1440, plus one mid-width (~768):

1. Click a person on the click page → button flips to "clicked" instantly, no navigation, no ✨.
2. Complete a mutual as the second clicker while on a click surface → reveal modal fires live, visible (computed `opacity: 1`), animates once, ~500ms.
3. As the waiting user: bell dot lights; dashboard shows the single mutual moment; opening either shows the reveal ONCE.
4. Close and re-open the same mutual from bell, dashboard, and Your clicks → drawer opens at current step; reveal never re-fires (verify `reveal_seen` persisted across sessions/devices).
5. Suggest → waiting → both-going all advance IN PLACE in one drawer; URL and page never change; ✕ works at every step.
6. Both RSVP → "You're both going ✨" fires once; Add to calendar works.
7. Force each recovery state (unanswered, seat_filled, nothing_lines_up) → renders inside the drawer, calm copy, no blame, no dead end.
8. Soft-release and not-feeling-it → correct copy; the other user sees nothing.
9. Re-render torture: toggle parent state / resize / background-tab while the drawer is open → drawer stays visible (no frozen opacity-0 regression).
10. `prefers-reduced-motion: reduce` → all steps render static and visible.
11. Grep the built output for banned strings: "match", "expired", "missed", "Refreshes about every", "2 clicks left".
12. No coordination step is reachable as a standalone routed page.

---
*v1, 2026-07-10 - distilled from the design-side mechanic prompt v2 + the 2 Jul site audit, anchored to `TECH/21_CLICK_MECHANIC.md` §B. Where this doc and a TECH/ spec disagree, the TECH/ spec wins - flag the divergence to Doan rather than guessing. Written per CLAUDE.md: hyphens only, no em-dashes.*
