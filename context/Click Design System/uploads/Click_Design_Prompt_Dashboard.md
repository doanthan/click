<!-- Dashboard art-direction prompt: Mode A (first-time) + Mode B (returning). Updated 27 Jun 2026: gamified new-user "finish setting up" checklist + Click-quiz nudge; live-build review fixes (coral discipline, drop 0-stat blocks, light radar, intent-neutral, available+in-cluster suggestions); RSVP CTA. Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Anti-AI-slop per Click_Design_Prompt_ArtDirection.md. -->
# Click — Dashboard (Mode A first-time + Mode B returning)

**Frame it right:** this is a personalized **home feed**, not a BI/analytics dashboard. The whole job is to feel calm, scannable, and easy on the eyes — guide the user to one next action (book something near them), then reveal more as they accrue history. The biggest failure mode is a "wall of identical cards in boxes," which reads cluttered and AI-generated. We beat that with whitespace-grouping, varied section treatments, and restraint.

## Plan (senior read, research-backed)
- **Glanceable zone + progressive disclosure:** most-important/most-actionable content first; reveal complexity as the user earns it. That's why Mode A = 4 sections and Mode B is fuller but **conditional**.
- **Reduce cognitive load:** whitespace separates sections (not borders/boxes), no duplicate info, never force too many choices at once. Calm beats dense.
- **Sectioned vertical feed, one consistent card system**, varied per section (a banner vs a scroll-row vs a grid) so it doesn't read as a card wall.
- **Conditional rendering (Mode B):** only render sections that have content. No sad empty boxes — skip the section, or use a warm, action-prompting empty state where the section is core.
- **Activity-first always:** events lead; people/relational surfaces come after (brand rule). No chat anywhere; people surfaces are anonymous-until-mutual, intent-neutral.

---

