<!-- Discovery / browse page (`/events`). Rev v2 (1 Jul 2026, Cindy — DISTANCE filter changed from a slider to preset CHIPS [1/3/5/10 km · Any]: a lone slider forced the sidebar width + fought its labels; chips keep the sidebar one consistent pattern, wrap at any width, and are easier on mobile. No template change [page-level filter choice].) Plus v1 (1 Jul 2026, Cindy — first proper Discovery spec; audited against CLICK_TEMPLATE.md). The event-browse surface: page header + search + category row + filters + sorted card grid; desktop sidebar / mobile bottom-sheet. Inherits CLICK_TEMPLATE (container, page-header + microcopy slot, tokens, tag/button systems, modal shell for the mobile sheet, motion). Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Uses the canonical Event Card (Click_Design_Prompt_EventCard.md) + the 16 categories (07 / GLOBAL). -->
# Click — Discovery (`/events`, the browse page)

**Frame:** the one place people go to find something to do. Calm, scannable, fast to filter — Luma's clarity, not a dense marketplace wall. It inherits the shared template; this doc only specifies what's Discovery-specific (the search + category row + filter IA + sorted grid), never re-describing tokens the template owns.

## Plan (senior read)
- **Template first:** page header, container, type tokens, tags, buttons, motion, and the mobile sheet all come from `CLICK_TEMPLATE.md` — do not restyle them here.
- **One clear filter model:** three non-overlapping groups (TYPE / DATE / DISTANCE). The live render had "This week" in TWO groups and "Near me" competing with a distance slider — that redundancy is the main fix.
- **The Event Card is the SAME card as everywhere else** — never a Discovery-only variant.
- **Mobile is a first-class layout**, not a squeezed desktop (Baymard: most browse abandonment is mobile filter friction).

