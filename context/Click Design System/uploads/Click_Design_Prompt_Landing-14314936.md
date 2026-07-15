<!-- Landing-page art-direction prompt: pre-launch (waitlist) + post-go-live. 23 Jun 2026. Built on the dictionary-definition hook. Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Anti-AI-slop per Click_Design_Prompt_ArtDirection.md. -->
# Click — Landing Page (pre-launch + post-go-live)

**The hook:** the dictionary definition of *click*. It's editorial, ownable, intriguing, and nobody in this space does it — so the whole page is built around it. Everything else earns its place or is cut.

## Plan (senior read)
- **Conversion truth:** one clear CTA beats competing CTAs by ~22%. So the page has exactly **one primary action** (join the waitlist / sign up) and everything else is a quiet link.
- **Intrigue without hype:** the strongest waitlist lever is **invite-only** (visitor → candidate, real scarcity). We use that + specificity ("Newtown & Surry Hills", "in real life") + the dictionary device. We deliberately avoid the generic "don't miss out" / urgency / countdown playbook — it violates `CLICK_LANGUAGE` (no loss framing, no deficit, no urgency beyond the honest 48h window).
- **Form friction:** email + postcode **only** (postcode is load-bearing for in-cluster tracking — audit G6 — but stop there; no name/role).
- **Viral growth lives on the success screen:** after signup, surface the "move up the waitlist" referral mechanic (invite friends → move up; 3 → guaranteed early invite). That's where the loop compounds.
- **Two states, one skeleton:** pre-launch is the definition + waitlist; post-go-live keeps the exact same hero and adds a small strip of real event cards + shifts the CTA to sign-up. The identity never changes; events become the proof.
- **Brand-language watch:** your line "in real life — not just online" uses "just" in the acceptable *only* sense (not the banned demoting sense), so it's fine — but if you want it bulletproof, "not behind a screen" is a clean alternative.

---

