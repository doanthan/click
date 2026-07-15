<!-- Detailed per-screen prompt: DISCOVERY (the /events browse page). Rev 27 Jun 2026. Completes Phase 1 of Click_Design_Prompt_FullBuildOut.md (one of the two prompts flagged "still to write"). Responsive WEBSITE, phone-optimised. Documents the AS-BUILT discovery surface in `click-app-v2/discovery.jsx` so the prompt and the live screen agree. Refs: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE / Buttons_Tags / CategoryIcons / EventCard. Paste the GLOBAL block from FullBuildOut first, then this. -->
# Click - Discovery (`/events`) - the browse page (desktop + mobile sheet)

Discovery is where someone goes to **find something to do** - activity-first, never people-first. It is the top of the funnel: the event card is the unit, the category icon-strip is the entry, and filtering must feel like narrowing a good list, never operating a search engine. The page is **a top-level destination** → it shows **NO back button** (per the GLOBAL nav rule). It already exists in the build (`discovery.jsx`); this prompt is the canonical spec so it doesn't drift.

**Six locked rules before the prompt:**
- 🔴 **Activity-first, never people-first.** Discovery surfaces *events*. No person cards, no "people near you", no intent as a browse axis. People live on the ✨ click page; discovery is the calendar of things to do.
- 🔴 **De-dated filter labels - never a dating filter.** Type filters are **Free · Under $25 · Trending · New · This week · Near me · Suggested for you**; Date is **Any · Today · This weekend · This week · This month**; Distance is a **"within N km"** slider. NEVER "Mostly singles", "Open to dating", or any intent/relationship filter. Intent is a profile/visibility setting, never a discovery facet.
- 🔴 **ONE category treatment** (per CategoryIcons.md): a Deep-Purple line icon on a soft Lavender-tint circle; the **selected** category fills Deep Purple and the icon reverses to cream. No rainbow per-category colours, no emoji.
- 🔴 **Mobile is a distinct pattern, not a squeezed desktop:** sticky search → horizontal-scroll category chips → a single **"Filters" button that opens a bottom SHEET** (slide-up + scrim) → a removable applied-filter chips row → single-column cards. The desktop left sidebar NEVER just reflows onto a phone.
- 🔴 **Filters are real and visible.** Applied filters show as **removable chips** below the controls so state is legible without reopening the sheet; a filter count rides on the Filters button; "Reset" clears them. The sheet's primary button reads **"Show N events"** (live count), never a bare "Apply".
- 🔴 **Every empty state is editorial, never blank/sad.** Two distinct kinds: **filtered-empty** ("Nothing matches those filters." + Reset) and **cold-start / empty-category** ("Nothing here yet - try another category"), each with a calm line icon and an action. Never a dead grey void.

