# Back-end Dashboard & Charts — Soft Minimal redesign guide

**North star: data is the hero, chrome recedes.** The same calm hairline language that carries the marketing pages (`public/concepts/06-soft-minimal.html`) now governs the admin and merchant surfaces. KPI numbers, chart bars and table cells do the talking; borders drop to a single 1px hairline, shadows go flat or whisper-soft, the loud electric-lime is demoted to a whisper, and one coral accent points the eye. Where the marketing concept has no charts or tables, this guide *extends* the language to data-viz coherently — a categorical palette derived from the canonical tokens, hand-rolled SVG/CSS recipes, and exact before/after for the two live chart files (`src/components/admin-trend-chart.tsx`, `src/components/merchant-finances-analytics.tsx`) and the admin tables.

## Table of contents

1. [Foundations — shared design tokens](#foundations--shared-design-tokens)
2. [Data-visualisation palette](#data-visualisation-palette)
3. [Components — anatomy & CSS](#components--anatomy--css)
4. [Building charts without a library](#building-charts-without-a-library)
5. [Accessibility for data-viz](#accessibility-for-data-viz)
6. [Migration from the current charts/tables](#migration-from-the-current-chartstables)

---

## Foundations — shared design tokens

All token values below are taken verbatim from `public/concepts/06-soft-minimal.html` (`:root`, lines 19–25).

### Design north star

**Soft Minimal** is airy, premium, and restrained. A white/cream canvas carries big, calm illustrations through generous whitespace, separated only by hairline dividers. A single coral accent does all the loud work; lavender plays the secondary highlight; lime appears only as a whisper. Everything breathes — soft long shadows, pill buttons, no hard edges — so the page reads as quiet, confident, and editorial rather than busy.

### Colour tokens

| Token | Hex | Role / usage rule |
| --- | --- | --- |
| `--purple` | `#3B2F81` | Emphasis words inside headings (`.lav` spans), def numbers, brand-deep accent. Use sparingly for emphasis, never for body text. |
| `--lavender` | `#C8B8F8` | Secondary highlight ONLY — heading underline swash (`linear-gradient` under "care about"), `::selection` background. |
| `--lav-bg` | `#F1ECFB` | Hover-row tint (`.grow:hover`), mini-avatar placeholder fill. The pale lavender wash for interaction states. |
| `--cream` | `#F9F6F0` | Page canvas (`body` background), button-ink text colour, avatar ring border. |
| `--paper` | `#FFFFFF` | Raised surfaces — quote card, floating cards on cream. |
| `--coral` | `#E8674C` | The ONLY loud accent. Primary CTA fill, eyebrow text + tick, brand dot, step numbers, "more" links, textlink underline, hero dot. |
| `--coral-d` | `#d3543b` | Coral button hover state only. |
| `--sage` | `#5B8C6E` | Reserved canonical accent (not actively used in this concept's surfaces). |
| `--teal` | `#2E7D8A` | Reserved canonical accent (not actively used in this concept's surfaces). |
| `--ink` | `#1C1830` | Headings + body text, ink button fill, default text colour. |
| `--slate` | `#6B6580` | Secondary text — leads, nav links, captions, stat labels, body paragraphs under headings. |
| `--mist` | `#E8E4F0` | Reserved soft neutral (canonical). |
| `--lime` | `#D6F24E` | The energy accent — a WHISPER only. Never a fill or a loud surface; reserved for the faintest touch. |
| `--line` | `rgba(28,24,48,0.10)` | Standard hairline divider — section borders, stat-row top/bottom, group rows, card borders. |
| `--line-s` | `rgba(28,24,48,0.07)` | Softer hairline — nav bottom border, inner stat separators. |

**Usage rules:** coral is the only loud accent; lavender = secondary highlight (underline swash + def top-borders + hover-row tint `--lav-bg`); lime is a whisper only; purple for emphasis words; slate for secondary text; ink for headings/body.

### `:root` CSS custom-property block

```css
:root {
  --purple:#3B2F81; --lavender:#C8B8F8; --lav-bg:#F1ECFB;
  --cream:#F9F6F0; --paper:#FFFFFF;
  --coral:#E8674C; --coral-d:#d3543b; --sage:#5B8C6E; --teal:#2E7D8A;
  --ink:#1C1830; --slate:#6B6580; --mist:#E8E4F0;
  --lime:#D6F24E;
  --line:rgba(28,24,48,0.10); --line-s:rgba(28,24,48,0.07);
}
```

### Typography

- **Display / headings / labels / buttons / numerals:** `"Schibsted Grotesk"` (weights 400, 500, 600, 700, 800). The `.disp` display class uses `font-weight:700; letter-spacing:-0.025em; line-height:1.04`.
- **Body:** `"Hanken Grotesk"` (weights 400, 500, 600), `line-height:1.65`.
- **Fallback stack:** `system-ui, sans-serif`.

Google Fonts link:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700;800&family=Hanken+Grotesk:wght@400;500;600&display=swap" rel="stylesheet" />
```

#### Type scale

| Element | Size | Other |
| --- | --- | --- |
| Hero `h1` | `clamp(2.7rem, 5.8vw, 4.5rem)` | line-height `1.04`, letter-spacing `-0.025em` (`.disp`) |
| Section `h2` (`.sec-h h2`) | `clamp(2rem, 4.2vw, 3rem)` | weight 700, letter-spacing `-0.025em`, line-height `1.06` |
| The-click `h2` | `clamp(1.9rem, 4vw, 2.7rem)` | weight 700, letter-spacing `-0.025em` |
| Closing `h2` | `clamp(2.4rem, 6vw, 4.4rem)` | weight 700, letter-spacing `-0.03em`, line-height `1.02` |
| How-row `h3` (`.hrow h3`) | `1.8rem` | weight 700, letter-spacing `-0.02em` |
| Feel-cell `h3` (`.fcell h3`) | `1.3rem` | weight 700, letter-spacing `-0.02em` |
| Group-row `h3` (`.grow h3`) | `1.25rem` | weight 700, letter-spacing `-0.02em` |
| Lead (`.lead`) | `1.16rem` | colour `--slate`, max-width `30rem` |
| Stat number (`.statrow .n`) | `2.6rem` | weight 700, letter-spacing `-0.03em`, line-height `1` |
| Eyebrow (`.eyebrow`) | `0.74rem` | weight 600, letter-spacing `0.18em`, `text-transform:uppercase`, colour `--coral` (or `--slate` via `.c`), 22×1px leading rule |

Note: `.disp` carries `letter-spacing:-0.025em`.

### Spacing & layout

- **Container** `.wrap`: `max-width:1080px; margin:0 auto; padding:0 28px`.
- **Section rhythm** `.sec`: `padding:88px 0` (stacked sections override with `padding-top:0`).
- **Hero** `.hero`: `padding:74px 0 64px`.
- **Grid gaps:** hero grid `56px` (`1.06fr 0.94fr`); feel grid `48px 40px` (3-col); how-rows `48px` gap with `54px 0` row padding (`0.9fr 1.1fr`); click defs `28px` (3-col); section heading top margins `14px`.
- General rhythm runs on an ~8px scale (8 · 18 · 24 · 30 · 34 · 48 · 56 · 88 px steps).

### Radii

| Surface | Radius |
| --- | --- |
| Buttons (pills) | `999px` |
| Cards (quote card `.q`) | `16px` |
| Mini-avatars (`.grow .mini-av .a`) | `999px` |
| Brand dot, hero dot | `999px` |

### Borders / dividers

Hairlines ONLY — `1px` solid `--line` (standard) or `1px` solid `--line-s` (softer). Used for section separators, stat-row top/bottom, inner stat dividers, group rows, nav border, and card outlines. **NO 2px borders anywhere.** (The textlink underline is the lone exception at `1.5px solid --coral`, and is a text decoration, not a divider.)

### Elevation / shadow

Soft, long, low-opacity shadows only — no hard offset shadows.

- **Coral button** (`.btn--coral`): `box-shadow:0 1px 2px rgba(28,24,48,.1), 0 16px 30px -16px rgba(232,103,76,.55);`
- **Quote card** (`.hero-art .q`): `box-shadow:0 20px 40px -24px rgba(28,24,48,.4);`

### Motion

- **Easing:** `cubic-bezier(.2,.7,.2,1)` everywhere.
- **Entrance:** `@keyframes rise { from{opacity:0; transform:translateY(18px);} to{opacity:1; transform:translateY(0);} }` applied via `.rise` at `.9s cubic-bezier(.2,.7,.2,1) both`. Stagger delays: `.d1=.05s · .d2=.15s · .d3=.25s · .d4=.35s · .d5=.45s`.
- **Hover lifts:** buttons `translateY(-2px)`; feature cells (`.fcell:hover`) `translateY(-5px)`.
- **Arrow nudge:** `.arr` shifts `translateX(4px)` on button/cell hover (`translateX(3px)` on textlinks + nav).
- **Group row slide:** `.grow:hover` → `padding-left:18px` + `background:var(--lav-bg)` (transition on `padding-left .3s` + `background-color .3s`); the row's "Join →" (`.go`) fades from `opacity:0` to `1`.
- **Reduced motion:** ALWAYS honoured — `@media (prefers-reduced-motion: reduce){ *{ animation:none !important; transition:none !important; scroll-behavior:auto !important; } }`.

### Breakpoints

- **≤ 920px:** hero grid → 1 column (gap `30px`); feel grid → 2 columns (gap `40px 32px`); how-rows → 1 column (incl. `.flip`, art `order:0`, max-width `240px`); click defs → 1 column; group rows drop the trailing "Join →"; nav links hide.
- **≤ 560px:** stat row → 1 column (separators become bottom borders); feel grid → 1 column.

### Iconography / illustration

Recoloured **Popsy SVGs** — calm, friendly line illustrations, centered in airy cells with no frames. Sizing: feature grid art `~150px` (`.fcell .art` height `150px`, `max-height:150px`); how-it-works rows `~300px` (`max-width:300px`, width `84%`); hero art `max-width:440px` (`92%`); the-click + closing art `~300px`/`~240px`. Each illustration sits on the bare canvas, never boxed, reinforcing the restrained, premium feel.

---

## Data-visualisation palette

The marketing concept ships no charts, so this is an **extension** — but it is built strictly from the canonical tokens above. Nothing new is introduced; we just assign existing tokens to data-viz roles.

### Categorical sequence (ordered)

Use this order. Pick the first *N* colours for *N* series — never skip ahead, never reorder.

| Order | Token | Hex |
| --- | --- | --- |
| 1 | `--coral` | `#E8674C` |
| 2 | `--purple` | `#3B2F81` |
| 3 | `--teal` | `#2E7D8A` |
| 4 | `--sage` | `#5B8C6E` |
| 5 | `--lavender` | `#C8B8F8` |
| 6 | `--slate` | `#6B6580` |
| 7 | `--lime` | `#D6F24E` (whisper — last only) |

Rules:
- **1 series → coral.** This is the default for every single-metric chart (the trend panels, the revenue bars).
- **2 series → coral + purple.** (e.g. revenue vs bookings — coral is the primary/money series, purple the secondary.)
- **3 → + teal · 4 → + sage · 5 → + lavender · 6 → + slate.**
- **Lime (`--lime`) is position 7 only** and only ever as a thin highlight — never a large fill. If you would need 7 fills, you almost certainly want a different chart (group the long tail into "Other" using `--slate`).

### Sequential / heat ramp

For one-variable intensity (calendar heat, density, a choropleth-style fill), ramp through the lavender family into purple — it stays inside the secondary-highlight lane and never competes with coral:

```
--lav-bg #F1ECFB  →  --lavender #C8B8F8  →  --purple #3B2F81
```

Interpolate in between for 5 steps: `#F1ECFB → #DDD0F4 → #C8B8F8 → #8173BC → #3B2F81`. (The two interior stops `#DDD0F4` and `#8173BC` are approximate linear-RGB midpoints — eyeball-tune if you need exact perceptual spacing.)

### Semantic palette

| Meaning | Token | Use |
| --- | --- | --- |
| Positive / up / approved / paid | `--sage` `#5B8C6E` (or `--teal` for a cooler read) | upward deltas, "approved"/"confirmed" pills, paid revenue ticks |
| Negative / down / rejected | `--coral` `#E8674C` | downward deltas, "rejected"/"refunded" pills, error fills |
| Neutral / no-change | `--slate` `#6B6580` | flat deltas, "pending"/"draft" pills, baseline series |
| Highlight / info / selected | `--lavender` `#C8B8F8` (fill) or `--lav-bg` (wash) | the focused bar, hover-row tint, "info" pills, selection |
| Warning | lime-adjacent — `--lime` `#D6F24E` as a **dot or hairline only**, never a fill | the one "needs attention" marker; pair with text, never colour-alone |

Note coral does double duty as both the brand accent *and* the negative semantic. That is fine because context disambiguates (a delta arrow vs a CTA), but **do not put a coral "down" delta next to a coral CTA** in the same card — move the CTA to `--ink`.

### Numerals & formatting

Big numbers are the hero — render them in **Schibsted Grotesk** with **tabular figures** so columns of digits line up:

```css
.stat-num {
  font-family: "Schibsted Grotesk", system-ui, sans-serif;
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
```

Tailwind: `font-[family-name:var(--font-display)] tabular-nums tracking-[-0.03em]`.

Reuse the formatters already in the chart files — do not hand-format money or dates:

- **AUD** — `new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })` (see `admin-trend-chart.tsx:3`). The shorthand `$${(cents/100).toLocaleString("en-AU", { maximumFractionDigits: 0 })}` in `merchant-finances-analytics.tsx:15` is fine for compact axis labels.
- **Counts** — `new Intl.NumberFormat("en-AU")` (`admin-members-table.tsx:26`).
- **Dates** — `new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" })` (`admin-trend-chart.tsx:9`); always pin `timeZone: "Australia/Sydney"` for month/day bucketing (`merchant-finances-analytics.tsx:3`).

### Copy-paste chart tokens

Add to `globals.css` `:root` (and the `@theme inline` block so Tailwind exposes `bg-[color:var(--chart-1)]` etc.):

```css
:root {
  /* data-viz categorical, in order */
  --chart-1: #E8674C; /* coral   — primary / 1-series default   */
  --chart-2: #3B2F81; /* purple  — secondary series             */
  --chart-3: #2E7D8A; /* teal                                   */
  --chart-4: #5B8C6E; /* sage                                   */
  --chart-5: #C8B8F8; /* lavender                               */
  --chart-6: #6B6580; /* slate                                  */
  --chart-7: #D6F24E; /* lime    — whisper, last only           */

  /* semantic shortcuts */
  --pos: #5B8C6E;     /* positive (sage)   */
  --neg: #E8674C;     /* negative (coral)  */
  --neu: #6B6580;     /* neutral (slate)   */
  --grid: rgba(28,24,48,0.07); /* = --line-s, gridlines */
}
```

```css
@theme inline {
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-chart-6: var(--chart-6);
  --color-chart-7: var(--chart-7);
}
```

That last block lets you write `bg-chart-1`, `text-chart-2`, `fill-chart-3` as first-class Tailwind utilities.

---

## Components — anatomy & CSS

### KPI / stat card

**Anatomy:** label (slate, eyebrow-ish, NOT mono) → big Schibsted number → optional delta chip (sage up / coral down / slate flat). Hairline or borderless on the cream/paper canvas; soft-ambient shadow at most.

This explicitly **replaces** the current `MetricCard` shell (`src/components/click-ui.tsx:73`) and the transaction KPI stickers (`admin-transactions-table.tsx:229,259–262`), which use `rounded-2xl border-2 … hard-shadow-sm`, `.font-display font-light`, `font-mono` labels and `.tilt-*` rotations.

```html
<div class="kpi">
  <span class="kpi__label">Paid revenue</span>
  <span class="kpi__num">$12,480</span>
  <span class="kpi__delta kpi__delta--up">▲ 8.2% vs last month</span>
</div>
```

```css
.kpi {
  background: var(--paper);
  border: 1px solid var(--line);   /* or borderless on cream */
  border-radius: 16px;
  padding: 22px 24px;
  /* shadow optional — keep it whisper-soft or drop it: */
  box-shadow: 0 1px 2px rgba(28,24,48,.04);
}
.kpi__label {
  display: block;
  font-family: "Schibsted Grotesk", system-ui, sans-serif;
  font-weight: 600; font-size: 0.78rem; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--slate);
}
.kpi__num {
  display: block; margin-top: 10px;
  font-family: "Schibsted Grotesk", system-ui, sans-serif;
  font-weight: 700; font-size: 2.4rem; letter-spacing: -0.03em;
  line-height: 1; color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.kpi__delta { display: inline-block; margin-top: 12px; font-size: 0.82rem; font-weight: 600; }
.kpi__delta--up   { color: var(--sage); }
.kpi__delta--down { color: var(--coral); }
.kpi__delta--flat { color: var(--slate); }
```

Tailwind equivalent for the card shell:
`rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6` then the number `font-[family-name:var(--font-display)] text-[2.4rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--ink)]`.

**Do**
- Let the number be the largest thing in the card.
- Use a coloured-text delta (no chip fill needed); reserve fills for charts.
- Sit cards directly on cream with a 1px hairline, or borderless with `--lav-bg` only on hover.

**Don't**
- `border-2`, `.hard-shadow-sm`, or any `.tilt-*` rotation.
- `font-mono` labels or `.font-display` serif numbers.
- Lime fills behind the number.

### Hairline stat row (dashboard header strip)

Reuse the marketing `.statrow` verbatim for the top-of-dashboard summary band — three to four KPIs separated by inner hairlines, bounded top and bottom. It is the most on-brand way to show headline numbers.

```css
.statrow { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.statrow .inner { display: grid; grid-template-columns: repeat(3, 1fr); }
.statrow .s { padding: 30px 8px; text-align: center; border-right: 1px solid var(--line-s); }
.statrow .s:last-child { border-right: 0; }
.statrow .n { font-family: "Schibsted Grotesk"; font-weight: 700; font-size: 2.6rem;
  letter-spacing: -0.03em; color: var(--ink); line-height: 1; font-variant-numeric: tabular-nums; }
.statrow .l { font-size: 0.86rem; color: var(--slate); margin-top: 8px; }
@media (max-width:560px){ .statrow .inner { grid-template-columns: 1fr; }
  .statrow .s { border-right: 0; border-bottom: 1px solid var(--line-s); } }
```

Use this for `src/app/admin/page.tsx` (currently 8× `MetricCard`) and the `merchant/page.tsx` `TabHeader` metric grids — collapse the boxed grid into one hairline strip wherever there are ≤4 headline numbers.

### Bar chart — full redesign

Single-series bars are **coral**; multi-series use the categorical sequence. Baseline is a 1px hairline, bars have a soft rounded top, axis labels are slate **Schibsted (not mono)**, and the tooltip is the paper-card pattern below.

**BEFORE** (`admin-trend-chart.tsx`, current):

```tsx
// panel shell
<div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
  {/* title */}
  <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">{m.label}</span>
  {/* total */}
  <span className="font-display text-2xl font-light leading-none text-[color:var(--ink)]">{m.format(total)}</span>
  <div className="mt-4 flex h-24 items-end gap-1.5">
    {/* bar */}
    <div className={`w-full rounded-t-md border border-[color:var(--line)] ${m.bar}`} style={{ height: `${pct}%` }} />
  </div>
  {/* axis */}
  <div className="mt-2 flex justify-between font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">…</div>
</div>
// bar colors: members bg-[var(--peach)] (lime!) · events bg-[var(--rose)] · rsvps bg-[var(--ink)] · revenue bg-[var(--punch)] (lime!)
```

**AFTER** (soft-minimal):

```tsx
// panel shell — 1px hairline, paper, no hard-shadow
<div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
  {/* title — Schibsted eyebrow with 22px coral rule */}
  <span className="inline-flex items-center gap-[9px] font-[family-name:var(--font-display)] text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--slate)]
                   before:h-px before:w-[22px] before:bg-[color:var(--coral)] before:content-['']">
    {m.label}
  </span>
  {/* total — grotesk, tabular */}
  <span className="font-[family-name:var(--font-display)] text-2xl font-bold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--ink)]">
    {m.format(total)}
  </span>
  {/* track sits on a 1px baseline */}
  <div className="mt-4 flex h-24 items-end gap-1.5 border-b border-[color:var(--line)]">
    {/* bar — single coral fill, soft rounded top, NO per-bar border */}
    <div className="w-full rounded-t-[5px] bg-[color:var(--chart-1)] transition-[height]" style={{ height: `${pct}%` }} />
  </div>
  {/* axis — Schibsted, slate, not uppercase-mono */}
  <div className="mt-2 flex justify-between font-[family-name:var(--font-display)] text-[0.7rem] font-medium text-[color:var(--slate)]">
    <span>{dateFormatter.format(new Date(buckets[0].week))}</span><span>now</span>
  </div>
</div>
```

Per-metric bar colour, mapped onto the categorical sequence instead of `peach/rose/ink/punch`:

```ts
const metrics = [
  { key: "members",      label: "New members",  bar: "bg-[color:var(--chart-2)]" }, // purple
  { key: "events",       label: "New events",   bar: "bg-[color:var(--chart-1)]" }, // coral
  { key: "rsvps",        label: "RSVPs",        bar: "bg-[color:var(--chart-3)]" }, // teal
  { key: "revenueCents", label: "Paid revenue", bar: "bg-[color:var(--chart-1)]" }, // coral (money = primary)
];
```

For `merchant-finances-analytics.tsx`, do the identical surgery: shell `border-2 → border`, drop `hard-shadow-sm`, header bar `border-b-2 bg-[var(--champagne)] → border-b bg-[var(--paper)]` (or remove the filled header strip entirely in favour of the eyebrow), bar `border-2 … bg-[var(--peach)] → rounded-t-[5px] bg-[var(--chart-1)]` (coral), and every `font-mono … uppercase tracking-[…]` label → Schibsted slate. Keep the fixed bar canvas heights (`h-24` = 96px here, `120px` in finances, `160px` in `MerchantTrends`) so layout doesn't shift.

**Do** — one coral fill for a single series; hairline baseline; emphasise the *focused* bar with `--lavender` and dim the rest to `color-mix(in srgb, var(--chart-1) 35%, var(--paper))`; round only the top corners (4–5px).

**Don't** — give every bar a border; use lime as the default fill; label axes in mono uppercase; stack a hard shadow under the panel.

### Line / area / sparkline

Hand-rolled SVG. Stroke in coral (single series) or the categorical sequence; area fill is the same hue at **low opacity** (`fill-opacity: 0.12`); gridlines are `--line-s`. Sparklines drop axes entirely.

```html
<svg viewBox="0 0 240 64" class="line" preserveAspectRatio="none" role="img" aria-label="Revenue trend, rising">
  <!-- area -->
  <path d="M0,52 L40,40 L80,44 L120,28 L160,30 L200,16 L240,20 L240,64 L0,64 Z"
        fill="var(--coral)" fill-opacity="0.12" />
  <!-- line -->
  <path d="M0,52 L40,40 L80,44 L120,28 L160,30 L200,16 L240,20"
        fill="none" stroke="var(--coral)" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round" />
  <!-- last-point dot -->
  <circle cx="240" cy="20" r="3" fill="var(--coral)" />
</svg>
```

Spacing: give the SVG a definite parent height (sparkline `h-12`–`h-16`, full chart `h-40`–`h-56`). End-point dot is the only solid mark; never plot every vertex.

### Donut / progress ring

SVG `circle` with `stroke-dasharray`. Track is `--line`, value arc is coral (or sage for "complete"/positive). Centre holds the Schibsted number.

```html
<svg viewBox="0 0 80 80" class="ring" role="img" aria-label="Setup 60% complete">
  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--line)" stroke-width="8" />
  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--coral)" stroke-width="8"
          stroke-linecap="round" transform="rotate(-90 40 40)"
          stroke-dasharray="213.6" stroke-dashoffset="85.4" /> <!-- 60% → 213.6*(1-0.6) -->
</svg>
```

`circumference = 2π·34 ≈ 213.6`; `dashoffset = circumference * (1 − fraction)`. Use this to replace the `SetupProgress` bar in `merchant/page.tsx:509`. For a simple horizontal progress bar use a `--lav-bg` track + coral fill, both `rounded-full`, `h-2` — never the lime `bg-peach-soft` track currently used at `merchant/page.tsx:437,490`.

### Distribution / stacked / horizontal-bar list

Category mixes (the `MerchantTrends` category list, `merchant/page.tsx:428`) become hairline rows with a `--lav-bg` track and per-category fills from the categorical sequence:

```html
<div class="dist-row">
  <span class="dist-row__label">Workshops</span>
  <div class="dist-row__track"><div class="dist-row__fill" style="width:62%; background:var(--chart-1)"></div></div>
  <span class="dist-row__val">62%</span>
</div>
```

```css
.dist-row { display:grid; grid-template-columns: 8rem 1fr auto; gap:14px; align-items:center; padding:12px 0; border-bottom:1px solid var(--line-s); }
.dist-row__label { color: var(--slate); font-size:0.9rem; }
.dist-row__track { height:8px; border-radius:999px; background: var(--lav-bg); }
.dist-row__fill  { height:8px; border-radius:999px; }
.dist-row__val   { font-family:"Schibsted Grotesk"; font-weight:600; font-variant-numeric: tabular-nums; color:var(--ink); }
```

For a true stacked bar, lay segments left-to-right in categorical order inside one `rounded-full` track; the first/last segment inherits the track radius.

### Tooltip pattern

Model directly on the hero quote card `.q` — paper, 1px `--line`, soft long shadow, 16px radius.

```css
.tip {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 13px;
  box-shadow: 0 20px 40px -24px rgba(28,24,48,.4);
  pointer-events: none;
}
.tip__t { font-family:"Schibsted Grotesk"; font-weight:600; font-size:0.9rem; color:var(--ink); font-variant-numeric: tabular-nums; }
.tip__s { font-size:0.74rem; color:var(--slate); margin-top:3px; }
```

For the simplest case keep the native `title={…}` attribute already on the bars (`admin-trend-chart.tsx:67`) — it's free and accessible. Upgrade to the `.tip` card only where you need styled, multi-line, or hover-anchored tips.

### Data tables

The admin tables (`admin-members-table.tsx`, `admin-merchants-table.tsx`, `admin-transactions-table.tsx`) lose the black `surface-deep` mono-uppercase header bar and 2px frame. New recipe: hairline row dividers, **Schibsted column headers in slate**, generous row padding, and a `--lav-bg` hover tint (the `.grow:hover` move).

```css
.tbl { border:1px solid var(--line); border-radius:16px; background:var(--paper); overflow:hidden; }
.tbl__head {
  display:grid; /* same grid-template-columns as rows */
  padding:14px 20px; border-bottom:1px solid var(--line);
  background:var(--paper);
  font-family:"Schibsted Grotesk"; font-weight:600; font-size:0.74rem;
  letter-spacing:0.08em; text-transform:uppercase; color:var(--slate);
}
.tbl__row {
  display:grid; padding:18px 20px; border-bottom:1px solid var(--line-s);
  align-items:center; transition:background-color .25s, padding-left .25s cubic-bezier(.2,.7,.2,1);
}
.tbl__row:last-child { border-bottom:0; }
.tbl__row:hover { background:var(--lav-bg); }   /* optional: padding-left:24px for the slide */
```

**BEFORE** (`admin-members-table.tsx:476–477`):

```tsx
<div className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
  <div className="… rounded-t-2xl bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] md:grid">
```

**AFTER**:

```tsx
<div className="mt-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] overflow-hidden">
  <div className="… px-5 py-3.5 border-b border-[color:var(--line)] bg-[color:var(--paper)]
                  font-[family-name:var(--font-display)] text-[0.74rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--slate)] md:grid">
```

#### Status pills

Replace the lime/rose/ink `roleTone`/`statusTone` maps (`admin-members-table.tsx:28–32`, `admin-merchants-table.tsx:18–24`) with tinted-wash + coloured-text pills (no loud fills):

```css
.pill { display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 11px;
  border-radius:999px; font-family:"Schibsted Grotesk"; font-weight:600; font-size:0.75rem; }
.pill--pos  { background: color-mix(in srgb, var(--sage) 14%, var(--paper));     color: var(--sage); }     /* approved / confirmed / paid */
.pill--act  { background: color-mix(in srgb, var(--coral) 14%, var(--paper));    color: var(--coral-d); }  /* action needed / rejected / refunded */
.pill--neu  { background: var(--lav-bg);                                          color: var(--slate); }    /* pending / draft / neutral */
.pill--info { background: color-mix(in srgb, var(--lavender) 28%, var(--paper)); color: var(--purple); }   /* info / merchant role */
```

Map: approved/confirmed/paid → `--pos` (sage); rejected/refund/action → `--act` (coral); pending/draft/neutral → `--neu` (slate); info/merchant → `--info` (lavender). Always include the text label — the colour is reinforcement, never the only signal.

**Do** — hairline dividers, slate headers, roomy `py-[18px]` rows, `--lav-bg` hover, tinted pills.
**Don't** — `border-2`, black header bars, `font-mono`/`font-black` headers, lime/rose solid pill fills, `divide-y-2`.

### Filters / segmented controls / period picker

Pill controls, coral active, 1px hairline idle. Replace the `border-2` search/select inputs (`admin-members-table.tsx:471,513`).

```css
.seg { display:inline-flex; gap:6px; }
.seg__btn { height:36px; padding:0 16px; border-radius:999px; border:1px solid var(--line);
  background:var(--paper); font-family:"Schibsted Grotesk"; font-weight:600; font-size:0.85rem;
  color:var(--slate); transition:background-color .2s, color .2s, border-color .2s; }
.seg__btn:hover { background:var(--lav-bg); color:var(--ink); }
.seg__btn[aria-pressed="true"] { background:var(--coral); border-color:var(--coral); color:#fff; }

.input { height:38px; padding:0 16px; border-radius:999px; border:1px solid var(--line);
  background:var(--paper); font-size:0.9rem; color:var(--ink); }
.input::placeholder { color: color-mix(in srgb, var(--slate) 70%, transparent); }
.input:focus-visible { outline:none; border-color:var(--coral);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--coral) 22%, transparent); }
```

Pagination: same pill recipe; current page = coral fill, others = hairline; the row-count footer goes from `font-mono uppercase` (`admin-members-table.tsx:502`) to Schibsted slate.

### Empty states & loading skeletons

Calm and hairline — never `border-dashed` (drop the dashed empty state at `admin-trend-chart.tsx:31`).

```html
<!-- empty -->
<div class="empty">
  <p class="empty__t">No trend data yet</p>
  <p class="empty__s">Buckets populate as activity accrues.</p>
</div>
```
```css
.empty { border:1px solid var(--line); border-radius:16px; background:var(--paper);
  padding:40px 24px; text-align:center; }
.empty__t { font-family:"Schibsted Grotesk"; font-weight:600; color:var(--ink); }
.empty__s { color:var(--slate); font-size:0.9rem; margin-top:6px; }

/* skeleton — shimmer of --lav-bg, honours reduced-motion */
.skl { background:var(--lav-bg); border-radius:8px; position:relative; overflow:hidden; }
.skl::after { content:""; position:absolute; inset:0;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent);
  transform:translateX(-100%); animation:shimmer 1.4s infinite; }
@keyframes shimmer { to { transform:translateX(100%); } }
@media (prefers-reduced-motion: reduce){ .skl::after { animation:none; } }
```

Skeleton bars in a chart: render N grey `--lav-bg` columns at varied heights inside the same `h-24` track so the layout doesn't jump when data lands.

### Sidebar & page-header chrome

**Sidebar** (`admin-sidebar.tsx`, `merchant-sidebar.tsx`): drop `rounded-3xl border-2 … hard-shadow`; the nav becomes a quiet column. Inactive items are slate; the active item gets a **coral indicator** (a 3px coral bar on the left, or coral text + `--lav-bg` wash) — not a black `bg-ink` block.

```css
.snav { background:var(--paper); border:1px solid var(--line); border-radius:18px; padding:10px; }
.snav__item { display:flex; align-items:center; gap:12px; height:42px; padding:0 14px;
  border-radius:12px; color:var(--slate); font-family:"Schibsted Grotesk"; font-weight:600;
  font-size:0.92rem; position:relative; transition:background-color .2s, color .2s; }
.snav__item:hover { background:var(--lav-bg); color:var(--ink); }
.snav__item--active { color:var(--coral); background:var(--lav-bg); }
.snav__item--active::before { content:""; position:absolute; left:0; top:9px; bottom:9px;
  width:3px; border-radius:999px; background:var(--coral); }
.snav__sep { height:1px; background:var(--line); margin:8px 0; }  /* was border-t-2 */
```

The merchant `+ Create event` CTA (`merchant-sidebar.tsx:178`) uses the `.btn--coral` pill, not `border-2 bg-rose hard-shadow-sm`.

**Page header** (`admin-page-header.tsx`): replace the `font-mono tracking-[0.2em] text-rose` eyebrow + `.font-display text-4xl/5xl font-light` H1 with the canonical eyebrow recipe + grotesk H1:

```tsx
<span className="inline-flex items-center gap-[9px] font-[family-name:var(--font-display)] text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--coral)]
                 before:h-px before:w-[22px] before:bg-[color:var(--coral)] before:content-['']">
  Admin
</span>
<h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.025em] text-[color:var(--ink)]">
  Members
</h1>
```

---

## Building charts without a library

No chart library — everything is SVG or CSS-height divs. Recipes in the soft idiom:

### 1. CSS bar chart (the definite-height gotcha)

This is already solved correctly in `admin-trend-chart.tsx:61–73`: a percentage-height bar **only resolves against a parent with a definite height**. So wrap each column in a full-height flex cell:

```tsx
<div className="flex h-24 items-end gap-1.5 border-b border-[color:var(--line)]">
  {data.map((d) => {
    const pct = Math.max(Math.round((d.value / max) * 100), d.value > 0 ? 6 : 2); // floor so tiny>0 stays visible
    return (
      <div key={d.key} className="group relative flex h-full flex-1 items-end" title={`${d.label} · ${fmt(d.value)}`}>
        <div className="w-full rounded-t-[5px] bg-[color:var(--chart-1)]" style={{ height: `${pct}%` }} />
      </div>
    );
  })}
</div>
```

The `h-24` (96px) parent is the load-bearing piece — without it the bars collapse to zero. Keep the existing canvas heights: **96px** (admin trend), **120px** (finances), **160px** (merchant trends).

### 2. Line/area path from data

```ts
function toPath(values: number[], w = 240, h = 56, pad = 4) {
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - pad - (v / max) * (h - pad * 2)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area };
}
```
Render `area` with `fill="var(--coral)" fill-opacity="0.12"` behind `line` with `stroke="var(--coral)" stroke-width="2"`.

### 3. Gridlines

Faint horizontal rules at `--line-s` (= `--grid`), drawn as SVG `<line>` or absolutely-positioned divs behind the bars. 3–4 lines max; label the top value in slate Schibsted, tabular.

### 4. Tabular numerals everywhere numbers stack

Any axis labels, tooltip values, KPI numbers, table number columns: `font-variant-numeric: tabular-nums` (`tabular-nums` in Tailwind) so digits don't jitter between frames.

### 5. Server-component friendly

All these charts are pure render from props (see both existing files are server components). Keep them server components; only add `"use client"` when you need hover state beyond native `title`.

---

## Accessibility for data-viz

- **Never colour-alone.** A coral "down" / sage "up" delta must also carry a glyph (▲/▼) or the word; status pills always show their text label, not just a hue.
- **Distinguish series beyond hue.** For multi-series where colours are close (sage vs teal), add a pattern (`fill` + a thin `--paper` hatch via `<pattern>`) or direct labels at the line ends.
- **Contrast on cream.** Coral (`#E8674C`) and purple (`#3B2F81`) clear AA against `--cream`/`--paper`; **lavender and lime do not carry text or thin marks** — use them only as large fills, and pair lime with an ink label. Slate (`#6B6580`) on cream is the floor for body/label contrast.
- **Title + aria.** Every SVG chart gets `role="img"` and a one-line `aria-label` summarising the trend ("Revenue trend, rising to $12,480"). Keep the native `title` on bars for hover/screen-reader parity.
- **Tabular alignment** is an accessibility feature too — `tabular-nums` keeps number columns scannable for low-vision users.
- **Focus + reduced motion.** Interactive bars/segments get a visible `:focus-visible` ring (`0 0 0 3px color-mix(coral 22%)`). All chart entrance/shimmer animation sits behind `@media (prefers-reduced-motion: reduce)`.
- **Don't encode meaning in lime.** It fails contrast for fine detail; reserve it for a single large highlight or a dot beside a text label.

---

## Migration from the current charts/tables

The live look is "River / neo-brutalist editorial": electric-lime as the primary fill, 2px borders, hard-ish shadows on every surface, `font-mono` uppercase labels, and an editorial serif for numbers. Soft Minimal inverts all of that.

### Old → new token / pattern map

| Current (River) | Soft-Minimal replacement | Notes |
| --- | --- | --- |
| `--peach` / `--punch` `#E2FF05` (electric lime) as primary fill | `--coral` (`--chart-1`); lime → `--chart-7`, whisper only | Highest-impact change. Currently the signature fill on KPIs, status pills, chart bars, hover states. |
| `--rose` `#FF5A3C` (coral, text + fill) | `--coral` / `--coral-d` (darker for text + focus) | Keep coral's role; split the shade so text/focus stays legible. |
| `--champagne` `#F4F1EA` (page bg) | `--cream` `#F9F6F0` | Cooler, cleaner canvas. |
| current `--cream` `#FBF9F4` (card surface) | `--paper` `#FFFFFF` | Raised surfaces go to true paper. |
| `--mauve` `#5C616B` (gray text) | `--slate` `#6B6580` | Same role, renamed. |
| `--font-click-display` (serif) on stats/H1 | **Schibsted Grotesk** | All `.font-display font-light` numbers/H1 → grotesk bold, tabular. |
| `.eyebrow` / hand-rolled `font-mono uppercase tracking-[0.18em]` | Schibsted eyebrow + 22px coral hairline rule | Kills the mono-label tic on every chart header, table header and page header. |
| `border-2 border-[color:var(--line)]` | `border` (1px) `--line` | Global drop to hairline on cards, charts, tables, inputs, sidebars. |
| `.hard-shadow-sm` on every surface | flat, or `0 1px 2px rgba(28,24,48,.04)` | Strip ubiquitous shadow. |
| `rounded-2xl` cards / `rounded-3xl` sidebars | 16px cards / 18px sidebars / 999px pills | `rounded-2xl` already ≈16px; soften `rounded-3xl`. |
| `.tilt-l/r-*` on KPI cards | remove (square up) | `admin-transactions-table.tsx:229,259–262`. |
| `bg-[var(--surface-deep)]` black table header | hairline header row, slate Schibsted text | `admin-members-table.tsx:477`, `admin-merchants-table.tsx:322`. |
| `bg-peach-soft` progress/category track | `--lav-bg` track + coral fill | `merchant/page.tsx:437,490`. |

### Exact anti-patterns in the two chart files & their fixes

`admin-trend-chart.tsx`:
1. `rounded-2xl border-2 … hard-shadow-sm` panel (`:46`) → `rounded-2xl border bg-[color:var(--paper)]`.
2. `font-mono … uppercase tracking-[0.18em] text-[var(--rose)]` title (`:49`) → Schibsted eyebrow + coral hairline, slate text.
3. `font-display text-2xl font-light` total (`:52`) → `font-[family-name:var(--font-display)] font-bold tabular-nums`.
4. Bar fills `bg-[var(--peach)]` / `bg-[var(--punch)]` = **lime** (`:22,25`) → `--chart-1`/`--chart-2`/`--chart-3` per the sequence (money = coral).
5. Per-bar `border border-[var(--line)]` (`:70`) → drop; add one `border-b` baseline on the track instead.
6. `font-mono … uppercase` axis (`:77`) → Schibsted slate.
7. `border-2 border-dashed` empty state (`:31`) → hairline `.empty` card.

`merchant-finances-analytics.tsx`:
1. `rounded-2xl border-2 … hard-shadow-sm` shell (`:54`) → `rounded-2xl border bg-[var(--paper)]`.
2. `border-b-2 … bg-[var(--champagne)]` header bar (`:55`) → `border-b bg-[var(--paper)]`, or remove the strip for the eyebrow.
3. `font-mono … uppercase tracking-[0.18em] text-[var(--rose)]` title + `…text-mauve` total (`:56,59`) → Schibsted eyebrow / slate.
4. Bar `border-2 border-[var(--line)] bg-[var(--peach)]` (lime) (`:83`) → `rounded-t-[5px] bg-[color:var(--chart-1)]` (coral), no border.
5. `font-mono` value/month labels (`:74,87`) → Schibsted, ink value / slate month, tabular.
6. Keep the `120px` bar canvas and the Sydney-pinned `Intl` formatters.

The same five edits apply to the three undeclared charts in `merchant/page.tsx` — `MerchantTrends` grouped bars + category list (`:389,428`) and `ConfirmedRsvpChart` (`:476`).

### Suggested order

1. **Tokens first** — add `--paper`, the `--chart-1..7` and semantic block, and the eyebrow recipe to `globals.css`; rebind `--peach`/`--punch` away from lime. This cascades everywhere.
2. **Shared primitives** — `src/components/click-ui.tsx` (`MetricCard`, `InfoCard`, `Pill`) and `admin-page-header.tsx`; fixing these re-skins most cards/labels for free.
3. **Charts** — `admin-trend-chart.tsx`, `merchant-finances-analytics.tsx`, then the three in `merchant/page.tsx`.
4. **Tables** — `admin-members-table.tsx`, `admin-merchants-table.tsx`, `admin-transactions-table.tsx` (shell, header, pills, filters, pagination).
5. **Chrome** — `admin-sidebar.tsx`, `merchant-sidebar.tsx`, then the dashboard pages `admin/page.tsx` + `merchant/page.tsx` (collapse boxed KPI grids into `.statrow` strips).
6. **Sweep** — grep for leftover `border-2`, `hard-shadow`, `font-mono`, `--peach`/`--punch`, `.tilt-`, `bg-peach-soft`, `border-dashed`, `surface-deep` across the dashboard tree.
