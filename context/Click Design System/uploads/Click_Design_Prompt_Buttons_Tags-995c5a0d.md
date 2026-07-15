<!-- Component redesign prompt: buttons + interest/category tags + status badges. Rev v6 (1 Jul 2026, Cindy — profile-page contrast audit): interest/category TAG resting look now TRUE-WHITE #FFFFFF fill (never cream) + 1px Mist-strong #DDD7EA hairline (was 1px Mist #E8E4F0 — too faint on cream, tags read as ghosts). New palette token --mist-strong #DDD7EA (CLICK_PALETTE v4). SITE-WIDE — every neutral tag on every surface (event cards, people cards, Your-clicks, dashboard, landing, discovery, onboarding/filters). Propagated: CLICK_PALETTE v4, CLAUDE_DESIGN_README_CANONICAL, UIUX_CHANGELOG. — Rev 27 Jun 2026 (v5): selected interest tag = purple fill, NO tick/check (the fill is the signal; Cindy 27 Jun) + aria-pressed for SR state. — v4: pending label → "clicked" (no ✨, muted), mutual → Sage "clicked ✨" (✨ on the peak only); "Sold out" is a badge/state, NOT a button — disabled demo uses a gated action, full-event CTA = "Join waitlist" → "Joined waitlist"; click states are NOT badges (removed from the badge family/demo); name-only people cards (no age); anonymous line once at section top. — v3: added A1b STATEFUL ACTION BUTTON rule (click-with/RSVP keep ONE footprint across default→pending→mutual; colour+label only; pending muted/unresolved not a smaller pill; max one ✨); Part B + checklist + nav line. — v2: no category dot (uniform tag — Cindy decision 27 Jun); added loading state; focus ring → Deep Purple (lavender ring failed 3:1 on cream); badges → rounded-rect to stay unmistakable vs pill tags now the dot is gone; sizing/padding/state model re-grounded in live best-practice research (WCAG 2.2 SC 2.5.8 target size; Material 3 chip specs; NN/g + LogRocket button-state model). Now a TWO-PART prompt: (A) update the claude-design project's OWN design system, (B) re-implement the website mockup surfaces with the corrected components. Grounded in CLICK_PALETTE.md + CLICK_TYPE.md + CLICK_LANGUAGE.md. -->
# Click — Buttons & Interest-Tags Redesign (plan + prompt)

**Problem in the current build (from the latest mock screenshots):** the component sheet *draws* button states (hover / pressed / focus / disabled) but the live `Button` component only does a mousedown scale — no real hover darken, no keyboard focus ring, no pressed colour, so "the buttons aren't consistent." And the same interest tag renders **three different ways** across surfaces — neutral white + dot on the sheet, lavender-tint pills on the people cards, plain neutral on event cards — because the `Tag` component ships `soft`/`color` tinting paths any surface can use. Result: a tag isn't recognisable as a tag. Plus two banned leftovers (`warm`/apricot button variant + "Founding partner" badge) are still referenced.

**The fix is the SYSTEM, in three distinct families, applied everywhere (no per-surface overrides).**

## Research grounding (so the numbers aren't arbitrary)
- **Touch / target size:** WCAG 2.2 SC 2.5.8 sets a 24×24px AA floor; 44×44px is the usability best practice (and the AAA 2.5.5 figure). → primary buttons land at **44px+**; the 36px small is a desktop/secondary size, never the primary mobile tap target.
- **Chips/tags:** Material 3 chips are **32px tall with ~8px between chips**; chips are deliberately lighter than buttons. → Click tags at **22px** (label 12px) read as ~half a 44px button — clearly a tag, not a button (downsized site-wide 28 Jun for a calmer, denser, clearly-secondary read; label held at 12px = legibility floor).
- **Button states:** the reference state model (idle → hover → focus → active/pressed → disabled → loading) must be real CSS pseudo-classes, not JS — hover gives a real-time cue, focus is a *separate* keyboard-only outline, disabled stays legible + in the DOM. → we implement all six, via `:hover` / `:focus-visible` / `:active` / `:disabled`.
- **Padding/spacing:** 12–24px horizontal button padding; 8–16px between controls; everything on the 4/8 grid.

## The system (3 distinct families)

