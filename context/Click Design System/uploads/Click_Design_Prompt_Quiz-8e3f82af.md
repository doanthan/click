<!-- Click persona quiz (full-screen modal) + dashboard/Settings entry. 28 Jun 2026. Responsive WEBSITE. Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Runs under the GLOBAL block in Click_Design_Prompt_FullBuildOut.md. This is the "Click persona quiz" deferred from onboarding to the dashboard checklist (HowItWorks_Onboarding line 60). It does NOT collect anything onboarding already owns - no name/age/gender/location, NO intent, NO dating preferences, NO interests (those live in onboarding Step 2/3 + Settings). Hyphens, not em-dashes. Spark only at the three peaks + the sanctioned completion celebration. -->

# Click - The Click persona quiz (full-screen modal) + entry points

Paste this whole block into claude design, UNDER the GLOBAL block. **Two passes, in order:**

**PASS 1 - update your own design system / README first** with the rules below, so every render inherits them. Do not render a screen until the system is updated.

**PASS 2 - then render ALL of these through the updated system, at 375 / 768 / 1024 / 1440:**
1. The persona quiz - full-screen modal: intro, 5 steps, finish screen.
2. The dashboard entry card ("Sharpen your suggestions") on the "finish setting up" checklist.
3. The Settings row ("The Click quiz - edit your answers").

Check the entire site and apply consistently - this is a site-wide change.

---

## WHAT THIS IS (and what it must NOT duplicate)

This is the **Click persona quiz** - the deeper personalisation layer that onboarding deliberately defers to the dashboard checklist. It tunes suggestions only. It is NOT onboarding.

🔴 **Do NOT collect anything onboarding already owns** (single source of truth - duplicating it causes drift):
- NO name / age / DOB / gender (onboarding Step 1).
- NO connection intent and NO dating preferences (onboarding Step 2 owns the six intent cards + the gated "Open to dating" sub-block; the dating toggle is edited in Settings). The quiz stays intent-neutral and never asks who you want to meet.
- NO interests category grid (onboarding Step 3).
- NO postcode / location (onboarding Step 1).

The quiz ONLY adds: event-room preference, social style, current social mood, availability, travel range, and optional life-chapter. These map to `personality_profiles` (+ non-sensitive life tags), never to intent/dating fields.

---

## BRAND LOCK (obey - overrides default taste)

- **Colour (flat):** Cream `#F9F6F0`; Deep Purple `#3B2F81` primary/selected (FLAT, never gradient/glow); Lavender `#C8B8F8` washes; Ink `#1C1830` text (never pure black); Slate `#6B6580` meta; Mist `#E8E4F0` hairlines. Status colours on badges only. **Selected = always Deep Purple.**
- **Type:** Poppins SemiBold 600 wordmark/headings/eyebrows/primary-button labels; system stack for body/meta. Body >=16px, ~1.5 line-height. Never body in Poppins.
- **Icons:** Lucide line glyphs; section icon = Deep-Purple Lucide glyph on a Lavender-tint circle. No emoji-as-icons.
- **Spark glyph rule:** the four-point spark renders as ONE Deep-Purple `#3B2F81` brand glyph, max one per element, NEVER decoration. On this flow it appears in exactly ONE place: the finish-screen celebration ("You're all set ✨", trailing only) - matching the onboarding done screen. NOT on the intro, NOT on step icons, NOT on the "what you're after" step.
- **Words:** hyphens not em-dashes; lowercase the feeling/verb ("click with someone"); only "Click" the platform name is capitalised; "click with" never "click on"; "match" banned; no chat/DM.
- **Radii:** ~16-20px modal/cards, ~12px option pills/buttons, full-round avatars/toggles, ~8px badges.
- **Platform:** responsive WEBSITE, mobile-optimised. NO native-app chrome. Light mode only.
- **No AI-slop:** no gradients/glows/mesh, glassmorphism/blur, cards-inside-cards, centered-everything, blob/3D/stock, lorem/placeholders. Real Sydney data only.

---

## ARCHITECTURE & BEHAVIOUR

- **Full-screen modal takeover** over the current page (site dimmed behind), NOT a separate route. Closing returns the user exactly where they were.
- Modal top bar: Click wordmark left; progress centre ("Step 2 of 5" + slim bar); X (close) right. Esc closes.
- **Progress bar starts ~15% pre-filled on Step 1** (never empty); fills fast early, slower later (endowed progress - same pattern as onboarding).
- **Auto-saves per step; resumable** (re-opens on the step they left). "Maybe later" / X close without losing progress.
- **Every question optional**; each step has a quiet "Skip" and a primary "Skip section" / "Next"; last step primary = "Finish".
- **Option pills:** one neutral pill - white fill, Mist hairline, Ink label, ~12px radius, >=44px target. Selected = Deep-Purple fill, white label, NO tick (`aria-pressed` for SR). Multi-select questions labelled "pick any" use the same pill.
- Honour `prefers-reduced-motion`. Everyday transitions 100-300ms, calm. No confetti/bounce. The finish celebration gets ONE gentle ~400-600ms spark moment only.

---

## ENTRY POINTS (render both)

**Dashboard - "finish setting up" checklist card "Sharpen your suggestions":** calm (not a nag), short line + a **pre-filled progress bar** ("Your suggestions are 40% tuned"), primary "Pick up where you left off" (or "Start" for new). Collapses to a quiet Settings link once complete. Uses the one Button + one Card system.