```
=== PROMPT ===

ROLE: Act as a principal product designer (30 yrs, reference-class consumer apps — Airbnb home, Luma, Headspace). Design Click's signed-in HOME dashboard — a calm, personalized, activity-first feed, NOT a data dashboard. Two modes (below). Mobile-first; design 375 first, then 768 / 1024 / 1330 (the spec's breakpoints). The brief from the founder: "super easy on the eyes" — so prioritise whitespace, hierarchy, and restraint above all. It must look like a funded product, never an AI template.

=== BRAND SYSTEM (locked) ===
Colour (CLICK_PALETTE.md): Cream #F9F6F0 canvas; Deep Purple #3B2F81 flat + sparing (active nav, one key action) — NEVER a gradient; Ink #1C1830 text (never pure black); Slate #6B6580 meta; Mist #E8E4F0 hairlines/dividers. Status colours (coral/amber/sage/teal) ONLY on event-card badges.
Type (CLICK_TYPE.md): Poppins SemiBold 600 for section headers, greeting, big numbers; system font stack for body/meta/cards. Never a generic neutral as the headline.
Voice (CLICK_LANGUAGE.md): warm, dry, calm. Activity-first (events lead, people second). No chat. "click with" not "match". Opportunity framing, never loss/urgency. Locked string for the post-event prompt: "Who'd you click with?".

=== LAYOUT FOUNDATIONS (this is where "easy on the eyes" is won) ===
- 8pt grid. SECTION spacing generous (48–64px between sections); INTRA-section tighter (16–24px). Inner ≤ outer, so sections read as groups via whitespace — NOT via cards-in-boxes.
- Section pattern: small Poppins eyebrow/header (e.g. "What's on near you this week") + optional quiet "See all →" link, then the content. Consistent rhythm down the page.
- One card system, varied by section: horizontal scroll-rows (carousels) for suggested/saved/people on mobile; tidy grids on desktop. NEVER nest a card inside a card.
- Desktop: comfortable max content width (~1100–1200px), generous side gutters — content never sprawls edge-to-edge. Calm, not full-bleed density.
- Light, warm, breathing room everywhere. If in doubt, add space and remove an element.
- 🔴 ONE-PRIMARY-CTA DISCIPLINE (critical on this long feed): only the **single most important action in the current viewport** is a filled Deep-Purple CTA. Everything else is quiet — ghost button, text link, or icon. A long sectioned feed must NEVER show two filled-purple buttons in one viewport (it flattens hierarchy and burns the "one purple moment" rule). Practically: an event card's own "RSVP" can be purple within its card, but the section header links ("See all →", "See everyone →"), the Finish-setting-up row CTAs, and the people card's "click with" should be calibrated so that as the user scrolls, at most one filled-purple action competes for the eye at a time — the rest are secondary/quiet. When two primaries would collide, demote the less urgent to a ghost/text style. The purple fill is the Von-Restorff signal; spend it once per screenful.

=== NAVIGATION (responsive WEBSITE — not a native app) ===
- ≥768: responsive sticky header — `click` wordmark left (lowercase = brand/home, taps to the dashboard); Discover · Dashboard center; Host an event · notifications · avatar right. Active = Deep Purple. (Optional left sidebar for the dashboard content area.)
- <768: compact header + menu. An optional sticky bottom action bar (Home · Discover · ✨ click · My Events · Profile) is fine as a WEB pattern — NOT native-app chrome (no device status bar/safe areas). ("My Events" = the bookings hub; "Saved" is one tab inside it, not a top-level nav label.)
- 🔴 THE "click" NAV ITEM — lowercase label (the feeling/verb, per CLICK_LANGUAGE), paired with the **✨ spark icon**, the only spark in the bar, marking it as the "click with someone" people destination. (Lowercase distinguishes it from the platform name; the spark + the destination role distinguish it from the `click` wordmark/home.)
  🔴 SPARK PLACEMENT (the live render botched this as "c˙Click" — a tiny dot merged into the letters). The ✨ is a **standalone LEADING icon**, treated EXACTLY like the other nav icons: same size and optical weight as the Home/Discover/Events icons (~18–20px), sitting to the LEFT of the word with the standard icon→label gap (~8px), vertically centered. So the item reads **"✨ click"** as `[icon]  click`, identical in structure to `[house] Home` · `[compass] Discover` · `[calendar] Events`. NEVER render the spark as a superscript, an accent, a dot between letters, or anything merged into the glyphs. The refined ✨ line-mark only — not an emoji.
  This makes three things distinct: the lowercase `click` wordmark (brand/home, top-left), `[house] Home`, and `[✨] click` (the people/connection page). Never label the people page anything that reads as "match".

=== MODE A — FIRST-TIME (5 sections; progressive disclosure, uncluttered) ===
A calm first run that guides to a first booking AND nudges profile completion.
1. WELCOME — a warm, brief greeting (Poppins), one orienting line: "Here's what's good near you this week, [Name]." Calm and personal; NOT a giant hero. **Use the compact app scale (per GLOBAL density): greeting = h2 (24/32), NOT display/h1 — the live render was oversized.** (Greeting name in Ink or Deep Purple — never coral.)
2. FINISH SETTING UP — the profile-completion card (full spec in the **FINISH SETTING UP** section below). The new-user activation core: a completeness card that makes people *want* to add the data that sharpens their suggestions. It is a **status display, NOT a to-do list users can tick** — rows fill only when the action is actually done.
3. SUGGESTED FOR YOU — the hero content: 3 event cards, this week, near them, matched. **Only AVAILABLE, in-cluster events** — never suggest sold-out/full events, never out-of-cluster (no Mosman/Melbourne) to a new user. Scroll-row on mobile, 3-up grid on desktop.
4. RADAR — the proximity surface (per 09_CLICK_WITH_ME_AND_RADAR), calm new-user empty state ("As you go to events, this fills in"). Intent-neutral, privacy-first — never implies dating, never reveals one-way interest. **Light treatment on cream — NOT a dark card.**
5. CATEGORIES — a way in if the 3 suggestions don't land: small neutral interest tags (per Click_Design_Prompt_Buttons_Tags.md) — Pottery, Run clubs, Wine, Cooking, Live music, Markets. Tap → Discovery.
No big "0" stat counters, no "Quick Actions" row that duplicates the nav. Restraint is the point.

=== MODE B — RETURNING (full, CONDITIONAL — only render sections with content; ordered by time-sensitivity) ===
1. POST-EVENT PROMPT (only if a recently attended event is inside its 48h window) — a distinct, gentle banner at top: "Who'd you click with?" with the event name + a calm CTA. Time-sensitive, so it leads when present. Two yes-branches ("See who was there" primary + "Maybe later" quiet). Opportunity-framed, never nagging. **Mobile: stack the two actions full-width (primary above "Maybe later"), never crammed side-by-side — the live render wrapped them.** Desktop: side by side, auto-width.
2. UPCOMING — your booked events (with "You're going" Sage state), soonest first. What's next.
3. CLICK WITH SOMEONE (rendered section eyebrow lowercase: **"click with someone"** — the feeling/verb, not the platform) — surfaces **EXACTLY ONE person at a time** (never 2–3 here — the wall lives on the Click page), rotated through the day from the curated pool of 3 (a drip, not a wall — feels intentional, cuts fatigue). **This section MUST include a clear "See everyone →" link** to the **click with someone page** (which shows all 3 + radar + profile view) — the dashboard is the teaser, the page is the destination. Anonymous-until-mutual, intent-neutral; placed AFTER your activity (brand rule). Render the one person with the **canonical People Card component** (full spec: `Click_Design_Prompt_PeopleCard.md` — do NOT re-describe it; use the SAME horizontal row-card): avatar, name·age, sentence-case intent label, **conditional shared-context** (never fabricated, never a bare "You were both at"), ≤3 shared tags, "click with [Name]" + "View profile". On click → pending pill **"clicked ✨"** (lowercase, UNNAMED — never "You clicked with [Name]") + the anonymous helper line. One rotated instance of the exact card used on the Click page.
4. RADAR — proximity surface (now populated).
5. SUGGESTED FOR YOU — fresh events this week, matched.
6. SAVED / WAITLIST — things saved or waitlisted (Saved = purple icon; Waitlist = amber badge).
7. ACTIVITY FEED — quiet, low-key: milestones and what's happened ("You attended pasta night", "Your radar updated"). Subtle, never a notification dump.
8. CATEGORIES — browse entry, same neutral tags.
0. FINISH SETTING UP (slim strip) — if the profile is still <100%, show a thin, dismissible "finish setting up" strip near the top (below the greeting, BELOW the post-event prompt if present). Same progress bar + quiz task as Mode A, condensed. Disappears at 100%.
Conditional rules: skip any empty section (don't render a hollow box). For a core section that's empty, use a warm action-prompting empty state ("Nothing saved yet — your next event is where it happens.").

=== FINISH SETTING UP — PROFILE-COMPLETION CARD (get this right — it's the activation core) ===
The pattern: a profile-completeness card (the LinkedIn "profile strength" / dating-app "complete your profile" idea, done premium). It exists to motivate users to add the data that makes their event + people suggestions better — so the VALUE must be obvious and the moment must feel rewarding, never chore-like.

🔴 CRITICAL INTERACTION RULE — it is NOT a user-checkable to-do list:
- The left indicator is a STATUS, not a checkbox. It is NOT tappable and must NOT look tappable — a soft outline ring when incomplete, a filled check when complete. Never a checkbox a user can toggle.
- Completion is SYSTEM-VERIFIED by the action: a row ticks ONLY when the user actually does it (uploads a photo, saves a bio, finishes the quiz). Users can never mark an item done themselves.
- The action is the ROW'S CTA on the right ("Add" / "Write" / "Start →"). Tapping it opens that task's flow; on genuine completion the row auto-ticks (soft animation) and the bar advances.

STRUCTURE & HIERARCHY:
- Header: "Finish setting up" (Poppins SemiBold ~20) + completeness count top-right ("2 of 5", system font, Slate).
- Progress bar under the header: full-width, ~6–8px, rounded, Deep-Purple fill on a Mist track, PRE-FILLED to current progress (endowed-progress — never starts at 0).
- One value line: "A fuller profile means better suggestions — for events and people."
- Rows (generous rhythm ~56–64px; hairline dividers or whitespace, not heavy boxes). Each row = [status indicator] · [title (Poppins ~15) + one-line value (system ~13, Slate)] · [action CTA, right]:
  • Add a photo — "people show up more for a face"
  • Write a one-line bio — "a sentence helps people place you"
  • Pick 3+ interests — "so we suggest the right events"
  • Take the Click quiz — "2 min · sharpens your suggestions"
  • Set your suburb — (usually already done from onboarding)

DONE STATE — NO strikethrough (strikethrough reads as 'cancelled/deleted', not 'achieved'):
- Completed row: filled Deep-Purple (or Sage) check; title stays LEGIBLE, slightly muted; optional quiet "Done". Never struck-through.

THE PULL (restrained gamification — make them WANT to finish, premium not game-y):
- The progress bar + "X of 5" is the core motivator (visible progress = the reward).
- Every item shows its concrete VALUE (above) — the "why" is what actually drives completion (LinkedIn-style).
- micro-animation: completing a row → the ring fills to a check with a soft ✨ tick (~250ms); the bar advances smoothly. At 100% → ONE warm celebration ("You're all set ✨ — your suggestions just got sharper"), then the card gracefully collapses/dismisses.
- NO points / streaks / leaderboards / guilt nudges (the brand is chilled). Progress + value + one celebration only.

CRAFT: 8pt spacing; Poppins titles + system body; refined line icons (no emoji except the locked ✨ at the celebration); Deep Purple for the check + bar (status colours never used here); a calm cream card on cream with a soft hairline — not a heavy box. Reads instantly as a funded product, and makes the next step feel obvious and inviting.

=== FIX THESE (from the live-build review — Doan's screens) ===
- Coral is a STATUS colour ONLY (almost-full/urgent). Do NOT use coral for the greeting name, primary CTAs, progress bars, or big fills. Primary action = Deep Purple.
- DROP the big "Upcoming RSVPs 0 / Saved 0" stat blocks — large zeros read as empty/demotivating. The checklist + suggested events drive action instead.
- RADAR is light on cream, never a dark card.
- Never foreground romantic intent (no "1 open to dating" badge on cards/radar). Intent stays quiet + neutral.
- Suggested events must be AVAILABLE and in-cluster; never show sold-out/full or out-of-cluster events as "suggested".
- CTA = "RSVP" (price on the card); never "RSVP to unlock".
- **NO calendar on the dashboard.** The calendar overview lives only on the My Events page. The dashboard is a feed; keep the glanceable zone clear.

=== REAL DATA (no placeholders) ===
Events: "Wheel throwing — two mugs" · Posy Ceramics, Newtown · Thu 6:30pm · $110 · Almost full | "Greenhouse terrarium" · Merchant & Green, Redfern · Sat 2pm · $120 · Trending | "Sunrise run + coffee, 5k" · Marrickville · Sat 6:15am · Free | "Native cocktails" · Surry Hills · Fri 7pm · $97 | "Pasta from scratch" · Surry Hills · Wed 6:30pm · $150.
People (Click-with-someone, first name + initial only, intent-neutral): Mia, Tom, Priya, Jules, Hassan, Bec.

=== STATES ===
Design: the empty Mode-A radar; Mode-B conditional skips; loading (calm skeletons matching card shapes, not spinners); the post-event prompt present/absent; saved/waitlist empty state. Tap targets ≥44px; visible focus; calm hover/press.

=== ANTI-AI-SLOP (see Click_Design_Prompt_ArtDirection.md) ===
BANNED: gradients/glows; glassmorphism/blur; cards-inside-cards; a uniform widget/card wall (vary section treatments); stock/3D-blob imagery; emoji-as-icons (keep locked ✨ only); placeholder data; generic "clean & modern" filler. Real warm-graded venue photos on cards. Editorial calm over density.

=== CRAFT CHECKLIST ===
[ ] Reads as a calm home feed, not a widget dashboard; generous whitespace; nothing feels crowded
[ ] Mode A = 5 sections incl. the FINISH SETTING UP completeness card — status indicator is NOT a user-tickable box (rows fill only on real completion); no strikethrough on done items; value-per-item; pre-filled progress; ✨ tick + 100% celebration; Mode B = conditional + slim strip while <100%
[ ] No big "0" stat blocks; no Quick-Actions row; coral used for status only (not name/CTA/progress); radar is light not dark; no "open to dating" badge; suggested events are available + in-cluster; CTA "RSVP" not "RSVP to unlock"
[ ] ONE filled-purple primary CTA per viewport — section links / checklist CTAs / "click with" calibrated so two primaries never collide as the user scrolls; less-urgent actions demoted to ghost/text
[ ] Nav unmistakable: lowercase `click` wordmark (brand/home) ≠ Home (house icon) ≠ **✨ click** (people page, lowercase, the only spark in the bar); people page never reads as "match"
[ ] Sections grouped by whitespace (inner ≤ outer), NOT nested cards; 8pt throughout
[ ] Activity leads; people surfaces come after and are anonymous-until-mutual, intent-neutral; no chat
[ ] Post-event prompt uses "Who'd you click with?", leads when present, never naggy
[ ] One card system varied by section (scroll-row / grid / banner); real event + people data
[ ] Cream canvas; flat purple, zero gradients; Poppins headers + system body; ink never pure black; status colour only on badges
[ ] Nav: bottom tabs <768, left sidebar ≥768; layouts shown at 375/768/1024/1330; ≥44px targets
[ ] Loading skeletons + empty states designed; calm motion; reduced-motion respected
[ ] Looks like a funded consumer product (Airbnb/Luma calm), not a template
=== END PROMPT ===
```

---

## Notes for Cindy
- **The "easy on the eyes" lever is spacing + restraint**, not visual flourish. The prompt forces generous section spacing, whitespace-grouping instead of boxes, a capped desktop width, and one accent colour. That's what makes a busy feed feel calm.
- **Mode A is the activation surface** (5 sections incl. the gamified checklist) — research shows a pre-filled progress checklist lifts completion 20–30% and 7-day retention 40–60%. Kept restrained (progress + one celebration, no points/streaks) to fit the chilled brand. A new user should still never see a half-empty Mode B.
- **Mode B is conditional** — the single most important rule is "skip empty sections, never render hollow boxes." That's what keeps a returning user's home from looking broken or cluttered on a quiet week.
- **Order = time-sensitivity:** post-event prompt (48h window) → upcoming → people → radar → suggested → saved → activity → categories. Activity stays ahead of people, per brand.
- Saved to `UIUX/cowork/` per your new convention. Want me to run this through claude_design once the Brand Package imports (so it inherits Poppins + the wordmark), or are you pasting it in?
