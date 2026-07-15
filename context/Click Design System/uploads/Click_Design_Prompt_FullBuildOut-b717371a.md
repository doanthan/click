<!-- THE MASTER design-prompt doc for claude design (responsive WEBSITE, phone-optimised). Updated 27 Jun 2026 — now the single entry point: GLOBAL block + phased plan + index of the canonical per-screen prompts. Folds in / supersedes the retired meta-docs (Mockups v1, ArtDirection, ConsumerCore). Brand canon: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Craft bar + workflow: the click-design skill (UIUX/tooling/click-design). -->
# Click — Full Build-Out: Audit, Plan & Master Prompt (responsive website)

> **This is the one meta doc.** Paste the GLOBAL block first, then a per-screen prompt. The canonical per-screen prompts (all in `UIUX/cowork/`): **Landing · HowItWorks_Onboarding · Auth · Dashboard · Discovery_Icons · EventCard · EventDetail · PeopleCard · WhoWasThere · Profile · Booking · MyEvents · ClickMechanic · Buttons_Tags**. Retired (do not use): `Click_Design_Prompt_Mockups.md` (v1), `Click_Design_Prompt_ArtDirection.md`, `Click_Design_Prompt_ConsumerCore.md` — their content lives here + in the per-screen prompts + the click-design skill.

## A. Quick audit — Doan's live build (what needs updating)
Functional and further along than the old mocks, but off the locked brand in ways that matter. Realign to the claude design direction (screenshot 4 is on-brand).

| In Doan's build | Issue | Fix |
|---|---|---|
| Tomato/mascot logo + "Click." | Not the planned identity | Use the locked wordmark: lowercase **click** in Deep Purple + the ✨ spark (the claude design version) |
| Coral as primary CTAs, hero accent, big stat blocks | Coral is a **status** colour (almost-full), not a brand primary — overusing it muddies the palette | Primary = **Deep Purple**. Coral only for "almost full"/urgent status. (per `CLICK_PALETTE`) |
| "RSVP to unlock" + inconsistent CTAs | Spec flags the jargon | "RSVP" (price on the card) / "Join waitlist" (full) / "View details" (booked); never "RSVP to unlock" or price-in-button |
| Categories/intents: Dating, Career, Relationships | Dating-app + networking skew | Activity-first categories; intent stays in profile/visibility, never a browse category (see Design Review) |
| "Where interests become friendships" | Friendship-specific, not intent-neutral | Lead activity-first + intent-neutral (e.g. "Where interests become familiar faces") |
| Events: Batmobile, "Fight Night (bare Nuckle)", baby photos; Melbourne events | Placeholder/joke data + breaks cluster discipline | Real **Sydney cluster** activity data (pottery, run clubs, terrarium, wine, glass-blowing) — list below |
| Dark "Click Radar" card | We're **light-mode only** | Light treatment on cream |
| Profile: age 18 + "Dating" intent | Target is 25–38; 18 + dating is a safety/brand flag (product call, not design) | Flag to product; design shows 25–38 personas, intent-neutral |
| "Two truths and a lie", "vibe"-style prompts | Fine as a prompt format; keep tone dry/on-brand | Keep prompts, lose any dating/“tribe” framing |

**Good in Doan's build, keep:** the small outline interest-tag pills (close to the new tag system); capacity/"seats left"; the dashboard's anonymous-click copy ("Clicking is anonymous — we'll only show you if it's mutual").

## B. North star
Screenshot 4 (claude design landing) is **correct and on-brand** — lowercase `click` wordmark + spark, dictionary hook, Deep Purple primary "Join the waitlist", invite-only Newtown/Surry Hills, a "host on Click" supply-side link, the 375/768/1024/1440 breakpoint toolbar, pre-/post-launch toggle. Build everything to **this** standard, not Doan's current visual language.

## C. The important correction — WEBSITE, not app (yet)
We do **not** have an app. We have a **responsive website that must be excellent on a phone**. App is a *later* phase. So:
- Design responsive **web** layouts at 375 (mobile-web) → 768 → 1024 → 1440. The phone frame in the mockup is presentation only.
- Use **web** navigation (responsive sticky header; a simple mobile sticky action bar is an acceptable web pattern).
- Do **NOT** render native-app chrome in the product: no device status bars, safe-area insets, native tab bars, splash screens, or push-permission dialogs.
- This **supersedes** the "app-ready / bottom tab bar / safe areas" language in the earlier per-screen prompts — treat those as "responsive web, mobile-optimised" instead. (I can propagate this edit into those prompts on request.)

