<!-- How It Works page + Onboarding 5-step flow. 27 Jun 2026. Responsive WEBSITE. Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Anchor copy to click_how_it_works_web_v1 + click_mechanic_explainer_copy. -->
# Click — How It Works + Onboarding

The last two consumer-spine screens. Both run under the **GLOBAL block** in `Click_Design_Prompt_FullBuildOut.md`. Copy should pull from the canonical specs (`click_how_it_works_web_v1.md`, `click_mechanic_explainer_copy.md`) — don't improvise mechanic wording.

---

## PART 1 — HOW IT WORKS (`/how-it-works`)

```
=== PROMPT (paste under GLOBAL) ===
ROLE: Senior product designer + copywriter. Design Click's "How it works" page — responsive website (375 → 1440). One calm, warm, editorial scroll that explains the model and the mechanic, then sends to signup. NOT a feature-grid; a confident, restrained explainer.

STRUCTURE (one idea per section, generous whitespace):
1. HERO — the dictionary-definition device (consistent with Landing): `click` wordmark + "/klɪk/ · verb" + the definition. One line of intrigue. (This is the full-explanation page, so here the mechanic IS explained — unlike acquisition surfaces.)
2. THE MODEL, in three calm steps (activity-first):
   1) "Find something you'd actually do" — events near you, this week (pottery, run clubs, wine, cooking). The activity is the reason to show up.
   2) "Go" — you booked, you turn up, you do the thing. A good night regardless of who you meet.
   3) "If you click with someone, you both find out" — the click, explained warmly (see THE CLICK below).
3. THE CLICK (the mechanic — pull copy from click_mechanic_explainer_copy.md):
   - Two quiet ways it happens: anonymously in discovery, or in the 48h window after an event you attended. Anonymous until mutual: "🔒 Clicking is anonymous — we'll only show you if it's mutual." Never reveals one-way interest.
   - Intent-neutral: romantic, friends, or just more social life — all equal; never framed as dating.
4. NO CHAT — framed as RELIEF, not a limitation: "No swiping. No endless chat. Real experiences with people who get it." When two people click, Click suggests a next event for both — the plan IS the conversation. Never apologise for the absence of chat.
5. WHY IT'S CALM — quiet trust points: only verified venues; you choose what you do and who you click with; "clicks are rare on purpose — that's what makes one feel real."
6. CLOSE — one primary CTA: "Join the waitlist" (pre-launch) / "Get started" (post-launch). Quiet "Run events in Sydney? Host on Click →" beneath. (NO "founding venue/merchant" — there's no founding programme; hosting is simply free during the pilot.)

RULES: cream canvas; flat Deep Purple; Poppins headings + system body; editorial/asymmetric, not centered-everything; one restrained motion moment; no gradients/stock/3D; real Sydney examples; light-mode only. Activity-first throughout; "click with" not "match"; no "lonely/just-as-demotion/find your tribe".
=== END PROMPT ===
```

---

## PART 2 — ONBOARDING (`/onboarding`, 4 steps + done — progressive profiling)

