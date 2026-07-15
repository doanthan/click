# Click - Full-Site Design Audit
**2 Jul 2026 · critique only - nothing was changed.** Measured against CLICK_PALETTE / CLICK_TYPE / CLICK_TEMPLATE / CLICK_LANGUAGE / Buttons_Tags + WCAG 2.1 AA, at 375 / 768 / 1024 / 1440, via live render inspection (screenshots + computed-style probes) and source reading.

Severity key: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low / Polish.

---

## A. Overall verdict

The system underneath is in genuinely good shape - one Event Card everywhere, fluid type that actually scales (verified h1 24px at 375 → 32px at 1440), the locked venue rule, capped tags, the one-✨ discipline, and a correct mobile nav pattern. What holds the design back right now is not the system but **two classes of gap**: (1) a **functional launch blocker** - the entire mutual-click coordination flow's modals render invisible (frozen entrance animations), which means the product's emotional peak cannot be seen at any breakpoint; and (2) **warmth debt** - every face is a grey glyph and every photo a flat illustration block, so the pages read systematic but cold, the exact opposite of the brand's "warm, real, alive" mandate. Fix the blocker, put real warm photography in, and sweep the handful of city-hardcoded strings, and this is a shippable site.

---

## B. Global findings

| Finding | Where | Why it matters | Severity | Recommended direction |
|---|---|---|---|---|
| **Coordination modals are invisible.** The Suggest-a-plan drawer and the mutual-reveal modal render at `opacity: 0`, frozen on the first frame of their `ckCoord` / `ckRise` / `ckPop` entrance animations (measured: opacity 0, `matrix(0.98,…)`, animation stuck). Only the scrim shows. Reproduced at 375 AND 1440 on `mutual`, `coord-suggest`, `coord-both`. | `coordination.jsx` (~lines 107-155): the Shell + reveal modal | The mutual reveal is the product's ✨ peak and the coordination flow is the core mechanic - both are unusable. Same re-render-restart animation bug class already fixed in onboarding and the filter sheet. | 🔴 | Remove the opacity-gating entrance animations (or make visible the base state), exactly as was done for onboarding/`ckSheetUp`. Motion can return later via a mechanism that survives re-renders. |
| **Every avatar is a grey person-glyph; photos are flat illustration blocks.** People cards (click page, who-was-there), profile avatar, profile photo grid, event banners. | `kit.jsx` Avatar/Cover across all surfaces | Canon: warm, real, activity photography is the conversion + trust lever; "faces soft/incidental" - but there are no faces at all. Pages read cold/systematic. | 🠠High | Commission/drop in warm-graded photography: portrait avatars, varied-tone activity shots. The `Cover` tone system (warm/bright/cool/dusk) is already plumbed - it needs real images, not washes. |
| **City-hardcoded copy.** "New to Sydney" intent row on How-it-works (canon v7 = "New in town"); quiz life-stage option "New to Sydney"; event FOMO lines "…locals new to Sydney are going"; landing field placeholder "Sydney suburb or postcode". | `howitworks.jsx:26`, `quiz.jsx:51`, `event-detail.jsx:125-129`, `app-screens.jsx:185` | Launch scales to Asia; canon requires `{area}` resolution. (Naming Sydney in pre-launch *marketing* hero copy is fine; product-surface strings are not.) | 🟠 | Sweep to `{area}`-token phrasing: "New in town", "locals new to the area", "suburb or postcode". |
| **Discover at 768 collapses to a one-card column.** The 240px filter sidebar + 280px min card track leaves room for exactly 1 card; a wide whitespace gutter results. | Discover, 768 only | Awkward mid-width; F-pattern scanning broken; wasted screen. | 🟠 | Keep the mobile pattern (Filters button → bottom sheet) up to <1024; sidebar only at ≥1024. |
| **Persistent horizontal scrollbar strip above the bottom nav at 375.** Page-level `scrollWidth == clientWidth` (no real page overflow) - the strip belongs to an inner `overflow-x: auto` rail (category row / footer links / tab row). | Every app screen at 375 | Reads as broken layout; invites sideways-scroll attempts. | 🟡 | `scrollbar-width: none` / `::-webkit-scrollbar{display:none}` on horizontal rails; audit each rail for real overflow. |
| **Banner subline contrast on lavender wash is borderline.** Slate `#6B6580` (≈4.9:1 on white) drops to ≈4.4:1 on `#F0ECF4` at 13.5px - just under AA 4.5:1 for small text. | Dashboard moment-banners, event FOMO box sublines | WCAG 2.1 AA | 🟡 | Step sublines on wash surfaces to `--ink-soft` (#3E3958) or raise size to ≥16px. |
| **Two stacked sticky bars on mobile event detail.** The $97/RSVP action bar sits directly on top of the bottom nav - ~130px of an 812px viewport is chrome. | Event Detail, 375 | Content squeeze; double-bar reads heavy. | 🟡 | Hide the bottom nav while the booking bar is visible (it's a focused task), or fold price into a single bar. |
| **Onboarding step 1 Continue is below the fold at 375.** Four fields + postcode explainer push the primary action off-screen. | Onboarding About-you, 375 | Spec: thumb-reachable Continue; drop-off risk on the first step. | 🟡 | Sticky bottom Continue (enabled state logic already exists). |
| **My Events tab row shows a stray vertical ⋮** after "Past 3" at 375. | My Events, 375 | Reads as a kebab menu that does nothing. | 🟢 | Likely an overflow artifact of the tab rail - clip or remove. |
| **No stale-link fallback on who-was-there.** The closed/ineligible/empty renders were deliberately deleted; a stale URL now shows the default grid. | `coordination.jsx` WhoWasThere | Fine in the mockup; production must redirect stale links to Discover (per the build-logic note). | 🟢 | Document the redirect expectation for build handoff. |

---

## C. Per-page findings

### Dashboard / Home
| Finding | Breakpoint | Severity | Direction |
|---|---|---|---|
| Moment-banner stack, single-column measure (~760px), banner hierarchy, per-canon glyphs - all compliant. | all | ✓ | keep |
| Mutual banner title carries the inline ✦ next to "You clicked with Mia." - plus the nav ✨. Two sparks in one viewport is within canon (nav + fresh-mutual banner are both sanctioned), but watch that no third appears. | all | 🟢 | note only |
| "Finish setting up" quiz row's lavender fill sits directly on a white card - correct (borderless wash on white). | all | ✓ | keep |

### Discover
| Finding | Breakpoint | Severity | Direction |
|---|---|---|---|
| One-card column beside the sidebar (see Global). | 768 | 🟠 | sheet pattern <1024 |
| Category row: 16 circles wrap to 2 rows on desktop ✓; horizontal peek-scroll on mobile ✓; scrollbar artifact (see Global). | 375 | 🟡 | hide rail scrollbars |
| 2-up mini card at 375: banner, date, title 16/22 clamp-2, suburb, price + "N going", no inline CTA/tags - matches the mobile card spec. | 375 | ✓ | keep |
| Filter sheet opens, closes via ✕ AND scrim, sticky "Show 6 events" ✓. | 375 | ✓ | keep |

### Event Detail
| Finding | Breakpoint | Severity | Direction |
|---|---|---|---|
| Double sticky bars (see Global). | 375 | 🟡 | merge/hide nav |
| FOMO copy "locals new to Sydney" (see Global city sweep). | all | 🟠 | `{area}` |
| Locked venue line, wash boxes borderless-on-white, category-once tag rule, h1 scale - compliant. | all | ✓ | keep |

### My Events
| Finding | Breakpoint | Severity | Direction |
|---|---|---|---|
| Stray ⋮ after the tab row (see Global). | 375 | 🟢 | clip |
| List rows cap ~780px ✓; mobile calendar = agenda view ✓; "Pick one to see what's on" (no "click" as UI verb) ✓. | all | ✓ | keep |

### click with someone / Who was there / Coordination
| Finding | Breakpoint | Severity | Direction |
|---|---|---|---|
| **Suggest-a-plan drawer + mutual reveal invisible** (see Global). | all | 🔴 | fix animations |
| Who-was-there: header order (eyebrow→title→subline) ✓, plain anonymity line ✓, canonical PeopleCard 2-up ✓, pending "clicked" muted with NO spark ✓, mutual Sage "clicked ✨" ✓. | all | ✓ | keep |
| Grey glyph avatars throughout (see Global imagery). | all | 🟠 | photography |

### Profile (own + modal)
| Finding | Breakpoint | Severity | Direction |
|---|---|---|---|
| Avatar is the pottery illustration scene, not a face; photo grid tones vary but all read as illustration blocks. | all | 🟠 | photography |
| Header panel, purple eyebrows, intent chips (wash + #C8B8F8 border), true-white tags, events-as-rows - all compliant. | all | ✓ | keep |

### Onboarding / Quiz / How-it-works / Landing
| Finding | Breakpoint | Severity | Direction |
|---|---|---|---|
| Onboarding: Continue below fold at 375 (see Global). | 375 | 🟡 | sticky footer |
| Onboarding: progress bar pre-filled ✓, "Step 1 of 4" ✓, interest tag-groups ✓, single trailing done-✨ ✓. | all | ✓ | keep |
| How-it-works: "New to Sydney" intent row is stale v6 copy (canon v7: "New in town"). | all | 🟠 | copy sweep |
| Quiz: intro modal + privacy wash boxes render correctly; "New to Sydney" option (see sweep). | all | 🟠/✓ | copy sweep |
| Landing: hero, dictionary block, pre/post-launch toggle all render cleanly; footer 2 rows, no divider ✓. | all | ✓ | keep |

---

## D. Verified measurements (evidence)

- 375 type: h1 24.2px, section heads 17.2-17.8px, card-title 16-17px, body 16px flat, meta 13-13.5px - **matches the recalibrated mobile scale**; fluid `cqi` clamps confirmed scaling smoothly to 32/20.8/18 at 1440.
- Footer copyright row: `border-top: 0px none` - complies with the no-divider rule.
- Lone-card grids: single "You're going" card = one 280px+ track, not full row (`auto-fill` fix holding).
- Coordination drawer computed style: `opacity: 0; transform: matrix(0.98,0,0,0.98,0,16); animation-name: ckCoord` - frozen.
- Page overflow at 375: `scrollWidth 399 == clientWidth 399` (scrollbar strip is an inner rail, not page overflow).

---

## E. Top 10 prioritised fixes

1. 🔴 **Un-freeze the coordination + mutual-reveal modals** (remove opacity-gating entrance animations) - `coordination.jsx`; canon: CLICK_TEMPLATE §8 modal shell, §9 motion (the ✨ peak must actually render).
2. 🟠 **Real warm photography** for avatars, profile grid, event banners - CLICK art direction (imagery lever).
3. 🟠 **City-agnostic sweep**: "New in town" on How-it-works + quiz; `{area}` in FOMO lines and the landing placeholder - CLICK_LANGUAGE §4.
4. 🟠 **Discover 768**: filter sheet up to <1024; sidebar only ≥1024 - CLICK_TEMPLATE §1a fluid-first.
5. 🟡 **Hide horizontal-rail scrollbars** at 375 - CLICK_TEMPLATE §1b mobile.
6. 🟡 **Sticky Continue** on onboarding mobile - onboarding spec (thumb-reachable).
7. 🟡 **Single sticky bar** on mobile event detail - CLICK_TEMPLATE §1b.
8. 🟡 **Wash-surface subline contrast** → ink-soft - WCAG 1.4.3.
9. 🟢 **My Events ⋮ artifact** - visual polish.
10. 🟢 **Document stale-link redirect** for who-was-there - build handoff note.

---

## F. What's working - do not regress

- **Fluid type system** (cqi clamps): genuinely smooth 375→1440, no jumps; body flat 16.
- **One Event Card**: 16:9 banner, ≤3 tags + "+N" never wrapping, locked venue + lock glyph with aria-label, price-left/CTA-right footer, natural title height with footer pinned via `margin-top:auto`.
- **`auto-fill` lone-card fix** - a single event no longer stretches.
- **Mobile nav pattern**: compact header + sticky bottom bar with the ✨ FAB; ≥44px targets.
- **Filter bottom sheet** that actually closes (✕ + scrim), sticky apply.
- **Moment-banner system**: one component, wash + #C8B8F8 border on cream, borderless on white; capped stack.
- **Language discipline**: hyphens throughout; "click with", never "click on"; no "click" as a UI verb ("Pick one to see what's on"); intent-neutral, friends-first ordering; desire-framing; one ✨ per surface, pending state spark-free.
- **States**: loading skeletons for every page family; per-tab warm empty states; waitlist/full routing now consistent card→detail.
- **Footer**: two rows, no divider, compact on mobile - per project memory.
