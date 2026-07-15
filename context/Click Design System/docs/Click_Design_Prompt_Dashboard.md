<!-- Dashboard art-direction prompt: Mode A (first-time) + Mode B (returning). Rev v2 (27 Jun 2026, from live render audit). Canonical per-screen prompt. Pairs with EventCard / PeopleCard / CategoryIcons / Discovery prompts. Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. -->
# Click - Dashboard (Mode A first-time + Mode B returning)

**Frame it right:** this is a personalized **home feed**, not a BI/analytics dashboard. The whole job is to feel calm, scannable, and easy on the eyes - guide the user to one next action (book something near them), then reveal more as they accrue history. The biggest failure mode is a "wall of identical cards in boxes," which reads cluttered and AI-generated. We beat that with whitespace-grouping, varied section treatments, and restraint.

## Build status (this repo - click-app-v2)
`dashboard.jsx` implements both modes against the rules below. The Rev v2 fixes applied:
- **CLICK RADAR = a compact social-proof BAR (NOT event cards)** - 1–3 light, one-line rows, each an anonymous aggregate social-proof line (people-overlap · shared-interest · trending) + the event name + a chevron, that taps through to the event. NOT an `EventCard` strip, NOT a "you keep crossing paths with people" people-tracking card. Cold-start (Mode A) = one calm bar: "As you go to events, your radar sharpens." The same `Radar` component renders on the dashboard AND the "click with someone" page.
- **click with someone = EXACTLY ONE rotated person card** + a "See everyone →" link to the Click page. Never 3 on the dashboard.
- **No empty "You were both at"** - the person card shows a real shared event, OR ≤3 shared interest tags, OR omits the context line entirely.
- **Finish setting up is COMPACT** - progress bar + "X of 5" + only the next incomplete step, with "See all steps" to expand. Not a full always-expanded box.
- **All event surfaces use the one canonical `EventCard`** (uniform site-wide, including Home).

## Plan (senior read)
- **Glanceable zone + progressive disclosure:** most-actionable content first; reveal complexity as the user earns it. Mode A = ~4 sections; Mode B is fuller but **conditional**.
- **Reduce cognitive load:** whitespace separates sections (not borders/boxes); no duplicate info; never force too many choices at once.
- **Sectioned vertical feed, one consistent card system**, varied per section (banner vs scroll-row vs grid) so it never reads as a card wall.
- **Conditional rendering (Mode B):** only render sections that have content. No sad empty boxes.
- **Activity-first always:** events lead; people/relational surfaces come after. No chat anywhere; people surfaces are anonymous-until-mutual, intent-neutral.

## Brand system (locked)
- **Colour:** Cream #F9F6F0 canvas; Deep Purple #3B2F81 flat + sparing (active nav, one key action) - NEVER a gradient; Ink #1C1830 text; Slate #6B6580 meta; Mist #E8E4F0 hairlines. Status colours (coral/amber/sage/teal) ONLY on event-card badges.
- **Type:** Poppins SemiBold 600 for section headers, greeting, big numbers; system stack for body/meta/cards.
- **Voice:** warm, dry, calm. Activity-first. No chat. "click with" not "match". Opportunity framing, never loss/urgency. Locked post-event string: "Did you click with anyone?".

## Layout foundations (where "easy on the eyes" is won)
- 8pt grid. SECTION spacing generous (48–64 desktop / 24–32 mobile); INTRA-section tighter (16–24). Inner ≤ outer, so sections read as groups via whitespace - NOT cards-in-boxes.
- Section pattern: small Poppins eyebrow/header + optional quiet "See all →", then the content.
- One card system, varied by section: scroll-rows on mobile; tidy grids on desktop. NEVER nest a card inside a card.
- Desktop max content width ~1060–1200px, generous gutters. Light, warm, breathing room.
- **ONE-PRIMARY-CTA DISCIPLINE:** only the single most important action in the current viewport is a filled Deep-Purple CTA. Spend the purple fill once per screenful; demote colliding primaries to ghost/text.