**1. Buttons** — one purple primary per view; everything else steps down. Filled Deep Purple means exactly two things across the whole product: a primary action, or a selected tag. No status colour is ever a button fill — there is no coral/apricot "CTA".

**2. Interest / category tags** — one neutral look, visibly lighter and smaller than a button, **no dot**. The pill shape + neutral ink is the identity; the *only* time a tag goes purple is when it's selected (**purple fill — NO tick**; the fill is the signal).

**3. Status badges** — the only place status colour lives, and a **rounded rectangle** (not a pill) so it can never be mistaken for an interest tag now that tags carry no dot.

---

```
=== PROMPT (paste into the claude-design project) ===

ROLE: Act as Click's principal product designer (reference-class craft — Linear / Stripe / Luma restraint). You will (A) FIX OUR OWN INTERNAL design system to the spec below, then (B) RE-RENDER the website mockup surfaces using the corrected components. Click is a responsive, mobile-optimised WEBSITE (375 → 1440) — no native-app chrome. Cream #F9F6F0 canvas, everything on an 8pt grid. Type per CLICK_TYPE.md: button / tab / label text in Poppins (Medium 500 / SemiBold 600); body/helper in the system font stack. Flat purple — never a gradient or glow.

PALETTE (locked, exact): Deep Purple #3B2F81 (primary + selected ONLY), Lavender #C8B8F8 (soft wash), Cream #F9F6F0 (canvas), Ink #1C1830 (text — never pure black), Slate #6B6580 (muted), Mist #E8E4F0 (borders/disabled), Mist-strong #DDD7EA (DEFINED tag/chip hairline + dividers that Mist leaves too faint on cream). Status (BADGES ONLY — never buttons or category tags): Coral #E8674C, Amber #E0A33A, Sage #5B8C6E, Teal #2E7D8A. Button hover/pressed purples: hover #332873 (~8% darker), pressed #2A2160 (~12% darker).

=== PART A — UPDATE THE INTERNAL DESIGN SYSTEM (tokens + components + README) ===

A1. BUTTON — implement REAL states via CSS pseudo-classes (not JS mouse handlers):
- Default Primary: Deep Purple #3B2F81 fill, cream text, weight 600, flat (no shadow/glow).
- Hover: fill → #332873; ≤1px optical lift (transform only, no glow); 120–160ms ease.
- Pressed/active: fill → #2A2160; remove lift; scale .985.
- Focus-visible (keyboard only): 2px Deep Purple #3B2F81 ring with a 2px cream offset gap (so it reads on both cream and a purple button). NOT lavender — lavender fails the 3:1 non-text contrast on cream.
- Disabled: Mist #E8E4F0 fill, Slate #6B6580 text, no hover/press, cursor not-allowed, stays in the DOM (legible, not opacity-faded to nothing). **The disabled DEMO must use a genuinely gated action (e.g. "Continue" before a step is valid) — NOT "Sold out". "Sold out" is a state, not a button (it's a badge — see A3); a full event's action is "Join waitlist" (A1b), never a dead "Sold out" button.**
- Loading: swap the label for a small spinner, HOLD the button width (no layout shift), set aria-busy, block interaction. Use on RSVP / "click with [name]" / "Suggest something to do".
- Secondary: white fill, 1.5px Mist border, Ink text → hover: faint Lavender wash + border darkens to Slate. Ghost/tertiary: no fill/border, Deep Purple text → hover: faint Lavender wash. ("Not feeling it" is a ghost — a quiet action, never a heavy button.)
- Sizes (heights on the grid, radius 12px): Small 36px (desktop/secondary only) · Medium 44px (default, min touch) · Large 52px. Horizontal padding 16 / 20 / 24. Label 14 / 15 / 16 weight 600. Optional leading line-icon 16–18px (Lucide/Phosphor), 8px gap.
- REMOVE the `warm`/apricot variant entirely — there is no warm CTA.

A1b. STATEFUL ACTION BUTTON (the "click with [name]" + RSVP buttons that carry a pending/selected state) — ONE control, one footprint:
- Across its states (default → pending → confirmed/mutual) the button keeps the **identical size, shape and radius**. Only the **fill colour + label change** — never resize or swap it for a smaller pill (the live-render bug was pending shrinking into a different-shaped chip).
- "click with [name]": default = filled Deep Purple "click with [name]"; **pending = muted treatment** (Mist/Lavender-tint fill, Deep-Purple or Slate label) label **"clicked" (NO sparkle)** — clearly NOT the filled "go" state and NOT celebratory; **mutual = Sage treatment "clicked ✨"** (one ✨ — the peak).
- Waitlist (full event) follows the same pattern: default = "Join waitlist" (primary); once joined = muted "Joined waitlist" (same footprint, colour + label only). "Sold out" is NEVER a button — it's a badge/state (see A3).
- Accessibility: state is signalled by colour AND label — never colour alone. **✨ appears on the mutual state only** (none on pending/default); never decoration.
- Pending must read as *unresolved/waiting*, not *confirmed* — muted, quiet, low-stakes.

A2. TAG (interest / category) — collapse to ONE neutral look; delete the `soft` and `color` tinting paths so no surface can re-tint a tag:
- Resting (every tag, every surface, identical — 🔴 Cindy 28 Jun, downsized again for hierarchy): 🔴 **TRUE-WHITE `#FFFFFF` fill (never cream — a white chip lifts off the warm cream canvas; the render's tags read as ghosts because they were effectively cream-on-cream), 1px Mist-strong `#DDD7EA` hairline (Cindy 1 Jul — plain Mist #E8E4F0 was too faint on cream), Ink text.** NO dot. **Height 22px, full pill radius, label 12px weight 500, horizontal padding 8px, 6px gap between tags.** (Progression 28/13 → 24/12 → now 22-tall / 12px-label / 8-pad — lighter, more clearly SECONDARY, applied EVERYWHERE: event cards, people cards, Your-clicks, dashboard, landing, discovery, onboarding/filters.) 🔴 **The LABEL stays 12px — do NOT go to 11 (legibility floor for secondary UI text, and the selectable variant needs it). Shrink the pill, never the type below 12.** Buttons stay 44px, so a tag reads ~half a button — unmistakably a tag.
- Selected (onboarding grid / filters only): Deep Purple #3B2F81 fill, cream text — **NO check/tick** (the purple fill IS the selected signal; Cindy 27 Jun). This is the ONLY time a tag goes purple. For accessibility add `aria-pressed`/`aria-selected` on the chip so screen readers convey the state without a visible tick (the full fill is a strong visual change, not a hue-only cue, so it's safe for sighted users). Selectable tags keep a **≥24px hit target** even though the visible pill is 22px — pad the interactive hit-area (transparent) to ≥24, don't enlarge the visible pill (WCAG 2.2 §2.5.8). Display-only card tags have no target requirement.
- Hover (only when selectable): Mist border darkens + faint wash. Display-only tags (on cards) have no hover.
- Status colour NEVER appears on a tag. The "+N" overflow chip uses this same neutral style.
- 🔴 **ONE LINE, NEVER WRAP, NEVER STRETCH THE CARD (Cindy 28 Jun — the "Sunrise run" card still ran "Running · Outdoors · Coffee after · +1" to the edge).** The tag row is constrained to the content width and clipped to a SINGLE line. **Measure as you add: include a tag ONLY if that tag AND the "+N" chip still fit inside the card's padding; the moment the next tag would touch the edge, STOP and put everything remaining into "+N".** A long tag forces fewer tags — e.g. "Running · Outdoors · Coffee after" → render **"Running · Outdoors · +2"** (drop "Coffee after"), or even "Running · +3" on a tight card. The "+N" is ALWAYS the last item, ALWAYS inside the card padding (never flush to the edge), never pushed onto a second line or off-card. NEVER wrap, NEVER horizontally scroll on a card, NEVER let a tag push the card wider; the count adapts, the font never shrinks. Same behaviour on every surface.

