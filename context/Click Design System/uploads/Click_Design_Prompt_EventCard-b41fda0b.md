<!-- Event-card component spec. Updated 27 Jun 2026: enforced venue-hiding (name + address hidden until booked/paid), tighter/less-blocky spacing, equal-height cards with aligned footers, interest tags capped at 3 on card (all on detail page), added free/waitlist/attending states. Responsive WEBSITE. Refs: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE / Buttons_Tags. ONE component, reused identically everywhere.
Rev v2 (27 Jun, from live render): show the DATE in the eyebrow ("Sat 14 Jun · 2:00pm", not just weekday); locked location collapses to ONE line — lock glyph only (explanation moves to the glyph's aria-label/tooltip; the "venue shown when you RSVP" text row is dropped from the card, kept on the detail); interest tags strictly ONE line + "+N" overflow, NEVER wrap; going-row vertical alignment fixed (+N chip same size/centre as avatars, was floating higher); added a RESPONSIVE SIZING section (auto-fit/minmax grid 1/2/3/3–4 cols, fixed 16:9 aspect-ratio, flex equal-height, fixed-width scroll-rows with peek); padding 15→16 (8pt). -->
# Click — Event Card (banner card, all states)

The event card is the most-repeated component in the product, so its hierarchy and states set the tone everywhere. This spec makes it a **banner card** with a clear hierarchy and three booking states.

**MDs this references (your question — yes, these):** `CLICK_PALETTE.md` (the card-state colour map — already defined there), `CLICK_TYPE.md` (type scale), `CLICK_LANGUAGE.md` (CTA wording + badge rules), `Click_Design_Prompt_Buttons_Tags.md` (the neutral interest-tag + status-badge system). 🔴 **Privacy logic (LOCKED, non-negotiable):** until the user has booked — RSVP for a free event, **payment for a paid event** — the card shows **suburb + distance ONLY**; the venue **name AND address are HIDDEN**, with a subtle "venue shown when you RSVP" cue so people understand. Revealed only after RSVP/payment. (Your current cards leak venue names like "Posy Ceramics" on un-booked events — that must stop.) This card is **ONE component reused identically everywhere** (discovery, dashboard, my events, landing) — consistency is part of the spec.

**Two notes before the prompt:**
- **CTA wording (decided 27 Jun):** one simple label — **"RSVP"** for all events; the **price shows on the card, never in the button**. **"Join waitlist"** when full · **"View details"** once booked. Never "buy a ticket", "RSVP to unlock", or price-in-button. Per the updated `CLICK_LANGUAGE` (v6).
- **Fix from your current card:** the maroon "Cocktails" badge is off-palette. Category/interest tags are **neutral** (per Buttons_Tags); only **status** badges (Trending, Sold out, etc.) carry colour. That one change makes the card read on-brand.

```
=== PROMPT ===
ROLE: Senior product designer. Design Click's EVENT CARD component — a banner card — for a responsive website (375 → 1440). It appears in scroll-rows (dashboard), grids (discovery), and on landing. Match Click brand + the Landing screen craft. Calm, scannable, one clear action.

=== ANATOMY & VISUAL HIERARCHY (top → bottom) ===
1. BANNER IMAGE — full-bleed top, consistent 16:9, rounded top corners. Real warm-graded Sydney venue photo (flat placeholders read 'blocky' — use real imagery). OVER the image, only two things: ONE STATUS BADGE top-left (~24px pill, 12px/600, solid status-colour + cream text), and the SAVE bookmark top-right (40px tap, cream circle, Deep-Purple icon; filled when saved). NOTHING else over the photo — interest tags live in the content area, never on the image.
2. CONTENT (15px padding; TIGHT, cohesive rhythm — avoid an airy, floating feel):
   a. DATE · TIME — eyebrow, system 13, Slate, calendar icon. **Show the DATE, not just the weekday:** "Sat 14 Jun · 2:00pm" (weekday, date, month · time). ONE line, never wraps (truncate gracefully if ever needed).
   b. TITLE — strongest element. Use the **`card-title` type token (Poppins SemiBold 18 / 24)** per CLICK_TYPE — Ink. 🔴 **MAX 2 LINES, then ellipsis (Cindy 28 Jun — "how do I manage a long one?").** There is **NO character limit** — use a 2-line `-webkit-line-clamp` with `…`, which is responsive and the cross-site standard (a fixed char cap breaks at different widths). 🔴 **RESERVE 2 lines of height for the title block** (`min-height` = 2 × line-height) so a 1-line title and a 2-line title leave the meta below at the SAME vertical position — this is what keeps a row of cards aligned. For the ellipsis to actually trigger, the title (and its flex parent) need **`min-width: 0`** (flex children default to `min-width:auto`, which is the root cause of text overflowing instead of truncating). Do not pick a bespoke size; reference the token.
   c. LOCATION — ONE line, system 13–14, Slate, pin icon. **Locked: SUBURB · DISTANCE + a small lock glyph ONLY** — e.g. "Redfern · 0.9km 🔒". **DROP the separate "venue shown when you RSVP" text line from the CARD** (it added a whole row and repeats the detail page). The lock glyph carries the meaning; attach the explanation as the lock's **`aria-label`/tooltip** ("Venue shown when you RSVP") so it stays accessible without taking a visible row. NEVER the venue name/address when locked. **Unlocked (booked/paid): venue name · suburb** (no lock).
   d. INTEREST TAGS — **strictly ONE line, NEVER wraps, NEVER stretches the card (Cindy 28 Jun — the render let "Plants · Craft · Take-home · +1" run to the card edge).** The downsized tag (24/12, per Buttons_Tags) sits in a `flex-nowrap` row with **`min-width: 0` + `overflow: hidden`**. 🔴 **Fit-by-width, not a fixed count: include a tag ONLY if that tag AND the "+N" still fit inside the card padding; the moment the next would touch the edge, stop and bump N.** A long tag forces fewer tags — "Running · Outdoors · Coffee after" → render **"Running · Outdoors · +2"** (drop "Coffee after"), or "Running · +3" on a tight card; prefer fewer + bigger N over cramming to the edge. The "+N" is always LAST, always **inside the card padding (never flush to the edge)**, never pushed off or onto a second line; the tag font never shrinks (the count adapts, not the size). Tags are now 22/12 per Buttons_Tags. The **full set shows on the event detail page**. Identical behaviour on every surface (dashboard, discovery, landing, my-events).
   e. GOING — ONE horizontal row, **all items vertically CENTRE-aligned on a single baseline** (the live render had the "+N" overflow chip sitting higher and breaking the row — `align-items: center` fixes it). Up to 3 overlapping avatars (26px, 2.5px cream ring) + a "+N" overflow chip that is the **SAME diameter + ring + vertical centre as the avatars** (never nudged up/down), then "16 going" (Slate 13, vertically centred with the avatars via matched line-height). Avatars are non-identifying here.
   f. FOOTER — pinned to the BOTTOM: PRICE left (Poppins 16, Ink; "Free" in Sage) + CTA right (see states). One action only.

=== LAYOUT & ALIGNMENT (fixes the 'blocky / misaligned footer' problems) ===
- Card = **flex column**; the content/meta area **flex-grows** so the FOOTER (price + CTA) pins to the bottom and **lines up across every card in a row** — never floating at different heights. The 2-line title clamp supports this. Equal heights via flex, NOT fixed pixel heights.
- 🔴 **WHY THE CARDS LOOK INCONSISTENT — and the fix (Cindy 28 Jun).** Inconsistency comes from variable-length content shifting the rows. Lock it down: (1) the **title block reserves 2 lines** (so 1- vs 2-line titles don't shift the meta below); (2) **every other text row is exactly ONE line** (date, location, tag row, going) — truncate with ellipsis / "+N", never wrap; (3) **fixed 16:9 image**; (4) **footer pinned** + equal-height flex (stretch to the tallest in the row). The hidden root cause of the overflow/inconsistency is flexbox: give text/tag flex children **`min-width: 0`** so they truncate instead of forcing the card wider. With these, every card in a row is the SAME width and height and the internal rows align. 🔴 **The Event Card is ONE component, the SAME fixed size + structure on EVERY surface** (dashboard scroll-rows, discovery grid, landing, my-events) — never re-tuned per page.
- Spacing tight & cohesive (this is the 'too much space' fix): padding **16px (8pt grid)**; date→title 4 · title→location 4 · location→tags 8 · tags→going 8 · then flex-gap → footer. One radius (16px); one soft low shadow OR a 1px Mist hairline, not both. Ink never pure black. Every text row (date, location, tag row, going) is a SINGLE line so heights stay equal.
- Consistent 16:9 image + consistent grid gutters (16–20px). Every instance of the card is pixel-consistent.

=== RESPONSIVE SIZING (scale to the page — research-grounded: CSS-Grid auto-fit/minmax + fixed aspect-ratio + flex equal-height) ===
The card has ONE internal layout; the GRID around it does the scaling — never hand-size cards or use fixed pixel heights.
- IMAGE: fixed **`aspect-ratio: 16/9`** (`object-fit: cover`) so every banner is the same proportion and card heights stay consistent across a row.
- CARD WIDTH: **min ~300px, max ~380px.** Content area `flex-grow`s; footer pins to the bottom so price+CTA align across the row regardless of title length (1 vs 2 lines).
- GRID columns by breakpoint (discovery/listing grid): **375 = 1 column full-width** (~16px side gutters) · **≥768 = 2 cols** · **≥1024 = 3 cols** · **≥1330 = 3–4 cols.** Implement with `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` + 16–20px gap (reflows without per-breakpoint hand-tuning), and cap the container width so cards never stretch absurdly wide.
- SCROLL-ROWS (dashboard "what's on near you", landing strip): a horizontal rail of **FIXED-width cards (~300–320px)** with a partial next-card **"peek"** to signal more, 16px gap — same card component, a 1-row rail instead of a wrapping grid.
- Equal height via **flex (tallest-in-row), NOT fixed heights**; the 2-line title clamp + one-line tag row + one-line meta keep natural heights close so the flex stretch is minimal.
- Mobile: single column, image still 16:9, ≥44px tap targets, comfortable thumb spacing.

=== STATES (venue hiding applies to ALL) ===
🔴 Until booked (RSVP free / PAID paid), every state shows suburb + distance only — venue name + address HIDDEN, with the "venue shown when you RSVP" cue.
1. AVAILABLE — free → Free (Sage) badge; paid → price in footer. CTA "RSVP". (+ Almost full / "N spots left" → Coral badge, still RSVP.)
2. FULL → WAITLIST — "Sold out" (Slate on Mist) or "Waitlist" (Amber) badge; CTA **"Join waitlist"** (secondary/outline, reads distinct). **Applies to FREE events too** (a free event can fill up → still "Join waitlist"). Suburb-only.
3. YOU'RE GOING (booked / attending) — "You're going" Sage check badge; venue name now REVEALED (venue · suburb); CTA "View details" (quiet secondary). This is the 'attending' card.
4. SAVED — bookmark filled Deep Purple (overlays any state).
(Primary CTA always Deep Purple; status colours never on the CTA.)

=== INTERACTION STATES ===
Hover (web): subtle lift / image scale ≤1.02, 150–300ms. Pressed: settle. Saved: bookmark fills purple + micro-confirm. Loading: a skeleton matching the card shape (banner block + text bars), not a spinner. Visible keyboard focus ring (lavender, offset). Respect prefers-reduced-motion.

=== RULES ===
- CTA labels: **"RSVP"** (available — all events; price on the card, not in the button) / **"Join waitlist"** (full) / **"View details"** (booked) — never "buy a ticket", "RSVP to unlock", or price-in-button. "click with" never "match".
- Status colour ONLY on status badges + "Free"/"You're going" indicators; everything else neutral/ink. No gradients. Cream card or white card on cream canvas; ink never pure black.
- Real Sydney data WITH dates (e.g. "Native cocktails, four pours · Surry Hills · 0.5km · Fri 13 Jun · 7:00pm · $97 · 11 going"; "Wheel throwing — two mugs · Newtown · Thu 12 Jun · 6:30pm · $110 · Almost full"; "Sunrise run + coffee · Marrickville · Sat 14 Jun · 6:15am · Free"). No placeholders.
- Poppins for title; system font for meta/price-number is fine (price can be Poppins for emphasis). Refined line icons (Lucide/Phosphor), no emoji-as-icon.

=== DELIVERABLE (mock every state; PROVE footer alignment) ===
Show the responsive grid at **375 (1 col) · 768 (2 col) · 1024 (3 col)** AND a **dashboard horizontal scroll-row with a peek**, footers aligned across every card. States: AVAILABLE free (RSVP) · AVAILABLE paid (RSVP) · Almost full / "N spots left" · Trending · New · **FULL → Join waitlist — show BOTH a free-waitlist AND a paid-waitlist card** · **YOU'RE GOING (attending, venue revealed)** · Saved · loading skeleton. PROVE: the **date** shows in the eyebrow ("Sat 14 Jun · 2:00pm"); the locked location is ONE line (lock glyph, no "venue shown" text row); the **tag row is ALWAYS one line** — include a card with MANY tags to prove it collapses to "+N" and never wraps; the **going row is vertically aligned** (the "+N" chip centred with the avatars + "N going", not floating higher); short AND 2-line titles in the same row still align footers. Venue name hidden on every un-booked card.
=== END PROMPT ===
```

---

## Notes for Cindy
- **Hierarchy in one line:** banner → date/time → **title (biggest)** → location → tags → who's going → price + one CTA. The title and the single CTA are the only loud things; everything else is calm meta.
- **The locked/unlocked privacy logic is built into the card:** suburb-only until you book, venue name revealed after — same rule as the event detail page, so they're consistent.
- **The CTA states** map exactly to your ask: RSVP (available) · Join waitlist (full) · View details (booked) — one simple primary action per state; price on the card, not in the button.
- **Status badges** ("Trending", "Sold out", etc.) are the only coloured thing on the card and pull straight from the `CLICK_PALETTE` card-state map — so the card can't drift off-palette.
- Should I fold this card spec into the Discovery + Dashboard prompts so they all point to one source of truth for the card?
