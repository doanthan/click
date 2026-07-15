<!-- Discovery page (desktop + mobile) + Category-icon system. 23 Jun 2026. Responsive WEBSITE (not app). Brand canon: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Fixes from Click_Design_Review.md §4 + §5. -->
# Click — Discovery Page + Category Icons

Two tightly-related specs in one doc (icons live on Discovery, Dashboard, and Onboarding). Both are **responsive website** specs — mobile-optimised, NOT a native app. Paste either `=== PROMPT ===` block into claude design under the GLOBAL block from `Click_Design_Prompt_FullBuildOut.md`.

Fixes the two issues from the design review: the discovery page didn't have a real mobile pattern, and the category icons were an off-brand rainbow.

---

## PART 1 — DISCOVERY PAGE (`/events`)

```
=== PROMPT ===
ROLE: Senior product designer. Design Click's Discovery page as a responsive WEBSITE (mobile-optimised; not a native app). Show 375 / 768 / 1024 / 1440. Match Click brand + the Landing screen's craft. Activity-first, calm, scannable.

PURPOSE: help someone find a good thing to do near them this week, fast. Every extra tap on mobile is an abandonment risk — keep friction minimal.

=== DESKTOP (≥1024) ===
- Page header: "What's on near you" (Poppins) + one quiet line — exact string: **"N events near Newtown & Surry Hills this week"** (e.g. "6 events near…"). 🔴 Never "events ON near" (the live render had this typo).
- Sticky search bar (full width): "Search events, venues, or interests…" with autocomplete suggestions.
- Category chip strip under search: horizontal row of the category chips (see PART 2 icons), "All" selected by default (Deep Purple).
- Left filter sidebar (~260px): grouped, de-dated filters —
   • Type: Free · Under $25 · Trending · New · This week · Near me · Suggested for you (toggle)
   • Date: Any · Today · This weekend · This week · This month
   • Distance: slider (default 5km, max 25km)
   • Reset all
- Sort control (top-right of results): "Nearest first / Soonest / Trending".
- Results: 3-up event-card grid (the card system from Click_Design_Prompt_Buttons_Tags + Mockups) — photo, status badge, title, **suburb · distance (venue NAME hidden until booked — see EventCard privacy rule)**, day · time, up to 3 interest tags (+N), price, Save icon, CTA = RSVP (price on the card, not in the button). Capacity ("12/20") in Slate.
- Empty states: no-results-filters ("Nothing matches those filters — try widening distance or date." + Reset), no-results-search, cold-start (editorial fallback: "New here? Start with these." → top events).

=== MOBILE (<768) — the important pattern (Google-Maps-style) ===
Vertical scroll for results; horizontal scroll for categories; filters in a sheet. In order top→bottom:
1. Sticky search bar at top (stays on scroll).
2. Horizontal-scroll CATEGORY CHIP bar directly under search (swipe sideways through categories; results update). "All" first.
3. A compact control row: a single "Filters" button (with a count badge when filters are active) + a small "Sort" control beside it.
4. Tapping "Filters" opens a BOTTOM SHEET (slides up) containing all sidebar filters (Type / Date / Distance), with "Apply" and "Reset" inside the sheet. Dim the page behind; sheet is dismissible.
5. APPLIED-FILTERS row: when filters are set, show them as a horizontal-scroll row of removable chips above results ("Free ✕", "This weekend ✕"), so state is visible without reopening the sheet.
6. Results: SINGLE-COLUMN event cards, full-width, generous spacing.
Tablet (768–1023): 2-up grid; filters still in the sheet (sidebar only returns ≥1024).

=== RULES ===
- De-dated labels only (NO "Mostly Singles", "Singles", "Dating"). Activity + practical filters only.
- CTA: "RSVP" (price on the card, not in the button); "Join waitlist" when full; never "buy a ticket"/"RSVP to unlock". Status badges per palette (Almost full→Coral, Trending→Amber, Free→Sage, New→Teal, sold out→Slate on Mist). Status colour on badges only.
- Real Sydney data (Posy Ceramics / Merchant & Green / Marrickville run / Surry Hills cocktails / Mark Eliott glass / Surry Hills pasta). No Batman/Melbourne/placeholder.
- 8pt spacing; cream canvas; Poppins headers + system body; refined line icons; no gradients; no cards-in-cards; light-mode only.
- States: loading skeletons (card-shaped), all three empty states, ≥44px targets, visible focus.
=== END PROMPT ===
```

---

## PART 2 — CATEGORY ICON SYSTEM (used on Discovery, Dashboard, Onboarding)

Keeps the friendly rounded-icon-in-a-circle style you liked; fixes the off-brand rainbow into one cohesive, on-brand treatment (icon best practice = a limited, consistent palette).

```
=== PROMPT ===
ROLE: Senior design-systems designer. Design Click's category-icon set as one cohesive, on-brand system. Friendly rounded line icons in soft circles — but ONE consistent colour treatment, not a rainbow.

STYLE (every category identical treatment):
- Icon: a single refined line icon (Lucide/Phosphor, consistent ~1.75px stroke, rounded joins), in Deep Purple #3B2F81.
- Container: a soft Lavender #C8B8F8 tint circle (e.g. ~15–20% lavender on cream), 48px (mobile) / 56px (desktop). One radius, full circle.
- Label under the circle: system font, 12–13px, Ink, centered.
- RESTING = purple icon on lavender-tint circle. SELECTED/active = circle fills Deep Purple, icon reverses to cream (the locked selected-state rule — selection is always Deep Purple, never a status colour).
- Hover (web): tint deepens slightly. ≥44px tap target.
- NO rainbow per-category colours. (If a touch of identity is wanted, a tiny category-colour dot is the max — but monochrome-on-lavender is the more premium, more "Click" choice.)

CATEGORIES (activity-first; NO "Dating"; intent lives in profile, not browse):
Pottery & ceramics · Run clubs & fitness · Wine & bars · Cooking · Live music · Art & craft · Wellness · Trivia & games · Outdoors · Markets · Coffee · Workshops.
(Drop/merge the old vague ones — "Social", "Content", "Networking", "Dating" — into these activity categories.)

DELIVERABLE: the full set shown resting; 2–3 shown in selected state; the chip-strip form (icon + label) as it appears on Discovery/Dashboard; mobile horizontal-scroll arrangement. 8pt spacing, cream canvas.
=== END PROMPT ===
```

---

## Notes for Cindy
- **Discovery mobile** now has the proven pattern (sticky search → horizontal category chips → "Filters" bottom sheet → applied-filter chips → single-column cards). That's what makes it work on a phone instead of cramming a desktop sidebar.
- **Category icons:** same friendly style you liked, one calm purple-on-lavender treatment instead of the rainbow — instantly reads as Click, and selection is unmistakable (fills purple).
- Both are **responsive website** specs (no native-app chrome), consistent with the corrected prompts.
- These complete the two Phase-1 gaps flagged in the build-out plan.