```
=== PROMPT ===

ROLE: Act as a principal designer + senior front-end engineer with 30 years shipping reference-class consumer sites (the craft bar of Linear, Stripe, Allbirds, Luma, Airbnb). Design Click's landing page — mobile-first (375px primary, scale to 1440) — in TWO states: (A) pre-launch waitlist, (B) post-go-live. KEEP IT RADICALLY MINIMAL: essential only. The page must feel like an art object a senior team obsessed over — aesthetic, editorial, calm — NOT an AI template. Conversion comes from one clear action and genuine intrigue, never from clutter or hype.

=== THE SIGNATURE: a REAL dictionary entry (Cindy 27 Jun — make it actually look like a dictionary, with an example) ===
The hero is a genuine dictionary entry for the word "click". Set it like a real, beautiful printed dictionary entry — headword, pronunciation, part of speech, a NUMBERED sense, the definition, AND an italic example sentence. That example is the upgrade that makes it read as a true dictionary, not just a styled quote.
  click ✨        ← the headword = the wordmark, large, Poppins, Deep Purple #3B2F81, lowercase; the single spark ✨ sits once near it
  /klɪk/ · verb   ← pronunciation + part-of-speech, Slate, smaller, body font, a touch of italic (the dictionary metadata line)
  1.  to connect effortlessly with someone through shared curiosity, energy, or experience.   ← number the sense "1." like a real entry; definition in Ink, generous
       *"we met at pickleball and just clicked!"*   ← 🔴 an EXAMPLE usage sentence — ITALIC, in quotes, indented under the definition (the classic dictionary convention). lowercase "clicked" = the feeling. This is the detail that sells the dictionary device.
  ——— (thin Mist hairline rule under the entry)
  We help people click in real life — not just online.   ← the positioning line, one notch up in weight, below the rule
Treat it editorially: real typographic rhythm (the example indented + italic, smaller than the definition), lots of negative space. The ✨ appears once near the wordmark — never sprinkled as decoration.

=== BRAND SYSTEM (locked) ===
Colour (CLICK_PALETTE.md): canvas Cream #F9F6F0 almost everywhere; Deep Purple #3B2F81 used flat and decisively (wordmark, primary CTA) — NEVER as a gradient or glow; Ink #1C1830 text (never pure black); Slate #6B6580 muted; Mist #E8E4F0 hairlines. Status colours only on event-card badges (post-launch).
Type (CLICK_TYPE.md): Poppins (SemiBold 600) for the wordmark, headline, primary-button label; system font stack (system-ui, -apple-system, Segoe UI, Roboto…) for definition body, sub-copy, captions. NEVER a generic neutral as the headline.
Voice (CLICK_LANGUAGE.md): warm, dry, confident, never salesy. "Click" (capital) = the app; "click" (lowercase) = the feeling. No "lonely / match / just-as-demotion / find your tribe". No loss/urgency framing.

=== HEADER — minimal MARKETING header, NOT the app nav (Cindy 27 Jun; research-backed) ===
🔴 The landing is a LOGGED-OUT marketing page — **do NOT show the app nav** (Home · Discover · ✨ click · Events + avatar). That nav is the signed-in app shell; on a landing it's clutter + exit paths (removing the nav bar lifts conversion materially — HubSpot ~+28%). And **do NOT repeat a big `click` logo in a header** — the hero wordmark already IS the giant brand mark (Cindy's point). Keep the top of the page clean.
- **PRE-LAUNCH (State A):** essentially **NO header** — open straight on the dictionary hero. No accounts exist yet, so no Log in. (Default to nothing; at most one quiet top-right link if truly needed.)
- **POST-LAUNCH (State B, logged out):** a slim header carrying the AUTH entry top-right ONLY — **"Log in"** (quiet ghost/text) + **"Sign up"** (Deep-Purple primary, the one filled action). No app nav. No centred logo at the very top (the hero carries the brand). On SCROLL, a slim sticky header may fade in with a SMALL `click` wordmark left + the same Log in / Sign up right, so the brand + CTA stay reachable once the hero scrolls away.
- Both the header "Sign up" and the hero primary CTA lead to the same /auth (`Click_Design_Prompt_Auth.md`); "Log in" → the sign-in tab. (A signed-in user hitting "/" sees the Dashboard, never this page — so the landing is always the logged-out view.)

=== STATE A — PRE-LAUNCH (WAITLIST) ===
ESSENTIAL ELEMENTS ONLY (nothing else):
1. The dictionary hero (above).
2. ONE primary CTA: "Join the waitlist" (or "Request an invite"). On click, reveals a minimal inline form: email + Sydney postcode ONLY, one button "Request invite". The button label makes clear it's a waitlist, not instant access.
3. One quiet line of access/intrigue beneath the CTA: "Invite-only. Launching first in Newtown and Surry Hills." (Specificity = premium, à la Linear. Optional, tasteful: "40+ events already in the works" — opportunity-framed, never "don't miss out".)
4. A quiet secondary text link: "How clicking works →" → /how-it-works. (Standardised wording — matches the click page; lowercase "clicking" the feeling.)
5. Supply side: the "Host an event" link in the GLOBAL minimal footer covers this — do NOT stack a separate full "Run events in Sydney? Host on Click" band directly above the footer (that doubling is part of why the footer reads heavy). If a landing-specific supply nudge is wanted, keep it ONE quiet inline line well above the footer, not a band touching it. (Hosting is free during the pilot — NO "founding venue/merchant" programme exists.)
6. Footer = the GLOBAL minimal FOOTER spec — **EXACTLY 2 rows, NO tagline** (🔴 remove the rendered "Real-life events across Sydney." — the footer drops the tagline): ROW 1 = `click` wordmark (left) + essential links (right): Discover · How it works · Host an event · Help · Privacy · Terms. ROW 2 = "© 2026 Click · Made in Sydney" (left) + monochrome social icons (Instagram, Threads — aria-labelled) + hello@click.au (right). Cream canvas, one Mist hairline, NO lavender block, NO 3-column grid, no feature/testimonials wall. (Same footer on EVERY page.)
SUCCESS SCREEN (after signup): warm confirmation in voice ("You're on the list. We'll be in touch when your suburb opens."), then the referral mechanic: "Want in sooner? Invite friends — every one moves you up. Three guarantees you a spot in the first round." with a copy-link / share affordance. This screen is where growth compounds — design it with care, not as an afterthought.

=== STATE B — POST-GO-LIVE ===
Same dictionary hero, unchanged (identity anchor). Then add, minimally:
1. A short section "What's on near you this week" — a horizontal strip / small set of 3 real event cards (see data), each: photo, title, suburb · distance (venue hidden until booked), day · time, price, one status badge where relevant (Free/Trending/Almost full per CLICK_PALETTE). Then a quiet "See everything on near you →". NOT a dense listings wall — 3 cards + a link.
2. AUTH: the slim header carries **Log in** (quiet) + **Sign up** (primary) top-right (see HEADER); the hero primary CTA shifts to **"Sign up" / "Get in"** (events are now the pull; leads to /auth → onboarding). One filled primary per view — the header "Sign up" and the hero CTA are the same action/destination, styled as one primary moment (don't create two competing filled buttons in the same viewport).
3. The GLOBAL minimal footer stays (its "Host an event" link carries the supply side — no separate stacked host band).
Everything else stays as restrained as State A.

=== REAL EVENT DATA (no placeholders) ===
  • "Wheel throwing — make two mugs" · Posy Ceramics, Newtown · Thu 6:30pm · $110 · Almost full
  • "Greenhouse terrarium build" · Merchant & Green, Redfern · Sat 2:00pm · $120 · Trending
  • "Sunrise run + coffee, 5k" · Marrickville · Sat 6:15am · Free

=== ART DIRECTION (anti-AI-slop — see Click_Design_Prompt_ArtDirection.md) ===
Editorial and asymmetric, not centered-everything. Generous, intentional whitespace (8pt grid) — whitespace is the product looking expensive. Photography (post-launch cards) = real Sydney venues, warm grade, never stock. Motion: one restrained moment only — e.g. the definition or the ✨ easing in on load (150–300ms, respect reduced-motion). 
BANNED: gradients/glows/mesh; glassmorphism/blur; cards-inside-cards; stock or 3D-blob imagery; emoji-as-icons (keep only the locked ✨); placeholder/lorem data; generic "clean & modern" filler; more than one primary CTA; any nav/feature clutter.

=== CRAFT CHECKLIST ===
[ ] The dictionary hero is the unmistakable centrepiece; ✨ used once, tastefully
[ ] The hero reads as a REAL dictionary entry — numbered sense + an ITALIC example sentence ("we met at pickleball and just clicked!")
[ ] NO app nav on the landing — minimal marketing header; pre-launch no header; post-launch Log in (quiet) + Sign up (primary) top-right
[ ] Footer = EXACTLY 2 rows, NO tagline (no "Real-life events across Sydney"), applied identically on every page; no stacked "Host on Click" band above it
[ ] Exactly ONE primary CTA; everything else is a quiet link
[ ] Waitlist form = email + postcode only; button reads as "waitlist", not instant access
[ ] Success screen carries the referral "move up" mechanic
[ ] Invite-only + named-suburb specificity for intrigue; NO loss/urgency/"don't miss out"
[ ] Post-launch: 3 real event cards + a link, not a listings wall; identity hero unchanged
[ ] Cream canvas; flat purple, zero gradients; Poppins headline + system body; ink never pure black
[ ] Editorial/asymmetric layout; 8pt spacing; one restrained motion moment; reduced-motion respected
[ ] Reads like Linear/Allbirds-grade craft — an art object, not a template
=== END PROMPT ===
```

---

## Notes for Cindy
- **Why the definition works:** it's intrigue *and* identity in one move — it tells people what "click" means (the feeling), differentiates instantly ("in real life"), and reads as editorial craft, not marketing. Lean all the way into it; it's your most ownable asset on this page.
- **The two states share one skeleton** so the brand never shifts — pre-launch is pure intrigue + waitlist; post-launch adds three real event cards and flips the CTA to sign-up. Nothing else changes.
- **Don't add more.** The instinct under pressure is to add proof, features, FAQs. Resist it — one idea, one action. The restraint is the premium.
- **One brand-language watch:** "not just online" is the acceptable *only*-sense of "just," so it passes — but "not behind a screen" is a bulletproof alternative if you want zero risk.
- **Next:** want me to run this through claude_design (after the Brand Package imports cleanly so it inherits Poppins + the wordmark), or are you pasting it in yourself?