A3. BADGE — keep status colour here only, and make it a ROUNDED RECTANGLE so it's unmistakable vs the pill tag:
- Shape: radius ~8px rounded rect (NOT a pill), height 24px, label 12px weight 600, status-coloured text + small leading line-icon or 6px dot on a soft (~10–14%) tint of the same status colour.
- Map (EVENT STATUS ONLY): Almost full → Coral · Trending / Waitlist → Amber · Free / You're going → Sage · New → Teal · Sold out → Slate text on Mist · date/time pill → onImage.
- **The click states ("clicked" pending / "clicked ✨" mutual) are NOT badges — they are button/card STATES (A1b), do not put them in the badge family or the badge demo row.** Badges carry event status; the click button carries click state. Keeping them separate is what stops "you clicked" reading like an event status.
- REMOVE the `warm` tone and the "Founding partner" badge — there is no founding programme (free Sydney pilot).

A4. README + tokens housekeeping: update the internal design-system README and token files to match the above; remove any `--shadow-accent`/`--shadow-warm` glow tokens, the apricot accent, the per-category "warm palette", Fraunces, and the ClickBudget counter if still present (all banned). Use real Sydney sample data only.

=== PART B — RE-RENDER THE WEBSITE MOCKUP WITH THE CORRECTED COMPONENTS ===
Re-render these surfaces so they consume the updated components (no inline overrides):
- Discovery event cards: RSVP = Medium primary; "View details" (booked) = Secondary; **full event = "Join waitlist" primary → "Joined waitlist" muted** (NOT a "Sold out" button); category tags = neutral pills, no dot; status (incl. "Sold out") = rounded-rect badge.
- People cards / Who-was-there: "click with [name]" = Medium primary (real hover/focus/pressed); **pending keeps the SAME button footprint** in its muted treatment, label **"clicked" (no ✨)**; **mutual = same footprint, Sage "clicked ✨"**; interest tag = ONE neutral pill, no lavender tint, no dot. **Name only on the card (no age)**; the anonymous reassurance shows ONCE at the top of the section, never under a card; ✨ on the mutual state only.
- Mutual modal: "Suggest something to do" = primary with a loading state on tap; intent line stays a Sage badge.
- Navigation: top-level pages show no back button; sub-pages show one top-left "← back"; the modal/drawer uses a close (✕) that dismisses the overlay, not the page (per GLOBAL nav rule).
- Onboarding interest grid: tags use the selected (purple fill, NO tick) state.
Show the component sheet AND at least these four surfaces so the system is visible in context.

