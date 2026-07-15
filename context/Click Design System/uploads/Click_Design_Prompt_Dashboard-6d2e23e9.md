<!-- Dashboard art-direction prompt: Mode A (first-time) + Mode B (returning). Updated 27 Jun 2026: gamified new-user "finish setting up" checklist + Click-quiz nudge; live-build review fixes (coral discipline, drop 0-stat blocks, light radar, intent-neutral, available+in-cluster suggestions); RSVP CTA. Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Anti-AI-slop per Click_Design_Prompt_ArtDirection.md.
Rev v2 (27 Jun, from live render audit): Finish-setting-up made COMPACT (progressive disclosure — progress + next step, expandable; rows 44–48; was too big); reinforced click-with-someone = EXACTLY ONE rotated card + "See everyone →" (render wrongly showed 3) and killed the empty "You were both at" (show shared neutral tags / conditional overlap); **CLICK RADAR = a compact social-proof BAR (not event cards; Cindy 27 Jun)** — 1–3 light rows, each an anonymous aggregate social-proof line → event (09 §9 rails); NOT an event-card strip, NOT a "crossing paths with people" card; mobile-first section added (bottom-bar nav not a wrapping pill row, 1 full-width people card, scroll-rows with peek, stacked post-event buttons); footer = GLOBAL minimal (no tagline — render stale); tags = one neutral style everywhere; compact density. ⚠️ Flag to Doan: confirm radar is event-first (09), not people-tracking. -->
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
Voice (CLICK_LANGUAGE.md): warm, dry, calm. Activity-first (events lead, people second). No chat. "click with" not "match". Opportunity framing, never loss/urgency. Locked string for the post-event prompt: "Did you click with anyone?".

=== LAYOUT FOUNDATIONS (this is where "easy on the eyes" is won) ===
- 8pt grid. SECTION spacing generous (48–64px between sections); INTRA-section tighter (16–24px). Inner ≤ outer, so sections read as groups via whitespace — NOT via cards-in-boxes.
- Section pattern: small Poppins eyebrow/header (e.g. "What's on near you this week") + optional quiet "See all →" link, then the content. Consistent rhythm down the page.
- One card system, varied by section: horizontal scroll-rows (carousels) for suggested/saved/people on mobile; tidy grids on desktop. NEVER nest a card inside a card.
- Desktop: comfortable max content width (~1100–1200px), generous side gutters — content never sprawls edge-to-edge. Calm, not full-bleed density.
- Light, warm, breathing room everywhere. If in doubt, add space and remove an element.
- 🔴 ONE-PRIMARY-CTA DISCIPLINE (critical on this long feed): only the **single most important action in the current viewport** is a filled Deep-Purple CTA. Everything else is quiet — ghost button, text link, or icon. A long sectioned feed must NEVER show two filled-purple buttons in one viewport (it flattens hierarchy and burns the "one purple moment" rule). Practically: an event card's own "RSVP" can be purple within its card, but the section header links ("See all →", "See everyone →"), the Finish-setting-up row CTAs, and the people card's "click with" should be calibrated so that as the user scrolls, at most one filled-purple action competes for the eye at a time — the rest are secondary/quiet. When two primaries would collide, demote the less urgent to a ghost/text style. The purple fill is the Von-Restorff signal; spend it once per screenful.

