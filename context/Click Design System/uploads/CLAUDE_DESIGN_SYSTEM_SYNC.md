<!-- One-time sync doc: corrections to bring the claude-design PROJECT's internal design system (its own click-design skill: README.md + tokens/ + components) into line with the CANONICAL specs in this repo. Created 27 Jun 2026. Hand this to claude code in the project. Delete once applied. -->
# Sync: claude-design project design-system → canonical specs

**Problem:** the claude-design project carries its OWN `click-design` design system (`README.md`, `tokens/colors.css` + `typography.css` etc., components, ui_kits) — built as "an original interpretation" of the briefs. It has **drifted** from the canonical specs in this repo (`UIUX/CLICK_PALETTE.md`, `CLICK_TYPE.md`, `CLICK_LANGUAGE.md`, `UIUX/cowork/*`). Because the project's agent reads its own design system first, the drift **overrides** pasted prompts. Fix the project's design system to these canonical values, then it stops blocking.

> Canonical order on any conflict: `CLICK_PALETTE.md` (colour) · `CLICK_TYPE.md` (type) · `CLICK_LANGUAGE.md` (words) · the per-screen prompts in `UIUX/cowork/`.

## 🔴 Critical — colour tokens (`tokens/colors.css`)
| Token | Project has (WRONG) | Canonical (CLICK_PALETTE) |
|---|---|---|
| Cream / canvas | `#FDFAF6` | **`#F9F6F0`** |
| Lavender | `#B7A8F2` | **`#C8B8F8`** |
| Ink / text | `#19133A` | **`#1C1830`** |
| Deep Purple | `#3B2F81` ✓ | `#3B2F81` (correct) |
| **Apricot accent `#EB8A63`** | present, used for "warm CTA" | **REMOVE entirely.** There is no apricot. Primary action is always Deep Purple. |
| **"Warm category palette"** (terracotta, mulberry, slate-blue, sage, violet, gold) | tags categories in colour | **REMOVE.** Category icons = ONE treatment: Deep-Purple line icon on a Lavender-tint circle; selected = Deep-Purple fill. Category **tags** are neutral (white fill, Mist hairline, Ink text). NO rainbow, no per-category colour. |
| Status colours | (folded into the warm palette) | The ONLY functional colours, **badges only**: Coral `#E8674C` (almost full) · Amber `#E0A33A` (trending/waitlist) · Sage `#5B8C6E` (free/going/mutual) · Teal `#2E7D8A` (new). Never a CTA, never a category. |
| Slate / Mist | (verify) | Slate `#6B6580` (meta), Mist `#E8E4F0` (hairlines). |

## 🔴 Critical — type (`tokens/typography.css`)
- Poppins display + system-font body ✓ keep.
- **REMOVE Fraunces** ("Fraunces italic for the editorial click moment") — Fraunces is DEAD (CLICK_TYPE supersedes it). The editorial `click` moment is Poppins.
- **Add `card-title` token = Poppins SemiBold 18/24** (the single size for event/people card titles).
- **Compact density (locked):** on APP surfaces, page/greeting heading = h2 (24/32), NOT display; section headers h3 (20/28); body 15–16; meta 13. Reserve display (32–46) for marketing/landing only.

## 🔴 Critical — banned visual patterns
- **No glows.** Remove `--shadow-accent` "purple glow on CTAs" and `--shadow-warm` "apricot lift". Glows are a banned AI-slop tell. Shadows are soft, low, purple-tinted only.
- **Radii:** cards **~16–20px** (project uses 20–28 — too round); inputs/buttons ~12px; pills/avatars full.
- **No depleting-budget counter.** Retire the **`ClickBudget`** component — "X clicks left" depleting counters are BANNED (21 rule 5). Clicking is silent; never show a budget on a browse feed.

## 🟠 Imagery — ONE decision for Cindy
The project says **"abstract illustration only, never photos."** Our art direction (`ArtDirection` folded into FullBuildOut + EventCard) calls for **real warm-graded Sydney venue/activity photography** (clay on a wheel, a flat white, runners at dawn). They conflict.
- **Recommendation:** event/venue imagery = **real warm-graded photos**; abstract illustration is fine for marketing/empty-states; **never stock faces** (people are real members; people surfaces stay privacy-careful). Confirm and align the project.

