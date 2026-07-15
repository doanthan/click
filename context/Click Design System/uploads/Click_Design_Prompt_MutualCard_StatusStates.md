<!-- Last updated: 2026-06-29 | Revision: v1 (new — adds COORDINATION STATUS-STATES to the mutual / "Your clicks" card [open / proposed-receiver / proposed-proposer / confirmed_together / dormant — labelled as YOUR-move or a calm honest wait, never a verdict] AND reaffirms TAGS ARE ALWAYS NEUTRAL [Cindy 29 Jun — corrects the lavender-tint shared chips shown in two prior mocks, which contradicted the already-locked neutral-tag rule in PeopleCard + Buttons_Tags]. Resolves the in-the-wild coloured "Both open to dating" chip [Image 3] = it's an intent/status marker, not a tag — flag. Source of truth: 21_CLICK_MECHANIC Part B coord_state machine, 01 §7 waiting-state, 09 §7, PeopleCard prompt, Buttons_Tags. ) -->
# Click — claude design prompt: mutual card coordination status-states + neutral-tag reaffirmation

> Paste into the claude-design project **after** the GLOBAL block and after `Click_Design_Prompt_PeopleCard.md` (this extends the People Card's MUTUAL context — the card on the "Your clicks" page). Two-part: **(1) add the coordination status-state model to the mutual card + enforce neutral tags everywhere in the design system, then (2) re-render the "Your clicks" page showing every coord_state.** 🔴 People Card is the LOCKED single component — these apply to every surface it appears on.

---

## Three things this does

1. **Tags are ALWAYS neutral — reaffirm + correct.** (Cindy 29 Jun.) This is ALREADY canon (`PeopleCard` "neutral chips, white fill, Mist hairline, Ink text"; `Buttons_Tags` killed the `soft`/`color` tint paths). Two recent mocks wrongly showed lavender-tint "shared" chips — that was the error, not the rule. 🔴 **Every interest tag, every surface, every state on the People Card and Who-was-there: neutral pill (white fill, 1px Mist hairline, Ink text, 22/12). The ONLY time a tag goes Deep-Purple is the SELECTED state in onboarding/filters. Never a lavender-tint "shared" chip — "shared" is signalled by the "You both like" / "Both into…" LABEL, not by colour.**
2. **Add coordination status-states** to the mutual card (the substantive new work — below).
3. **Resolve the coloured "Both open to dating" chip** (Image 3) — see §C.

---

## A. The coordination status line (the new work)

The "Your clicks" mutual card must show WHERE in the coordination flow each mutual is — but per canon (`21` Part B + `01` §7), the label is always **YOUR move** or a **calm, honest wait**, NEVER a verdict ("they haven't replied") and never a passive "waiting" pile. The `coord_state` machine has exactly these states; map each to a status line + action:

| coord_state | Your role | Status line (the new element) | Primary action |
|---|---|---|---|
| `open` | — (nothing proposed yet) | *(no status line — just the intent + overlap)* | **"Suggest a plan →"** |
| `proposed` | **receiver** (they suggested) | **"[Name] suggested [Event] · [day/time]"** (Deep-Purple, it's your move) | **"See their plan →"** |
| `proposed` | **proposer** (you suggested, awaiting them) | **"You suggested [Event] · [day/time]"** + a quiet **"[Name] was active [X] ago"** (Slate) | **"Suggest another"** (secondary/ghost) |
| `confirmed_together` | both booked | **"You're both going to [Event] 🎉"** + "[day/time · suburb]" (the celebrated state) | **"See the plan →"** |
| `dormant` | no viable event | **"Nothing fits you two just yet - new events drop weekly"** + "We'll nudge you the moment something does" | **"Browse together"** (secondary) |

🔴 **Locked framing rules (from canon — do not soften into verdicts):**
- **Proposer-waiting (`proposed`, you proposed):** NEVER "Waiting on [Name] to reply" / "[Name] hasn't responded" — that frames a non-response as a snub. Use "You suggested [Event]" + the factual "[Name] was active 2h ago" (real social proof the person + app are live, `01` §7). 🔴 After 24h of THEIR inactivity (`last_active_at`), soften to **"[Name] hasn't been on in a bit - we'll make sure they see it."** (copy-only, changes no state/timer — `21` §B4.2).
- **Receiver (`proposed`, they proposed):** this is YOUR move — surface it prominently ("[Name] suggested [Event] · See their plan →"). This is the highest-value action on the page.
- **`confirmed_together` is CELEBRATED**, not a quiet row — the warmest card state (the mechanic finally landing). The 🎉 is allowed here (it's in the canon notification copy); it is NOT a ✨ (✨ is the click/mutual peak, not the plan-confirmed peak).
- **`dormant` is NOT a dead end** — opportunity-framed, "new events drop weekly", a Browse-together CTA always present. Never "no matches" / loss-framed.
- **Surface only YOUR-move states prominently;** never build a passive "waiting on others" list. The proposer-waiting card exists (anxiety management, `01` §7) but is calm and secondary, not a call-to-action.
- **`crossed` edge** (you both proposed at once, `21` §B4.4): "You both reached out! [Name] suggested [Event] - take that, or send yours?" — surface as a receiver-style card with a one-tap accept + counter.

## B. The status line in the card skeleton

The status line replaces/augments the "Both into…" overlap line position when a coordination state is active. Reading order on the mutual card:
1. Name + intent line ("You're both here for friends" — sage, mutual-confirmed intent per `CLICK_LANGUAGE`)
2. **Status line** (the coord_state line above) — the new element, Deep-Purple when it's your move, Slate when it's a calm wait
3. "You both like [overlap]" + neutral shared tags (unchanged; tags NEUTRAL)
4. Primary action (right on desktop row / full-width on mobile)

Keep the skeleton identical to the People Card (avatar 46–64 per the locked component, name+intent, overlap+tags, action) — the status line is an *addition* in the mutual context, not a new layout.

## C. Resolve the coloured "Both open to dating" chip (Image 3)

The live render shows a filled-lavender **"Both open to dating"** chip among neutral tags — this violates the always-neutral tag rule. 🔴 **DECISION (recommended, pending Cindy): it is NOT an interest tag — it's a mutual-intent disclosure**, so it should not be styled as a tag at all. Options:
- **(a, recommended)** render it as part of the **intent line** (text, not a chip): "You're both here for friends · both open to dating" — keeps tags neutral, puts intent where intent lives.
- **(b)** a distinct small **status marker** (not a pill tag — a different shape, e.g. a quiet inline label with a glyph) so it's clearly not an interest tag.
- 🔴 NOT (c): leave it as a coloured pill among the tags — that's the drift to fix.
Either way the mutual-dating disclosure only appears when BOTH are dating-intent (`10` §3 / `CLICK_LANGUAGE` dual-intent rule) — never a one-sided "open to dating" on a named card.

---

## States to mock (the "Your clicks" page)

Render the page with sections and one card per coord_state:
1. **Live mutuals** section — an `open` card ("Suggest a plan →"), a `proposed`-receiver card ("[Name] suggested… · See their plan →"), a `proposed`-proposer card ("You suggested… · [Name] active 2h ago · Suggest another").
2. **Plans** section — a `confirmed_together` card ("You're both going to [Event] 🎉 · See the plan →"), visually the warmest (the one place a soft lavender-wash *card background* is OK — that's a large surface, not a tag).
3. A `dormant` card ("Nothing fits you two just yet…").
4. **Past clicks** section — closed/connected mutuals, quiet.
5. All tags NEUTRAL throughout (prove the correction). Mobile + desktop.

---

## Checklist (must all hold)

- 🔴 Tags NEUTRAL everywhere (white/Mist/Ink, 22/12); purple only = selected in onboarding/filters; no lavender-tint "shared" chip anywhere. "Shared" = the label, not colour.
- 🔴 Status line = YOUR move or a calm honest wait; NEVER "they haven't replied" / a verdict / a passive waiting pile.
- 🔴 Proposer-waiting uses "[Name] was active Xh ago" → softens after 24h inactivity; receiver card surfaces "See their plan →" prominently.
- 🔴 `confirmed_together` celebrated (🎉, warmest card); 🎉 ≠ ✨ (✨ stays the click/mutual peak).
- 🔴 `dormant` opportunity-framed, never loss; Browse-together CTA present.
- 🔴 "Both open to dating" is NOT a coloured tag — it's intent-line text or a status marker (Cindy to pick); only when both are dating-intent.
- Skeleton identical to the locked People Card; status line is an addition, not a relayout.
- One ✨ rule, hyphens not em-dashes, sentence case, Poppins headings/system body, 8pt, ≥44px, neutral status colours on badges only.

---

## FILES TO COMMIT (after Cindy signs off)

- `UIUX/Cowork/Click_Design_Prompt_ClickMechanic.md` — add the coord_state status-line model to the "Your clicks" mutual card (§D states); the status line + whose-move framing. Bump header + rev note.
- `UIUX/Cowork/Click_Design_Prompt_PeopleCard.md` — reaffirm tags-always-neutral in the tag rule (it's already there — add a one-line "no lavender-tint shared chip; shared = label not colour" guard so it can't drift again); note the status-line addition in the mutual context.
- `UIUX/Cowork/Click_Design_Prompt_WhoWasThere.md` + `Click_Design_Prompt_WhoWasThere_Redesign.md` — correct the shared-tag chips to NEUTRAL (the redesign prompt wrongly showed lavender-tint); "You both like" stays as the label.
- `UIUX/Cowork/Click_Design_Prompt_Buttons_Tags.md` — already correct (neutral tag, purple-only-selected); add the explicit "no 'shared' tint variant — shared is a label" line under A2 so it's airtight.
- `UIUX/CLAUDE_DESIGN_README_CANONICAL.md` — §4 People Card: add the coord_state status-line set + the whose-move framing rule; reinforce tags-always-neutral (no shared tint). §5 "Your clicks": the coord_state card states.
- `UIUX/UIUX_CHANGELOG.md` (v67 → v68) — new row + header bump (text below).
- Suggested commit message: `design: mutual-card coordination status-states (your-move framing per 21 Part B) + reaffirm tags-always-neutral (kill the shared-tint chip); resolve "both open to dating" as intent not tag`

### Changelog row to add to `UIUX_CHANGELOG.md` (newest-first)
```
| 29 Jun 2026 | cowork/ ClickMechanic, PeopleCard, WhoWasThere(+Redesign), Buttons_Tags; CLAUDE_DESIGN_README_CANONICAL | **Mutual-card coordination status-states + tags-always-neutral reaffirmed (Cindy).** Added the coord_state status line to the "Your clicks" mutual card — open ("Suggest a plan →") · proposed-receiver ("[Name] suggested [Event] · See their plan →") · proposed-proposer ("You suggested [Event]" + "[Name] was active 2h ago", softening to "we'll make sure they see it" after 24h inactivity) · confirmed_together ("You're both going to [Event] 🎉", celebrated/warmest) · dormant ("nothing fits yet - new events drop weekly", opportunity-framed). 🔴 Locked framing: the label is always YOUR move or a calm honest wait — NEVER "they haven't replied"/a verdict/a passive waiting pile (per 21 Part B + 01 §7). 🎉 ≠ ✨ (✨ stays the click/mutual peak). 🔴 TAGS ARE ALWAYS NEUTRAL — reaffirmed + corrected: two prior 29-Jun mocks wrongly showed lavender-tint "shared" chips; that contradicted the already-locked neutral-tag rule (PeopleCard + Buttons_Tags). "Shared" is signalled by the "You both like"/"Both into…" LABEL, never by colour; purple-fill tag = selected-in-onboarding only. 🔴 The in-the-wild filled "Both open to dating" chip (Image 3) is NOT a tag — recommended: fold into the intent line ("…· both open to dating") or a distinct status marker; only when BOTH are dating-intent. **Flag to Doan:** card needs coord_state on the mutual payload (open/proposed/confirmed_together/dormant + whose-move = am I proposer or receiver) to pick the status line + action; proposer-waiting pulls partner last_active_at; "both open to dating" derives from dual dating-intent, rendered as intent text not a tag.
```

**Flag to Doan:**
- The mutual card payload needs `coord_state` AND whose-move (is the viewer the proposer or receiver on a `proposed` state) to pick the right status line + action.
- Proposer-waiting card pulls the partner's `last_active_at` for "active Xh ago" + the 24h-inactivity copy softening (copy-only, no state change — `21` §B4.2).
- `confirmed_together` is the celebrated state (warm congrats, "Going with [Name]" — `21` §B5.3).
- "Both open to dating" is derived from dual dating-intent and rendered as intent-line text/status, NOT an interest tag — keeps the tag set neutral.
- Tags are neutral everywhere; the only purple tag is the selected state in onboarding/filters.

**Flag to Cindy:** one open call — the "Both open to dating" disclosure styling: (a, recommended) fold it into the intent line as text ("You're both here for friends · both open to dating") vs (b) a distinct small status marker (not a pill tag). Either keeps interest tags neutral; just confirm which.
