# CLICK_TEMPLATE.md - the page template (applies to EVERY page)

**Canon.** Every Click page - marketing and app - inherits this template. Page-specific prompts add content on top; they never restyle what is locked here. On any conflict, this doc + CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE / Buttons_Tags win.
Mirrors the live render (`Click App Screens v2.html`, sources `click-app-v2/*.jsx`, tokens `tokens/*.css`). Last synced: 3 Jul 2026.

---

## 1. Canvas + container

- Canvas = Cream `#F9F6F0` (`--cream`). Light mode only. No gradients, glass, or blur.
- One capped container: `max-width: var(--container-max)` + `margin-inline: auto`; desktop gutters 40px, mobile 16px.
- Everything left-aligns to ONE shared gutter. Only the right edge varies by content type.

### 1a. Fluid-first
- The site scales smoothly 375 -> 1440; breakpoints are for STRUCTURE only (nav -> bottom bar, columns -> 1-up, modal -> sheet, footer stack) - never just to resize type or cards.
- Card grids: `repeat(auto-fill, minmax(280px, 1fr))`, gap 16-24. **`auto-fill`, never `auto-fit`** - a lone card must hold its track width, not stretch across the row.
- Images: `max-width: 100%` + `aspect-ratio` + `object-fit: cover` (no layout shift).

### 1b. Mobile density (375)
- Single column, 16px gutters; section gaps 20-26 (not 40-56); card padding ~14; inner gaps 8.
- Event cards tile 2-up as MINI cards (banner, date, title 16/22 clamp-2, suburb, price + "N going"; whole card taps through - no inline CTA or tag row). No horizontal-scroll rails; grids grow DOWN. Hide inner-rail scrollbars.
- Chrome: compact header (wordmark + bell + avatar + hamburger) + sticky BOTTOM nav (Home · Discover · ✨ click FAB · My Events · Profile) with reserved bottom padding. Never nav pills in the header.
- Footer @375: two compact rows, links 11.5px, copyright 11px, 12/16px padding.

## 2. Content measure

- Stacked single-column blocks (banners, finish-setting-up, people card, radar bar, list rows, header text) cap at **~760px**, left-aligned at the gutter - never full container.
- Only card GRIDS and wide data (calendar) fill the container.

## 3. Type (CLICK_TYPE - tokens in `tokens/typography.css`)

- **Poppins** SemiBold 600 = display/headings/wordmark/button + tab labels; **system stack** = body. Never paragraphs in Poppins.
- Fluid `clamp(MIN, rem + N·cqi, MAX)` - MIN = the 375 size, MAX = desktop (the app body is a `container-type: inline-size` query container):
  - display 32 -> 64 (marketing only) · h1 24 -> 32 (`--text-h1`, every page title) · h2 20 -> 24 · h3 17 -> 20 (section headers) · card-title 16 -> 18 · body-lg 16 -> 17.
  - **Body = flat 16px, never below** (iOS zoom). Meta/body-sm 13. Micro/eyebrow 11-12 uppercase, letter-spacing .08-.1em.
- Page titles always use `--text-h1` - no bespoke px sizes. App greeting/page heading never uses display.

## 4. Page header (locked pattern)

- Optional EYEBROW: micro uppercase - Slate for greetings ("Good evening, Ava"), Deep Purple for context eyebrows ("YESTERDAY · PASTA FROM SCRATCH").
- TITLE: h1 (`--text-h1`), Ink `#1C1830`.
- Optional SUBLINE: body, Slate `#6B6580` - the one microcopy slot. No second subline.
- Header text block caps at the content measure.
- Section headers = h3, uniform size; right side may carry a quiet "See all →" purple link (13.5/600, invisible ≥40px hit padding).

## 5. Color (CLICK_PALETTE - tokens in `tokens/colors.css`)

