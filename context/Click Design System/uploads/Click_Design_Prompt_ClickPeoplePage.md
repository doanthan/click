<!-- Last updated: 2026-07-01 | Revision: v1 (NEW - dedicated render prompt for the "click with someone" PEOPLE PAGE: the daily people pool + click radar + Your clicks. This is a CONVENIENCE PASTE-PROMPT derived from canon, NOT a new source of truth: it stays in sync with `Click_Design_Prompt_ClickMechanic.md` §E [the page] + `Click_Design_Prompt_PeopleCard.md` [the card] + `CLICK_LANGUAGE.md` §5 [the strings]. On ANY conflict, those win and THIS file is corrected. If canon changes, regenerate this prompt. Echo resolved option A [eyebrow only, no discovery sub-line] - see the flag below.) -->

# Click - "click with someone" people page (claude-design paste prompt)

**Source of truth:** `Click_Design_Prompt_ClickMechanic.md` §E (the page) + `Click_Design_Prompt_PeopleCard.md` (the card) + `CLICK_LANGUAGE.md` §5 (locked strings) + `CLICK_PALETTE.md` / `CLICK_TYPE.md` (tokens). This file is a paste-convenience wrapper; those win on any conflict.

**How to use:** paste the GLOBAL block from `Click_Design_Prompt_FullBuildOut.md` first, then the block below, into claude-design. Then screenshot the render back into chat for critique.

🔴 **Echo decision baked in (option A, recommended):** the eyebrow "3 people you might click with today" now carries the "what this is" job, so the discovery sub-line is DROPPED. If you prefer option B (keep the sub-line "A few people we think you'll click with." and revert the eyebrow to "3 people for you today"), change the two eyebrow/sub-line lines below.

---

