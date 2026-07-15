<!-- Click - Quiz (modal) design prompt. Paste into claude design. Two-part: (1) update the project design system / README, then (2) re-render all affected surfaces through it. Hyphens, not em-dashes. Spark only at the three mechanic peaks - NEVER in the quiz. -->

# Click - The Click quiz (full-screen modal) + entry points

Paste this whole block into claude design. **Do it in two passes, in order:**

**PASS 1 - update your own design system / README first.** Apply the rules below to your internal design-system pages so every render inherits them. Do not render a screen until the system is updated.

**PASS 2 - then render ALL of these surfaces through the updated system, at every breakpoint (375 / 768 / 1024 / 1440):**
1. The Click quiz - full-screen modal: intro, 5 steps, the gated dating sub-block, and the finish screen.
2. The dashboard entry card ("Sharpen your suggestions").
3. The Settings row ("The Click quiz - edit your answers").

Check the entire site and apply consistently - this is a site-wide change, not a one-off screen.

---

## BRAND LOCK (obey - these override any default taste)

- **Colour (flat, never gradient/glow):** Cream canvas `#F9F6F0`; Deep Purple `#3B2F81` for primary/selected (FLAT - never a gradient or glow); Lavender `#C8B8F8` tint washes; Ink `#1C1830` text (never pure black); Slate `#6B6580` meta; Mist `#E8E4F0` hairlines. Error red `#B5362F` for genuine errors only. Status colours (Coral/Amber/Sage/Teal) on badges only. **Selected state is ALWAYS Deep Purple**, never a status colour.
- **Type:** Poppins SemiBold 600 for the wordmark, headings, eyebrows and primary-button labels; system font stack for body/meta. Big jump between heading and body. Body >=16px, ~1.5 line-height. Never set body in Poppins.
- **Icons:** refined Lucide line glyphs, consistent stroke. Category/section icons = a Deep-Purple Lucide glyph on a Lavender-tint circle. **No emoji-as-icons.**
- **The spark glyph is BANNED on every quiz surface.** The four-point spark is reserved exclusively for the three mechanic peaks (mutual reveal, both-going, connected) + the nav. The quiz intro, the "what you're after" step, and the finish screen must use plain Lucide glyphs, NOT the spark.
- **Words:** hyphens, not em-dashes, everywhere. Lowercase the feeling/verb ("click with someone"); only the platform name "Click" is capitalised. Use "click with" (never "click on"); "match" is banned. No chat/DM anywhere.
- **Radii:** ~16-20px cards/modals, ~12px inputs/buttons/option pills, full-round avatars/toggle pills, ~8px badges.
- **Platform:** responsive WEBSITE, mobile-optimised. NO native-app chrome (no status bar, safe-area, native tab bar, push dialogs). The phone frame is presentation only.
- **No AI-slop:** no gradients/glows/mesh, no glassmorphism/blur, no cards-inside-cards, no everything-centered symmetry, no blob/3D/stock illustrations, no lorem/placeholder data. Light mode only. Real Sydney data only.

---

## ARCHITECTURE & BEHAVIOUR

- **Full-screen modal takeover** layered over the current page (the site is dimmed behind), NOT a separate route. Closing returns the user exactly where they were.
- Top bar inside the modal: the Click wordmark left; a progress indicator centre ("Step 2 of 5" + a slim bar); an X (close) right. Esc also closes.
- **Progress bar starts ~15% pre-filled on Step 1** (never empty) and fills fast early, slower later. Endowed progress is the point - it must never read as starting from zero.
- **Auto-saves per step; resumable.** Re-opening lands on the step they left. "Maybe later" / X closes without losing progress.
- **Every question is optional.** Each step has a quiet "Skip" and a primary "Skip section" / "Next"; the primary advances. Last step's primary = "Finish".
- **Option pills:** one neutral pill style - white fill, Mist hairline, Ink label, ~12px radius, >=44px tap target. Selected = Deep-Purple fill, white label, NO tick (use aria-pressed for SR). Single-select and multi-select ("pick any") use the same pill; multi-select questions are labelled "pick any".
- Honour `prefers-reduced-motion`. Everyday transitions 100-300ms, calm. No confetti, no bounce.

---

## ENTRY POINTS (render both)

**Dashboard card - "Sharpen your suggestions":** a calm card (not a nag) with a short line and a **pre-filled progress bar** ("Your suggestions are 40% tuned"), primary action "Pick up where you left off" (or "Start" for new users). Desire-led, never guilt. Uses the one Button + one Card system. Disappears/collapses to a quiet Settings link once complete.

