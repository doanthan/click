<!-- Component spec: CATEGORY ICONS - the one activity-category treatment used across Discovery, the dashboard categories rail, and onboarding interests. Rev 27 Jun 2026. Completes Phase 1 of Click_Design_Prompt_FullBuildOut.md (the second of the two prompts flagged "still to write"). Documents the AS-BUILT treatment (`click-app-v2/discovery.jsx` CAT_PATHS + the `category-icons` foundations specimen). Refs: CLICK_PALETTE / CLICK_TYPE / Buttons_Tags. -->
# Click - Category Icons (the activity-category treatment, everywhere)

A small system with one job: make Click's **activity categories** instantly recognisable and unmistakably on-brand, with **zero rainbow**. The old build coloured each category differently (a rainbow grid that read as a kids' app and muddied the palette). The fix is **one treatment, repeated**: a Deep-Purple line icon on a soft Lavender-tint circle; selected = the circle fills Deep Purple and the icon reverses to cream. That's it - the meaning comes from the glyph, never from a per-category colour.

**Five locked rules before the prompt:**
- 🔴 **One treatment, no rainbow.** Every category icon is a **Deep-Purple (#3B2F81) line glyph on a Lavender-tint circle** at rest. Categories are distinguished by their **glyph only**, never by hue. No per-category colour, no coloured backgrounds, no gradient discs.
- 🔴 **Selected = Deep-Purple fill, cream glyph.** The only state change is the resting lavender circle filling solid Deep Purple with the icon reversing to cream - the same "filled purple = selected" rule as tags and primary buttons (per Buttons_Tags). Selection never relies on a colour difference between categories.
- 🔴 **Line icons, even stroke, no emoji.** ~1.85px stroke on a 24px viewBox, round caps/joins, `currentColor` so the glyph inherits purple→cream on select. Refined line icons (Lucide/Phosphor family), never emoji-as-icon, never filled/3D illustrations.
- 🔴 **Activity-first taxonomy - no "Dating" category.** The set is activities: All · Pottery & ceramics · Run clubs & fitness · Wine & bars · Cooking · Live music · Art & craft · Wellness · Trivia & games · Outdoors · Markets · Coffee · Workshops. Intent/audience is NEVER a category.
- 🔴 **Same treatment at every size + surface.** Discovery icon-strip (~20px glyph / ~40px circle), mobile category chips (smaller), the dashboard "categories" rail, and onboarding interest selection all use the identical icon-in-circle - only the dimensions change.

```
=== PROMPT (paste under the GLOBAL block) ===
ROLE: Principal product designer. Design Click's CATEGORY ICON system - ONE on-brand treatment for activity categories, reused on Discovery (icon-strip + mobile chips), the dashboard categories rail, and onboarding interests. Responsive WEBSITE. Flat purple, no gradient.

=== THE TREATMENT ===
- Resting: a Deep-Purple #3B2F81 line glyph (≈1.85px stroke, 24px viewBox, round caps/joins, currentColor) centered on a **soft Lavender-tint circle** (a ~12–16% Lavender wash on cream). Optional label beneath/beside in the system font, 13–14, Slate when unselected.
- Selected: the circle fills **solid Deep Purple #3B2F81**, the glyph reverses to **cream**, the label goes Ink/Deep-Purple weight 600. This is the ONLY state colour change - never a per-category hue.
- Hover (web, selectable): the lavender wash deepens slightly + ≤1px lift; visible Deep-Purple focus-visible ring with a cream offset (keyboard only). Respect prefers-reduced-motion.
- Sizes: Discovery strip ≈40px circle / 20px glyph; mobile chips ≈32–36px; onboarding grid can go larger. Identical proportions, just scaled.

=== THE SET (activity-first; NO "Dating") ===
All (lines) · Pottery & ceramics · Run clubs & fitness · Wine & bars · Cooking · Live music · Art & craft · Wellness · Trivia & games · Outdoors · Markets · Coffee · Workshops. Each gets a distinct, legible line glyph (a thrown pot, a running figure, a wine glass, a pan, a music note, a brush, a leaf, dice, a mountain, a stall/tent, a coffee cup, a tools/spanner). Distinguish by glyph, never colour.

=== RULES ===
- Zero rainbow: no category-specific background colours or gradients. Purple-on-lavender at rest, purple-fill+cream when selected - full stop.
- Filled purple means selected (consistent with tags + primary buttons). No status colour ever appears on a category icon.
- No emoji, no 3D/illustrated icons. Even-weight line glyphs only.
- Labels sentence case; touch targets ≥44px on mobile; the whole chip (icon + label) is the hit area.

=== DELIVERABLE ===
Show the full category set in the resting treatment, the selected treatment (one category filled), a hover/focus state, and the set in three contexts at their real sizes: the Discovery icon-strip (desktop), the mobile horizontal-scroll chips, and the onboarding interest grid. Prove it's ONE treatment scaled - never a rainbow, never a per-category colour.
=== END PROMPT ===
```

## As-built reference
The live treatment ships in `click-app-v2/discovery.jsx` as `CAT_PATHS` (the line-glyph path set) + `CatGlyph` + `CatChip` (icon-in-circle, purple→cream on select), and is documented as the **`category-icons`** foundations specimen in the Design System tab. Discovery's strip and mobile chips both consume it; onboarding interests use the same purple-fill-on-select logic.

## Where this references / is referenced
- **Discovery** (`Click_Design_Prompt_Discovery.md`) - the icon-strip + mobile chips.
- **Buttons_Tags** (`Click_Design_Prompt_Buttons_Tags.md`) - "filled Deep Purple = selected" is the shared rule; category-select obeys it.
- **CLICK_PALETTE** - Deep Purple #3B2F81, Lavender #C8B8F8, Cream #F9F6F0.

## Notes for Cindy
- **Rainbow was the tell.** A per-category colour grid is the single fastest way to make a product look unfunded/template-y. One treatment + glyph-only differentiation reads as a designed system and keeps Deep Purple meaningful.
- **It's the same "purple = selected" rule** as tags and primary buttons - so categories, filters, and CTAs all speak one selection language. That consistency is the craft.
- **Already built + documented** (the `category-icons` foundations card) - this doc just makes the treatment a citable single source of truth, completing the second of the two Phase-1 prompts FullBuildOut flagged.