## D. Plan — build the inventory in phases (don't generate all at once)
claude design produces sharper screens from focused prompts. Recommended order; run the master prompt **phase by phase**:
1. **Phase 1 — Consumer core (the demo spine):** Home/Landing ✓, How It Works, Onboarding (5), Dashboard A+B, Discovery (desktop + mobile), Event Detail (locked/unlocked) ✓, the Click-mechanic flow ✓, People, Public Profile (view).
2. **Phase 2 — Account, booking, retention:** Auth + email-verification gate, Booking/Checkout (free + paid), Confirmed Events, Profile Edit, Settings, Activity feed, the 3 emails (digest / post-event / milestone).
3. **Phase 3 — Merchant portal:** Merchant Landing, Registration wizard + Pending, First-event checklist, portal tabs (Dashboard/Events/Attendees/Bookings/Analytics/Finances/Venues/Discounts/Support/Settings), Event Creation wizard.
4. **Phase 4 — Admin portal:** Admin login (MFA) + tabs.
Cross-cutting throughout: empty/cold-start states, role/portal switcher, the 4 breakpoints.
(✓ = already in your interactive mockup.)

---

## E. THE MASTER PROMPT
Paste the GLOBAL block once, then append the phase block you're building. Detailed per-screen prompts already exist for some — referenced inline.