**Settings row - "The Click quiz":** a single list row, label "The Click quiz", sub "Edit your answers", chevron right. Opens the same modal.

---

## SCREEN-BY-SCREEN COPY (use verbatim - hyphens only, no em-dashes)

### Intro
- Icon: plain Lucide glyph (e.g. compass/sliders) on a Lavender circle. NO spark.
- Eyebrow: `THE CLICK QUIZ`
- Title (Poppins): **Find your kind of night**
- Sub: "A handful of quick questions, so we surface fewer, better things - the events and rooms that feel like you. About two minutes. Skip anything, change it all later."
- Privacy line (small, lock glyph, Lavender-tint pill): "Private to you - these tune your suggestions and never show on your profile."
- Primary button: **Start the quiz**
- Quiet secondary: **Maybe later**

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

### Step 3 of 5 - What you're after lately
- Eyebrow `WHAT YOU'RE AFTER LATELY`. Title: **Right about now**. Sub: "This can shift - update it whenever."
- "What brings you to Click?" *(pick any)*: Doing more of what I love · Meeting new people · Making local friends · Growing my circle · Networking · Open to dating
  - *(Order matters: "Open to dating" is ONE of six and listed LAST - never foregrounded. A friends-only user must feel this is equally for them.)*
- **GATED sub-block - render ONLY when "Open to dating" is selected** (slides in below, gentle):
  - Intro line: "Nice - a couple of quick ones, just for this."
  - "You'd like to meet": Men · Women · Everyone
  - "Age range": a range slider, defaulted to the user's cohort (e.g. 25-38)
  - Micro privacy line: "Only shapes who we suggest - never shown on your profile."
- "Socially, right now you're": Open and curious · Keen to widen your circle · In a good place, just here for fun

### Step 4 of 5 - Your week & range
- Eyebrow `YOUR WEEK & RANGE`. Title: **Timing and distance**. Sub: "So we lean toward what actually fits your life."
- "When you're usually free" *(pick any)*: Weekday mornings · Weekday evenings · Saturdays · Sundays · Varies week to week
- "How far you'll travel for a good one": Keep it in my suburb · Up to ~20 minutes · Across the city for the right thing · Distance doesn't faze me

### Step 5 of 5 - A little about you  *(optional + sensitive, deliberately LAST)*
- Eyebrow `A LITTLE ABOUT YOU`. Title: **Anything you'd like us to know?**. Sub: "All optional - it just helps us connect you with people in a similar chapter."
- "Any of these fit right now?" *(pick any)*: New to Sydney · New parent · Student · Recently retired · None of these
- "A pet in your life?": Yes · No
- "Do you identify as LGBTQ+?" *(optional)*: Yes · No · Prefer not to say
  - Soft line under it (lock glyph): "Optional and private to you - it helps us keep events welcoming."
  - *(Do NOT add any line about letting others know / community signals. No machine reveal.)*

### Finish
- Icon: a warm Lucide check on a Lavender circle. NO spark.
- Title: **You're all set**
- Sub: "Thanks - that helps a lot. We'll start leaning toward your kind of thing."
- Then a small **tuned strip - "What's on near you this week"** using the canonical Event Card (the SAME card used site-wide), 2-3 real events:
  - "Wheel throwing - make two mugs" · Posy Ceramics, Newtown · Thu 6:30pm · Almost full
  - "Sunrise run + coffee, 5k" · Marrickville · Sat 6:15am · Free
  - "Native cocktails, four pours" · Surry Hills · Fri 7:00pm · 11 going
- Primary button: **See what's on**
- Footnote (Slate): "Change your answers anytime in Settings."

---

## STATES TO COVER
- Loading: calm skeletons matching the option-pill and card shapes, not spinners.
- In-progress / resumed: lands on the saved step with prior selections shown.
- Empty/none: "None of these" is a valid selection on optional questions.
- The gated dating sub-block: collapsed by default, animates in only on selection, collapses again if deselected (selections preserved if re-selected within the session).
- Finish with no/low data: still warm; the tuned strip falls back to "Popular near you this week" using the same Event Card.
- Accessibility: focus ring = Deep Purple + cream offset, keyboard-only (`:focus-visible`); selected pills use `aria-pressed`; tap targets >=44px; progress announced to SR.

## DELIBERATELY REMOVED (do not reintroduce)
- The disguised age question ("in my 20s figuring it out / in my 30s building") - age is already known; the wording made assumptions.
- Fragile-state tags ("recently single", "navigating a big change").
- The living-situation question (alone / with a partner / housemates / family).
- The old LGBTQ+ explainer about quietly signalling others.
- All spark glyphs on quiz surfaces; all em-dashes.