## 🔴 Critical — language / copy (`README.md` CONTENT FUNDAMENTALS + components)
| Project has (stale) | Canonical (CLICK_LANGUAGE, current) |
|---|---|
| "RSVP for free · **Book · $X** for paid" | **Single "RSVP" for ALL events** (price on the card, never in the button); "Join waitlist" (full); "View details" (booked). Drop the RSVP/Book split. |
| Mutual: **"You clicked with each other."** / "You two clicked." | **"You clicked with [Name]."** + push **"It's mutual — you clicked with [Name]. ✨"** (Cindy 27 Jun) |
| Soft-release: **"Things didn't line up this time…"** | **"Still out there — if you cross paths again, you can pick it back up."** ("didn't line up" is BANNED loss framing.) |
| Casing (prose) | Sentence case ✓ — BUT **UI chrome for the mechanic is lowercase** (the feeling): nav **"✨ click"**, page header **"click with someone"**, button **"click with [name]"**, pending state **"clicked"** (no ✨; see component section below). Only the platform name in prose/wordmark is capital "Click". |
| `match`/`swipe`/`connect`/loss-framing banned ✓ | keep. Add: **no founding-merchant programme** (hosting is free during the Sydney pilot — drop "founding venue/badge/10%"). |

## 🟠 Structure / flow drift (README §141–145 + components)
- **Onboarding:** location = **typed 4-digit postcode** (NOT a suburb picker) + Sydney-pilot honesty; intentions are **MULTI-SELECT**; dating sub-questions appear **only when "Open to dating" is selected**; add **flexible discovery** toggle. (The build's suburb-chip picker was the drift you/claude code already fixed — align the design-system note too.)
- **Dashboard Mode A = 5 sections** (welcome · finish-setting-up card · suggested · radar · categories), not "exactly 4".
- **People card** = one-per-line full-width rows, name only (no age), muted "clicked" pending (unnamed, no ✨), filled-purple button that keeps one footprint across states. (Retire any 3-up people grid.)
- **Dating mode** toggle lives in **Settings / Edit Profile + onboarding** (NOT the dashboard header), only for dating-intent users; romantic FOMO is aggregate-only (≥3), never a named person tagged "dating".

## 🔴 Critical — component-level corrections (Button / Tag / Badge) — added 27 Jun 2026
The project's `Button`, `Tag` and `Badge` components have drifted from the spec. Grounded in live best practice (WCAG 2.2 SC 2.5.8 target size; Material 3 chip specs; the NN/g-style idle→hover→focus→active→disabled→loading state model). Full paste-ready prompt: `UIUX/cowork/Click_Design_Prompt_Buttons_Tags.md` (v2).

**Button — states are drawn but not implemented.** The component only scales on mousedown: no hover darken, no `:focus-visible` ring (accessibility GATE fail), no pressed colour, no loading.
- Implement all states as REAL CSS pseudo-classes (not JS handlers): hover fill `#332873` (~8% darker) + ≤1px optical lift; pressed `#2A2160` (~12%) + scale .985; **focus-visible = 2px Deep Purple `#3B2F81` ring + 2px cream offset** (NOT lavender — lavender fails 3:1 on cream); disabled = Mist fill + Slate text (in-DOM, not opacity); **loading** = spinner + held width + aria-busy.
- Sizes: Small 36 (desktop/secondary only) · Medium 44 (default, min touch) · Large 52; radius 12; H-padding 16/20/24; label 14/15/16 Poppins 600; icon gap 8.
- **Remove the `warm`/apricot variant** (referenced in the demo as "Become a founding merchant/partner") — banned, and there is no founding programme.

**Tag — one neutral look; delete the tinting paths.** The component ships `soft` + `color` props, so the same interest tag renders neutral-with-dot on the sheet, lavender-tint on people cards, and plain on event cards. The `.prompt` also advertises a `category` prop the component never implements.
- Collapse to ONE resting style everywhere: white fill, 1px Mist hairline, Ink text, **NO dot** (Cindy decision 27 Jun). Height 28 (dense 24), full pill, label 13/500, H-padding 12, 8px gap.
- Selected (onboarding/filters only) = Deep Purple fill + cream text + 14px check — the only time a tag goes purple.
- **Delete `soft` and `color`** so no surface can re-tint; reconcile the `.prompt` (drop the `category` prop). Status colour never on a tag.

**Badge — make it a rounded rectangle.** Now that tags carry no dot, distinguish badges by SHAPE: radius ~8px rounded rect (not a pill), height 24, label 12/600, status text + soft tint per the card-state map. **Remove the `warm` tone and the "Founding partner" badge.** Swap demo names to the canonical Sydney set (Mia/Tom/Priya/Jules/Hassan/Bec/Daniel/Linh/Sam/Aisha — not "Mara/Ada/Bea").

**Stateful action button (click-with / RSVP) — ONE footprint across states.** The pending state must be the SAME button (same size/shape/radius) in a quiet muted treatment — colour + label change ONLY — NOT a separate, smaller pill (the live people-card render shrank pending into a different-shaped lavender pill, which read as a confirmation). default = filled Deep Purple "click with [name]"; **pending = muted (Mist/Lavender-tint) "clicked" (NO ✨)**, reads unresolved; **mutual = Sage "clicked ✨"** (one ✨ — the peak). State signalled by colour + label, never colour alone.

**"Sold out" is NEVER a button — it's a badge/state.** A full event's action is the waitlist stateful pair: **"Join waitlist" → "Joined waitlist"** (muted, same footprint). The disabled-button demo must use a genuinely gated action (e.g. "Continue"), not "Sold out".

**The click states are NOT badges.** "clicked" (pending) and "clicked ✨" (mutual) are button/card STATES — remove them from the badge family + the badge demo row. Badges carry EVENT status only (almost full / trending / free / new / going / sold out / date pill). The mutual indicator appears on a person's card / profile preview when you have a live mutual, plus the reveal headline — never as a status badge.

**✨ usage — max ONE per element, never decoration.** Pending carries NO ✨ ("clicked"); the mutual state carries one ("clicked ✨"). Kill the double sparkle (`✦ clicked ✨`) and the decorative ✨ on the "Both into…" overlap line (plain glyph). Reserve the celebratory ✨ for the peaks.

**People card — no age, no per-card anonymous line.** Name only on the card (age lives on the profile drawer — sensitive; researched 27 Jun); the anonymous reassurance shows ONCE at the top of the section, never under a card (it breaks the layout).

**Navigation consistency (every page).** Top-level destinations show NO back button; sub/detail pages show ONE top-left "← back" in the same place on every page; modals/drawers use a Close (✕) where Esc/scrim dismisses the overlay, not the page. (Responsive website, full mobile optimisation, no native chrome — app is a later phase.)

## 🟢 Best path now — replace the project README wholesale
A corrected, consolidated, drift-free README has been written: **`UIUX/CLAUDE_DESIGN_README_CANONICAL.md`**. It mirrors all canon + the latest decisions (web-not-app, Poppins/system not Inter, "Did you click with anyone?", pending "clicked" / mutual "clicked ✨", minimal footer, canonical event radar, Event-Card-same-everywhere, selected tag = purple fill NO tick) and adds the governance rules (mirror-of-canon, update-on-change, apply-to-all-pages, one-component-identical-site-wide). **Recommend: paste it in to REPLACE the project's `README.md` outright** — that fixes the root cause (the old README called itself "an original interpretation," which licensed the drift). Then the per-component corrections below are already satisfied.

## Tag tick removed (27 Jun)
Selected interest tag = **Deep Purple fill, NO tick/check** (the fill is the signal; `aria-pressed` conveys state to screen readers). Supersedes the earlier "purple fill + check."

## How to apply
Hand this file to the claude-design project (claude code) with: *"update our internal click-design design system (README + tokens/colors.css + typography.css + components) to these canonical values, removing apricot/warm-category/glows/Fraunces/ClickBudget and the stale copy, and applying the Button/Tag/Badge component corrections."* Or paste `Click_Design_Prompt_Buttons_Tags.md` (which also re-renders the mockup surfaces). Then re-paste a screen prompt — it should stop overriding the brand. **Delete this sync doc once applied.**
