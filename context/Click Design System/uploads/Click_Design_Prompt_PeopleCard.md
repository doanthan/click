<!-- People-card component spec — the canonical single-source-of-truth for the "person you can click with" card. 27 Jun 2026. Created to fix the audit gap (the people card was described twice — in ClickMechanic §E and Dashboard — and drifted into the broken squished-column screen). ONE component, reused identically on the Click-with-someone page, the dashboard, and inside the profile drawer header. Responsive WEBSITE. Distinct from the EVENT card. Refs: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE / Buttons_Tags / 09_CLICK_WITH_ME_AND_RADAR / 21_CLICK_MECHANIC. -->
# Click — People Card (the "person you can click with" card, all states)

The people card is the second-most-repeated component in the product (after the event card) and the one that was rendering **broken** — squished narrow columns, titles wrapping vertically, bios dumped on cards. This spec makes it a **single canonical component, reused identically** on the **Click-with-someone page** (3 cards), the **dashboard** ("click with someone" section — 1 rotated card), and as the **header of the profile drawer**. Like the event card, every instance is pixel-consistent — that consistency is the fix.

**It is NOT the event card.** Do not reuse event-card chrome (no dominant 16:9 banner, no price footer, no RSVP). A person is a face + the real overlap + one intention — a calmer, more human card.

**MDs this references:** `CLICK_PALETTE.md` (colour), `CLICK_TYPE.md` (type scale), `CLICK_LANGUAGE.md` ("click with" grammar, banned words), `Click_Design_Prompt_Buttons_Tags.md` (neutral interest chips + buttons), `TECH/09_CLICK_WITH_ME_AND_RADAR.md` §2 (card content rules), `TECH/21_CLICK_MECHANIC.md` §7B (already-clicked card states).

**Five locked rules before the prompt:**
- 🔴 **No bio / prompt text on the card.** A person's bio, prompts, and full interests live ONLY in the **profile drawer** (opened via "View profile"). The card carries the *overlap*, never the essay.
- 🔴 **Shared-context line is CONDITIONAL — never fabricated, never empty.** "You were both at [event]" appears ONLY if they genuinely shared an event (rare — discovery is bookless/person-bound). Otherwise the line IS the **intent overlap + 2–3 genuinely-shared interest tags** ("Both into pottery & live music"). **NEVER render a bare "You were both at" with no event after it** (the live render bug) — if there's no real shared event, that label must not appear at all; if there's neither a shared event nor a shared interest, omit the line entirely. Never invent a shared event.
- 🔴 **Pending copy is locked AND must read as PENDING, not confirmed:** on click → pill **"clicked ✨"** + helper line **"Clicking is anonymous — we'll only show you if it's mutual."** Derived from the viewer's OWN click only. **NEVER "You clicked with [Name]"** or any phrasing that reads as confirmed/mutual — the pending pill never names the person and never implies they clicked back. (That naming belongs ONLY to the separate *mutual* state "You two clicked ✨".) A click is a quiet, anonymous, one-way pending action — the UI must feel low-stakes and unresolved, not like a match was made.
- 🔴 **Intent labels are sentence case:** "Here for friends", "Open to dating", "Here for the activities" — NEVER title case ("Here For Friends", "Open To Dating"). (The live render title-cased them — fix it.)
- 🔴 **One person per line on the page.** The 3 people render as **3 full-width horizontal ROW-cards stacked vertically (one per line)** on desktop — NOT a cramped 3-up column grid (which clipped the buttons and staggered the footers). See LAYOUT.