=== NAVIGATION (responsive WEBSITE — not a native app) ===
- ≥768: responsive sticky header — `click` wordmark left (lowercase = brand/home, taps to the dashboard); Discover · Dashboard center; Host an event · notifications · avatar right. Active = Deep Purple. (Optional left sidebar for the dashboard content area.)
- <768: compact header = `click` wordmark left + avatar (+ a menu/hamburger) ONLY. 🔴 **Do NOT render the 4 nav items as a wrapping pill row in the header — the live render did, and it eats vertical space and pushes content down.** Put primary nav in a **sticky bottom action bar** (Home · Discover · ✨ click · My Events · Profile) — a WEB pattern, NOT native chrome (no status bar/safe areas). Content reserves bottom padding so nothing hides under the bar. ("My Events" = the bookings hub; "Saved" is a tab inside it.)
- 🔴 THE "click" NAV ITEM — lowercase label (the feeling/verb, per CLICK_LANGUAGE), paired with the **✨ spark icon**, the only spark in the bar, marking it as the "click with someone" people destination. (Lowercase distinguishes it from the platform name; the spark + the destination role distinguish it from the `click` wordmark/home.)
  🔴 SPARK PLACEMENT (the live render botched this as "c˙Click" — a tiny dot merged into the letters). The ✨ is a **standalone LEADING icon**, treated EXACTLY like the other nav icons: same size and optical weight as the Home/Discover/Events icons (~18–20px), sitting to the LEFT of the word with the standard icon→label gap (~8px), vertically centered. So the item reads **"✨ click"** as `[icon]  click`, identical in structure to `[house] Home` · `[compass] Discover` · `[calendar] Events`. NEVER render the spark as a superscript, an accent, a dot between letters, or anything merged into the glyphs. The refined ✨ line-mark only — not an emoji.
  This makes three things distinct: the lowercase `click` wordmark (brand/home, top-left), `[house] Home`, and `[✨] click` (the people/connection page). Never label the people page anything that reads as "match".
- DATING MODE — 🔴 there is **NO dating-mode toggle in the dashboard header** (moved 27 Jun). The on/paused toggle lives in **Settings / Edit Profile**, and dating mode is first set during **onboarding** (when "Open to dating" is selected). The dashboard may quietly reflect intent-appropriate content (e.g. romantic FOMO shown only to dating-on viewers) but does NOT host the toggle control. (Was a header toggle; relocated so the dashboard stays a clean activity feed and dating settings live with the other profile/privacy controls.)

=== MOBILE-FIRST (375 — the live render had real problems; fix them) ===
Design 375 first, then scale up. Mobile-specific rules:
- Primary nav lives in the sticky BOTTOM bar (above); the header is just `click` wordmark + avatar — NO wrapping pill row in the header.
- PEOPLE CARD ("click with someone"): ONE full-width card (the dashboard shows one person anyway) — NEVER a 2-up row with the second card clipped (the live render did this).
- EVENT STRIPS (suggested / radar / saved & waitlist): a horizontal scroll-row of full cards with a partial next-card **PEEK** to signal more — not a cramped 2-up grid that clips cards. One card ≈88–90% of viewport width + peek, 16px gap.
- POST-EVENT PROMPT: the two actions **STACK full-width** on mobile (primary "See who was there" above, "Maybe later" quiet below) — never side-by-side (the live render wrapped "See who was there" onto two lines). Subline (locked, tightened): "No rush - just the people who were there." (drop the filler "actually"). Desktop may sit the primary + quiet "Maybe later" inline, right-aligned.
- 🔴 **ONE BUTTON, used identically everywhere (Cindy 28 Jun — the render gave "See who was there" a full pill while "Suggest a plan" used the standard radius).** Every primary action uses the SAME canonical Button — **radius ~12px, NEVER a full pill** (full-round is for tags/avatars only). "See who was there", "Suggest a plan →", "RSVP", "View details" (secondary) all share one footprint/radius. No per-banner button restyle.
- MUTUAL MOMENT banner: headline "You clicked with [Name]. ✨" (the one ✨ peak) + subline "Skip the small talk - pick something, meet there." + primary "Suggest a plan →" (same Button as above). 🔴 The ✨ is the **Deep-Purple brand glyph** (identical to the nav sparkle) — NOT the raw orange/multicolour emoji (Cindy 28 Jun; the orange emoji collides with the Amber status colour).
- FINISH SETTING UP: the slim strip (progress bar + next step), never the full expanded box on mobile.
- TITLES clamp (event 2 lines, booking row 1 line) and the booking row's date·venue line truncates with … rather than wrapping to 3 lines.
- Section spacing tighter on mobile (24–32) than desktop (48–64) per GLOBAL density; ≥44px targets; generous thumb spacing. Test at 375 (Baymard: 63% of mobile users abandon over preventable mobile issues).