```
=== PROMPT (paste under GLOBAL) ===
ROLE: Senior product designer specialising in onboarding that converts. Design Click's onboarding — responsive website (375 → 1440). GUIDING PRINCIPLE: **progressive profiling** — collect ONLY the minimum needed to make the first feed good; defer everything else to the dashboard's "finish setting up" checklist. (Evidence: each extra field drops completion 3–5%; ~80% abandon long forms; asking minimal upfront lifts conversion ~20%; reach the aha in <5 min.) Calm, warm, intent-neutral, ONE decision per screen, skippable where optional.

SIGNUP (on /auth, BEFORE onboarding): email + password OR Google/Apple SSO only. Email verification is a SEPARATE gate (browse-only until verified) — not an onboarding step.

PROGRESS + GAMIFICATION (restrained — the brand is chilled): a slim top progress bar, **pre-filled / endowed** (show momentum from step 1, "Step 1 of 4"). Every step gives clear **completion verification** — valid input → a small satisfying tick, and "Continue" only enables when the step is genuinely complete. The final screen is an explicit completion celebration that verifies the whole flow is done. NO points / streaks / leaderboards (the heavier gamification lives on the dashboard checklist afterwards) — progress + ticks + one celebration only.

THE 4 STEPS (the minimum — nothing else belongs here):
1. ABOUT YOU — name · age (DOB) · gender · **postcode (typed 4-digit field — NOT a suburb dropdown/picker; do not make users select a suburb)**. Four low-friction identity fields on ONE calm screen (grouped — fewer screens feels faster for low-effort fields than splitting each out). **Postcode framed with pilot honesty:** "Click is piloting in inner Sydney first. Pop in your postcode — we'll show you what's near, and if we're not in your area yet, we'll email you the moment we launch there." Validate a 4-digit AU postcode (inline tick); if it's outside the pilot clusters, **accept it anyway** with a calm note ("You're a little outside our first suburbs — you're in, and we'll let you know when Click reaches you"), NEVER a hard block. DOB for eligibility, stated plainly.
2. INTENTION — the six intent cards (intent-neutral, desire-framed — "here for…", never a status; the platonic-only option reads "Here to meet people, not to date", never "in a relationship"). Choosing romantic reveals dating sub-questions inline (only then). One tap → Continue.
3. INTERESTS — the category-icon tag grid (8 default + "show more" to 16; music = single question; selected = Deep Purple fill). "Pick a few so we can suggest the right things." 3+ encouraged; skip allowed (sensible defaults applied).
4. PHOTO (optional) — uploader with a prominent "Skip for now". Clearly optional; deferrable to the dashboard.

DONE — completion screen: warm celebration that VERIFIES completion ("You're all set ✨"); reframe no-chat as relief once ("no endless chat — you meet people by doing things you like"); ONE primary CTA into the product ("See what's on near you"); + a gentle pointer: "Finish your profile anytime from your dashboard."

DEFER TO DASHBOARD (NOT in onboarding): profile photo (if skipped), bio, prompts, extra interests, the Click persona quiz — all live in the dashboard "finish setting up" checklist (the more-gamified surface). Items captured here (suburb, interests) pre-tick that checklist.

STATES: gentle inline validation; per-step completion tick; skip paths visible; **progress saved on drop-off (resume where they left)**; ≥44px targets; visible focus; loading skeletons. Mobile: single column, thumb-reachable Continue.

RULES: cream canvas; flat Deep Purple primary + progress; Poppins headings + system body; category-icon + tag systems reused; 8pt spacing; no gradients/stock/3D; light-mode only; intent-neutral; desire-framing not deficit; "event(s)" for labels, "plans" only as warm copy; "click with" not "match".
=== END PROMPT ===
```

---

## Notes for Cindy
- **How It Works is the one place the mechanic is fully explained** (acquisition surfaces only get a sentence of intrigue) — so it carries the no-chat-as-relief and anonymous-until-mutual framing in full, pulled from your existing copy specs.
- **Onboarding = progressive profiling** (the fix for drop-off you flagged). Minimum to make the first feed good — **name, age, gender, suburb, intention, interests, optional photo** — and nothing else. 4 steps + a done screen; each step verifies completion (tick + enabled Continue), final screen celebrates/verifies the whole flow. Evidence: each extra field −3–5% completion, ~80% abandon long forms, minimal-upfront +~20% conversion, aha <5 min.
- **Everything else is deferred to the dashboard checklist** — bio, prompts, extra interests, the persona quiz, photo-if-skipped. That's the more-gamified surface; onboarding stays fast and items captured here pre-tick it.
- This completes the consumer spine: Landing, How It Works, Onboarding, Dashboard, Discovery, Event Card, Event Detail, My Events, the Click-mechanic flow, People + Profile.