```
=== PROMPT (paste under the GLOBAL block from Click_Design_Prompt_FullBuildOut.md) ===
ROLE: Principal product designer (craft bar: Luma / Airbnb / Linear). Design Click's DISCOVERY / browse page (`/events`) for a responsive WEBSITE (375 → 1440). It INHERITS CLICK_TEMPLATE.md — use its container, page-header pattern, type tokens, tag + button systems, modal/sheet shell, and motion scale; do not restyle them. Calm, scannable, activity-first. Hyphens, never em-dashes.

=== PAGE HEADER (per CLICK_TEMPLATE) ===
- Title (`h1` 32/40 · m 28/34): "What's on near you".
- Subline (`body`, Slate — the microcopy slot): "{N} events this week" (e.g. "6 events this week"). 🔴 Location already lives in the title's "near you" — do NOT repeat it or hardcode suburbs in the subline (dynamic {area} only if the title ever drops location). No "on near" typo.
- No eyebrow. No header action (nav carries it).

=== DESKTOP LAYOUT (≥1024) ===
1. SEARCH — a single full-width field under the header: "Search events, venues, or interests…" with a leading search glyph; autocomplete suggestions on type (events, venues, interests). One radius language, Mist border → Deep-Purple focus ring.
2. CATEGORY ROW — the 16 canonical categories (07 order) as the shared icon treatment (Deep-Purple Lucide line glyph on a soft Lavender-tint circle + label; SELECTED = Deep-Purple FILL). "All" leads and is selected by default. 🔴 The **Dating** category is GATED — hidden for non-dating users (the render correctly omitted it). Wraps to a second row on desktop; horizontal-scroll on mobile.
3. TWO-COLUMN below: a LEFT FILTER SIDEBAR (~240px) + the RESULTS area (card grid).
   - 🔴 FILTER IA — three NON-overlapping groups, each a `micro` Slate label + selectable filter chips (interactive: white pill → Deep-Purple FILL when active, per Buttons_Tags; this is the ONLY place a chip goes purple on selection; distinct from display interest tags):
     • TYPE (price + status): Free · Under $25 · Trending · New · Suggested for you
     • DATE (time): Today · This weekend · This week · This month
     • DISTANCE: 🔴 **preset CHIPS, not a slider (Cindy 1 Jul — a lone slider forced the sidebar width + fought its labels; chips keep the sidebar ONE consistent pattern + wrap at any width + are far easier on mobile).** Single-select, default "Any distance": **1 km · 3 km · 5 km · 10 km · Any distance** (same selectable chip = white pill → Deep-Purple FILL when active). 🔴 REMOVE "Near me" from TYPE (DISTANCE owns it) and REMOVE the duplicate "This week" from TYPE (it lives in DATE). No filter appears in two groups. Every filter in the sidebar is now the same chip control — no slider.
   - RESULTS: a top row with the live count ("6 events") LEFT + a "Sort · Soonest" dropdown RIGHT (Soonest · Nearest · Trending · Price). Then the Event Card grid: `repeat(auto-fit, minmax(300px, 1fr))` → 3-up at this width, equal-height cards, 16–24px gaps.
- APPLIED FILTERS: when any filter is on, show a row of removable applied-filter chips (each with an ✕) above the grid + a quiet "Clear all". Keeps state visible.

=== MOBILE (375 → 768) — a first-class layout, not a squeezed desktop ===
- Sticky SEARCH at top. Under it, a horizontal-SCROLL category chip row (same icons). 
- A single "Filters" button (with an active-count badge, e.g. "Filters · 2") → opens a **bottom SHEET** using the template §8 sheet shell (grab-handle, body scrolls, sticky "Show N events" apply button, ✕/scrim close). The sheet holds the same TYPE / DATE / DISTANCE groups.
- Applied-filter chips row (removable) under the search once filters are set.
- Single-column Event Cards, full-width, with the peek/scroll rhythm per the card spec.

=== EVENT CARD (the SAME shared component — do not restyle) ===
Per Click_Design_Prompt_EventCard.md: 16:9 image, status badge top-left (Almost full → Coral · Trending → Amber · Free / You're going → Sage · New → Teal · Full/Sold out → Slate on Mist), Save + Share top-right; DATE eyebrow ("Sat 13 Jun · 2:00pm"); `card-title` (2-line clamp); locked location ONE line "Suburb · Distance" + lock glyph; interest tags = true-white + Mist-strong hairline, one line + "+N"; going-avatars + count; price left; CTA right = RSVP (available) / Join waitlist (full) / View details (booked). One filled-purple CTA per card.

=== STATES ===
- Empty / no results (filters too narrow): a calm, warm panel — "Nothing matches those filters. Try widening the date or distance." + a "Clear filters" action. Never a dead-end, never loss-framed.
- Cold start / broad area: show the full set; never imply personalisation that isn't there.
- Loading: calm skeleton cards matching the grid (not spinners).
- Search no-match: "No events match '[term]' yet — try a category below."

=== MICROCOPY (per CLICK_TEMPLATE §7 — warm, brief, guides, magic-safe) ===
Title/subline as above; filter labels short + human; sort labels one word; empty states guide the next step (widen a filter), never apologise or use urgency; "RSVP" (price on the card), "Join waitlist" (full); dynamic {area}, never hardcoded suburbs; hyphens not em-dashes.

=== MOTION (template §9) ===
Filter toggle / chip select: `--dur-fast` soft fill. Applied-chip add/remove + grid re-flow: `--dur-base` fade, no layout jank. Mobile sheet: scrim fade + rise `--dur-base`. Reduced-motion: instant. No ✨ anywhere on this page (not a peak surface).

=== A11y + BREAKPOINTS ===
Selected filter chips carry `aria-pressed` (TYPE/DATE/DISTANCE are all chips now — no slider); DISTANCE is single-select (radio semantics); category icons have labels; ≥44px targets; visible `:focus-visible` (Deep-Purple + cream offset); the mobile sheet traps focus + restores it. Render 375 / 768 / 1024 / 1440.

THEN self-critique against CLICK_TEMPLATE's on-template checklist AND: any filter appearing in two groups, any hardcoded suburb / "on near" typo in the subline, an Event Card restyled from the shared component, a purple CTA collision, the Dating category showing for a non-dating user, or a squeezed mobile filter row instead of the sheet.
=== END PROMPT ===
```

## Notes for Cindy
- **Closes the last Phase-1 gap** — Discovery finally has a proper spec, built on the template.
- **The one real fix** was the filter model: "This week" was in two groups and "Near me" fought the distance slider. Now TYPE = price/status, DATE = time, DISTANCE = slider — no overlaps.
- **Microcopy**: "What's on near you" + "6 events this week" — no typo, no repeated/hardcoded location, scales to any city.
- Everything visual inherits the template + the shared Event Card, so Discovery can't drift from the rest of the site.