```
ROLE: Principal product designer (craft bar: Linear / Luma / Airbnb / Hinge). Render the "CLICK WITH SOMEONE" people page for Click - a responsive WEBSITE (375 -> 1440), NOT a native app (no status bars, safe-area insets, native tab bars, push-permission dialogs; any phone frame is presentation only). Calm, warm, premium restraint, delightful in the small moments. Content LEFT-ALIGNED in one ~1100-1200px container at the shared page gutter - NEVER a centred phone-width column floating on a desktop screen (that is the app-native tell - kill it).

BRAND LOCK: Cream #F9F6F0 canvas · Deep Purple #3B2F81 (primary/selected, flat) · Lavender #C8B8F8 (small accents only) · --lavender-wash #F0ECF4 (large fills / your-move cards) · Ink #1C1830 · Slate #6B6580 · Mist #E8E4F0 · error #B5362F. Poppins (600) headings/labels; system body >=16/1.5. ONE Button system: radius 12, NEVER a full pill; primary = flat Deep Purple, secondary = white + Mist border, ghost = text + lavender wash. The ✨ spark = a single Deep-Purple #3B2F81 glyph reserved for the 3 peak moments - there are NONE on this page. Hyphens, never em-dashes.

NON-NEGOTIABLES (CLICK_LANGUAGE + the locked mechanic):
- Anonymous until mutual - a one-way click is NEVER revealed to the other person (no "likes you" queue). One neutral helper line: "🔒 Clicking is anonymous - we'll only show you if it's mutual."
- Intent-neutral - it must NOT read as a dating app. Activity-first; no hearts, no match/like/swipe, no coupley framing. Of any 3-person set, at most ONE is "Open to dating". "click with" never "match".
- Never expose internal rules - no refresh timers, no "X clicks left", no ranking, no caps. Show outcomes + one warm line; "How clicking works ->" for anything more.
- Web-only: optimistic UI (a click flips the card to a pending state instantly, no page load); profile view + any coordination are modals/drawers, never new pages.

PAGE STRUCTURE (top to bottom, one left-aligned column):

1. HEADER
   - H1, lowercase: "click with someone".
   - A light secondary link beneath it: "How clicking works ->".

2. PEOPLE TO CLICK WITH (the served daily pool - the hero of this page)
   - Eyebrow (Poppins, warm, Ink): "3 people you might click with today".
   - NO sub-line under the eyebrow (the eyebrow says what this is; do NOT add "A few people we think you'll click with" or any "refreshed daily" / freshness line - it echoes the eyebrow and over-explains the mechanic).
   - The anonymity helper line ONCE here, at the top of the section, never repeated under each card: "🔒 Clicking is anonymous - we'll only show you if it's mutual."
   - Exactly 3 People Cards, ONE per line (row on desktop, stack on mobile), equal height, footers/actions aligned. Each card:
       · Avatar ~52 (photo or soft placeholder). NO age, NO bio text on the card.
       · Name only (card-title ~17-18 Poppins).
       · Intent line - grouped tight with the name, Slate, sentence case, sentence-length. NEVER green, never a separate bulleted line. Solo wording: "Here for friends" / "Here for the activities" / "Growing my circle" / "New in town". Show "Open to dating" ONLY if both the viewer and this person are dating-intent.
       · ONE conditional commonality line - a NON-interest signal so it never repeats the tags. First available only: shared event "You were both at [event]" -> shared music "Both into [genre] & [genre]" -> cluster proximity "you're both nearby". Omit the line entirely if none. Never restate the interest tags, never a named suburb, never the private quiz answers.
       · Up to 3 shared neutral interest tags (this is the ONLY place shared interests appear). Tags always neutral (never a coloured "shared" chip).
       · Actions: primary "click with [name]" (flat Deep Purple, radius 12) + a "View profile" ghost action. "View profile" opens a CENTERED profile modal (one shared profile block; focus-trapped; ✕/Esc/scrim dismiss, never navigates).
       · Pending state (after the viewer clicks) = the SAME button footprint in a quiet muted "clicked" treatment (only fill + label change; NO ✨; reads pending/unresolved, never confirmed).

3. CLICK RADAR (a compact social-proof BAR - NOT event cards)
   - Eyebrow "click radar" + a light line "People like you are showing up to these."
   - 1-3 light rows, each an anonymous AGGREGATE line tied to one event ("3 people going also like hiking -> [event]" / "Mostly people in their 30s going -> [event]"). Floor >=3. Never names or photos. Row icon = a plain radar/signal line-glyph, NEVER a ✨. Tapping a row goes to the locked event to RSVP.

4. YOUR CLICKS (the durable home of the loop - one consistent outcome-card across all three groups; 16px vertical gap set ONCE on the list container, identical in every group)
   - LIVE MUTUALS: section header + the locked sub-line "You both clicked. Now plan something you'd both enjoy." Cards: avatar 52 · name · intent/commonality line · ONE action on the RIGHT, vertically centred and aligned across cards. Your-move cards carry the soft --lavender-wash background fill; action "Suggest a plan ->" (or a muted "Waiting on [Name]" when you have already proposed - quiet, no strong CTA). 🔴 A Live mutual shows NO confirmed-looking event (there is no plan yet - that is what "Suggest a plan" is for). No name-adjacent state pill.
   - PLANS (you are both going): clean NEUTRAL white card; the confirmed upcoming event (calendar glyph OK here only - this is the one place a real plan exists); action "See the plan ->".
   - PAST CLICKS: names the plan you did together "You went to [Plan] together · [when]"; connected wins ("We clicked 👍") stay as cards; soft-released ones collapse into a quiet "+ N past clicks" line that expands on tap (neutral no-loss copy "Still out there - if you cross paths again, you can pick it back up"; never "expired" / "missed").

MICROCOPY DISCIPLINE: warm, brief, a little curious; protect the magic (never explain the internals). Everything sentence case except the platform name "Click" in prose.

RENDER at mobile 375 AND desktop 1440. Note each micro-animation (optimistic click flip; profile-modal open) - 100-300ms, gentle easing, prefers-reduced-motion safe.

THEN self-critique against the click-design rubric and list every miss. Check specifically for: a centred-narrow column on desktop; any ✨ on this page; any age or bio on a card; a green or separate-bulleted intent line; the anonymity line repeated per card; a Live-mutual card showing a fake/confirmed event; uneven card spacing between the three Your-clicks groups; any dating-app signifier (heart, "match", dating foregrounded); an eyebrow/sub-line echo.
```

---

## What to do (Cindy)

1. If you want option B instead (keep the sub-line, plainer eyebrow), change the two lines noted in section 2 of the prompt - otherwise leave as is.
2. In claude-design, paste the GLOBAL block (from `Click_Design_Prompt_FullBuildOut.md`) then the block above.
3. Screenshot the render back into the chat so the agent can critique it against the live pixels.
4. Tell the agent which page to audit next (Dashboard, Quiz, Settings, or Event Detail).

*One open structure question to settle when you look at the render: in the live build "Your clicks" reads as its own page while canon treats it as a section of this "click with someone" page. Decide whether Your clicks is a section here or its own destination, and the agent will reconcile canon to match.*