```
=== GLOBAL (paste with every phase) ===
ROLE: Principal product designer + senior front-end engineer (30 yrs, reference-class consumer web — Linear, Stripe, Airbnb, Luma). Build Click as ONE cohesive, on-brand RESPONSIVE WEBSITE, mobile-optimised. NOT a native app (app is a later phase) — no native chrome (status bars, safe areas, native tab bars, splash, push dialogs); the phone frame is presentation only. Breakpoints: 375 (mobile-web) / 768 / 1024 / 1440. Match the existing Landing screen's craft and brand exactly.

CONSISTENCY & GOVERNANCE (read FIRST — this is how to stop stale, contradictory pages):
- **One component, used IDENTICALLY site-wide.** The Event Card, People Card, Button, Tag, Badge, the top nav, and the footer are SINGLE components — the SAME in every place they appear (dashboard, discovery, my events, landing, event detail, radar, search, profile). NEVER restyle a component per page. 🔴 **The EVENT CARD is the SAME CARD THROUGHOUT THE SITE** — identical layout, states, sizing, one-line tags, pinned footer — whether it's on discovery, the dashboard strips, the radar, my-events, or the landing.
- **Every change applies to ALL pages, in the same pass.** When a rule or component changes, propagate it to EVERY screen that uses it — never fix one page and leave the rest stale. Change the tag style → change it everywhere tags appear; change the card → re-render every surface that shows the card.
- **Update the design-system README whenever a rule changes.** The README/design system is what the project reads first, so a stale README = drifted, contradictory renders. In the SAME pass as any token/rule/component change, UPDATE the README to mirror it. On conflict, the canonical specs (CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE + the per-screen prompts) win and the README is corrected to match them — the README is a MIRROR of canon, never an independent "interpretation."

BRAND (locked):
- Colour (CLICK_PALETTE.md): Cream #F9F6F0 canvas; Deep Purple #3B2F81 = primary action + selected, used FLAT and sparingly (NEVER gradients); Lavender #C8B8F8 soft accent; Ink #1C1830 text (never pure black); Slate #6B6580 meta; Mist #E8E4F0 hairlines. Status colours (Coral #E8674C almost-full, Amber #E0A33A trending/waitlist, Sage #5B8C6E free/going/mutual, Teal #2E7D8A new) ONLY on badges — NEVER as primary CTAs, hero accents, or big fills.
- Type (CLICK_TYPE.md): Poppins (SemiBold 600) for wordmark/headings/primary-button labels/tab labels; system font stack for body/meta. Never a generic neutral as a headline.
- Voice (CLICK_LANGUAGE.md): warm, dry, calm. Activity-first (events lead, people second, everywhere). No chat anywhere. "click with" not "match"; CTA = "RSVP" (price on the card, not in the button) / "Join waitlist" (full) / "View details" (booked), never "buy a ticket", "RSVP to unlock", or price-in-button; no "lonely/just-as-demotion/find your tribe"; opportunity framing, never loss/urgency. Capital "Click" = the platform name only; the feeling/verb is lowercase — and UI chrome follows the feeling: nav **"✨ click"**, page header **"click with someone"**, button **"click with [name]"**, pending pill **"clicked ✨"** (all lowercase).
- Identity: lowercase `click` wordmark in Deep Purple + the ✨ spark. No mascot.
- DENSITY (compact — locked 27 Jun; the current mockups run TOO LARGE). Tighten the ELEMENTS, keep the calm whitespace-grouping. On APP surfaces (dashboard, cards, people, discover, profile — NOT the marketing/landing hero): **page/greeting heading = h2 (24/32), NOT display**; section headers = h3 (20/28); card titles = the `card-title` token (18/24); body 15–16; meta 13 (Slate). Reserve display 32–46 for landing/marketing only. **Buttons:** height ~40px (keep ≥44px tap area via padding), label 14–15; **auto-width inside rows on desktop, full-width only on mobile** (no giant full-width buttons on desktop). **Avatars:** people-card 56–64px; going-avatars 24px. **Padding:** cards ~16px; **section gaps 40–48 desktop / 24–32 mobile; intra-group 12–16** (inner ≤ outer still holds). Goal: ~15–20% more content per screen, same editorial calm — never crowded.

MECHANIC (locked — do not violate):
- No chat/DMs. After a mutual click, a structured "suggest an event" flow is the only coordination.
- Anonymous until mutual — never reveal one-way interest to anyone.
- Intent-neutral — romantic/friends/social coexist; never frame as a dating app; never make dating a category or a headline.
- Clicking happens via the discovery people-surface (anonymous) or the post-event window (attendance-gated, 48h). The event page itself is context-only — NO "click" button on an event's attendee list.

ANTI-AI-SLOP: no gradients/glows/glassmorphism/blur; no cards-inside-cards (group with whitespace on an 8pt grid, inner ≤ outer); no uniform card-wall (vary section treatments); no stock/3D-blob imagery (real warm-graded Sydney venue photos); no emoji-as-icons (refined line icons; keep only locked ✨); NO placeholder/joke data — use the real data below; light-mode only.

REAL SYDNEY DATA (use everywhere; replace any Batman/Melbourne/placeholder content):
Events (cards show the DATE — "weekday date mon · time", e.g. "Thu 12 Jun · 6:30pm", not just the weekday) — "Wheel throwing — two mugs" · Posy Ceramics, Newtown · Thu 12 Jun · 6:30pm · $110 · Almost full | "Greenhouse terrarium" · Merchant & Green, Redfern · Sat 14 Jun · 2:00pm · $120 · Trending | "Sunrise run + coffee, 5k" · Marrickville · Sat 14 Jun · 6:15am · Free | "Native cocktails, four pours" · Surry Hills · Fri 13 Jun · 7:00pm · $97 | "Glass-blowing taster" · Mark Eliott Glass, Marrickville · Sun 15 Jun · 11:00am · $182 · New | "Pasta from scratch" · Surry Hills · Wed 11 Jun · 6:30pm · $150.
Categories (activity-first; NO "Dating") — Pottery & ceramics · Run clubs & fitness · Wine & bars · Cooking · Live music · Art & craft · Wellness · Trivia & games · Outdoors · Markets · Coffee · Workshops. Icons: one consistent treatment — Deep Purple line icon on a soft Lavender circle; selected category = Deep Purple fill. (NOT rainbow.)
People (first name + initial, intent-neutral): Mia, Tom, Priya, Jules, Hassan, Bec.

NAV (web): responsive sticky header — lowercase `click` wordmark left (brand/home); Discover · Dashboard · **✨ click** (the people / "click with someone" destination — lowercase, with the ✨ as a standalone LEADING icon, the only spark in the bar, never merged into the letters) center; "Host an event", notifications, avatar right. Collapses to a compact header + menu on mobile. Active state Deep Purple. (Optional mobile sticky bottom action bar — Home · Discover · ✨ click · My Events · Profile — is fine as a web pattern; not a native tab bar.)

NAV CONSISTENCY — back / close (locked; applies to EVERY page — fixes the inconsistent back buttons across the mockup). The rule is page-type-based, identical everywhere:
- **Top-level destinations** (Home/Dashboard, Discover, ✨ click, My Events, Profile — anything reached from the persistent nav): show **NO back button**. The persistent header/nav is the only way around at this level. A back button on a tab is redundant and confuses where "back" goes.
- **Sub / detail pages** (Event detail, Profile view [if full-page], Booking/Checkout, Who-was-there, post-event "Did you click with anyone?", confirmed-event detail): show **exactly one back affordance, top-left, in the SAME position + style + label on every page** ("← back"; returns to the perceived previous page). Never two competing back/close controls on one screen.
- **Modals / drawers / sheets** (profile drawer, mutual reveal, suggest-an-event, filters sheet): use a **Close (✕) top-right** (or a sheet grab-handle on mobile); Esc / browser-back / tapping the scrim **dismisses the overlay and returns to the page beneath — never navigates the page away**. Keep the close prominent so users don't reach for browser-back.
- Placement is pixel-consistent across pages (same corner, same icon, same label) at every breakpoint. (Baymard: users expect Back to return to the *perceived* previous page; overlays should close, not navigate.)

FOOTER (global, MINIMAL — a calm utility footer, NOT a fat marketing footer; same on every page). The live render was too heavy: a full Lavender colour block + three link columns (EXPLORE/COMPANY/SUPPORT, 9 links incl. Careers/About) + tagline + a separate "Run events in Sydney?" band stacked on top + social + email + copyright. Replace with:
- **Same Cream `#F9F6F0` canvas — NO lavender block.** A single 1px Mist hairline along the top is the only divider. It should blend into the page, not announce itself. Compact vertical padding (≈40–48 desktop / 24–32 mobile per GLOBAL), capped content width aligned to the page.
- **~2 quiet rows, essentials only — LEAN, no tagline:**
  1. TOP row: lowercase `click` wordmark (Deep Purple, small — NO ✨; the spark is nav-only) on the left; a SINGLE inline row of essential links on the right (wraps on mobile), Slate text → Deep-Purple on hover, descriptive (never "click here"), ≥44px tap spacing: **Discover · How it works · Host an event · Help · Privacy · Terms**. (About/Careers NOT essential for the pilot — omit; Host an event covers the supply side, so DROP the separate "Run events in Sydney? Host on Click" band — don't stack both.) **No tagline.**
  2. META row: left — "© 2026 Click · Made in Sydney" (Slate 13). Right — social as **small MONOCHROME line icons** (Instagram + Threads) matching the UI icon set (Lucide/Phosphor stroke; Slate → Deep-Purple on hover; NEVER brand-coloured logos that clash with the cream/purple palette), each a ≥44px tap target with an **`aria-label`** ("Click on Instagram" / "Click on Threads") and `aria-hidden` on the glyph (an icon-only social link with no accessible name is the most common footer a11y failure — never ship an empty icon link); plus **hello@click.au** as a real `mailto:` TEXT link beside them (contact reads clearer as text than an icon).
- **Mobile:** everything stacks to a single column, centered or left-aligned, links wrap to 2 rows max; no accordions needed (the set is small). ≥44px targets; ≥4.5:1 contrast (Slate on cream clears).
- NO 3-column grid, NO column headers, NO feature/testimonial/newsletter blocks, NO lavender fill, NO duplicated host CTA. Legal (Privacy, Terms, © + year) + contact are the non-negotiable essentials (compliance); everything else is trimmed.
=== END GLOBAL ===

=== PHASE 1 — CONSUMER CORE ===
Build these as one cohesive set. Detailed specs exist where noted — follow them.
- HOME / LANDING — already on-brand; keep. (Detailed: Click_Design_Prompt_Landing.md — dictionary hero, pre-launch waitlist + post-go-live with 3 real event cards.)
- HOW IT WORKS — explain the model activity-first; the click mechanic in one warm pass; frame no-chat as relief ("no swiping, no endless chat"); anonymous-until-mutual; ends with signup CTA. One sentence of intrigue, full explanation here (not on acquisition).
- ONBOARDING — progressive profiling, minimal (name/age/gender/suburb/intention/interests/optional photo), ~4 steps + done, gamified with per-step completion; everything else deferred to the dashboard "finish setting up" checklist. (Detailed: Click_Design_Prompt_HowItWorks_Onboarding.md.)
- DASHBOARD — Mode A (first-time, 5 sections incl. the system-verified "finish setting up" card) + Mode B (returning, conditional). (Detailed: Click_Design_Prompt_Dashboard.md.) Activity-first ordering; whitespace grouping; thin top; no promo-card clutter; one filled-purple CTA per viewport; calendar lives on My Events, not here.
- DISCOVERY (`/events`) — desktop: category chip strip, left filter sidebar, sort, search w/ autocomplete, suggested-for-you toggle, card grid, empty states. MOBILE (critical): sticky search → horizontal-scroll category chips → single "Filters" button opening a bottom SHEET → applied-filter chips row → single-column cards. De-dated filter labels (Free / Trending / New / This week / Near me / by category — NOT "Mostly Singles"). (Pattern per Design Review §5.)
- EVENT DETAIL — locked (suburb-only + aggregate life-tag FOMO + capacity bar + status tags; Save/Share/Remind) / unlocked (full address + faked map + manage +1s + cancel/refund + add-to-calendar + a NAMED ATTENDEES grid: pic·name·shared interests·view-profile, NO click-with, NO life tags on cards, "open to dating" only under mutual opt-in) / waitlist (full); share on all; NO click button anywhere; LOCKED social proof is aggregate-only (never a named person tagged with intent), UNLOCKED shows named attendee cards (interests only); full interest-tag set shown; sticky bar must not overlap content; one ✨ max ("You're going" = Sage check); on-brand photo nudge. CTA = RSVP / Join waitlist / You're going. (Detailed: Click_Design_Prompt_EventDetail.md; booking flow: Click_Design_Prompt_Booking.md.) ⚠️ Flag to Doan: per-person "open to dating" on the unlocked attendee list softens 10/12 aggregate-only (mutual opt-in gated).
- WHO WAS THERE (post-event, Process 2) — the ONLY surface where a post-event click happens (the event page is context-only): attendance-gated attendee grid, anonymous click, no timer shown, photo nudge, two yes-branches. (Detailed: Click_Design_Prompt_WhoWasThere.md.)
- CLICK MECHANIC FLOW — post-event prompt ("Did you click with anyone?") → your clicks → MUTUAL REVEAL ("You two clicked." + "You're both here for [intent]") → suggest-an-event (the no-chat coordination) → closure ("We clicked 👍" → "Love that. That's what Click's for. ✨") → soft-release ("Still out there — if you cross paths again, you can pick it back up." — NEVER loss-framed). The mutual reveal is the most crafted screen. (Detailed: Click_Design_Prompt_ClickMechanic.md.)
- PEOPLE — the "click with someone" page: curated daily set of 3, shown ONE PER LINE (full-width row-cards), the anonymous "click with" surface; intent-neutral; reassurance legible ("🔒 Clicking is anonymous — we'll only show you if it's mutual"). (Detailed: Click_Design_Prompt_PeopleCard.md = the canonical people card; Click_Design_Prompt_ClickMechanic.md §E/§F = the page + profile drawer.)
- PROFILE (view = "viewing someone", read-only) — ONE profile, two modes; the viewer mode shows the public subset + "click with [name]". (Detailed: Click_Design_Prompt_Profile.md — the canonical source for BOTH the own-profile and the viewer drawer.)
=== END PHASE 1 ===

=== PHASE 2 — ACCOUNT / BOOKING / RETENTION ===
- AUTH (`/auth`) — email/password + Google/Apple SSO; sign-up/sign-in toggle; email-verification gate (browse-only locked view); password reset. (Detailed: Click_Design_Prompt_Auth.md.)
- BOOKING / CHECKOUT — free RSVP path + paid (Stripe Checkout) path; waitlist join; confirmation. CTA = "RSVP" (price on the card).
- CONFIRMED EVENTS (`/confirmed-events`) — upcoming bookings, ticket/state ("You're going" Sage).
- PROFILE (own / edit) — the "your own profile" mode: Deep-Purple "Edit profile", privacy as a compact link, completion nudges; edit = up to 5 photos, bio, tags, intentions, dating prefs (only when romantic intent on). (Detailed: Click_Design_Prompt_Profile.md — Mode A.)
- SETTINGS — account, romantic-visibility toggle (with the locked helper copy), event-history toggle.
- ACTIVITY FEED — quiet, low-key (milestones, what happened) — never a notification dump.
- EMAILS (3) — weekly digest (Tue 7am, de-matched subject), post-event prompt email, milestone email. On-brand, restrained.
=== END PHASE 2 ===

=== PHASE 3 — MERCHANT PORTAL (`/merchant-portal`) ===
- MERCHANT LANDING (`/merchant`) — **"Host on Click — free during our Sydney pilot."** Current model (locked 27 Jun): **hosting is FREE right now; there is NO founding-merchant programme, NO founding badge, NO commission.** Just list your events and reach the people most likely to love them. Audience-quality not reach; peer-to-peer tone. (⚠️ The merchant copy decks still carry the old founding/10% narrative — superseded; they need a copy refresh to the free-pilot model.)
- REGISTRATION — 4-step wizard (ABN/docs) + Merchant Pending holding page.
- FIRST-EVENT ONBOARDING CHECKLIST (5 steps; replaces portal dashboard until complete).
- PORTAL TABS — Dashboard (widgets + under-attended alert), Events, Attendees, Bookings, Analytics (charts), Finances (Stripe Connect), Venues, Discounts, Support, Settings. Calm data-UI, not a dense BI wall.
- EVENT CREATION WIZARD — 5 steps (basics / when-where / capacity+price / media / review).
=== END PHASE 3 ===

=== PHASE 4 — ADMIN PORTAL (`/admin-portal`) ===
- ADMIN LOGIN — separate, MFA-gated, non-admins blocked.
- TABS — Platform Analytics, Merchant Approvals (amber@2h / red@4h urgency), Event Moderation, User Moderation, Tag Management, Financial Review, Audit Log, System Settings. Functional, restrained.
=== END PHASE 4 ===

=== CROSS-CUTTING (apply throughout) ===
Role/portal switcher (avatar dropdown: user/merchant/admin). Cold-start + all discovery empty states (editorial, action-prompting, never blank/sad). Loading = calm skeletons. Every screen at 375/768/1024/1440; ≥44px touch targets; visible focus; reduced-motion respected.

=== CRAFT CHECKLIST (per screen) ===
[ ] Responsive website (no native-app chrome); works beautifully at 375; scales to 1440
[ ] On brand: cream canvas, flat Deep Purple primary (zero gradients), status colour on badges only, Poppins+system type, `click` wordmark+spark
[ ] Activity-first; no chat; anonymous-until-mutual; intent-neutral; no "Dating" category; CTA = RSVP (one label; price on the card, not in the button), never "RSVP to unlock"; "click with" not "match"
[ ] Real Sydney data (no Batman/Melbourne/placeholder); on-brand category icons (purple-on-lavender, not rainbow)
[ ] 8pt spacing; whitespace grouping (no nested cards); refined line icons; empty/loading states designed
[ ] Nav consistent: top-level pages show NO back; sub/detail pages show ONE top-left "← back" (same place every page); modals/drawers use a close (✕) that dismisses the overlay, not the page
[ ] Stateful action buttons (click-with / RSVP) keep ONE size + shape across states — only fill colour + label change; pending reads as pending, not confirmed; max one ✨ per element
[ ] Reads like a funded product (Luma/Airbnb calm), not a template or a dev build
=== END MASTER PROMPT ===
```

---

## F. Notes for Cindy
- **Run it phase by phase** (paste GLOBAL + one phase). One mega-generation goes shallow; phased keeps each screen sharp.
- **Phase 1 is the demo spine** — it's what makes the interactive mockup feel complete for pre-launch. Merchant/admin (Phases 3–4) can follow.
- **The web-not-app correction is the important new constraint** — I've written it into GLOBAL and noted it supersedes the "app-ready" language in the earlier prompts. Want me to propagate that edit into the individual prompt docs so they're all consistent?
- **Two detailed prompts still to write** to complete Phase 1: the **Discovery** page (desktop + mobile sheet pattern) and the **Category-icon** spec. Say the word and I'll add them under this build-out.
