<!-- "Who was there" — the post-event (Process 2) click surface, 48h window. Updated 29 Jun 2026 (attendee grid switched from centred TILES to the LEFT-ALIGNED People Card in a 2-up responsive grid [refined type scale, avatar-left, tight grouping] — supersedes the centred avatar-on-top tile that scanned poorly + broke consistency with the People Card; also removed the contradictory photo-nudge note earlier 29 Jun). Originally 27 Jun 2026. Built to the click-design skill. Responsive WEBSITE. Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Source of truth: 21_CLICK_MECHANIC §7B (Process 2), 09, 13 §9. The ONLY surface where a post-event click happens (the event page itself is context-only, no click button). -->
# Click — "Who was there" (post-event click surface, Process 2)

The signature **post-event** moment: after an event you **attended**, a calm surface lets you anonymously **click with people who were actually there** — within a short window. This is the ONLY place a post-event click happens (the event detail page is context-only, no click button). Reached from the **post-event prompt**, not from browsing.

**Grounding:** `21_CLICK_MECHANIC.md` §7B (Process 2), `09`, `13 §9` (privacy rails). Click behaviour + the pending state = the canonical **People Card** rules (`Click_Design_Prompt_PeopleCard.md`); this doc is the SCREEN (entry, attendee grid, gates, states).