## Navigation (responsive website)
- **≥768:** sticky header - lowercase `click` wordmark left (home); Discover · Dashboard center; Host · notifications · avatar right. Active = Deep Purple.
- **<768:** compact header = `click` wordmark + avatar only; primary nav in a sticky **bottom action bar** (Home · Discover · ✨ click · My Events · Profile). Reserve bottom padding.
- **The "click" nav item:** lowercase label + standalone leading ✨ spark icon (same size/weight as other nav icons, to the LEFT of the word, ~8px gap). Reads "✨ click" as `[icon] click`. Never a superscript/dot/accent merged into the glyphs. Three distinct things: lowercase `click` wordmark (home) ≠ `[house] Home` ≠ `[✨] click` (people page). People page never reads as "match".
- **Dating-mode toggle (header):** shown ONLY to users with "Open to dating"; quiet "Dating mode: On / Paused", refined heart/spark line-icon, Deep-Purple when on; pausing shows a calm confirm; turning on is instant.

## Mobile-first (375)
- Bottom-bar nav, never a wrapping pill row in the header.
- People card: ONE full-width card - never a clipped 2-up row.
- Event strips: horizontal scroll-row with a partial next-card PEEK (~88–90% width + 16px gap), not a cramped clipping 2-up grid.
- Post-event prompt: two actions STACK full-width (primary above "Maybe later").
- Finish setting up: slim strip, never the expanded box.
- Titles clamp (event 2 lines, booking row 1 line, date·venue truncates with …).

## Mode A - first-time (progressive disclosure)
1. **Welcome** - warm brief greeting (Poppins h2 24/32, NOT display), one orienting line: "Here's what's good near you this week, [Name]." Name in Ink or Deep Purple - never coral.
2. **Finish setting up** - the profile-completion card (see below). COMPACT by default.
3. **Suggested for you** - 3 event cards, this week, near them, matched. Only AVAILABLE, in-cluster events. Scroll-row mobile / 3-up grid desktop.
4. **Click radar** - the compact social-proof BAR (see below). Cold-start: one calm bar, "As you go to events, your radar sharpens." Light on cream.
5. **Categories** - small neutral interest tags → Discovery.
No big "0" stat counters, no "Quick Actions" row that duplicates nav.