=== CRAFT CHECKLIST ===
[ ] Every button state is REAL (hover darken / pressed / :focus-visible ring / disabled / loading) — not drawn-only; same control behaves the same everywhere
[ ] Stateful action buttons (click-with / RSVP) keep ONE size + shape across default/pending/mutual — only fill colour + label change; pending reads as pending not confirmed; max one ✨ per element
[ ] Focus ring is Deep Purple with a cream offset (passes 3:1), keyboard-only
[ ] One neutral interest-tag look everywhere, NO dot; selected = purple fill, NO tick (aria-pressed conveys state to screen readers)
[ ] Tags read as ~22px (label 12px, the floor) vs 44px buttons — clearly lighter/smaller; one line + "+N" (fewer tags + bigger N when tight), never wrap/stretch the card
[ ] Status colours appear ONLY on badges; badges are rounded rects, tags are pills — never confused
[ ] Exactly one primary (purple) per view; no apricot/warm CTA; no "Founding partner" badge
[ ] 8pt sizing; radius 12 (buttons) / full (tags) / ~8 (badges); labels in Poppins per CLICK_TYPE.md
[ ] Flat purple — no gradient/glow; real Sydney data; light mode
[ ] ≥44px touch on every primary; reduced-motion honoured
=== END PROMPT ===
```

---

## Notes for Cindy
- **What actually fixes "inconsistent buttons":** the states are now *behaviour*, not artwork. The old component only scaled on mousedown — no hover, no focus ring (an accessibility fail). Part A1 makes hover/pressed/focus/disabled/loading real CSS so every button behaves the same on mouse, touch and keyboard.
- **What fixes the tags:** one neutral look, the `soft`/`color` tinting paths deleted so no surface can drift again, and **no dot** (your call) — cleaner, and it keeps tags (pill) clearly different from badges (now a rounded rect). A tag finally always looks like a tag.
- **Why this is a two-part prompt:** the project reads its *own* design system first, which is why pasted prompts kept getting overridden. Part A updates that system at the source; Part B forces the mockup to re-render through it — so the fix sticks instead of being a one-off screen.
- **Purple stays meaningful:** filled Deep Purple = primary action OR selected tag, nothing else. That single rule is what makes it read as a designed system.
- Paste the whole `=== PROMPT ===` block into the claude-design project. The matching token/component corrections are also in `CLAUDE_DESIGN_SYSTEM_SYNC.md` (§ Component-level) if you'd rather hand the project a diff than a prompt.
