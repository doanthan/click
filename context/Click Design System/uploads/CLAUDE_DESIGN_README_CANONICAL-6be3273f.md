<!-- CORRECTED + CONSOLIDATED design-system README for the claude-design project. Updated 28 Jun 2026 (Your-clicks cards carry no state pill; acquisition CTA "Request an invite" + out-of-area never blocked; no-rejection-angle framing rule [§5b]; "in real life / IRL" encouraged phrase + @click.irl handle; one Button radius-12 never-a-pill; radar row icon never a ✨; ✨ = one Deep-Purple brand glyph, never the raw orange emoji; Your-clicks card = People-Card density, action right-aligned, tight padding; interest tag downsized to 24/12 site-wide, one line + "+N" never wrap). Paste this in to REPLACE the project's current README.md. It mirrors the canonical Click specs (CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE + UIUX/Cowork/*). On any conflict, those canonical specs win and THIS file is corrected to match — never the other way around. -->
# Click — Design System (canonical mirror)

> **click** *(verb)* — that effortless feeling when you just click with someone. The activity is the icebreaker; connection is the outcome.

This is the design system for **Click**, an invite-only events platform launching in inner Sydney. It mirrors Click's canonical specs and is what this project reads first — so it must stay in sync with them.

---

## 0. HOW THIS SYSTEM IS GOVERNED (read first — this stops stale, contradictory pages)

1. **This README is a MIRROR of canon, not an original interpretation.** On ANY conflict, the canonical specs win — `CLICK_PALETTE.md` (colour), `CLICK_TYPE.md` (type), `CLICK_LANGUAGE.md` (words), and the per-screen prompts in `UIUX/Cowork/`. When they disagree with this file, **this file is wrong and gets corrected** — never the reverse.
2. **Update this README whenever a rule, token, or component changes — in the same pass.** A stale README is the #1 cause of drifted renders. If a rule changes, change it here too, immediately.
3. **Every change applies to ALL pages, in the same pass.** Never fix one screen and leave the rest stale. Change the tag → change it everywhere tags appear. Change the card → re-render every surface that uses the card.
4. **One component, used IDENTICALLY site-wide.** Button, Tag, Badge, Avatar, **Event Card**, People Card, the top nav, and the footer are SINGLE components. Never restyle one per page. 🔴 **The EVENT CARD is the SAME CARD THROUGHOUT THE SITE** — discovery, dashboard "suggested"/"saved" strips, my-events, landing — identical layout, states, sizing, one-line tags, pinned footer. (Click Radar is the exception: it is NOT event cards but compact social-proof BARS — see §5.)

---

## 1. PLATFORM — responsive WEBSITE, not an app (yet)

Click is a **responsive website, mobile-optimised** (375 → 768 → 1024 → 1440). The native app is a LATER phase. **Strip all native-app chrome** — no device status bars, safe-area insets, native tab bars, splash screens, or push-permission dialogs. The phone frame in mockups is presentation only. Use web patterns: a responsive sticky header; an optional sticky bottom action bar on mobile is a web pattern, not a native tab bar.