**Locked rules (don't deviate):**
- **Attendance-gated:** only people who actually attended AND are visible-to-attendees appear. No-shows and hidden users never show.
- **Anonymous:** a click here is one-way, anonymous-until-mutual — identical to discovery. Never a "likes you" queue, never reveal a one-way click.
- **Magic-protected:** frame the window as "while it's fresh / the people who were actually there" — NEVER expose the 48h timer or a countdown. Opportunity-framed, never loss/urgency.
- **Privacy:** aggregate signals only; NEVER tag a named person with intent/dating; sensitive life tags never shown.
- **No photo nudge on this page** (Cindy 28 Jun) — the event has passed, so prompting "add a photo so people recognise you" here is pointless. Photo encouragement belongs where it helps a FUTURE event (onboarding / profile / a dashboard banner before an upcoming event), never on a past one.

```
=== PROMPT (paste under the GLOBAL block from Click_Design_Prompt_FullBuildOut.md) ===
ROLE: Principal product designer. Design Click's "WHO WAS THERE" post-event click surface as a responsive WEBSITE (375 → 1440). Calm, warm, low-stakes, anonymous. Compact per the GLOBAL density. NOT a native app. This is reached from the post-event prompt, never from browsing.

=== ENTRY (the post-event prompt) ===
A gentle prompt = the **shared dashboard moment-banner component** (icon-circle · eyebrow "LAST NIGHT · [EVENT]" · title "Did you click with anyone?" · sub "Click anyone worth a second hang - we'll do the rest." · "See who was there"), NOT nagging. Tapping opens this surface. Headline on the surface: **"Did you click with anyone?"** (the locked string — *click* = connect/hit-it-off) + a calm sub-line **"Click anyone worth a second hang - we'll do the rest."** (🔴 drop "actually"; hyphen not em-dash; never show a timer/countdown.)

=== THE SCREEN (ONE job: anonymously click with people who were there — keep it singular) ===
1. CONTEXT STRIP — small: the event you attended (thumbnail + title + "you were there"). Quiet, so the focus is the people.
2. HEADLINE + BRIEF EXPLAINER — "Did you click with anyone?" + sub "Click anyone worth a second hang - we'll do the rest." + 🔴 **a BRIEF anonymity explainer RIGHT HERE near the top, before the grid (Cindy 28 Jun — so people understand before they click):** "🔒 Clicking is anonymous - we'll only show you if it's mutual." + a quiet **"How clicking works →"** link. Once for the screen; magic-protective (link, don't over-explain inline).
3. ATTENDEE GRID — the people who were there (attendance-gated). 🔴 **The LEFT-ALIGNED People Card, in a responsive grid (Cindy 29 Jun — supersedes the centred-tile form; the live render's centred tiles [avatar-on-top, centred text, full-width pinned button] scan poorly across many people and break consistency with the People Card used everywhere else).** Each card = the canonical People Card anatomy, NOT a centred tile: **avatar LEFT (~52)** · a content column (**name ONLY, no age** [card-title ~17] → sentence-case intent label [~13 Slate] → up to 3 shared-interest tags [neutral 22/12, one line + "+N"]) · the **"click with [Name]"** action (filled Deep Purple, the ONE Button, radius 12). 🔴 Use the SAME refined type scale + spacing as the discovery People Card: name 17 → (intent 13) grouped tight, tags below; one avatar size; even ~16–18px padding, equal-height cards, footers aligned, tight not airy. 🔴 **Responsive grid: 1-up mobile / 2-up desktop, 16px gap** (NOT 3-up — 2-up keeps each card wide enough for the left-aligned row to breathe while still fitting 8–20 people without an endless single-column scroll). Click → optimistic muted **"clicked"** pending (same button footprint, NO ✨, unnamed). (Romantic overlay = an aggregate add-on for dating viewers only, ≥3 — never on a named card.)
🔴 **NO PHOTO NUDGE on this page (Cindy 28 Jun) — the event has already passed, so "add a photo so people recognise you" is pointless here. REMOVE it.** The "add a photo" encouragement belongs where it helps a FUTURE event — onboarding, the profile, or a dashboard banner ahead of an event you're about to attend — never on a past one.
🔴 **NO "We clicked" / "Already swapped a moment" section here (Cindy 28 Jun — it's logically misplaced and confusing).** This page's only job is to anonymously click with people who were there. The **"We clicked 👍" CLOSURE is ONLY for a person you ALREADY have a MUTUAL with** — someone Click suggested a plan to pre-event, whom you coordinated with and met — and it lives on **that mutual's card in Your clicks / the coordination drawer (ClickMechanic §D1)**, never as a free-floating "did you connect with anyone?" here. (We can't capture a connection with a stranger; clicking with them here IS the path, and if it's mutual it becomes a mutual in Your clicks, where closure happens.) Keep this page singular.

=== STATES (mock all) ===
- DEFAULT grid (some tiles default, one or two showing the muted "clicked" pending state — same button footprint, no ✨).
- PENDING (you've clicked someone) — the SAME button switches to its muted "clicked" state (no ✨, same footprint, NOT a smaller pill), unnamed, never "you clicked with [Name]". The anonymous reassurance shows ONCE at the top, not on a card.
- EMPTY — no eligible people (small event / others hidden): warm, not a dead end ("Quiet one — no one to click with here. Your next event is where it happens.").
- DIDN'T-ATTEND / not-eligible — if somehow opened without having attended: a calm note (you click with people from events you went to).
- WINDOW CLOSED — after the window passes: a kind, non-loss line ("This one's wrapped up — catch the next one"). NEVER "expired/you missed it".
- Loading skeleton (card-shaped). (No photo-nudge state — removed.)

=== ROMANTIC OVERLAY (10 §4 — only to viewers with Dating mode ON) ===
An aggregate add-on only ("a few people here are open to dating", ≥3), NEVER on a named card, never to non-dating viewers. No per-person dating tag, ever.

=== RULES ===
- Attendance-gated + anonymous + magic-protected (no timer/countdown shown). NO event-page-style "click with" leak — this IS the post-event click surface, distinct from the context-only event page.
- "click with [name]" (lowercase, single space), muted "clicked" pending (unnamed, no ✨), mutual = Sage "clicked ✨"; "Who's…/Who was there" never "who's clicked in". **Name only on tiles — NO age** (age lives on the profile modal). Aggregate social proof only; never a named person tagged with intent; sensitive life tags never shown.
- Cream canvas; Deep Purple primary; status colour on badges only; lowercase `click` + ✨ nav; Poppins headings + system body; compact density; refined line icons; real Sydney names, FIRST NAME ONLY no age (Mia, Tom, Priya, Jules, Hassan, Bec); 8pt; ≥44px targets; visible focus; reduced-motion. Light-mode only; web-only (no native chrome).

=== DELIVERABLE ===
The post-event prompt → the Who-was-there grid (default + a pending card), empty state, window-closed state. 🔴 NO photo nudge, NO "We clicked"/two-yes-branch section (removed — closure lives on the existing mutual in Your clicks, §D1). Brief anonymity explainer + "How clicking works →" near the TOP. 🔴 Cards are the LEFT-ALIGNED People Card (avatar left ~52 · name no-age 17 → intent 13 → ≤3 neutral tags 22/12 · "click with [Name]" action) — NOT centred tiles; refined type scale + tight grouping, equal-height, footers aligned. Responsive: mobile 375 (1-up) + desktop 1024 (2-up, 16px gap). Click → pulse → muted "clicked" (no ✨). No timer/countdown anywhere.
=== END PROMPT ===
```

## Notes for Cindy
- **This is the only place a post-event click happens** — the event page stays context-only (no click button), so this surface carries Process 2.
- **Attendance-gated + anonymous + no timer shown** — you only see people who were actually there, clicks are anonymous-until-mutual, and the 48h window is never exposed as a countdown (magic-protection).
- **Reuses the People Card behaviour** for the click + pending state, so it's consistent with the discovery surface; the tiles are just a denser grid (more people than the curated 3).
- **No photo nudge on this page** — the event has passed, so "add a photo so people recognise you" is pointless here (Cindy 28 Jun). Photo encouragement belongs where it helps a FUTURE event (onboarding / profile / a dashboard banner before an upcoming event), never on a past one. (🔴 Corrected 29 Jun — an earlier note here wrongly said the nudge "appears here too"; that contradicted the prompt body, which removes it. Removed for good.)