```
=== PROMPT (paste under the GLOBAL block from Click_Design_Prompt_FullBuildOut.md) ===
ROLE: Principal product designer (reference-class consumer — Hinge / Coffee Meets Bagel curated-discovery craft, Luma calm). Design Click's PEOPLE CARD — the "person you can click with" card — as ONE canonical component for a responsive WEBSITE (375 → 1440), reused identically on the Click-with-someone page, the dashboard, and as the profile-drawer header. NOT a native app (no native chrome). Calm, human, warm; the overlap is the hook. It is DISTINCT from the event card — do not reuse event-card chrome.

=== ANATOMY & VISUAL HIERARCHY (the elements; arrangement is responsive — see LAYOUT) ===
The same elements, laid out as a horizontal ROW on desktop (avatar left · info center · actions right) and a VERTICAL card on mobile (avatar top → info → actions). Reading order is always: who they are → the real overlap → the action.
1. AVATAR — rounded, ~56–64px (compact, per GLOBAL density), warm-graded real photo (never stock/3D blob). Left on the desktop row, top on the mobile card — consistent across all instances. A subtle Mist ring; NO status dot, NO online indicator.
2. NAME · AGE — ONE line: "Mia · 29". Use the **`card-title` type token (Poppins SemiBold 18 / 24)** per CLICK_TYPE — Ink (same token as the event-card title, for cross-card consistency). Must NEVER wrap vertically — truncate gracefully if absurdly long. Age is "· NN", never a separate row.
3. INTENT LABEL — directly under the name: "Here for friends" / "Open to dating" / "Networking" (system 13, Slate). **Sentence case ALWAYS** — never title-case ("Here For Friends" / "Open To Dating" are wrong). Desire-framed, never a status, never a badge colour. (Per CLICK_LANGUAGE — intent-neutral, never implies dating unless the person chose it.)
4. SHARED-CONTEXT LINE — the hook. CONDITIONAL, one line, system 13–14, Ink:
   • IF they genuinely shared an event → "You were both at Wheel throwing" (calendar/pin glyph).
   • ELSE (usual case) → the intent + interest overlap → "Both into pottery & live music" (sparkle/overlap glyph). NEVER fabricate a shared event.
5. SHARED INTEREST TAGS — up to 3 neutral chips (white fill, Mist hairline, Ink text — per Buttons_Tags), "+N" if more. These are the SHARED ones (intersection with the viewer), not the person's full set. NO life tags on the card (sensitive — profile/mutual only).
6. ACTIONS — right side of the desktop row (vertically centered) / full-width at the bottom of the mobile card: PRIMARY "click with [Name]" (Deep-Purple filled, Poppins label, single line — never wraps/clips) + SECONDARY "View profile" (quiet ghost/text → opens the profile drawer; beside the primary on desktop, below it on mobile). One primary action only. In the PENDING state this whole area becomes the "clicked ✨" pill + helper line (see STATES) — the buttons are replaced, not stacked on top.
   NO bio, NO prompts, NO free text anywhere on the card.

=== LAYOUT & ALIGNMENT (ONE PERSON PER LINE — this is the fix for the broken 3-up) ===
The card is RESPONSIVE with two arrangements. The 3-up column grid is DEAD (it clipped the buttons, wrapped "click with [Name]" onto two lines, and staggered the footers).

- **Desktop / tablet ≥768 — HORIZONTAL ROW (one person per line):** the 3 people stack VERTICALLY as 3 full-width row-cards inside a capped container (~760–860px, left-aligned on the page, not full-bleed). Each row: **avatar left** (~64–72px) · **info column center, flex-grow** (name·age → intent → conditional shared-context → ≤3 tag chips) · **actions right** (the "click with [Name]" + "View profile" pair, vertically centered). Because each row owns the full content width, the two actions ALWAYS fit on one line and never clip or wrap. Rows are independent, so height differences between people never cause misalignment. Generous row padding (~20–24px), rows separated by whitespace or a single Mist hairline (not nested boxes).
- **Mobile <768 — VERTICAL card:** the row collapses to the vertical arrangement (avatar top, then name·age → intent → shared-context → tags → actions full-width, primary above secondary). Single column, full-width, stacked — exactly the mobile render that already works. ≥44px targets.
- **Actions never wrap or clip, ever:** "click with [Name]" is a single-line label (give it room; if a name is very long, truncate the name, never wrap the button). "View profile" sits beside it (desktop) or below it (mobile) as a quiet ghost — never pushed past the card edge.
- Spacing: 8pt grid; internal padding ~20–24px (desktop row) / ~16–20px (mobile card). One radius (16px); one soft low shadow OR a 1px Mist hairline, never both. Ink never pure black; titles/labels clamp, never stack letter-by-letter.
- The single dashboard instance uses this SAME row-card (one row, one person) — see Dashboard prompt.

=== STATES (mock every one) ===
1. DEFAULT — as above; shared-context shown in BOTH variants (one card with a real shared event, the others with the intent+tags overlap) to prove equal height.
2. PENDING (you've clicked — the usual outcome) — primary button settles INLINE to a calm pill "clicked ✨" + helper line "Clicking is anonymous — we'll only show you if it's mutual." (derived from your own click only; never reveals theirs). **The pill is UNNAMED and reads as pending — NEVER "You clicked with [Name]"** (that reads as confirmed/mutual; banned here). "View profile" stays available. The card does NOT reshuffle mid-session. This is the calm, low-stakes "sent, now wait" state — not a celebration, not a confirmation.
3. ACTIVE MUTUAL — if you already have a live mutual with this person: the card reads "You two clicked ✨" (Sage accent) and taps through to the mutual. (Rare on a discovery surface; include for completeness — mirrors 21 §7B.)
4. LOADING — a skeleton matching THIS card's shape (avatar circle + 2 text bars + chip row + button bar), not a spinner.
5. NOT SHOWN — suppressed / expired / blocked people never render as a card (handled upstream; no dead/disabled card).
(Anonymous reassurance "🔒 Clicking is anonymous — we'll only show you if it's mutual" appears ONCE per section, not per card — see the page-level prompts.)

=== INTERACTION & MICRO-ANIMATION ===
- Tap "click with [Name]" → a gentle ✨ pulse (~250ms) → button morphs INLINE to the "clicked ✨" pill (no page load, no spinner). Optimistic — never wait on the server. This is an everyday-feedback moment (100–300ms), NOT one of the three ✨ peak moments — keep it soft, not a celebration.
- "View profile" → opens the profile drawer (desktop right-side drawer / mobile full-width sheet), no navigation.
- Hover (web): card lifts ≤2px / avatar ring warms, 150–300ms. Visible keyboard focus ring (Lavender, offset). Respect prefers-reduced-motion (swap motion for a static pending state).

=== RULES ===
- "click with [Name]" — never bare "click", never "match", never "click on". Verb is always "click with" (lowercase). **Single space only — "click with Mia", NEVER "click with  Mia" (no double space before the name).**
- 🔴 BUTTON CONSISTENCY (the live render had it ghost on the dashboard, filled on the people page — fix): the primary "click with [name]" is **ALWAYS the same style on every surface — filled Deep Purple**. Never ghost/outline on one screen and filled on another. "View profile" is always the quiet ghost secondary.
- 🔴 COMPACT (per GLOBAL density — the cards were running too large): row padding ~16px; avatar 56–64; **button height ~40px (≥44 tap area via padding), label 14–15, AUTO-WIDTH inside the desktop row (not full-width), full-width only on mobile**; name = `card-title` 18/24, intent/context 13–14, chips compact. Tighten so 3 rows read calm and dense, not bulky.
- NO bio/prompt text on the card (that's the profile drawer's job). NO life tags on the card. Shared-context line never fabricated.
- One primary action (Deep-Purple "click with"); "View profile" is quiet secondary. Selected/primary is always Deep Purple, never a status colour. No gradients.
- Cream or white card on cream canvas; Poppins for name; system font for intent/context/chips; Ink never pure black; refined line icons (Lucide/Phosphor), no emoji-as-icon (keep locked ✨).
- Real Sydney people (first name + initial/age only): Mia · 29, Tom · 34, Priya · 27, Jules · 31, Hassan · 30, Bec · 28. Real shared interests (pottery, live music, run clubs, wine, cooking). No placeholders, no fake bios.

=== DELIVERABLE (mock every state; PROVE equal height + alignment) ===
Desktop = 3 full-width ROW-cards stacked one-per-line in a capped container; mobile = vertical cards stacked. Mock: DEFAULT row with a REAL shared-event line (Mia — "You were both at Wheel throwing"), DEFAULT rows with the intent+tags overlap (Jules — "Both into pottery & live music"; Tom — "Both into coffee & weekend films"), and a row with NO shared event and NO overlap (the line simply omitted — prove there's NEVER a bare "You were both at") · PENDING ("clicked ✨" + helper, unnamed — prove it's NOT "You clicked with [Name]") · ACTIVE MUTUAL ("You two clicked ✨") · loading skeleton. Use short AND long names/overlaps to prove the "click with [Name]" + "View profile" actions never wrap or clip. Intent labels sentence case. Show at 375 + 1024, micro-animation noted.
=== END PROMPT ===
```

