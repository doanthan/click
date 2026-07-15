<!-- Last updated: 2026-07-01 | Revision: v4 (added `--mist-strong` #DDD7EA — a one-step-deeper Mist for DEFINED tag/chip hairlines + dividers that plain Mist #E8E4F0 leaves too faint on the warm cream canvas [interest tags were reading as ghosts]. Same lavender-tinted neutral family; non-text UI boundary; pairs with a true-white #FFFFFF chip fill. Site-wide: every neutral interest/category tag. Cindy 1 Jul — profile-page contrast audit; propagated to Buttons_Tags + CLAUDE_DESIGN_README_CANONICAL + UIUX_CHANGELOG. Flag to Doan.) Plus v3 (added `--lavender-wash` #F0ECF4 — a DERIVED low-chroma section-tint for LARGE background fills, fixing the cream/lavender clash [warm cream hue ~40° vs cool lavender ~255° + 25.8% chroma too loud at section size]; + the locked accent-not-canvas rule: brand lavender #C8B8F8 is a small-surface accent, NEVER a section canvas. A11y: slate #6B6580 on the wash = 4.74:1 [AA pass] vs 3.07:1 on brand lavender [fail] — verified. Token sits in a NEW surface-tints group [§3A], NOT §1's locked table; brand lavender UNCHANGED. Hex chosen #F0ECF4 over the #ECE8F3 fallback [warmer, bridges the clash, more AA headroom]. Flag to Doan.) Plus v2 (added `--error` #B5362F — a deep warm brick red for genuine errors / destructive ONLY [form validation, destructive-confirm], AA on cream 5.5:1; never a badge/CTA/decoration; distinct from Coral's "almost full". Supersedes the project-invented #C0504A which failed AA. Flag to Doan — control-doc colour addition.) Plus v1 (new canonical palette doc) -->

# CLICK_PALETTE.md

**Status:** Canonical. This file is the single source of truth for all colour values across Click — consumer, merchant, and admin surfaces, in code and in design. On any conflict over a colour value or status-colour mapping, this file overrides all other docs (landing pages, card specs, onboarding specs).

**Companion:** `CLICK_LANGUAGE.md` (canonical language). Where language and colour both apply to a UI string (e.g. the "We clicked 👍" moment), `CLICK_LANGUAGE.md` owns the words, this file owns the colour.

---

## 1. Core brand palette (locked)

The three brand colours. These are the identity. Do not substitute, tint, or approximate.

| Token | Name | Hex | Role |
|---|---|---|---|
| `--brand-purple` | Deep Purple | `#3B2F81` | Primary brand colour. Selected-state fill, primary CTAs, logo, headings on light ground. |
| `--brand-lavender` | Lavender | `#C8B8F8` | Secondary brand colour. Soft accents, gradients, hover washes, decorative fills. |
| `--brand-cream` | Cream | `#F9F6F0` | Primary background / canvas. The warm off-white the whole product sits on. |

**Selected-state rule (locked):** Deep purple `#3B2F81` is the interactive selected-fill colour (interest tiles, toggles, active nav). Per `01_USER_JOURNEY.md` §Step 3 and `QA_FEATURE_CHECKLIST.md`. No status/accent colour below may be used for interactive selection — keeps "selected" unambiguous.

**Accent-not-canvas rule (locked, v3):** Brand lavender `#C8B8F8` is an accent / small-surface colour — icon circles, chips/tags, hover washes, decorative fills, the swatch ramp, small highlights. It is **NEVER a section canvas.** Large section backgrounds use cream `#F9F6F0` or the derived `--lavender-wash` (§3A). This prevents the cream/lavender clash on big fills (warm cream vs cool full-strength lavender) and the slate-on-lavender AA failure (3.07:1).

### Drift reconciliation (resolved here)

The merchant landing docs previously carried non-canonical hex values. These are **superseded** by the core palette above:

| Doc | Was | Now (canonical) |
|---|---|---|
| `click_landing_page_merchant_v1.md` | cream `#fdfaf6`, lavender `#b7a8f2` | cream `#F9F6F0`, lavender `#C8B8F8` |
| `click_how_it_works_merchant_v1.md` | cream `#fdfaf6`, lavender `#b7a8f2` | cream `#F9F6F0`, lavender `#C8B8F8` |

*Action: when either merchant doc is next edited, update its in-doc palette line to point here rather than restating hex. Do not restate hex values in feature docs — reference this file.*

---

## 2. Functional / status palette (new)

Contrasting colours for dimension and state. Chosen to sit against the purple/lavender/cream base while holding the brand's tone: warm, confident, a little dry, never loud. None of these is used for interactive selection (see selected-state rule above).

| Token | Name | Hex | Role |
|---|---|---|---|
| `--status-urgent` | Coral | `#E8674C` | Urgency. "⚡ Almost full", "X spots left", low-stock counters. Warm against cream, hard contrast against purple. |
| `--status-waitlist` | Amber | `#E0A33A` | Waitlist + popularity. "Waitlist" badge, "Trending 🔥", sold-out-but-popular. Reads premium, not alarming. |
| `--status-success` | Sage | `#5B8C6E` | Success / positive. "✓ You're going", "Free 🎉", the "We clicked 👍" confirmation. Deliberately muted — a loud success-green would fight the chilled, un-salesy tone. |
| `--status-info` | Teal | `#2E7D8A` | Info / new / secondary accent. "New ✨" badge, inline links, info notices. The true contrast against purple on the wheel — a cool counterweight that isn't lavender. |
| `--error` | Error red | `#B5362F` | **Genuine errors / destructive only** (form validation "That doesn't look right", a destructive-confirm action). A deep, warm brick red — same warm family as Coral but darker + truer-red so it reads as *serious*, never confused with Coral's "almost full" status. AA on cream (5.5:1 as text) and carries white/cream text on a fill (5.9:1). 🔴 **NEVER a status badge, NEVER a primary CTA, NEVER decoration.** Use as error text, a 1px field border, or a soft ~10–12% tint background for an error banner. (Added 28 Jun 2026 — supersedes the project-invented `#C0504A`, which failed AA on cream at 4.34:1.) |

---

## 3. Neutral ramp (new)

Text and structure colours. Previously undefined — feature docs repeatedly reference "muted colour" / "supporting info" grey without pinning a value. These pin them. The ink is purple-tinted, not pure black, so text sits in the brand family.

| Token | Name | Hex | Role |
|---|---|---|---|
| `--ink` | Ink | `#1C1830` | Primary text. Purple-tinted near-black. Never use pure `#000`. |
| `--slate` | Slate | `#6B6580` | Muted / caption text. The "supporting info" grey in card specs (category·date·time line, suburb·distance). |
| `--mist` | Mist | `#E8E4F0` | Borders, dividers, disabled-control fills. Lavender-tinted light grey. |
| `--mist-strong` | Mist-strong | `#DDD7EA` | A one-step-deeper Mist for elements that need a *defined* edge on cream — interest/category **tag hairlines** and dividers that Mist leaves too faint. Same lavender-tinted family as Mist. Non-text UI boundary (not gated by the 4.5:1 text rule); pairs with a true-white `#FFFFFF` chip fill so the chip lifts off the warm canvas. (Added 1 Jul 2026 — fixes tags reading as ghosts on cream; applies site-wide wherever the neutral tag appears.) |

---

## 3A. Surface tints (derived — NOT brand colours)

Derived low-chroma tints for LARGE background fills. These are **not** brand identity colours (they do not belong in §1) — they exist only to fill big areas without the full-strength accent clashing with the cream canvas.

| Token | Name | Hex | Role |
|---|---|---|---|
| `--lavender-wash` | Lavender wash | `#F0ECF4` | **LARGE section backgrounds only** (How It Works bands, big dashboard panels). Low-chroma (~3%) lavender, warmed toward cream so it bridges the warm canvas instead of clashing. Ramp: cream `#F9F6F0` → wash `#F0ECF4` → lavender `#C8B8F8` → purple `#3B2F81`. Slate body on it = **4.74:1 (AA pass)**. 🔴 Never use brand lavender `#C8B8F8` as a section canvas — use this. (Neutral fallback `#ECE8F3` also passes AA at 4.58:1; `#F0ECF4` chosen for warmth + headroom.) |

---

## 4. Status-colour → card-state map (pins `12_DISCOVERY_PAGE.md`)

The discovery card spec names states but never pins hex. This is the binding map.

| Card state | Badge / text colour | Token |
|---|---|---|
| Standard (available) | — (no status colour) | — |
| Almost full (<15% spots) | Coral `#E8674C` | `--status-urgent` |
| Trending | Amber `#E0A33A` | `--status-waitlist` |
| Sold out — waitlist available | Amber `#E0A33A` | `--status-waitlist` |
| Sold out — no waitlist | Slate `#6B6580` on Mist overlay | `--slate` / `--mist` |
| Free | Sage `#5B8C6E` | `--status-success` |
| New | Teal `#2E7D8A` | `--status-info` |
| Already booked ("✓ You're going") | Sage `#5B8C6E` | `--status-success` |
| Saved | Deep Purple `#3B2F81` (filled icon) | `--brand-purple` |

**Note on overlays:** sold-out grey overlay is the Mist tint over the banner, never black — per `12_DISCOVERY_PAGE.md` ("subtle, not depressing").

---

## 5. CSS custom properties (paste block)

```css
:root {
  /* Core brand */
  --brand-purple:   #3B2F81;
  --brand-lavender: #C8B8F8;
  --brand-cream:    #F9F6F0;

  /* Functional / status */
  --status-urgent:   #E8674C; /* coral  — almost full, spots left */
  --status-waitlist: #E0A33A; /* amber  — waitlist, trending */
  --status-success:  #5B8C6E; /* sage   — going, free, we clicked */
  --status-info:     #2E7D8A; /* teal   — new, links, info */
  --error:           #B5362F; /* red    — form errors / destructive ONLY; never a badge/CTA/decoration */

  /* Neutral ramp */
  --ink:   #1C1830; /* primary text */
  --slate: #6B6580; /* muted / caption */
  --mist:  #E8E4F0; /* borders, dividers, disabled */
  --mist-strong: #DDD7EA; /* defined tag/chip hairline + dividers Mist leaves too faint on cream; pair with a true-white chip fill */

  /* Surface tints (derived — large fills only, NOT brand colours) */
  --lavender-wash: #F0ECF4; /* LARGE section backgrounds only; never use the brand accent #C8B8F8 as a canvas */
}
```

---

## 6. Accessibility note (contrast)

WCAG AA needs 4.5:1 for body text, 3:1 for large text / UI components. Quick guidance, not a substitute for testing each pairing:

- **On cream `#F9F6F0`:** ink, slate, deep purple, teal, sage, and **error red `#B5362F` (5.5:1)** all clear AA for text. Coral and amber are **badge/large-text only** on cream — they do not reliably clear 4.5:1 as body text. Don't set caption-size body copy in coral or amber.
- **On deep purple `#3B2F81`:** cream and lavender clear AA. White clears. Do not put slate, teal, or sage text on purple.
- **Amber on white/cream is the riskiest pairing** — keep it to fills with dark text on top, or large badge text, never small text.
- **On `--lavender-wash` `#F0ECF4`:** slate `#6B6580` body = **4.74:1 (AA pass)**, ink = 14.7:1. This is the fix for the old slate-on-brand-lavender pairing, which was **3.07:1 (fails AA)** — so large lavender fills must use the wash, never `#C8B8F8`. (Verified via WCAG relative-luminance calc, 29 Jun.)

*Outstanding: remaining per-pairing contrast values not yet exhaustively measured. When the design system is built, run each token pair through a checker and record ratios here. Flagging so it isn't assumed-safe.*