**Settings row - "The Click quiz":** single list row, label "The Click quiz", sub "Edit your answers", chevron. Opens the same modal.

---

## SCREEN-BY-SCREEN COPY (verbatim - hyphens only)

### Intro
- Icon: plain Lucide glyph (compass/sliders) on a Lavender circle. NO spark.
- Eyebrow: `THE CLICK QUIZ`
- Title (Poppins): **Find your kind of night**
- Sub: "A handful of quick questions, so we surface fewer, better things - the events and rooms that feel like you. About two minutes. Skip anything, change it all later."
- Privacy line (lock glyph, Lavender-tint pill): "Private to you - these tune your suggestions and never show on your profile."
- Primary: **Start the quiz** · Quiet secondary: **Maybe later**

### Step 1 of 5 - Your kind of room
- Eyebrow `YOUR KIND OF ROOM`, Lucide glyph on Lavender circle. Title: **Set the scene**. Sub: "The rooms you enjoy most - pick whatever fits."
- "Size that suits you" *(pick any)*: Small and intimate · Medium · Big and buzzing
- "The vibe you're after" *(pick any)*: Hands-on and creative · Active and physical · Social and easygoing · Learning something new · Calm and restorative
- "You'd rather it be": With a plan · Loose and free-flowing · Don't mind either way

### Step 2 of 5 - How you connect
- Eyebrow `HOW YOU CONNECT`. Title: **Your social style**. Sub: "No right answers - just what's true for you."
- "You recharge by": Time on your own · A bit of both · Being around people
- "Walking into a room of strangers, you": Hang back and read the room · Dive in and say hi · Depends on the day
- "You tend to click with people who are" *(pick any)*: Thoughtful and deep · Fun and spontaneous · Driven and ambitious · Warm and caring
- "Your social pace": Slow and steady · Somewhere in between · Fast, I love variety

### Step 3 of 5 - What you're after lately  *(social MOOD only - NOT intent; intent lives in onboarding)*
- Eyebrow `WHAT YOU'RE AFTER LATELY`. Title: **Right about now**. Sub: "This can shift - update it whenever."
- "Socially, right now you're": Open and curious · Keen to widen your circle · In a good place, just here for fun
- "You feel most at ease when" *(pick any)*: There's an activity to focus on · It's a small group · No specific needs, I'm easy

### Step 4 of 5 - Your week & range
- Eyebrow `YOUR WEEK & RANGE`. Title: **Timing and distance**. Sub: "So we lean toward what actually fits your life."
- "When you're usually free" *(pick any)*: Weekday mornings · Weekday evenings · Saturdays · Sundays · Varies week to week
- "How far you'll travel for a good one": Keep it in my suburb · Up to ~20 minutes · Across the city for the right thing · Distance doesn't faze me

### Step 5 of 5 - A little about you  *(optional + sensitive, deliberately LAST; stored as non-sensitive life tags, never shown on a person)*
- Eyebrow `A LITTLE ABOUT YOU`. Title: **Anything you'd like us to know?**. Sub: "All optional - it just helps us connect you with people in a similar chapter."
- "Any of these fit right now?" *(pick any)*: New to Sydney · New parent · Student · Recently retired · None of these
- "A pet in your life?": Yes · No
- "Do you identify as LGBTQ+?" *(optional)*: Yes · No · Prefer not to say
  - Soft line (lock glyph): "Optional and private to you - it helps us keep events welcoming."
  - *(NO line about signalling others / community - no machine reveal. This is a SENSITIVE life tag: never shown on a person, ever; see 08.)*

### Finish
- Icon: warm Lucide glyph on a Lavender circle.
- Title: **You're all set ✨**  *(ONE trailing Deep-Purple spark - the sanctioned completion celebration, matching the onboarding done screen)*
- Sub: "Thanks - that helps a lot. We'll start leaning toward your kind of thing."
- Then a small **tuned strip - "What's on near you this week"** using the canonical Event Card (same card used site-wide), 2-3 real events:
  - "Wheel throwing - make two mugs" · Posy Ceramics, Newtown · Thu 6:30pm · Almost full
  - "Sunrise run + coffee, 5k" · Marrickville · Sat 6:15am · Free
  - "Native cocktails, four pours" · Surry Hills · Fri 7:00pm · 11 going
- Primary: **See what's on** · Footnote (Slate): "Change your answers anytime in Settings."

---

## STATES
- Loading: calm skeletons matching the pill/card shapes, not spinners.
- Resumed: lands on the saved step with prior selections shown.
- "None of these" is valid on optional questions.
- Finish with low data: tuned strip falls back to "Popular near you this week" using the same Event Card.
- Accessibility: focus ring = Deep Purple + cream offset, `:focus-visible`; selected pills `aria-pressed`; targets >=44px; progress announced to SR.

## DELIBERATELY EXCLUDED (do not add)
- Intent / dating preferences (onboarding Step 2 + Settings own these - never duplicate here).
- Age / gender / location / interests (onboarding owns these).
- The old disguised-age question ("in my 20s figuring it out / in my 30s building").
- Fragile-state tags ("recently single", "navigating a big change").
- The living-situation question.
- Any LGBTQ+ "we signal others" explainer.
- Spark glyphs anywhere except the finish celebration; all em-dashes.