=== MODE A — FIRST-TIME (5 sections; progressive disclosure, uncluttered) ===
A calm first run that guides to a first booking AND nudges profile completion.
1. WELCOME — a warm, brief greeting (Poppins), one orienting line: "Here's what's good near you this week, [Name]." Calm and personal; NOT a giant hero. **Use the compact app scale (per GLOBAL density): greeting = h2 (24/32), NOT display/h1 — the live render was oversized.** (Greeting name in Ink or Deep Purple — never coral.)
2. FINISH SETTING UP — the profile-completion card (full spec in the **FINISH SETTING UP** section below). The new-user activation core: a completeness card that makes people *want* to add the data that sharpens their suggestions. It is a **status display, NOT a to-do list users can tick** — rows fill only when the action is actually done. **COMPACT by default** (progress bar + "X of 5" + the next step only, expandable via "see all →") — NOT a full always-expanded 5-row box (the live render was too big).
3. SUGGESTED FOR YOU — the hero content: 3 event cards, this week, near them, matched. **Only AVAILABLE, in-cluster events** — never suggest sold-out/full events, never out-of-cluster (no Mosman/Melbourne) to a new user. Scroll-row on mobile, 3-up grid on desktop.
4. CLICK RADAR — a **COMPACT social-proof BAR, NOT event cards** (full spec in the **CLICK RADAR** section below): 1–3 light rows, each an anonymous aggregate social-proof line tied to an event ("3 people going also like hiking → [event]") that taps through to the event. New-user calm single bar ("As you go to events, your radar sharpens."). Light on cream — never a card grid, never a dark block. (NOT a "people you keep crossing paths with" card — never names/shows attendees; per 09.)
5. CATEGORIES — a way in if the 3 suggestions don't land: small neutral interest tags (per Click_Design_Prompt_Buttons_Tags.md) — Pottery, Run clubs, Wine, Cooking, Live music, Markets. Tap → Discovery.
No big "0" stat counters, no "Quick Actions" row that duplicates the nav. Restraint is the point.