*(This corrects the old framing of "a consumer app, mobile-first, ~420px frame." It's a website.)*

---

## 2. CONTENT FUNDAMENTALS (binding — `CLICK_LANGUAGE.md` overrides on conflict)

**Voice:** a friend who knows the city well, has good taste, doesn't oversell. Warm, specific, a little dry, confident without being loud. Speaks to "you"; "we" only lightly. Never therapeutic, never lectures.

**Desire, not deficit.** Name the appetite, never the lack. ✅ "Some of the best people you'll ever meet — you just haven't crossed paths yet." ❌ "It can be hard to meet people."

**"In real life / IRL" — encouraged brand phrase.** The thesis: real connection is built in person, over shared activities, more than once. Spell out **"in real life"** in primary/explanatory copy; **"IRL"** for social/short/playful. The handle is **@click.irl**. Don't overuse (one strong "in real life" per page).

**The capitalisation split (functional, not cosmetic):** **Click** (capital C) = the platform, in prose. **click** (lowercase) = the feeling/mechanic (= connect/hit-it-off) — this is the ENCOURAGED core verb. Only the literal button-tap sense is banned (use **tap**/**select**). The wordmark is lowercase `click`.

**Lowercase UI chrome (the mechanic chrome follows the feeling):** nav **"✨ click"**, page header **"click with someone"**, action button **"click with [name]"**, pending pill **"clicked"** (see below). Capital "Click" only as the platform name in prose/wordmark. Otherwise prose is sentence case.

**The one grammar rule:** always **"click *with* someone"**, never "click on someone."

**Banned — fail on sight:** `match`/"it's a match" (→ mutual click), `swipe`, `connect`/`connection` for the mechanic, `lonely`/`isolated`/`struggling`, "find your tribe"/"meet your people"/"meaningful connections", "buy a ticket"/"RSVP to unlock"/price-in-button (→ a single **"RSVP"** for ALL events, price on the card; "Join waitlist" when full → "Joined waitlist" once joined; "View details"/"You're going" when booked), "refer a friend" (→ "bring your people into Click"), **founding-merchant** anything (hosting is free during the Sydney pilot — no founding programme/badge/commission), and **"click" as a UI verb**.

**No "just."** Audit every "just" before an intent/persona — it demotes.

**Opportunity, never loss.** Lifecycle copy never says "expire/last chance/winding down/you missed your chance." Soft-release (locked): "Still out there — if you cross paths again, you can pick it back up."

**Acquisition CTA = "Request an invite"** (Landing + How It Works; invite-only brand — active/exclusive framing). Distinct from the per-event "Join waitlist" action. **Never block an out-of-area signup** — anyone in Sydney can request an invite; an out-of-area suburb/postcode still completes and confirms "we'll tell you the moment Click reaches you" (Landing + onboarding, same promise).

**No rejection angle (marketing/explanatory copy).** Don't plant the could-be-no ("tells you if it was mutual", "find out if they liked you back") AND don't over-correct by naming the safety ("no one gets turned down", "a one-way click is never shown", "nothing rated/ranked", "you're never on display") — both put rejection on the page and break magic-protection. Lead with **desire** (shared interest / proximity) and keep the click **curious** (tease it: "that's all we'll say - the rest is more fun to find out"); let safety be felt, not stated. Never label readers as shy/lonely/introverted/anxious. (The tiny in-product anonymity helper at the click moment is the one allowed exception.) Full rule: `CLICK_LANGUAGE.md` §5b.

**✨ usage (locked):** max ONE ✨ per element, never decoration. The **pending** click state carries NO ✨; the **mutual** state carries one. Concentrate ✨ at the three peaks (mutual / both-going / connected) and the nav "✨ click". **Treatment: ONE consistent brand glyph in Deep Purple `#3B2F81`** everywhere — 🔴 NEVER the raw multicolour/orange emoji (it collides with the Amber badges-only status colour and breaks the one-flourish consistency). The nav sparkle and the mutual-banner sparkle must be the identical purple glyph.

**Locked mechanic strings (don't improvise — placeholders ship):**
- Post-event headline: **"Did you click with anyone?"** *(corrects the old "Who'd you click with?")*
- Pending one-way click state: **"clicked"** — the SAME click button in a quiet/muted treatment (no ✨, same footprint as "click with [name]", NOT a smaller pill). Reads pending/unresolved.
- Mutual persistent card-state: **"clicked ✨"** (Sage). The big reveal headline is **"You clicked with [Name]."** (a separate moment).
- Mutual push: **"It's mutual — you clicked with [Name]. ✨"**
- Intent line on a mutual: equal → "You're both here for [intent]."; mixed → show both, never collapse.
- Anonymous reassurance: **"🔒 Clicking is anonymous — we'll only show you if it's mutual."** — shown ONCE at the top of a people section, NEVER under each card.
- Closure button: **"We clicked 👍"** → "Love that. That's what Click's for. ✨". Closure ACTION only — never a passive status pill.
- Your-clicks list cards (Live mutuals / Plans / Past clicks): **NO name-adjacent state pill.** Section header + a quiet state accent + the action carry the state; the card leads with the NAME. Banned card pills: "You two clicked", "You both clicked", "You're both going", "We clicked 🔥", "Released gently"; and no ✨ on a list card (✨ is for the three peaks only). Soft-released cards carry no marker. **LAYOUT = People-Card density, just a little different:** a horizontal row — avatar 56–64 left · content column (name `card-title` · "event · when" · intent line · ≤3 tags) · **the ONE action on the RIGHT, vertically centred and aligned across all cards** (not a bottom-left text link). Even, comfortable padding ~16–20px (inner ≤ outer, 8pt) — NOT oversized/airy; equal-height within a section. Differs from the People Card only in: one action (not click-with + view-profile) + a quiet state accent (Live mutuals Sage-tint, Plans Lavender-tint, Past neutral). Action uses the one Button/link system (radius 12, no pill). 🔴 **A Live mutual shows NO confirmed-looking event** (there's no plan yet — that's what "Suggest a plan →" is for); only the **Plans** card shows a real upcoming event; Past clicks show where you clicked, clearly past. 🔴 **The "tags" are what you have IN COMMON, framed like the People Card** ("Both into pottery & live music" / "both new to Newtown") — intent line + ≤2 shared interests / non-sensitive life tags, never one-sided pseudo-tags. **Nudge, never a verdict — never "it's a match".**

---

## 3. VISUAL FOUNDATIONS

**Palette (`tokens/colors.css` must match):** Deep Purple `#3B2F81` = brand spine + the ONLY primary-action / selected colour (flat, never a gradient or glow). Cream `#F9F6F0` = page ground (never stark white). Lavender `#C8B8F8` = soft lift (washes, accent circles). Ink `#1C1830` = text (never pure black). Slate `#6B6580` = meta. Mist `#E8E4F0` = hairlines/dividers/disabled. **Status colours live on BADGES ONLY** — Coral `#E8674C` (almost full), Amber `#E0A33A` (trending/waitlist), Sage `#5B8C6E` (free/going/mutual), Teal `#2E7D8A` (new) — never a CTA, hero accent, or category. No apricot. No rainbow category palette. Button hover `#332873`, pressed `#2A2160`.

**Type (`tokens/typography.css` must match):** **Poppins** (SemiBold 600) = display/brand — headings H1–H3, the `click` wordmark, primary-button + tab labels, big numbers; Medium 500 for sub-labels. **Body = the system font stack** (`--font-body`) for paragraphs, captions, fields, list rows. **No Inter as the display face; no Fraunces/serif** (retired). Never set paragraphs in Poppins or the wordmark in the body font. **Compact density (locked):** on app surfaces greeting/page heading = h2 (24/32) NOT display; section headers h3 (20/28); `card-title` 18/24; body 15–16; meta 13. Reserve display 32–46 for marketing/landing.

**Imagery:** event/venue = real warm-graded Sydney photography (clay on a wheel, a flat white, runners at dawn). Abstract illustration only for marketing/empty states. NEVER stock photos of faces (members are real; people surfaces stay privacy-careful).

**Cards:** white surface on cream, radius 16–20px, ONE low purple-tinted shadow OR a hairline (not both), no colored left-borders, no cards-inside-cards (group with whitespace, inner ≤ outer).

**Radii:** inputs/buttons ~12px, cards 16–20px, **tags/avatars fully pill/round, badges ~8px rounded RECT** (so a badge never reads as a pill tag).

**Shadows:** soft, low, purple-tinted — never grey, never harsh, **never a glow.** Primary CTAs are flat deep purple.

**Anti-AI-slop (banned):** gradients/glows/mesh, glassmorphism/pervasive blur, cards-inside-cards, everything-centered symmetry, faceless 3D/blobs/stock "diverse people laughing", emoji-as-icons (only ✨/👍 locked), placeholder/lorem data. Light mode only.

**Motion:** calm — short fades, 4–8px entrance rises, ease-out ~120–240ms; hover darken one step; press darken + ~0.98 scale. ✨ only at the three peaks. Honour reduced-motion.

---

## 4. COMPONENTS (`window.ClickDesignSystem_*`)

**Button** — real CSS states (not JS): default flat Deep Purple / hover `#332873` / pressed `#2A2160` + .985 scale / **focus-visible = 2px Deep-Purple ring + 2px cream offset** (keyboard only) / disabled Mist fill + Slate text (in-DOM) / **loading** = spinner + held width. Sizes 36 (desktop/secondary) · 44 (default, min touch) · 52; **radius 12 — NEVER a full pill** (full-round is tags/avatars only; every primary — "See who was there", "Suggest a plan →", RSVP — shares this one footprint, no per-banner restyle); H-padding 16/20/24. Secondary = white + Mist border → lavender wash on hover. Ghost = text + lavender wash. **No `warm`/apricot variant.**

**Stateful action button (click-with / RSVP)** — ONE footprint across states; only fill + label change, never size/shape. `click with [name]` (filled purple) → **pending "clicked"** (muted Mist/Lavender fill, NO ✨) → **mutual "clicked ✨"** (Sage). Waitlist: "Join waitlist" → "Joined waitlist" (muted). **"Sold out" is a badge/state, never a button.**

**Tag** (`Tag`) — interest/category chips: ONE neutral look everywhere — white fill, 1px Mist hairline, Ink text, **NO dot**, **height 24 (dense 22), full pill, label 12/500 (`tag` token), padding 10 (dense 8), 6px gap** *(downsized from 28/13 on 28 Jun — smaller + lighter site-wide: event cards, people cards, Your-clicks, dashboard, landing, discovery, onboarding/filters)*. 🔴 **ONE LINE, never wrap, never stretch the card:** render as many whole tags as fit then collapse the rest into a neutral **"+N"** chip ("Plants · Craft · +2"); narrower card → fewer tags + bigger N; tags never shrink their font, never scroll on a card, a long tag never pushes the card wider. **Selected (onboarding/filters only) = Deep Purple fill, cream text, NO TICK** *(the purple fill is the signal)* — `aria-pressed`/`aria-selected` for SR; keep a ≥24px hit target. Status colour NEVER on a tag. Delete any `soft`/`color` tinting so no surface can re-tint.

**Badge** (`Badge`) — status only, ROUNDED RECT (~8px), height 24, label 12/600, status text on a soft tint per the card-state map. Almost full→Coral · Trending/Waitlist→Amber · Free/You're going→Sage · New→Teal · Sold out→Slate on Mist. **No `warm` tone, no "Founding partner" badge.** The click states ("clicked"/"clicked ✨") are NOT badges.

**Avatar / AvatarStack** — round; initials chip if no photo; non-identifying in social-proof clusters. The "+N" overflow chip is the SAME diameter + vertical centre as the avatars (never floating higher).

**Event Card** (`EventCard`) — 🔴 ONE component, identical site-wide. Banner 16:9 (`aspect-ratio`, object-fit cover); **DATE shown** in the eyebrow ("Sat 14 Jun · 2:00pm", not just the weekday); title (`card-title`, 2-line clamp); **locked location = ONE line: "Suburb · Distance" + a lock glyph only** (the "venue shown when you RSVP" explanation is the glyph's `aria-label`/tooltip + lives on the detail page — not a visible second row); interest tags **strictly ONE line + "+N" overflow, never wrap**; price; RSVP. Going row centre-aligned. **Equal-height via flex** (content flex-grows, footer pins), responsive grid `repeat(auto-fit, minmax(300px,1fr))` → 1/2/3/3–4 cols, fixed-width horizontal scroll-rows with a peek. Status badge top-left; Save + Share top-right. Venue name/address hidden until booked. Full interest-tag set shows only on the Event Detail page.

**People Card** (`PeopleCard`) — the canonical "person you can click with" card. One per line (row desktop / stack mobile). **Name only — NO age** (age lives on the profile drawer). Conditional shared-context: a real "You were both at [event]" OR "Both into [shared interests]" + ≤3 shared neutral tags — **never a bare empty "You were both at."** Pending = the stateful button's muted "clicked" (no ✨); the anonymous line shows once at the section top, never per-card. "View profile" → drawer.

**Top nav** — responsive sticky header: `click` wordmark (home) · Discover · Dashboard · **✨ click** (people; the ✨ is a standalone leading icon, the only spark in the bar) · "Host an event" · a **notifications BELL** (unread dot that clears on open → a calm, positive-only panel — never a one-way click, see `Click_Design_Prompt_Notifications.md`) · avatar. Mobile: compact header (wordmark + avatar + menu) + a sticky bottom action bar — NOT a wrapping pill row. **Back rule:** top-level pages no back; sub-pages one top-left "← back"; modals/drawers a close (✕) that dismisses the overlay, not the page. 🔴 **App nav = signed-in surfaces only.** Logged-out MARKETING pages (Landing, How-it-works, For-merchants) use a MINIMAL marketing header — no app nav, no repeated big logo — just **Log in** (quiet) + **Sign up** (primary) post-launch; pre-launch needs no header.

**Footer** (global, minimal — EVERY page) — same Cream canvas, one Mist hairline, **EXACTLY 2 rows, NO tagline** (remove "Real-life events across Sydney"): row 1 `click` wordmark + essential links (Discover · How it works · Host an event · Help · Privacy · Terms); row 2 "© 2026 Click · Made in Sydney" + social as monochrome line icons (Instagram **@click.irl**, Threads — each with `aria-label` + `aria-hidden` glyph) + `hello@click.au` (mailto text). No fat 3-column grid, no Careers, no lavender block, no duplicate host band.

---

## 5. KEY SCREENS

**Dashboard** — Mode A (first-time, **5 sections**: welcome · **finish-setting-up** · suggested · radar · categories) + Mode B (returning, conditional: post-event prompt · you're going · click-with-someone · click radar · suggested · saved & waitlist · activity · categories). **Finish-setting-up is COMPACT** (pre-filled progress bar + the next incomplete step only, expandable; rows 44–48; a status display, not user-tickable) — not a full always-expanded box. **Click-with-someone shows EXACTLY ONE rotated person + "See everyone →"** (never 3). **Click Radar = a compact social-proof BAR (NOT event cards)** — 1–3 light rows, each an anonymous aggregate social-proof line tied to an event ("3 people going also like hiking → [event]" · "Mostly people in their 30s going → [event]" · "Trending in Sydney → [event]"), ≥3 floor, never names/photos, taps through to the locked event to RSVP. Row icon = a **plain radar/signal line-glyph, NEVER a ✨** (✨ is reserved for the three peaks). NOT an event-card strip, NOT a "crossing paths with people" card. Same compact bar on the dashboard and the "click with someone" page.

**Discovery (`/events`)** — desktop filter sidebar (category · when · price · suburb) + sortable results grid; mobile chips-row + filter drawer. Same Event Card.

**Event Detail** — locked (suburb + lock + aggregate FOMO + capacity bar + status tags; Save/Share/Remind) / unlocked (full address + faked map + add-to-calendar + manage +1s + cancel/refund + a NAMED attendees grid: pic·name·shared interests·view-profile, NO click-with, NO life tags on cards, "open to dating" only under mutual opt-in) / waitlist. Full interest-tag set shown. No click-with button anywhere on the page.

**Landing** (logged-out marketing) — the signature is a REAL dictionary entry: headword `click` ✨ · "/klɪk/ · verb" · a numbered sense ("1. to connect effortlessly with someone…") · an **italic example sentence** ("we met at pickleball and just clicked!") · a Mist rule · the positioning line. Minimal marketing header (no app nav): pre-launch = no header + one **"Request an invite"** CTA (email + suburb/postcode; out-of-area never blocked → "we'll tell you the moment Click reaches you"); post-launch = **Log in + Sign up** top-right + the hero CTA + a 3-event strip. The minimal 2-row footer.

**How it works / Onboarding** — the one editorial page explaining the mechanic; onboarding = 4-step + done progressive profiling (postcode, multi-select intents with inline dating sub-questions only when "Open to dating", interests grid using the selected purple-fill tag, optional photo) with endowed progress. **Dating mode** is first set here (when "Open to dating" is chosen); its on/paused toggle otherwise lives in **Settings / Edit Profile** — NOT in the dashboard header.

**Settings / Edit Profile** — home of the **Dating mode: On/Paused** toggle (`romantic_visible`, shown only to dating-intent users), dating preferences (interested-in / age range, private), the "Show me in event attendee lists" opt-out, and event-history visibility.

**My Events** — Upcoming · Waitlist · Saved · Past + List/Calendar (calendar only here).

---

## 6. PRIVACY & MECHANIC RAILS

No chat, ever — a mutual → structured "suggest an event" only. Anonymous until mutual; never reveal a one-way click; no "likes you" queue. **Life tags are silent** — never shown on a profile or attributed to a named person; they power AGGREGATE FOMO/radar copy ("3 people over 50 going", ≥3, non-sensitive only) and the post-mutual "we're the same" shared-non-sensitive-tag snapshot (gated on an active mutual). 🔴 **"Open to dating" (any label/line, ANYWHERE — people cards, mutual cards, attendee lists, profiles) displays ONLY when BOTH the viewer and the other person have dating mode on** — a friends-only viewer NEVER sees a dating label anywhere (intent-neutral + mutual opt-in). On event pages the aggregate romantic FOMO is shown only to dating-viewers (≥3). Sensitive life tags never shown, even in aggregate. **Intent-neutral / no-dating-vibes:** activity-first, no swiping, no photo-first judgment, no chat; foreground friends/activities/networking (≤1 dating per set of 3); the mutual reveal leads with the connection + shared activity, never "a match"; no hearts/match/swipe/singles. **Microcopy:** clear, concise, never over-explain or reveal the internals (no refresh timers, no "a one-way click is never shown", no "re-click anytime") — keep the magic + curiosity.

---

## 7. REWARD PSYCHOLOGY (tasteful — never a dark pattern)

Endowed progress (bars start pre-filled, never 0). Variable-but-finite daily set (3 people/day, the rotated person, radar) = a curiosity gap worth returning for. Intrinsic over extrinsic. A natural "you're done for today" stopping point. ✨ only at the three peaks. **Banned:** depleting counters ("2 clicks left"), streaks, points, leaderboards, loss/urgency, guilt nudges, fake scarcity.

---

*Source of truth: `cndykm/click-tech` → `UIUX/` (canonical specs + `Cowork/` per-screen prompts). On conflict, canon wins and this README is corrected to match. Owner: Cindy · Implementation: Doan.*