- Deep Purple `#3B2F81` = the ONLY primary-action / selected / active color, flat. One filled-purple primary per viewport (stacked moment-banners are the one exception).
- Lavender `#C8B8F8` = small accents/hairlines; `--lavender-wash #F0ECF4` = tint fills; Mist `#E8E4F0` hairline; Mist-strong `#DDD7EA` tag hairline; Ink `#1C1830` text (never pure black); Slate `#6B6580` meta.
- Status colors on BADGES only: Sage (You're going / Attended / mutual), Amber (Trending / waitlist), Coral (Almost full), Teal (New), Slate-on-Mist (Full). Never on layout.
- Text on cream/lavender must pass AA (≥4.5:1 body, ≥3:1 large/UI).

## 6. Components (ONE component each - identical on every surface)

- **Buttons**: `.ck-btn` - md 44px min-height (primary), sm 36px (secondary/ghost); radius 12; label Poppins 600. ≥44px tap target for primaries (mobile keeps 44, tighter label 14-15).
- **Interest tag**: true-white `#FFFFFF` fill + 1px Mist-strong `#DDD7EA` hairline + Ink label, full pill, no dot, no tick. ≤3 per row + "+N", never wraps. Display-only.
- **Intent chip** ("Here for"): lavender-wash `#F0ECF4` fill + **1px `#C8B8F8` border** + Ink label, full pill. Display-only; outranks interest tags.
- **Filter chip** (interactive): white pill -> Deep-Purple FILL when selected (`aria-pressed`). The only chip that goes purple.
- **Event Card**: 16:9 banner (max-width ~340 so the banner reads as a banner), status badge top-left, Save/Share top-right, date eyebrow, 2-line-clamp title, locked venue "Suburb · distance" + lock glyph (aria-label), tags row, going-avatars, footer price-left / CTA-right pinned `margin-top: auto`. Mobile = the 2-up mini variant (§1b). Row variant for My Events lists.
- **People Card**: avatar 52 · name (card-title) + intent (13 Slate, never green) · conditional commonality line · ≤3 shared tags · action pair KEPT TOGETHER ("click with [name]" filled + "View profile" ghost). Narrow/mobile = stacked, full-width bottom actions.
- **Moment banner**: lavender-wash + `#C8B8F8` border, icon-circle left (intent-neutral glyph), eyebrow -> title -> one subline, actions right (one row, wrapping). Max 2 stacked.

### 6a. Lavender-wash card rule
`#F0ECF4` fill + ~16px radius everywhere; the 1px `#C8B8F8` border ONLY when the box sits on CREAM. On a white surface (inside a panel/modal) - borderless.
White card on white modal: 1px `#EDE9F2` hairline or soft shadow to separate.

## 7. Microcopy (CLICK_LANGUAGE)

- Hyphens, never em-dashes. "click with", never "click on" / "match". "click" is never a UI verb (use tap/pick/select). "event(s)" for labels; "plans" only as warm copy.
- City-agnostic on product surfaces: `{area}` + "near you" fallback; never hardcoded suburbs (marketing hero may name Sydney).
- Desire-framed, never deficit; intent-neutral; no rejection angle in either direction; never label the reader.
- Post-event opener: "Did you click with anyone?" - never "Who'd you click with?".
- Empty states guide the next step, never apologise; never a dead end.

## 8. Modal / sheet shell

- Desktop: white card on a dim scrim; radius `--radius-2xl`; max-width ~560-600 (profile) / 420 (reveal); max-height ~85vh, body scrolls under any sticky footer; ✕ top-right + Esc + scrim close; focus trapped and restored.
- Mobile (<768): full-screen sheet; filters = bottom sheet with grab-handle, sticky "Show N events" apply, ✕/scrim close (must actually close).
- Section eyebrows inside surfaces: Deep Purple micro uppercase.

## 9. Motion

- Scale: `--dur-fast` (chip/filter toggles) · `--dur-base` (fades, sheet rise, optimistic click flip) · `--dur-slow` (row-complete tick) · `--dur-peak` (the mutual reveal only).
- **Resting state is always visible** (`opacity: 1; transform: none`); animate FROM hidden, and never gate visibility on a CSS animation that restarts on re-render (drive one-shot moments - e.g. the reveal confetti - from canvas/rAF or mount-once state).
- ✨ spark: at most ONE per surface, trailing only, Deep Purple - reserved for peaks (mutual card/reveal, nav FAB, done screen). Never on pending states, radar, or profile. Confetti only on the mutual reveal, one-shot, brand palette.
- `prefers-reduced-motion` honoured everywhere (instant states, no confetti).

## 10. Accessibility

≥44px tap targets (or invisible hit padding on small text links); body ≥16; visible `:focus-visible` (Deep Purple ring + cream offset); `aria-pressed` on filter chips; labels on icon buttons + the venue lock glyph; keyboard + focus-trap on modals.

## 11. Footer

Two rows, NO divider between them: (1) wordmark + essential links; (2) "© 2026 Click · Made in Sydney" + social + email. Compact at 375 (§1b).

---

## Self-check (run before shipping any page)

1. Page title uses `--text-h1`; sections h3; no bespoke sizes; body ≥16.
2. One shared left gutter; stacked blocks ≤760; grids `auto-fill`; no lone-card stretch; no sideways scroll at 375.
3. One filled-purple primary per viewport; status color on badges only.
4. Tags/chips per §6 (white interest / bordered intent / purple-fill filter); Event + People cards are the shared components, unrestyled.
5. Lavender-wash border-on-cream rule (§6a) holds.
6. Mobile: bottom nav + compact header; modals -> sheets; footer compact; 44px targets.
7. Language: hyphens, "click with", `{area}`, no UI-verb "click", ≤1 ✨.
8. Resting states visible; reduced-motion safe.