```
=== PROMPT (paste under the GLOBAL block) ===
ROLE: Principal product designer (reference-class consumer web - Airbnb search, Luma calm). Design Click's DISCOVERY page (`/events`) for a responsive WEBSITE (375 → 1440), phone-optimised. NOT a native app. Activity-first browse: the event card is the unit (reuse the canonical EventCard - do not redraw it). It is a top-level destination → NO back button.

=== DESKTOP / TABLET (≥1024) - sidebar + sortable grid ===
- A sticky page header (the GLOBAL nav). Below it: an **H2 page title** ("Discover") - app-surface density, never a marketing display size.
- **Category icon-strip** across the top: horizontally-arranged icon-in-circle chips (All · Pottery & ceramics · Run clubs & fitness · Wine & bars · Cooking · Live music · Art & craft · Wellness · Trivia · Outdoors · Markets · Coffee · Workshops). Selected = Deep-Purple filled circle, cream icon (per CategoryIcons.md). One row, wraps or scrolls; not a dropdown.
- **Left filter sidebar (~260px, sticky):** three groups - **Type** (multi-select neutral pills: Free · Under $25 · Trending · New · This week · Near me · Suggested for you), **Date** (single-select pills: Any · Today · This weekend · This week · This month), **Distance** (a "within N km" slider, Deep-Purple accent, 1–25km + "Any distance"). A "Reset filters" text link when anything is set.
- **Results column:** a count ("12 events") + a **Sort select** (Soonest · Nearest first · Trending) top-right; then a **3-up card grid** of EventCards. Generous gaps; no card-wall monotony.
- **Search** with autocomplete in the header (matches event name / venue / suburb).

=== MOBILE (<768) - the sheet pattern (critical; NOT a squeezed desktop) ===
Top-to-bottom: **sticky search** → **horizontal-scroll category chips** (same icon-in-circle treatment, smaller) → a single row with a **"Filters" button** (shows a count badge when active) + the **Sort select** → a **removable applied-filter chips row** (each chip = label + ✕; horizontally scrollable) → **single-column EventCards**.
- Tapping **Filters** opens a **bottom sheet**: slide up from the bottom over a dimmed scrim, a grab affordance + "Filters" title + "Reset", the same Type / Date / Distance groups, and a pinned footer primary **"Show N events"** (live count) that closes the sheet. Scrim tap / Esc / the close dismiss the sheet - never navigate the page. ≥44px targets throughout.

=== STATES ===
- DEFAULT - populated grid/list.
- FILTERED-EMPTY - "Nothing matches those filters." + a calm compass/figure line icon + a **"Reset filters"** secondary button. (filters set, zero results)
- COLD-START / EMPTY CATEGORY - "Nothing here yet" for a category with no events + a nudge to try another; never blank.
- LOADING - a grid of EventCard skeletons (avatar/banner block + 2 text bars + chip row + button bar), not a spinner.

=== RULES ===
- CTA on each card = **RSVP** (price on the card, not in the button) / **Join waitlist** (full) / **View details** (booked) - never "RSVP to unlock" or price-in-button. NO "click" button anywhere on discovery (events are context-only; clicking is people-bound).
- Filters never include intent/relationship facets. Category is activity, not audience.
- 8pt grid; flat Deep Purple for the one primary moment per viewport; status colour on badges only; neutral interest tags (no dot); refined line icons; light mode; real Sydney event data (Wheel throwing · Posy Ceramics, Newtown · Greenhouse terrarium · Merchant & Green, Redfern · Sunrise run · Marrickville · Native cocktails · Surry Hills · Glass-blowing · Marrickville · Pasta from scratch · Surry Hills). No Batman/Melbourne/placeholder content.
- Sort + filter + search + distance are all genuinely functional (they actually narrow the list) - mock them as working, not decorative.

=== DELIVERABLE ===
Show DESKTOP (1024/1440 - sidebar + 3-up grid + a selected category + 2 active filters with the applied-chips visible) AND MOBILE (375 - chips, the Filters button with a count, the applied-chips row, single column) AND the open bottom SHEET on mobile (scrim + groups + "Show N events"). Plus both empty states. Prove the mobile pattern is its own layout, not a reflowed sidebar.
=== END PROMPT ===
```

## As-built reference (so the prompt matches the live screen)
The live `discovery.jsx` already implements this exactly: category taxonomy + `CAT_PATHS` line icons, `TYPES` / `DATES` / `SORTS`, a working filter/sort/search/distance pipeline, the desktop sidebar + 3-up grid, the mobile chips → Filters bottom-sheet → applied-chips → single column, and both the filtered-empty and cold-start empty states. The category-icon treatment is documented separately in **CategoryIcons.md** and as the `category-icons` foundations specimen.

## Where this references / is referenced
- **EventCard** (`Click_Design_Prompt_EventCard.md`) - the card unit; discovery never redraws it.
- **CategoryIcons** (`Click_Design_Prompt_CategoryIcons.md`) - the one icon-in-circle treatment used in the strip + mobile chips.
- **FullBuildOut** Phase 1 - discovery is the browse spine; this completes one of the two prompts it flagged as outstanding.

## Notes for Cindy
- **The mobile sheet is the whole point.** The most common discovery failure is a desktop sidebar crammed onto a phone. The bottom-sheet + applied-chips pattern keeps filtering one-thumb and keeps the result count always in view ("Show N events").
- **No intent in filters - ever.** That single rule is what keeps Click from reading as a dating app at the top of the funnel. Audience is never a browse axis.
- **It's already built to this spec** - this doc just makes discovery a single source of truth like the event and people cards, so it can't drift.
