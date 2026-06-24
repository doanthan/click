# Click — Frontend Redesign Guide ("Soft Minimal")

> Consumer-facing surfaces only: marketing/landing, discover/browse, event detail, auth/onboarding, and profile. This guide ports the live "River / neo-brutalist editorial" frontend to the **Soft Minimal** language defined in `public/concepts/06-soft-minimal.html`. (For admin/merchant dashboards, see the dashboard guide.)

## North star

**Soft Minimal is airy, premium, and restrained.** A white/cream canvas carries big, calm Popsy illustrations through generous whitespace, separated only by hairline dividers. A single coral accent does all the loud work; lavender plays the secondary highlight; lime appears only as a whisper. Everything breathes — soft long shadows, pill buttons, no hard edges — so each page reads as quiet, confident, and editorial rather than busy. The redesign's whole job is to **delete weight**: kill the electric-lime fills, the 2px borders, the mono uppercase labels, the heavy serif, and the zine-y tilts — and replace them with grotesk type, 1px hairlines, coral, and air.

## Table of contents

1. [Foundations — shared design tokens](#foundations--shared-design-tokens)
2. [Components — anatomy & CSS](#components--anatomy--css)
3. [Layout & responsive](#layout--responsive)
4. [Motion & interaction](#motion--interaction)
5. [Voice & content](#voice--content)
6. [Accessibility](#accessibility)
7. [Applying it to real pages](#applying-it-to-real-pages)
8. [Migration from the current "River" look](#migration-from-the-current-river-look)

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

## Components — anatomy & CSS

Each component below maps a concept block to React/Tailwind. Pull the raw CSS from `public/concepts/06-soft-minimal.html` (line numbers cited). Where useful, a Tailwind-4 equivalent is given — but for load-bearing, repeated chrome (nav, buttons, eyebrow) prefer a real CSS class in `globals.css` over long arbitrary-value chains.

### Sticky blur nav + brand wordmark

**Purpose:** A near-invisible top bar that floats over the cream canvas. The cream tint is semi-transparent with a backdrop blur so content scrolls softly behind it; a single hairline separates it from the page.

**Anatomy:** `.nav-shell` (sticky, blurred) → `.wrap.nav` (flex row, 78px tall, bottom hairline) → `.brand` wordmark (coral period dot `.pd`) · `.links` (slate nav links) · `.cta` (ink textlink with arrow nudge).

**Key CSS** (concept lines 54–62):

```css
.nav-shell { position:sticky; top:0; z-index:60; background:color-mix(in srgb, var(--cream) 86%, transparent); backdrop-filter:blur(10px); }
.nav { display:flex; align-items:center; justify-content:space-between; height:78px; border-bottom:1px solid var(--line-s); }
.brand { font-family:"Schibsted Grotesk"; font-weight:800; font-size:1.4rem; letter-spacing:-0.03em; color:var(--ink); display:inline-flex; align-items:baseline; }
.brand .pd { width:7px; height:7px; border-radius:999px; background:var(--coral); margin-left:3px; align-self:flex-end; margin-bottom:5px; }
.nav .links a { font-size:0.92rem; font-weight:500; color:var(--slate); }
.nav .links a:hover { color:var(--ink); }
```

**Tailwind notes:** the `color-mix` blur tint has no clean utility — keep it as a `.nav-shell` class, or use `bg-[color-mix(in_srgb,var(--cream)_86%,transparent)] backdrop-blur-[10px] sticky top-0 z-[60]`. The brand dot is a `<span>` (`w-[7px] h-[7px] rounded-full bg-[color:var(--coral)] self-end mb-[5px] ml-[3px]`). The live `.click-wordmark` (serif, lime dot) in `globals.css:156` must be replaced wholesale.

**Do:** keep the bar to 78px, one hairline, slate links that darken to ink on hover. Hide `.links` ≤920px and rely on the existing `portal-mobile-nav.tsx` for the drawer.
**Don't:** add a 2px border, a hard shadow, a solid background, or the serif wordmark. No lime period dot — the dot is coral.

### Buttons — `.btn--coral`, `.btn--ink`, `.textlink`

**Purpose:** One loud primary (coral pill), one quiet primary (ink pill), and an inline text CTA (coral-underlined with an arrow). There is exactly one coral button per viewport ideally.

**Anatomy:** 52px-tall pill, 26px horizontal padding, 999px radius, Schibsted 600, an `.arr` span that nudges right on hover.

**Key CSS** (concept lines 44–51):

```css
.btn { display:inline-flex; align-items:center; gap:9px; height:52px; padding:0 26px; border-radius:999px; font-family:"Schibsted Grotesk"; font-weight:600; font-size:0.98rem; transition:transform .25s cubic-bezier(.2,.7,.2,1), background-color .2s, box-shadow .25s; }
.btn .arr { transition:transform .25s cubic-bezier(.2,.7,.2,1); } .btn:hover .arr { transform:translateX(4px); }
.btn--coral { background:var(--coral); color:#fff; box-shadow:0 1px 2px rgba(28,24,48,.1), 0 16px 30px -16px rgba(232,103,76,.55); }
.btn--coral:hover { transform:translateY(-2px); background:var(--coral-d); }
.btn--ink { background:var(--ink); color:var(--cream); }
.btn--ink:hover { transform:translateY(-2px); background:#000; }
.textlink { display:inline-flex; align-items:center; gap:8px; font-family:"Schibsted Grotesk"; font-weight:600; color:var(--ink); border-bottom:1.5px solid var(--coral); padding-bottom:2px; }
.textlink:hover .arr { transform:translateX(3px); }
```

**Tailwind notes:** wrap these as a `<Button variant="coral|ink|text">` component (or extend `LinkButton` in `src/components/click-ui.tsx`). The coral glow shadow is `shadow-[0_1px_2px_rgba(28,24,48,.1),0_16px_30px_-16px_rgba(232,103,76,.55)]`. The arrow is a literal `<span className="arr">&rarr;</span>` so it can transform independently. Note `.btn--coral` text is pure `#fff`, not cream.

**Do:** use coral for the single most important action per screen (Start exploring / RSVP / Save). Use ink for the secondary pill. Use `.textlink` for tertiary "Browse events →" inline CTAs.
**Don't:** stack two coral buttons side by side. Don't use lime as a button fill (the current `bg-rose` / lime CTAs all migrate). Don't drop the arrow-nudge or the hover `translateY(-2px)`.

### Eyebrow — Schibsted + 22px coral hairline

**Purpose:** The label voice. Replaces the entire `font-mono uppercase` eyebrow tic. A short coral rule precedes uppercase Schibsted text.

**Key CSS** (concept lines 40–42):

```css
.eyebrow { font-family:"Schibsted Grotesk"; font-weight:600; font-size:0.74rem; letter-spacing:0.18em; text-transform:uppercase; color:var(--coral); display:inline-flex; align-items:center; gap:9px; }
.eyebrow::before { content:""; width:22px; height:1px; background:var(--coral); }
.eyebrow.c { color:var(--slate); } .eyebrow.c::before { background:var(--slate); }
```

**Tailwind notes:** keep `.eyebrow` as a real class — the `::before` rule is awkward inline. Two variants: default (coral) and `.c` (slate, for section sub-labels). Center it with `justify-content:center` when used over a centered heading.

**Do:** use coral eyebrows above hero/closing CTAs; slate (`.c`) above mid-page sections. Keep the 22px rule.
**Don't:** use `font-mono`, `tracking-[0.2em] text-rose`, condensed Archivo, or the `✷` glyph. The existing `.eyebrow` helper in `globals.css:176` (condensed-mono mauve) is fully replaced.

### Hero

**Purpose:** Asymmetric two-column hero — text left, a single floating Popsy illustration right with a small overlaid quote card and a coral dot. Sells the calm, editorial mood instantly.

**Anatomy:** `.hero-grid` (`1.06fr 0.94fr`, 56px gap) → left column (eyebrow, `h1.disp`, `.lead`, `.actions`) → `.hero-art` (img + absolutely-positioned `.q` quote card + `.dot`). The `h1` mixes a `.lav` purple emphasis word and a `.u` lavender underline swash.

**Key CSS** (concept lines 65–77):

```css
.hero { padding:74px 0 64px; }
.hero-grid { display:grid; grid-template-columns:1.06fr 0.94fr; gap:56px; align-items:center; }
.hero h1 { font-size:clamp(2.7rem,5.8vw,4.5rem); color:var(--ink); margin-top:24px; }
.hero h1 .lav { color:var(--purple); }
.hero h1 .u { background:linear-gradient(transparent 66%, var(--lavender) 66% 94%, transparent 94%); }
.hero .lead { margin-top:24px; max-width:30rem; font-size:1.16rem; color:var(--slate); }
.hero-art .q { position:absolute; bottom:6%; left:0; background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:13px 17px; box-shadow:0 20px 40px -24px rgba(28,24,48,.4); max-width:15rem; }
.hero-art .dot { position:absolute; width:10px; height:10px; border-radius:999px; background:var(--coral); top:14%; right:12%; }
```

**Tailwind notes:** the `.u` lavender swash is a background-gradient highlight on an inline `<span>` — replicate exactly: `bg-[linear-gradient(transparent_66%,var(--lavender)_66%_94%,transparent_94%)]`. The quote card is the only raised `--paper` surface in the hero; give it the soft drop shadow above.

**Do:** one emphasis word in purple (`.lav`), one phrase under the lavender swash (`.u`). Float exactly one quote card + one coral dot.
**Don't:** box the illustration, add multiple accent colours, or use the serif for the H1.

### Hairline stat row (`.statrow`)

**Purpose:** Three social-proof numbers separated by hairlines — no card blocks, no fills. Big Schibsted numerals over slate labels.

**Key CSS** (concept lines 80–85):

```css
.statrow { margin-top:8px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.statrow .inner { display:grid; grid-template-columns:repeat(3,1fr); }
.statrow .s { padding:30px 8px; text-align:center; border-right:1px solid var(--line-s); }
.statrow .s:last-child { border-right:0; }
.statrow .n { font-family:"Schibsted Grotesk"; font-weight:700; font-size:2.6rem; letter-spacing:-0.03em; color:var(--ink); line-height:1; }
.statrow .l { font-size:0.86rem; color:var(--slate); margin-top:8px; }
```

**Do:** keep it to a hairline frame; numbers in ink, labels in slate. ≤560px stacks to one column with bottom-border separators.
**Don't:** wrap each stat in a card, add a fill, or use the serif numerals. This is the consumer-side analogue of the dashboard `MetricCard` — but on the marketing pages it stays *blockless*.

### "Browse by feel" — borderless airy feature grid

**Purpose:** The category/vibe grid. Three columns of frameless cells, each a centered illustration + heading + one line + a coral "more" link. Cells lift on hover; nothing is boxed.

**Key CSS** (concept lines 95–103):

```css
.feel { display:grid; grid-template-columns:repeat(3,1fr); gap:48px 40px; margin-top:56px; }
.fcell { transition:transform .3s cubic-bezier(.2,.7,.2,1); }
.fcell:hover { transform:translateY(-5px); }
.fcell .art { height:150px; display:grid; place-items:center; margin-bottom:18px; }
.fcell .art img { max-height:150px; width:auto; }
.fcell h3 { font-family:"Schibsted Grotesk"; font-weight:700; font-size:1.3rem; letter-spacing:-0.02em; color:var(--ink); }
.fcell .more { margin-top:12px; font-family:"Schibsted Grotesk"; font-weight:600; font-size:0.9rem; color:var(--coral); display:inline-flex; gap:7px; }
.fcell:hover .more .arr { transform:translateX(4px); }
```

**Tailwind notes:** the whole cell lifts (`hover:-translate-y-[5px]`), and the nested `.more .arr` nudges on cell hover — model with `group`/`group-hover:translate-x-1` on the arrow.

**Do:** keep cells frameless on the bare canvas; one coral "more" link per cell.
**Don't:** add borders, shadows, or background fills to cells. This is where `/categories` and the discover vibe rail live — resist the urge to re-box.

### How-it-works — alternating airy rows

**Purpose:** Three steps as full-width alternating rows (illustration / copy, flipped each row), separated by top hairlines. "Step n" is a small coral label.

**Key CSS** (concept lines 107–114):

```css
.hrow { display:grid; grid-template-columns:0.9fr 1.1fr; gap:48px; align-items:center; padding:54px 0; border-top:1px solid var(--line); }
.hrow:last-child { border-bottom:1px solid var(--line); }
.hrow.flip .art { order:2; }
.hrow .n { font-family:"Schibsted Grotesk"; font-weight:700; font-size:1rem; color:var(--coral); }
.hrow h3 { font-family:"Schibsted Grotesk"; font-weight:700; font-size:1.8rem; letter-spacing:-0.02em; color:var(--ink); margin-top:8px; }
.hrow p { color:var(--slate); margin-top:10px; font-size:1.04rem; max-width:26rem; }
```

**Do:** alternate `.flip` per row; coral "Step n"; hairline between rows. ≤920px collapses to one column with `art order:0`, max-width 240px.
**Don't:** number with lime circles or boxed badges. This is the `how-it-works` page spine.

### "The click" — centered statement

**Purpose:** A centered editorial definition block. Lavender 2px def top-borders are the *one* place a 2px line is allowed (decorative, not a divider), and an italic coral pull-quote closes it.

**Key CSS** (concept lines 117–124):

```css
.click { text-align:center; max-width:48rem; margin:0 auto; }
.click .defs { margin-top:30px; display:grid; grid-template-columns:repeat(3,1fr); gap:28px; text-align:left; }
.click .defs .d { padding-top:18px; border-top:2px solid var(--lavender); }
.click .defs .num { font-family:"Schibsted Grotesk"; font-weight:700; color:var(--purple); }
.click .pull { margin-top:34px; font-family:"Schibsted Grotesk"; font-weight:600; font-style:italic; font-size:1.3rem; color:var(--coral); }
```

**Do:** lavender 2px top-rules on the three defs; purple `01/02/03` numbers; one italic coral pull-quote.
**Don't:** extend the lavender 2px treatment anywhere else — every other border in the system is a 1px hairline.

### Group list rows (`.glist` / `.grow`)

**Purpose:** A clean, frameless list of recurring groups. Each row reveals a coral "Join →" and slides right with a `--lav-bg` tint on hover.

**Key CSS** (concept lines 127–135):

```css
.glist { margin-top:40px; border-top:1px solid var(--line); }
.grow { display:grid; grid-template-columns:auto 1fr auto auto; gap:24px; align-items:center; padding:24px 6px; border-bottom:1px solid var(--line); transition:padding-left .3s cubic-bezier(.2,.7,.2,1), background-color .3s; }
.grow:hover { padding-left:18px; background:var(--lav-bg); }
.grow .mini-av .a { width:38px; height:38px; border-radius:999px; overflow:hidden; border:2px solid var(--cream); margin-left:-12px; background:var(--lav-bg); }
.grow .go { font-family:"Schibsted Grotesk"; font-weight:600; font-size:0.86rem; color:var(--coral); opacity:0; transition:opacity .25s; white-space:nowrap; }
.grow:hover .go { opacity:1; }
```

**Tailwind notes:** the slide is `hover:pl-[18px] hover:bg-[color:var(--lav-bg)]`; the reveal is `group-hover:opacity-100` on `.go`. Overlapping avatars use `-ml-3` with a `border-2 border-[color:var(--cream)]` ring (the 2px ring here is an avatar ring, not a divider — allowed).

**Do:** reveal "Join →" only on hover; tint the row lavender. ≤920px drops the trailing "Join →" column.
**Don't:** box each row. This pattern fits any consumer list (saved events, confirmed events, people rows).

### Closing CTA

**Purpose:** A centered, large-type sign-off with one Popsy illustration, a coral eyebrow, a two-line `.disp` headline with a purple `.lav` second line, and the single coral CTA + a textlink.

**Key CSS** (concept lines 138–143):

```css
.closing { text-align:center; padding:30px 0 10px; }
.closing h2 { font-family:"Schibsted Grotesk"; font-weight:700; font-size:clamp(2.4rem,6vw,4.4rem); letter-spacing:-0.03em; color:var(--ink); line-height:1.02; }
.closing h2 .lav { color:var(--purple); }
.closing .actions { margin-top:30px; display:flex; gap:18px; justify-content:center; align-items:center; flex-wrap:wrap; }
```

**Do:** biggest type on the page; one coral button + one textlink.
**Don't:** add a coloured band behind it (the live design uses a `surface-deep` near-black band — drop it; the closing stays on bare cream).

### Footer

**Purpose:** Minimal — wordmark + one slate caption line above a single top hairline.

**Key CSS** (concept lines 145–147):

```css
footer { padding:70px 0 56px; }
.foot-grid { display:flex; flex-wrap:wrap; gap:16px; justify-content:space-between; align-items:center; border-top:1px solid var(--line); padding-top:30px; }
.foot-grid .mono { font-size:0.78rem; color:var(--slate); }
```

**Do:** keep it to one hairline and slate text. The real `SiteFooter` in `src/components/site-chrome.tsx` carries more links — render them as slate Schibsted columns above this hairline row.
**Don't:** use a dark band, lime accents, or mono type (the `.mono` class name here is legacy; the text is Schibsted/slate).

---

## Layout & responsive

- **Container:** `.wrap` = `max-width:1080px; margin:0 auto; padding:0 28px`. Every section's inner content sits in a `.wrap`. The 28px gutter is the consistent left/right edge.
- **Section rhythm:** `.sec` = `padding:88px 0`. When sections stack directly, the lower one overrides with `padding-top:0` (see concept usage `style="padding-top:0;"`) so the rhythm doesn't double up. Hero is `74px 0 64px`.
- **Vertical scale:** 8 · 14 · 18 · 24 · 30 · 34 · 48 · 56 · 88 px. Use these, not arbitrary values.

### Breakpoint behaviour

**≤ 920px** (concept lines 153–160):
- Hero grid → 1 column, gap `30px`; `.hero-art` centers (`max-width:420px; margin:0 auto`).
- Feel grid → 2 columns, gap `40px 32px`.
- How-rows → 1 column (including `.flip`); art `order:0`, `max-width:240px`.
- Click defs → 1 column.
- Group rows → 3-column grid (drop the trailing "Join →"); `.go` hidden.
- Nav `.links` hidden (defer to `portal-mobile-nav.tsx`).

**≤ 560px** (concept line 161):
- Stat row → 1 column; `.s` separators flip from right-borders to bottom-borders.
- Feel grid → 1 column.

Implement in Tailwind with `max-md` / custom screens, or keep these as media queries in `globals.css` since they target concept classes directly. If you map to Tailwind's default breakpoints, note 920px ≈ between `md`(768) and `lg`(1024) — add a custom `@theme` screen (`--breakpoint-feel: 920px`) rather than rounding.

---

## Motion & interaction

- **Easing:** `cubic-bezier(.2,.7,.2,1)` for every transition/animation. Define once (`--ease: cubic-bezier(.2,.7,.2,1)`) and reuse.
- **Entrance — `.rise`:** elements fade up 18px over `.9s`. Stagger with `.d1`–`.d5` (`.05/.15/.25/.35/.45s`). Use on hero children and the stat row for the initial paint only. In React, apply as a className; do not re-trigger on re-render.

```css
@keyframes rise { from{opacity:0; transform:translateY(18px);} to{opacity:1; transform:translateY(0);} }
.rise { animation:rise .9s cubic-bezier(.2,.7,.2,1) both; }
.d1{animation-delay:.05s;} .d2{animation-delay:.15s;} .d3{animation-delay:.25s;} .d4{animation-delay:.35s;} .d5{animation-delay:.45s;}
```

- **Hover lifts:** buttons `translateY(-2px)`; feel cells `translateY(-5px)`; event cards use the same subtle lift (replace the live `hover:-translate-y-1` + hard offset shadow with a `-translate-y-[5px]` + soft ambient shadow).
- **Arrow nudge:** `.arr` → `translateX(4px)` on button/cell hover, `translateX(3px)` on textlinks/nav.
- **Group-row slide:** `padding-left:18px` + `--lav-bg` tint; reveal `.go` from `opacity:0`.
- **Reduced motion (mandatory):**

```css
@media (prefers-reduced-motion: reduce){ *{ animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
```

**Do:** keep all motion soft and short; one shared easing. **Don't:** port the live `.wiggle`, `.chip-bob`, `.float-slow`, `.marquee`, `.confetti-field`, or `.tilt-*` rotations — they all contradict Soft Minimal and are deleted.

---

## Voice & content

- **Tone:** calm, plain, confident. Short declaratives. The product promise is *"Show up twice. Become familiar."* — lean on familiarity, not hype.
- **Sentence case** for headings and buttons ("Start exploring", "Browse by feel", not Title Case or ALL CAPS — caps are reserved for the tiny eyebrow label only).
- **One CTA in coral** per screen. Everything else is ink or a textlink. The coral is the "do this" signal; spending it on two things dilutes it.
- **Emphasis:** at most one purple `.lav` word and one lavender `.u` swash per headline. Don't decorate every line.
- **Microcopy examples from the concept:** "A calm local calendar of dinners, walks, workshops and run clubs where the conversation already has a reason." / "The activity carries the conversation, so you do not have to manufacture it." / "Privately tap someone you would see again." Keep contractions light and the register warm but unfussy.
- **Numbers** are social proof, stated plainly ("8,400 people showing up monthly", "94% would come back again") — no exclamation, no badge.

---

## Accessibility

- **Contrast pairs (verified intent):**
  - Ink `#1C1830` on cream `#F9F6F0` / paper `#FFFFFF` → body and headings, high contrast (passes AA/AAA).
  - Slate `#6B6580` on cream → secondary text only; large/medium weight, do not use below ~14px for critical text.
  - White `#FFFFFF` on coral `#E8674C` → button text; this is the canonical pair (`.btn--coral` uses `#fff`, not cream, for that reason). Don't put coral text on cream for long copy — coral on cream is borderline; reserve coral text for short labels/links where size + weight carry it, and use `--coral-d` if more contrast is needed.
  - Ink on lavender `#C8B8F8` (the `.u` swash sits *behind* ink text) → fine. Never put lavender text on cream.
- **Focus states:** keep a visible focus ring. The live coral `outline: 3px solid var(--rose)` becomes `outline: 2px solid var(--coral); outline-offset: 2px` (thinner to match the hairline system, still clearly visible). Never remove focus outlines on pills or textlinks.
- **Hit targets:** buttons are 52px tall (passes 44px min). Keep nav links and the bookmark toggle ≥44px tappable.
- **Reduced motion:** the `prefers-reduced-motion` block is required, not optional.
- **Illustrations are decorative:** Popsy SVGs that don't carry meaning take `alt=""` (as in the concept's `.fcell` images). Only the hero/quote-bearing illustration gets a real `alt`. The verified-tick and lock icons need `aria-hidden` + adjacent text (the event-card lock already pairs the icon with "RSVP to unlock venue").
- **`::selection`** is lavender-on-ink — ensure selected text stays legible (it does; ink on lavender).

---

## Applying it to real pages

### Landing — `src/app/page.tsx`

This page maps almost 1:1 to the concept. Build it as: sticky nav → hero → stat row → "browse by feel" → how-it-works → "the click" → groups → closing → footer. Reuse `SiteHeader`/`SiteFooter` from `src/components/site-chrome.tsx` but re-skin them to the nav/footer specs above. Replace any `surface-deep` near-black bands (category strip, "Join once") with bare-cream sections separated by hairlines.

### Discover / browse — `src/app/discover/page.tsx` + `src/components/event-explorer.tsx`

- **Personalized rail + grid:** present events as the borderless `.feel`-style grid where possible; the event grid itself uses the redesigned `event-card.tsx`.
- **Filters (`event-explorer.tsx`):** the current `border-2` filter pills/selects → 1px hairline pills (999px), Schibsted labels, coral active state (coral fill or coral 1px ring + coral text), `--lav-bg` hover. No mono labels.
- **Section eyebrows** use the `.eyebrow.c` slate variant.

### Event card — `src/components/event-card.tsx` and `src/components/event-tile-card.tsx`

Current card (`event-card.tsx:50`) is `rounded-lg border-2 border-line bg-champagne … hard-shadow-sm hover:[box-shadow:8px_8px_0_0_var(--shadow-ink)]` — the literal hard-offset shadow on hover is the most "neo-brutalist" tell. Redesign:

- Shell → `rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]` with a single soft ambient shadow and `hover:-translate-y-[5px]` (drop the `8px 8px 0` offset shadow entirely).
- Image block: keep `object-cover` + the slow `group-hover:scale-105` zoom; change `border-b-2` → `border-b` hairline.
- **Status pill** (`event-card.tsx:42–47, 64`): the traffic-light tones currently use `--peach`(lime)/`--rose`/`--ink`. Re-map: open → a soft neutral/coral-tint pill (NOT lime), limited/waitlist/full → coral (`--coral`), locked → ink. Pill = `rounded-full border border-[color:var(--line)]`, **drop `border-2` and `hard-shadow-sm`**, use Schibsted (not the `font-black uppercase` mono treatment), sentence-or-small-caps.
- **Date/availability chips** (`:68, :72`): keep on `--paper`, 1px hairline, Schibsted; drop the `font-mono` time line — use Schibsted slate.
- **Eyebrow line** (`:80`, currently `font-mono uppercase tracking-[0.16em] text-mauve`) → Schibsted slate, sentence case: `Suburb · Category · Price`.
- **Title** (`:83`, `font-display text-[1.65rem] font-light`) → Schibsted `font-semibold`/700, `text-[1.65rem] tracking-[-0.02em]` (matches `.fcell h3` voice).
- **Tags** use the redesigned `Pill` (1px hairline, `--lav-bg` hover).
- **Attendee avatars** (`:129`): keep the overlap; change `border-2 border-champagne` → `border-2 border-[color:var(--paper)]` (ring, allowed) and drop `hard-shadow-sm`.

`event-tile-card.tsx` and `event-list-card.tsx` follow the same recipe; the list-card variant should adopt the `.grow` row pattern (hairline rows, hover `--lav-bg` slide, reveal a coral "View →").

### Event detail — `src/app/events/[slug]/page.tsx`

- Hero of the page = the event image + title block; use the hero type scale (`.disp`) for the title, an `.eyebrow` for `Suburb · Date`, and slate for the lead description.
- The locked-venue affordance keeps its lock icon + "RSVP to unlock venue" copy (already in `event-card.tsx:90–105`); style as ink text with the hairline.
- Sticky RSVP/checkout action = the single `.btn--coral`. The map (`event-venue-map.tsx`) and gallery (`event-media-gallery.tsx`) sit in hairline-bordered, `--paper`, 16px-radius cards with a soft shadow — no 2px borders.
- Attendee preview (`event-attendee-preview.tsx`) reuses the overlapping-avatar pattern.

### Auth & onboarding — `login`, `signup`, `register`, `forgot-password`, `onboarding`, `quiz/*`, `merchant/signup/*`, `merchant/onboarding/*`

- Cards = `--paper`, 16px radius, 1px hairline, one soft shadow. Inputs = 1px hairline (drop `border-2`), 999px or 12–16px radius, coral focus ring.
- Wizard step indicators: coral for the active step (a coral dot or coral "Step n" label like `.hrow .n`), slate hairline for inactive — not lime, not boxed.
- Primary action per step = `.btn--coral`; "Back" = `.btn--ink` or a textlink.
- Quiz answer chips = hairline pills with `--lav-bg` selected/hover state and a coral ring when chosen.
- Keep one calm Popsy illustration per auth/onboarding screen (frameless), echoing the hero pattern.

### Profile — `src/app/profile/page.tsx`, `src/app/profile/[userId]/page.tsx`, `src/app/profile/edit/page.tsx`

- Avatar gets the `border-2 border-[color:var(--cream)]`/`--paper` ring (allowed). The `<VerifiedTick />` stays; recolour to coral or keep its existing semantic.
- Name/handle in `.disp`; bio in body Hanken slate.
- Prompts (Hinge-style) and gallery render as `--paper` cards, 16px radius, hairline, soft shadow — like the hero quote card scaled up.
- Stat counts (events attended, clicks) use the blockless `.statrow` treatment, not boxed `MetricCard`s, on the public profile.
- "More photos" grid: frameless, 4:5 crops, hairline only.

---

## Migration from the current "River" look

### Old → new token map

| Current token / pattern | Soft-Minimal replacement | Notes |
| --- | --- | --- |
| `--peach` / `--punch` `#E2FF05` (electric lime) as **primary accent** | `--coral` primary + `--lavender` secondary; lime → **whisper only** | Highest-impact change. Lime is the current signature fill (KPI cards, status pills, chart bars, hover states, `::selection`, wordmark dot, `.peach-highlight`). Rebind to coral / soft wash. |
| `--rose` `#FF5A3C` (coral, text + fill) | `--coral` `#E8674C` + `--coral-d` `#d3543b` (darker for text/hover) | Keep coral's role; split shades — Soft-Minimal wants a *darker* hover, not lighter. |
| `--champagne` `#F4F1EA` (page bg) | `--cream` `#F9F6F0` | Cooler, cleaner cream. |
| `--cream` `#FBF9F4` (elevated card surface) | `--paper` `#FFFFFF` | Renaming collides with new `--cream`; use `--paper` for raised surfaces. |
| `--mauve` `#5C616B` (secondary text) | `--slate` `#6B6580` | Same role, renamed. |
| `--font-click-display` (Fraunces serif) | **Schibsted Grotesk** | Removes the serif voice entirely; all `.font-display` H1s + stat values → grotesk. `font-light` huge serif numerals → grotesk 700. |
| `.eyebrow` (Archivo condensed-mono, `0.18em`, mauve) | Schibsted eyebrow + 22px coral hairline | Kills the mono-label tic. |
| hand-rolled `font-mono uppercase tracking-[0.18em]` labels | same grotesk eyebrow | Chart/section/page headers bypass `.eyebrow`; migrate too. |
| `border-2 border-[color:var(--line)]` | **1px hairline** `--line` | Global: every card/pill/table/input/button. Drop to `border`. |
| `.hard-shadow-sm` (offset shadow on every surface) | soft long ambient shadow, or none | Most surfaces go flat or to one soft shadow. |
| `rounded-lg`/`rounded-2xl` cards, `rounded-3xl` chrome, `rounded-full` pills | 16px cards / 999px pills | `rounded-2xl`≈16px maps cleanly; pills stay 999px. |
| `.tilt-l/r-*` rotations | **remove** (square up) | |
| `bg-ink text-champagne` active states / dark KPI | keep dark accent, soften (1px border, no hard shadow) | |
| `.peach-highlight` lime marker | coral wash or remove | |
| `::selection` lime-on-ink | **lavender-on-ink** | |

### Anti-patterns to remove (per the consumer surfaces)

1. **Hard/offset shadows** — especially `event-card.tsx:50`'s `hover:[box-shadow:8px_8px_0_0_var(--shadow-ink)]`. Strip to soft ambient or flat.
2. **2px borders** — `border-2`, `border-b-2`, `divide-y-2` on cards, inputs, filter pills, image dividers. → 1px hairlines (the lavender `.click .defs` 2px and avatar rings are the only allowed 2px usages).
3. **Electric-lime fills** — status pills, hover backgrounds, the wordmark dot. → coral / neutral / lavender; lime whisper-only.
4. **`font-mono` UPPERCASE labels** — card eyebrows (`event-card.tsx:80`), time lines (`:70`), filter labels, page headers. → Schibsted.
5. **Heavy serif display** (`font-display … font-light`) — every H1 and card title (`event-card.tsx:83`). → Schibsted 700.
6. **Zine framing** — `.tilt-*`, `.sticker tilt-l-2`, `✷` eyebrows, `.squiggle`, `.confetti-field`, `.diagonal-stripes`, `.divider-zig`, `.wiggle`/`.chip-bob`, `border-dashed` empty states.
7. **`surface-deep` near-black bands** on consumer pages (category strip, "Join once", footer) — drop to bare cream + hairline.

### Suggested file-by-file order

1. **`src/app/globals.css` — the root re-skin.** Replace the `:root` block with the Soft-Minimal tokens (see below), rename `--champagne→--cream`, `--cream→--paper`, `--mauve→--slate`, `--peach/--punch→--lime` (whisper) + introduce `--lavender/--lav-bg/--purple/--coral-d`. Rewrite `.eyebrow`, `.hard-shadow*` (→ soft), focus ring, `::selection`. Add `.btn--coral/.btn--ink/.textlink`, `.disp`, `.statrow`, `.feel/.fcell`, `.hrow`, `.grow` as shared classes.
2. **`src/app/layout.tsx` — fonts.** Swap `next/font` imports:

```ts
import { Schibsted_Grotesk, Hanken_Grotesk } from "next/font/google";

const schibsted = Schibsted_Grotesk({
  variable: "--font-click-display", // also drives display/labels/numerals
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const hanken = Hanken_Grotesk({
  variable: "--font-click-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
// Remove Fraunces (serif), Archivo (condensed), IBM_Plex_Mono — no longer used.
```

   Apply `${schibsted.variable} ${hanken.variable}` on `<html>`/`<body>`. Then wire the `@theme inline` block so Tailwind utilities resolve to the new tokens:

```css
@theme inline {
  --color-cream: var(--cream);
  --color-paper: var(--paper);
  --color-ink: var(--ink);
  --color-slate: var(--slate);
  --color-coral: var(--coral);
  --color-coral-d: var(--coral-d);
  --color-lavender: var(--lavender);
  --color-lav-bg: var(--lav-bg);
  --color-purple: var(--purple);
  --color-lime: var(--lime);
  --color-line: var(--line);
  --color-line-s: var(--line-s);
  --font-display: "Schibsted Grotesk", system-ui, sans-serif; /* via --font-click-display */
  --font-sans: var(--font-click-body);
  /* Drop --font-mono / --font-condensed / serif aliases. */
}
```

   Keep the old token *names* as aliases during migration if you want a staged rollout (e.g. `--champagne: var(--cream)`), then delete the aliases once all usages are gone.
3. **`src/components/click-ui.tsx`** — the shared primitives cascade everywhere: re-skin `MetricCard`, `InfoCard`, `Pill`, `LinkButton`, `SectionIntro` (drop `rounded-2xl border-2 hard-shadow-sm .font-display .font-condensed`; adopt 1px hairline, `--paper`, soft shadow, Schibsted, coral accent).
4. **`src/components/site-chrome.tsx`** — nav + footer to the specs above; replace `.click-wordmark` serif/lime with the coral-dot brand.
5. **`src/components/event-card.tsx`, `event-tile-card.tsx`, `event-list-card.tsx`** — the consumer scroll surface (recipe in §Applying it).
6. **`src/app/page.tsx`** — rebuild against the concept section-by-section.
7. **`src/app/discover/page.tsx` + `event-explorer.tsx`** — grid + filter chips.
8. **`src/app/events/[slug]/page.tsx`** + detail subcomponents (`event-media-gallery`, `event-venue-map`, `event-attendee-preview`, `event-detail-modal`, `event-booking-dialog`, `event-checkout-modal`).
9. **`how-it-works`, `categories`, `categories/[slug]`, `people`, `profile/*`.**
10. **Auth/onboarding wizards** (`login`, `signup`, `register`, `forgot-password`, `onboarding`, `quiz/*`, `merchant/signup/*`, `merchant/onboarding/*`).
11. **Legal pages** (`terms`, `privacy`, `security`, `refund-policy`, `safety`) — these are mostly type; just inherit the new tokens + Schibsted/Hanken and they're done.

Work top-down (tokens → fonts → primitives → chrome → cards → pages) so each step cascades into the next and you're not re-touching surfaces.
