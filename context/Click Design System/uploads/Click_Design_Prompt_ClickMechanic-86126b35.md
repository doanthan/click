<!-- The Click mechanic — full coordination flow, WEB-only. 27 Jun 2026. Source of truth: 21_CLICK_MECHANIC + TECH/CLICK_LIFECYCLE_PROCESS_MAP. Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Supersedes the mechanic section in Click_Design_Prompt_Mockups.md. -->
# Click — The Click Mechanic (full coordination flow, web-only)

This is **the feature** — give it the most craft. It must look like a funded Silicon-Valley product: clean, warm, delightful in the small moments, dead-easy to understand. **Web only** — the claude-design version was app-native; strip all native chrome.

**Source of truth (don't deviate):** `21_CLICK_MECHANIC.md` (Parts A+B) + `TECH/CLICK_LIFECYCLE_PROCESS_MAP.md` (the state machine). **Copy:** `CLICK_LANGUAGE.md` locked strings. **Explainer:** link to the How Click Works page wherever a moment could confuse.

**The two guardrails that make this magic, not slop:**
1. **Don't give away the magic.** Show *outcomes* and one warm line — never the internal rules (timers, caps, anonymity internals, ranking). If a moment needs more, link "How clicking works →". The intrigue is the retention.
2. **Cute, but professional.** Micro-animations are purposeful (100–300ms, gentle easing, reduced-motion respected). The ✨ spark is the one signature flourish, used sparingly at the three peak moments (mutual, both-going, connected). No confetti dumps, no bounce, no looping motion.

```
=== PROMPT (paste under the GLOBAL block from Click_Design_Prompt_FullBuildOut.md) ===
ROLE: Principal product designer (reference-class consumer — the craft bar of Linear, Luma, Airbnb). Design Click's signature CLICK MECHANIC as a responsive WEBSITE (375 → 1440) — NOT a native app (no status bars, safe areas, native tab bars, push-permission dialogs; the phone frame is presentation only). Calm, warm, easy to understand, delightful in the small moments. This is the feature the whole product exists for — it gets the most craft.

NON-NEGOTIABLES (CLICK_LANGUAGE + the locked mechanic):
- NO CHAT, ever. After a mutual, a structured "suggest an event" flow is the only coordination. Never design a message thread/inbox.
- Anonymous until mutual — a one-way click is NEVER revealed to the other person (no "likes you" queue). Neutral line: "🔒 Clicking is anonymous — we'll only show you if it's mutual."
- Intent-neutral — romantic/friends/social coexist; never frame as dating; the intent line names a desire ("You're both here for [shared intent]"), never a status.
- "click with" never "match"; "RSVP" CTA (price on the card); events = labels, "plans" only as warm copy; opportunity framing, never loss/urgency.
- Don't expose internal rules (windows, caps, ranking). Outcomes + one warm line; "How clicking works →" for more.

=== WEB INTERACTION MODEL (reduce page loads — it's a website, not an app) ===
Minimise full-page navigations. Use a single-page feel with **optimistic UI**: the moment someone clicks, the card updates INSTANTLY to a "pending" state (no page load, no spinner) — delayed feedback now reads as broken. The mutual reveal, the profile view, and the propose-an-event flow are **modals / side-drawers / inline panels**, NOT new pages (pages are only for complex, full-attention flows; these are sub-tasks). Clicking, revealing, viewing a profile, and proposing should all happen without leaving the current page.

=== A · CLICK WITH SOMEONE (the send — two ways in) ===
A1. FROM DISCOVERY (anonymous): a quiet "click with" affordance on a person in the discovery people-surface. Tapping it → a gentle pulse, then the SAME button switches to its muted pending state labelled "clicked" (lowercase, the feeling; **NO ✨** — pending isn't a peak; same button footprint, NOT a smaller pill). The anonymous reassurance "Clicking is anonymous — we'll only show you if it's mutual." shows **once at the top of the surface, never on the card** (derived from the viewer's own click only; never says anything about the other person). Low-stakes, reassuring. micro-anim: button → soft ripple (~250ms) → label settles.
A2. FROM A POST-EVENT WINDOW (attendance-gated) — the full SCREEN is the canonical **"Who was there" surface** (`Click_Design_Prompt_WhoWasThere.md`; don't re-describe it here). In short: the post-event prompt "Good night at [Event]? Did you click with anyone?" → headline "Did you click with anyone?" → the attendee grid; tap people to click with them (anonymous, muted "clicked", no ✨). TWO yes-branches when you've connected with someone: "We clicked 👍" (offline — you swapped numbers, done) vs "We clicked — suggest something" (into coordination). Calm, no pressure; never expose the window timer.
(The event-page people-surface has 3 states — locked (before you attend) · unlocked / "Who was there" (the 48h window) · closed (after) — see EventCard/Discovery specs; this flow begins from the unlocked state.)

=== B · MUTUAL REVEAL (the signature moment — a MODAL/overlay, NOT a new page) ===
When both have clicked: the reveal, as a celebratory modal/overlay over the current page (no navigation). This is the single most delightful moment in the product — earn it.
- Copy (locked, per CLICK_LANGUAGE): headline **"You two clicked."** + intent line "You're both here for [shared intent]." Push version: **"It's mutual — you two clicked. ✨"** (NOT the older "You clicked with each other".)
- Feel: warm, earned, a little magic — Lavender wash + the ✨ spark drifting in + a soft unblur/scale-up of the person (~500ms, one-time, NOT confetti). Sage accents for the positive moment.
- Immediately answers "what now?" with ONE action → "Suggest something to do" (NO chat anywhere). Never apologise for the absence of chat — frame it as the point ("skip the small talk — pick a thing, meet there").
- A quiet "How clicking works →" link for anyone unsure.

=== C · COORDINATION (no-chat planning — the loop) ===
C1. SUGGEST AN EVENT (proposal — a drawer/inline panel, not a new page): Click suggests a shared event (matched to both) shown as an event card — actions: "Suggest this" · "Show another" · back out. **AND the user can propose their own:** "Suggest your own →" lets them search any Click event (or propose a new one) to send instead. So coordination = Click's pick OR the user's pick. Sending → a gentle send micro-anim. Copy frames it as action: "Pick something you'd both enjoy."
C2. ONE PERSON IN (awaiting the other): once you accept/RSVP, you see "You're in — waiting on [Name]" (calm, hopeful, not anxious). The other person sees "[Name]'s keen for [event] — you in?" with RSVP. micro-anim: your side gets a soft "locked in" tick. (This is the in-between state — one committed, one pending.)
C3. BOTH GOING (confirmed_together — a milestone): when both have RSVP'd → "You're both going ✨" — a satisfying lock-in moment: two small avatars meet / a gentle confirm pulse (~400ms) + ✨. Shows the event + "Add to calendar". This is a peak — make it feel good, stay tasteful.
Recovery states to mock (calm, no blame, no reveal):
- Proposal unanswered → quietly returns to "open" ("No rush — suggest another when you like"); one gentle nudge.
- Seat filled first → "It filled up just now" + "Find another together" / "Waitlist together". Never strands or blames.
- Nothing lines up right now → a calm holding state ("Nothing fits just yet — we'll keep an eye out"). Not a dead end (the system keeps looking). Do NOT expose the mechanics of how/when.

=== D · TERMINALS (where a click rests) ===
D1. CONNECTED / CLOSURE (success — the win): "We clicked 👍" → confirmation "Love that. That's what Click's for. ✨". A warm, quiet celebration (✨, Sage). Rests in "Past clicks"; re-clickable anytime. micro-anim: the 👍 → a soft ✨ bloom.
D2. SOFT-RELEASE (a click goes quiet): neutral, opportunity-framed — "Still out there — if you cross paths again, you can pick it back up." NO verdict, NO loss framing ("expired/missed/didn't line up" all banned). Calm, kind.
D3. NOT FEELING IT (silent exit): "Not feeling it? No worries — just ignore this." Silent to the other person — NEVER surfaces "[X] isn't feeling it" to anyone.

=== E · "CLICK WITH SOMEONE" PAGE (the `Click` nav destination — renamed from "Your clicks") ===
ONE page (reduces navigations), with the H1 rendered **lowercase: "click with someone"** (lowercase "c" — it's the feeling/verb, not the platform name; per CLICK_LANGUAGE's click/Click split), plus a quiet line + a **"How clicking works →"** link (to the How Click Works page). This page was rendering BROKEN — squished narrow columns, titles wrapping vertically, bios dumped on cards. Fix it: spacious, consistent, hierarchy-led, makes people WANT to click. Top → bottom:

1. PEOPLE TO CLICK WITH — the curated daily pool. **This page shows ALL 3** people surfaced for you today (the dashboard surfaces just ONE of them, rotated through the day). The pool refreshes to **3 fresh people daily**. A warm Poppins eyebrow frames it as a small, intentional set: **"3 people for you today"** + a quiet sub-line "A fresh few each day — no endless feed." (Curated-scarcity, à la Coffee Meets Bagel — a small daily set feels intentional and cuts decision fatigue.)

   PEOPLE CARD — use the **canonical People Card component** (full spec: `Click_Design_Prompt_PeopleCard.md` — do NOT re-describe it here). In short: a DISTINCT, minimal card (NOT the event card) — avatar, **name only (NO age — age is on the profile drawer)**, intent label, **conditional shared-context line** ("You were both at [event]" only if real, else intent + 2–3 shared interest tags — never fabricated), ≤3 neutral shared-tag chips, footer "click with [Name]" (Deep Purple) + "View profile" (ghost → drawer). **No bio/prompts on the card.** Pending = the SAME button in its muted state "clicked" (lowercase, NO ✨, NOT a smaller pill); the anonymous reassurance shows ONCE at the top of the page, never under a card. All 3 render ONE PER LINE — full-width horizontal row-cards stacked vertically in a capped container (desktop) / vertical cards stacked (mobile), exactly as the PeopleCard spec defines. NOT a 3-up column grid (that clipped the buttons and staggered the footers). Conditional shared-context never shows a bare "You were both at"; pending is the unnamed "clicked", never "You clicked with [Name]"; intent labels sentence case.

   Anonymous reassurance appears ONCE for the section (not per card): "🔒 Clicking is anonymous — we'll only show you if it's mutual."

   TASTEFUL GAMIFICATION (premium, NOT game-y — brand is chilled): the daily-pool framing itself ("3 people for you today" + "a fresh few each day") is the core pull — variable, finite, worth returning for. A quiet "Fresh today ✨" marker on the set, and the ✨ micro-celebration on a click, carry the delight. **BANNED:** depleting-budget counters ("2 clicks left"), streak numbers, points, leaderboards, urgency/loss framing (21 rule 5). The reward is the freshness and the maybe-mutual, never a score.

2. CLICK RADAR — a **COMPACT social-proof BAR (NOT event cards)**, identical to the dashboard radar (see the Dashboard prompt's CLICK RADAR section). 1–3 light rows, each an anonymous aggregate social-proof line tied to an event ("3 people going also like hiking → Sunrise run" · "Mostly people in their 30s going → Native cocktails" · "Trending in Sydney → Greenhouse terrarium") that taps through to that event. Distinct from the people cards above — this points to EVENTS, not faces. Anonymous, aggregate-only (≥3), NEVER names/photos, never reveals who until you RSVP. Light on cream — never cards, never a dark block. Opportunity-framed.

3. YOUR CLICKS (outcomes, grouped — reuse the row system): Live mutuals (open/proposing) · Plans (you're both going) · Past clicks (connected — re-clickable). Pending one-way clicks are NEVER listed (no "likes you" queue — anonymity holds). Warm empty state ("No clicks yet — your next event is where it happens.").

=== F · PROFILE VIEW (a drawer/modal — NOT a new page) ===
This is **Profile MODE B (viewing someone)** — canonical spec in `Click_Design_Prompt_Profile.md` (one profile, two modes). Render it as the read-only public-subset drawer described there. Summary below for context:
The separate place a person's bio, prompts and full interests live — opened via "View profile" from a people card (A → B). Viewing is never gated, never notified, carries no interest signal (distinct from the click). Drawer on desktop (slides from the right over the dimmed page), full-width sheet on mobile. Close returns to the list — no navigation. Scannable + social-proof-led, NOT a resume:
- HEADER reuses the canonical People Card fields (`Click_Design_Prompt_PeopleCard.md`): photo(s) (larger here), name · age, intent label ("Here for friends"). The drawer then adds what the card omits (below).
- **Why you're seeing them (social proof, near the top):** the SAME real overlap as the card — "You were both at [event]" ONLY if true, otherwise the shared intent + shared **interest tags** + shared **life tags** (07_INTEREST_TAGS / 08_LIFE_TAGS) highlighted as the overlap. Never fabricate a shared event.
- **THIS is where the bio + a prompt or two live** (the text that must NOT appear on the card — e.g. "Here for the activities and whoever's there for them too. Ask me about ceramics."). Show only if the person set them; no placeholder if blank.
- Full interest tags (the card showed 2–3; the profile shows the set). Optionally "Been to N Click events" if the person hasn't hidden it. NEVER life tags beyond the shared ones; never email/contact/last name.
- ONE primary action, pinned: **"click with [Name]"** (optimistic, anonymous → same muted "clicked" pending state, no ✨, same button footprint). If already pending, show that pending state instead. No chat, ever.
- Never expose anything that reveals a one-way click (no "they viewed you", no reciprocation hint).

=== MICRO-ANIMATION SYSTEM (cute but professional) ===
- Three peak moments get the ✨ signature: mutual reveal, both-going, connected. Each is a one-time, ~400–600ms gentle moment — warm, never loud, never confetti.
- Everyday feedback (click sent, proposal sent, RSVP) = 100–300ms soft tick/pulse. Hover/press calm.
- The ✨ spark is the brand flourish — used ONLY at peaks, never sprinkled as decoration.
- Respect prefers-reduced-motion (swap motion for a tasteful static state). No looping/auto-playing motion.

=== RULES / ANTI-SLOP ===
Cream canvas; flat Deep Purple (primary/selected) + Lavender wash + Sage for positive moments; status colour on badges only; Poppins headings + system body; 8pt spacing; whitespace grouping, no cards-in-cards; refined line icons; real Sydney data + names (Mia, Tom, Priya, Jules, Hassan, Bec); light-mode only; web-only (no native chrome). No gradients/glassmorphism/blur/stock/3D. Keep copy outcome-level — never expose internal rules; link "How clicking works →".

=== DELIVERABLE (mock every state) ===
Send: discovery pending · post-event "Did you click with anyone?" (+ two yes-branches). Mutual reveal. Coordination: suggest-an-event · one-person-in · both-going · proposal-unanswered · seat-filled · nothing-lines-up. Terminals: connected/closure · soft-release · not-feeling-it. The "click with someone" page (lowercase H1; all 3 daily people one-per-line + radar + your-clicks outcomes). Profile-view drawer (shared context + interest/life tags). Show clicking / reveal / propose / profile as INLINE or MODAL/DRAWER — never as new full pages. Each at mobile 375 + desktop 1440, with its micro-animation noted. **WEB-ONLY — delete any native-app screens (status bars, native tab bars, push-permission dialogs) from the mockup; the phone frame is presentation only.** Pay special attention to the "click with someone" PAGE: the people cards must be spacious, equal-height, footers aligned, NO bio text on the card, NO age on the card, shared-context conditional, pending = the same button in its muted "clicked" state (no ✨), and the anonymous helper line shown ONCE at the top, never per-card.
=== END PROMPT ===
```

## Notes for Cindy
- **Built from your lifecycle map**, so every coordination state is real and named: send (discovery + post-event) → mutual → propose → one-in → both-going → connected, plus the soft-release / not-feeling-it / dormant / seat-race recovery paths. Nothing's invented.
- **Web-only** — strips the native-app chrome claude design added. The phone frame stays as presentation only.
- **Magic protected:** screens show outcomes + one warm line and link to How Click Works; the internal rules (windows, caps, ranking, anonymity internals) are never exposed. That withholding is deliberate — it's what keeps people curious and engaged.
- **Cute but professional:** the ✨ spark + soft easing carry the delight, concentrated at the three peaks (mutual / both-going / connected). Research backs restraint — subtle, purposeful motion lifts engagement; loud motion reads as slop.
- **The mutual reveal is the screen to obsess over** — it's your most ownable moment and the thing no competitor has.
- Supersedes the mechanic section in `Click_Design_Prompt_Mockups.md` (that section now points here).