---

## Where this component is used (one source of truth)
- **Click-with-someone page** (`Click_Design_Prompt_ClickMechanic.md` §E) — shows **all 3** daily people as this card in a 3-up grid; the section adds the "3 people for you today" framing, the once-per-section anonymous reassurance, and the radar + outcomes below. The §E prompt references THIS spec for the card itself.
- **Dashboard** (`Click_Design_Prompt_Dashboard.md`, "click with someone" section) — shows **ONE** rotated person as this exact card, with a "See everyone →" link to the Click page.
- **Profile drawer** (`Click_Design_Prompt_ClickMechanic.md` §F) — the drawer header reuses the card's avatar / name·age / intent / conditional overlap; the drawer THEN adds the bio, prompts, and full interest set that the card omits.

If the card changes, it changes **here**, and the three consumers inherit it. Do not re-describe the card in those files — reference this one.

## Notes for Cindy
- **This is the fix for the broken screen.** The event card never broke because it had one canonical spec; the people card broke because it was described in two places and drifted. Now there's one source of truth.
- **The hook is the overlap, not a bio.** Research (Hinge/Coffee Meets Bagel) shows a small, curated, *reasoned* card ("here's why you two") drives more intentional action than a profile dump — and it keeps the card scannable and equal-height. The bio waits in the drawer for anyone who wants more.
- **Equal height is engineered, not hoped for:** flex-grow content + min-width columns + 2-line clamps mean the cards can't squish or stagger again.
- **Want me to fold the EventCard + PeopleCard into a tiny "components" index** so Discovery/Dashboard/Click all point to the two canonical card specs? That'd close the consistency loop the audit flagged.