## Mode B - returning (conditional; ordered by time-sensitivity)
1. **Post-event prompt** (only inside a recent event's 48h window) - gentle banner: "Did you click with anyone?" + event name + two yes-branches ("See who was there" primary + "Maybe later" quiet). Leads when present.
2. **Upcoming** - your booked events ("You're going" Sage state), soonest first.
3. **click with someone** (lowercase eyebrow) - EXACTLY ONE rotated person from the curated pool of 3, with a "See everyone →" link to the Click page. Real overlap only (shared event OR ≤3 shared neutral tags) - never a bare "You were both at". Canonical People Card. On click → muted pending "clicked" (lowercase, no ✨, same footprint). Anonymous reassurance once at section top.
4. **Click radar** - the compact social-proof BAR, populated.
5. **Suggested for you** - fresh this week, matched.
6. **Saved / waitlist** - saved (purple icon) + waitlisted (amber badge).
7. **Activity feed** - quiet milestones, never a notification dump.
8. **Categories** - same neutral tags.
0. **Finish setting up (slim strip)** - while profile <100%, a thin dismissible strip near the top (below the post-event prompt if present).
Conditional rule: skip any empty section; for a core section that's empty, use a warm action-prompting empty state.

## Finish setting up - profile-completion card (activation core)
A premium profile-completeness card that motivates adding data that sharpens suggestions. The value must be obvious and the moment rewarding, never chore-like.
- **NOT a user-checkable to-do list.** The left indicator is a STATUS (outline ring incomplete / filled check complete), not a tappable checkbox. Completion is SYSTEM-VERIFIED by doing the action (the row's right-hand CTA opens that flow); rows auto-tick on genuine completion.
- **COMPACT / progressive disclosure:** by default header + pre-filled progress bar + "X of 5" + ONLY the next incomplete step, then "See all steps" to expand inline. Rows compact (~44–48px). At 100%: one celebration ("You're all set ✨ - your suggestions just got sharper"), then collapse/dismiss.
- **Done state:** filled Deep-Purple/Sage check; title stays legible, slightly muted; NO strikethrough.
- **The pull:** progress bar + "X of 5" + concrete per-item value lines. NO points/streaks/leaderboards/guilt. Progress + value + one celebration only.
- Items: Add a photo · Write a one-line bio · Pick 3+ interests · Take the Click quiz · Set your suburb.

## Click radar - the EVENT radar (canonical, per 09)
## Click radar - a compact social-proof BAR (locked 27 Jun; NOT event cards - supersedes the old "EVENT strip")
1–3 light, one-line **bars** (rows), each an anonymous AGGREGATE social-proof line tied to ONE event, that taps straight through to that event's (locked) detail page. The hook is the SIGNAL, not a card. **Do NOT render event cards here**, and it is NOT a "you keep crossing paths with people" people-tracking card (never names/shows/tracks individual attendees).
- **Section:** eyebrow "On your radar" + a quiet one-liner ("People like you are showing up to these.").
- **Each bar = ONE row:** a small line-icon (people/spark/trend) in a soft lavender circle + the social-proof line + " → " + the event name (Ink, semibold) + a chevron. Hairline-separated rows inside one light, rounded container on cream - never cards, never a dark block. The whole row taps to the event.
- **The line** is the highest-priority aggregate that qualifies, AGGREGATE + ANONYMOUS only:
  1. "3 people you might click with are going" (people-overlap; needs ≥3 attendees + viewer's matches)
  2. "4 going are also into plants" / "Popular with pottery fans" (shared-interest aggregate)
  3. "Mostly people in their 30s going" (life-stage aggregate; sensitive tags never shown)
  4. "Trending in Sydney" (booking velocity, fallback)
- **Privacy rails (unchanged):** ≥3 total confirmed attendees before any line; aggregate COUNTS only, never who; sensitive life tags excluded; venue locked (suburb + distance) until RSVP.
- Show ~1–3 bars max (a teaser, not a feed). Light on cream. The SAME bar renders on the dashboard AND the "click with someone" page (one `Radar` component, exported from the dashboard).
- **Cold start:** a single calm, non-tappable bar - "As you go to events, your radar sharpens." Don't imply personalisation that isn't there yet.
- **Cold start:** "Trending near you" (top events by velocity), framed honestly - do not imply personalisation that isn't there yet.

## Fix-these (from the live-build review)
- Coral is a STATUS colour ONLY. Primary action = Deep Purple. No coral greeting/CTA/progress.
- DROP big "0" stat blocks; the checklist + suggested events drive action.
- Radar is light on cream, never dark.
- Never foreground romantic intent (no "open to dating" badge on cards/radar).
- Suggested events must be AVAILABLE + in-cluster; never sold-out/out-of-cluster.
- CTA = "RSVP" (price on card); never "RSVP to unlock".
- NO calendar on the dashboard (lives on My Events).
- Footer = GLOBAL minimal (cream, one hairline, NO tagline, monochrome social icons).
- TAGS - one neutral style everywhere (white fill, Mist hairline, Ink text, no dot, one line + "+N"). Purple only when selected.
- COMPACT density: greeting h2 (24/32) not display; section headers h3 (20/28); post-event prompt + finish-setting-up compact.

## Real data (no placeholders)
Events: "Wheel throwing - make two mugs" · Posy Ceramics, Newtown · Thu 6:30pm · $110 | "Greenhouse terrarium build" · Merchant & Green, Redfern · Sat 2pm · $120 | "Sunrise run + coffee, 5k" · Marrickville · Sat 6:15am · Free | "Native cocktails, four pours" · Surry Hills · Fri 7pm · $97 | "Pasta from scratch" · Surry Hills · Wed 6:30pm · $150. People (first name + initial, intent-neutral): Mia, Tom, Priya, Jules, Hassan, Bec.

## States
The Mode-A cold-start radar; Mode-B conditional skips; loading (calm skeletons matching card shapes, not spinners); post-event prompt present/absent; saved/waitlist empty state. Tap targets ≥44px; visible focus; calm hover/press; reduced-motion respected.

## Anti-AI-slop
BANNED: gradients/glows; glassmorphism/blur; cards-inside-cards; a uniform card wall (vary section treatments); stock/3D-blob imagery; emoji-as-icons (keep the locked ✨ only); placeholder data; generic "clean & modern" filler. Real warm-graded venue photos on cards. Editorial calm over density.

## Where this references / is referenced
- **EventCard** - the card unit used by Suggested / Saved / Discovery; the radar does NOT use it (the radar is a compact one-line social-proof bar that links to the event).
- **PeopleCard** - the canonical "person you can click with" card; the dashboard shows one rotated instance.
- **CategoryIcons / Discovery** - the browse entry points the categories + radar lead into.