=== MODE B — RETURNING (full, CONDITIONAL — only render sections with content; ordered by time-sensitivity) ===
1. POST-EVENT PROMPT (only if a recently attended event is inside its 48h window) — a distinct, gentle banner at top: "Did you click with anyone?" with the event name + a calm CTA. Time-sensitive, so it leads when present. 🔴 **The eyebrow/label is warm + event-anchored, NOT date-coded** — e.g. "last night · Pasta from scratch" or "your night at Pasta from scratch". **BAN "the morning after"** (the live render used it — it reads like a hookup; off-brand, intent-neutral, never a date). Two yes-branches ("See who was there" primary + "Maybe later" quiet). Opportunity-framed, never nagging. **Mobile: stack the two actions full-width (primary above "Maybe later"), never crammed side-by-side — the live render wrapped them.** Desktop: side by side, auto-width.
1b. MUTUAL MOMENT (only if you have a fresh, un-acted mutual) — 🔴 the single WARMEST thing on the dashboard, near the top (after the post-event prompt, before Upcoming): a gentle Sage/Lavender-wash card **"✨ you clicked with [Name] — suggest a plan →"** — tapping shows the mutual reveal ONCE (if not yet seen), then the coordination drawer at its current step (never re-fires the reveal; per ClickMechanic §B). ONE at a time (the freshest); if there are more, a quiet "+ N more in your clicks →". This is how a mutual that happened while you were AWAY gets seen on return (it's also notified — bell + push — per the mechanic). Opportunity-framed, warm, never urgent. It clears once you've proposed (then it lives in Your clicks → Live mutuals). The one ✨ here is earned (a peak).
2. UPCOMING — your booked events (with "You're going" Sage state), soonest first. What's next.
3. CLICK WITH SOMEONE (rendered section eyebrow lowercase: **"click with someone"** — the feeling/verb, not the platform). 🔴 **Subline — replace the awkward "One person you crossed paths with. Quiet, low-stakes, never a profile to judge." (Cindy 27 Jun)** with a warm, simple line, e.g. **"Someone you might just click with — quietly picked, no pressure."** (the anonymous reassurance is its own line below — don't repeat it here; don't enumerate "no profile to judge", it reads defensive). 🔴 **The live render broke TWO rules here — fix both: (a) it showed THREE cards — the dashboard shows EXACTLY ONE; (b) every card had an empty "You were both at" with nothing after it AND no shared tags — that bare label must NEVER render.** Surfaces **EXACTLY ONE person at a time** (never 2–3 here — the wall lives on the Click page), rotated through the day from the curated pool of 3 (a drip, not a wall — feels intentional, cuts fatigue). The card MUST show real overlap: either a genuine "You were both at [event]" OR "Both into [shared interests]" + **≤3 shared neutral interest tags** (per PeopleCard + Buttons_Tags — white fill, Mist hairline, no dot, one line) — if there's neither a shared event nor a shared interest, OMIT the context line entirely (never an empty "You were both at"). **This section MUST include a clear "See everyone →" link** to the **click with someone page** (which shows all 3 + radar + profile view) — the dashboard is the teaser, the page is the destination. Anonymous-until-mutual, intent-neutral; placed AFTER your activity (brand rule). Render the one person with the **canonical People Card component** (full spec: `Click_Design_Prompt_PeopleCard.md` — do NOT re-describe it; use the SAME horizontal row-card): avatar, **name only (NO age — age is on the profile drawer)**, sentence-case intent label, **conditional shared-context** (never fabricated, never a bare "You were both at"), ≤3 shared tags, "click with [Name]" + "View profile". On click → the SAME button switches to its muted pending state **"clicked"** (lowercase, UNNAMED, NO ✨, same footprint — never "You clicked with [Name]", never a smaller pill); the anonymous reassurance shows once at the section top, not on the card. One rotated instance of the exact card used on the Click page.
4. CLICK RADAR — the **compact social-proof BAR (not event cards)** — see the **CLICK RADAR** section below.
5. SUGGESTED FOR YOU — fresh events this week, matched.
6. SAVED / WAITLIST — things saved or waitlisted (Saved = purple icon; Waitlist = amber badge).
7. ACTIVITY FEED ("Lately") — 🔴 **CUT it from the dashboard by default** (Cindy's question, 27 Jun). It's a BACKWARD-looking log ("you saved X", "you went to Y") with low action value; the dashboard should be FORWARD-looking (the mutual moment, what's next, who to click) — that's what creates pull. A history log dilutes the dopamine focus and adds clutter. If a momentum signal is wanted, keep ONLY a genuine MILESTONE (e.g. "you've been to 3 events this month") as a tiny line at the very bottom — never a "you saved X" feed. Full activity history lives on the profile/activity page, not here.
8. BROWSE BY CATEGORY — 🔴 use the **SAME canonical category treatment as the DISCOVERY page** (Cindy 27 Jun — they're currently inconsistent: dashboard pills vs Discovery's purple icon-circles). ONE category component everywhere: a **Deep-Purple line glyph on a soft Lavender-tint circle + label** (the only category treatment, never rainbow), as a row of category entries — matching Discovery's filter row exactly (same icons, same labels, same style). These are navigational CATEGORY entries (icon + label), NOT the neutral interest-tag pill. Tapping → Discovery filtered to that category. (Yes, show the icons — icon + label is warmer + more scannable; just make the dashboard and Discovery identical.)
0. FINISH SETTING UP — 🔴 the **SAME compact profile-completion component as Mode A** (consistent across modes — NOT a different "thin bar" in B and a "card" in A; one component, identical treatment + the quiz featured). Shown near the top (below the greeting, below the post-event prompt + mutual moment if present), if <100%. Disappears at 100%.
Conditional rules: skip any empty section (don't render a hollow box). For a core section that's empty, use a warm action-prompting empty state ("Nothing saved yet — your next event is where it happens.").

=== FINISH SETTING UP — PROFILE-COMPLETION CARD (get this right — it's the activation core) ===
The pattern: a profile-completeness card (the LinkedIn "profile strength" / dating-app "complete your profile" idea, done premium). It exists to motivate users to add the data that makes their event + people suggestions better — so the VALUE must be obvious and the moment must feel rewarding, never chore-like.

🔴 CRITICAL INTERACTION RULE — it is NOT a user-checkable to-do list:
- The left indicator is a STATUS, not a checkbox. It is NOT tappable and must NOT look tappable — a soft outline ring when incomplete, a filled check when complete. Never a checkbox a user can toggle.
- Completion is SYSTEM-VERIFIED by the action: a row ticks ONLY when the user actually does it (uploads a photo, saves a bio, finishes the quiz). Users can never mark an item done themselves.
- The action is the ROW'S CTA on the right ("Add" / "Write" / "Start →"). Tapping it opens that task's flow; on genuine completion the row auto-ticks (soft animation) and the bar advances.

🔴 COMPACT / PROGRESSIVE DISCLOSURE (the live render's box was TOO BIG — this is the fix):
- By DEFAULT the card is SLIM: header + the pre-filled progress bar + "X of 5" + ONLY the **single NEXT incomplete step** (its title + one-line value + CTA), then 🔴 a **VISIBLE "see all · X left →" / chevron** to expand the remaining steps inline. The live render showed only the next step with NO way to see the other steps — that's the bug Cindy flagged ("doesn't show the other things I need to complete"). People must be able to SEE what's left in one tap. Do NOT render all 5 rows expanded by default (that was the earlier "too big"); the answer is compact + an obvious expand.
- Rows are **compact (~44–48px, NOT 56–64)**; tight padding; hairline dividers or whitespace, never heavy boxes. On mobile it's a slim one-line-plus-bar strip.
- At 100% the card shows the one celebration then **collapses/dismisses**.
- 🔴 **IDENTICAL IN MODE A AND MODE B** (Cindy 27 Jun — it was inconsistent: a card in A, a thin bar in B). ONE component, same compact treatment, same featured step, both modes.
- 🔴 **FEATURE THE CLICK QUIZ — it's the most important data point** (it powers who you meet + every suggestion via the matching/life-tags engine). So the quiz is the PRIORITY step: surface it FIRST when incomplete with a subtle Lavender-tint highlight + a quiet lowercase **"most useful"** chip on its row (Cindy 28 Jun — 🔴 NOT an all-caps "BIGGEST BOOST" badge [game-y], and 🔴 NEVER a ✨/double-✨ [the sparkle is reserved for the three peaks; a setup row is not a peak]). Keep it clearly visible in the expanded list; don't let "add a photo" outrank it. Same in both modes.
- Research: progressive disclosure — surface the most actionable thing, let users drill in; a giant always-expanded checklist fights the "calm, glanceable" goal.

STRUCTURE & HIERARCHY:
- Header: "Finish setting up" (Poppins SemiBold ~18, compact) + completeness count top-right ("2 of 5", system font, Slate).
- Progress bar under the header: full-width, ~6–8px, rounded, Deep-Purple fill on a Mist track, PRE-FILLED to current progress (endowed-progress — never starts at 0).
- One value line (only when expanded, or omit on mobile to save space): "A fuller profile means better suggestions — for events and people."
- EXPANDED rows (compact rhythm ~44–48px; hairline dividers or whitespace, not heavy boxes). Each row = [status indicator] · [title (Poppins ~15) + one-line value (system ~13, Slate)] · [action CTA, right]:
  • Add a photo — "so people recognise you on the night"
  • Write a one-line bio — "a line gives people a reason to say hi"
  • Pick 3+ interests — "so we suggest the right events"
  • Take the Click quiz — "2 min · it's what sharpens who you meet" + a quiet lowercase **"most useful"** chip (🔴 the FEATURED / priority step; subtly highlighted, surfaced first when incomplete, both modes; NO ★/✨, NO all-caps badge)
  • Set your suburb — (usually already done from onboarding)

DONE STATE — NO strikethrough (strikethrough reads as 'cancelled/deleted', not 'achieved'):
- Completed row: filled Deep-Purple (or Sage) check; title stays LEGIBLE, slightly muted; optional quiet "Done". Never struck-through.

THE PULL (restrained gamification — make them WANT to finish, premium not game-y):
- The progress bar + "X of 5" is the core motivator (visible progress = the reward).
- Every item shows its concrete VALUE (above) — the "why" is what actually drives completion (LinkedIn-style).
- micro-animation: completing a row → the ring fills to a check with a soft ✨ tick (~250ms); the bar advances smoothly. At 100% → ONE warm celebration ("You're all set ✨ — your suggestions just got sharper"), then the card gracefully collapses/dismisses.
- NO points / streaks / leaderboards / guilt nudges (the brand is chilled). Progress + value + one celebration only.

CRAFT: 8pt spacing; Poppins titles + system body; refined line icons (no emoji except the locked ✨ at the celebration); Deep Purple for the check + bar (status colours never used here); a calm cream card on cream with a soft hairline — not a heavy box. Reads instantly as a funded product, and makes the next step feel obvious and inviting.

=== CLICK RADAR — a COMPACT social-proof BAR (NOT event cards; Cindy 27 Jun) ===
WHAT IT IS: a small, LIGHT section — one or a few compact **BARS** (rows), each a single ANONYMOUS aggregate social-proof line tied to an event, that taps through to that event. The hook is the SIGNAL, not a full card. 🔴 **Do NOT render event cards here** (dashboard AND the "click with someone" page) — and it is NOT a "you keep crossing paths with people" card either (09 §9: never names/tracks individuals).
- SECTION: eyebrow "On your radar" + a quiet one-liner ("People like you are showing up to these.").
- Each BAR = ONE row: a small **plain line-icon** (a radar/signal or people glyph) + the social-proof line + the event name + a chevron / tap-to-event. 🔴 **NOT a ✨** (Cindy 28 Jun — the render put a sparkle on the radar bar; ✨ is reserved for the three peaks, never decoration on a social-proof row). Examples:
   • "3 people going also like hiking → Sunrise run + coffee"
   • "2 people going are also over 50 → Over-50s trivia night"
   • "A few you might click with are going → Greenhouse terrarium"
   • "Trending in Sydney → Native cocktails, four pours"
- 🔴 On the DASHBOARD show **EXACTLY ONE bar** (Cindy 27 Jun) — a single radar signal, **refreshed/rotated ~every 30 minutes** (per `09`; never show a timer) — + a quiet **"see all on your radar →"** link to the click-with-someone page, which shows the few (1–3). The dashboard is a teaser, ONE signal; the wall lives on the click page. Light on cream — a hairline-separated row or a quiet Lavender-tint bar, NOT a card, NOT a dark block. One line.
- Its only JOB is to **send people to the event** — tapping a bar opens that event's (locked) detail page to RSVP.
- 🔴 PRIVACY RAILS (09 §9): the line is the highest-priority AGGREGATE signal (people-overlap / shared-interest / life-stage / trending), **≥3 total confirmed attendees** before any line shows; COUNTS only — NEVER names, photos, or who; sensitive life tags excluded even in aggregate; open-to-dating line (≥3, dating-viewers only) is aggregate. Venue stays locked until RSVP.
- COLD START (new user) — a single calm bar: "As you go to events, your radar sharpens." (Don't imply personalisation that isn't there yet — 09 §12.)
- ⚠️ This is a PRESENTATION change from 09's "strip of 5 event cards" → a compact bar. Content/privacy rails unchanged. **Flag to Doan** to reconcile 09 §9 presentation. Same compact bar on the dashboard AND the "click with someone" page.
- DELIVERABLE: mock the radar as 1–3 compact bars (each a different social-proof line → event), at 375 + 1024, plus the cold-start single bar. Anonymous, aggregate, light, NOT cards.

=== FIX THESE (from the live-build review — Doan's screens) ===
- Coral is a STATUS colour ONLY (almost-full/urgent). Do NOT use coral for the greeting name, primary CTAs, progress bars, or big fills. Primary action = Deep Purple.
- DROP the big "Upcoming RSVPs 0 / Saved 0" stat blocks — large zeros read as empty/demotivating. The checklist + suggested events drive action instead.
- RADAR is light on cream, never a dark card.
- Never foreground romantic intent (no "1 open to dating" badge on cards/radar). Intent stays quiet + neutral.
- Suggested events must be AVAILABLE and in-cluster; never show sold-out/full or out-of-cluster events as "suggested".
- CTA = "RSVP" (price on the card); never "RSVP to unlock".
- **NO calendar on the dashboard.** The calendar overview lives only on the My Events page. The dashboard is a feed; keep the glanceable zone clear.
- **FOOTER = the GLOBAL minimal footer** (cream, one hairline, ~2 lean rows, **NO tagline**, social as monochrome icons). The live render still shows the old "Real-life events across Sydney." tagline — that's stale; drop it per the GLOBAL FOOTER spec.
- **TAGS — one neutral style everywhere** (white fill, Mist hairline, Ink text, NO dot, NO tint, ONE line + "+N" overflow, per Buttons_Tags): event-card interest tags, the people-card shared-interest tags, and the "Browse by category" pills all use it. The only time a tag goes purple is selected (onboarding/filters). The people-card shared tags must actually render (the live render dropped them and left an empty "You were both at").
- 🔴 **EVENT CARDS ARE ONE SIZE EVERYWHERE** (Cindy 27 Jun): the **Suggested for you · Saved & waitlist · Upcoming** strips ALL use the SAME Event Card component at the SAME dimensions (per GLOBAL consistency + EventCard responsive sizing). The live render sized the Saved/Waitlist cards differently from Suggested — fix: identical card, identical width/height, footers aligned, across every strip.
- 🔴 **TOP-OF-DASHBOARD BANNERS — ONE consistent system (Cindy 27 Jun: "the notifications look jumbled and inconsistent").** The post-event prompt + the mutual moment are both time-sensitive ACTIONABLE moments → use ONE consistent **moment-banner component**: same Lavender-wash, same radius/padding, same structure (leading icon/avatar · eyebrow · title · one subline · ONE action right). The **finish-setting-up is NOT another alert** — give it a visually DISTINCT, quieter treatment (a white progress card / slim bar, not a third lavender box) so it reads as "your setup," not a third notification. Don't stack a wall of look-alike boxes (research: if everything's a banner, nothing is). Order: post-event → mutual → (distinct) finish-setting-up. Cap the loud moment-banners to the genuine ones present.
- **DOPAMINE / ENGAGEMENT — ethical only (Cindy: "make it addictive").** The pull comes from the GOOD levers: the variable-but-FINITE reward (the mutual surprise, the one fresh daily person, the radar — never an infinite feed), endowed progress (the pre-filled completion bar), the ✨ peak moments, the curiosity gap (anonymous-until-mutual), and warm social proof. The mutual moment is the dopamine spike — surface it warmly + instantly. Natural stopping points (a finite daily set = "you're done for today"). 🔴 BANNED (dark patterns): infinite scroll, depleting counters ("2 clicks left"), streak-as-pressure, points/leaderboards, FOMO floods, guilt nudges, fake scarcity. Addictive via anticipation + warmth, NEVER manipulation.
- **CLICK RADAR** = a compact social-proof BAR (above) — 1–3 light rows that link to events — NOT event cards and NOT a "you keep crossing paths with people" card.
- **COMPACT DENSITY (per GLOBAL):** greeting = h2 (24/32) not display; section headers h3 (20/28); the post-event prompt and finish-setting-up are compact, not large blocks. Trim whitespace where the render runs airy, but keep section grouping by whitespace.

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
[ ] CLICK RADAR is a compact social-proof BAR (1–3 light rows, each an anonymous aggregate line → event; ≥3 floor; never names/photos) — NOT event cards, NOT a "crossing paths with people" card
[ ] Finish-setting-up is COMPACT (progress bar + next step, expandable; rows 44–48) — not a full always-expanded box; click-with-someone = ONE rotated card + "See everyone →" (never 3); no empty "You were both at"; people-card shared tags render
[ ] Mobile: bottom-bar nav (no wrapping pill row in header); one full-width people card; event scroll-rows with peek; post-event buttons stacked; footer = GLOBAL minimal (no tagline)
[ ] ONE filled-purple primary CTA per viewport — section links / checklist CTAs / "click with" calibrated so two primaries never collide as the user scrolls; less-urgent actions demoted to ghost/text
[ ] Nav unmistakable: lowercase `click` wordmark (brand/home) ≠ Home (house icon) ≠ **✨ click** (people page, lowercase, the only spark in the bar); people page never reads as "match"
[ ] Sections grouped by whitespace (inner ≤ outer), NOT nested cards; 8pt throughout
[ ] Activity leads; people surfaces come after and are anonymous-until-mutual, intent-neutral; no chat
[ ] Post-event prompt uses "Did you click with anyone?", leads when present, never naggy
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
- **Order = time-sensitivity + dopamine first:** post-event prompt (48h window) → **mutual moment** ("✨ you clicked with [Name]") → upcoming → finish-setting-up (slim) → people (1 rotated) → radar (1 bar) → suggested → saved & waitlist → browse-by-category. **"Lately"/activity is cut** (forward-looking dashboard). Activity (events) leads people surfaces, per brand.
- Saved to `UIUX/cowork/` per your new convention. Want me to run this through claude_design once the Brand Package imports (so it inherits Poppins + the wordmark), or are you pasting it in?
