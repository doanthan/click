<!-- Click - Quiz refinement handover. What changed, what to commit, what to paste, what to flag to Doan. Hyphens, not em-dashes. -->

# Click quiz - refinement handover (28 Jun 2026)

The Click quiz was audited and rewritten: architecture (modal, not page), reorder (fun first / sensitive last), 6 steps -> 5, microcopy cleaned, dating preferences gated, assumptive and fragile-state and sensitive questions cut, spark glyph and em-dashes removed. Full paste prompt: `Click_Design_Prompt_Quiz.md`.

## The three decisions - resolved (applied as defaults; change if you disagree)
1. **LGBTQ+ question:** KEPT, moved to the last step, options Yes / No / Prefer not to say, explainer replaced with one non-revealing line ("Optional and private to you - it helps us keep events welcoming"). The old "we quietly let others know" copy is gone.
2. **Connection intent:** Step 3 should CONFIRM/EDIT the intent already set at onboarding - single source of truth, same wording everywhere. Do not let the quiz copy diverge from onboarding/Settings.
3. **Pet question:** kept but flagged - remove if it isn't actually used by matching or a connector.

## A. What to paste into claude design
Paste `Click_Design_Prompt_Quiz.md` as one block. It is two-part: (1) update the project's design system / README first, then (2) re-render the quiz modal + dashboard entry card + Settings row across all breakpoints. If renders still drift, the project's internal design-system pages are stale - re-paste `CLAUDE_DESIGN_README_CANONICAL.md` rather than re-pasting the screen prompt.

## B. What to commit to GitHub (cndykm/click-tech)
- `UIUX/Cowork/Click_Design_Prompt_Quiz.md` - NEW prompt file (add to the per-screen index in `Click_Design_Prompt_FullBuildOut.md`).
- `UIUX/UIUX_CHANGELOG.md` - new top entry (draft below).
- Canon edits (see flags) once Doan/you confirm: `UIUX/CLICK_LANGUAGE.md`.

Suggested commit message:
`design(quiz): rework Click quiz - modal arch, reorder, gated dating prefs, cut sensitive/assumptive Qs, microcopy + brand-lock pass`

### Changelog entry (draft)
> **Quiz rework.** Click quiz formalised as a full-screen modal (dashboard + Settings entry, auto-save/resume, editable). Reordered fun-first / sensitive-last; 6 steps -> 5 (availability + distance merged). Cut: disguised age question, fragile-state life tags (recently single / navigating a big change), living-situation question, LGBTQ+ community-signal explainer. Added: intent-neutral "what brings you to Click?" with "Open to dating" gating a dating-preferences sub-block (who you'd like to meet + age range). Endowed-progress bar (pre-filled, fast-early). Removed all spark glyphs (decoration) and em-dashes from quiz surfaces; privacy line reframed from defensive to desire-led.

## C. Flags to Doan (spec / build / control-doc)
- **`CLICK_LANGUAGE.md`:** add the canonical intent set - "Doing more of what I love / Meeting new people / Making local friends / Growing my circle / Networking / Open to dating" - as the single source used by onboarding, the quiz, and Settings ("Open to dating" always last, never foregrounded). Bump header + changelog row per MAINTENANCE_PROTOCOL.
- **Data / schema:** quiz writes to `personality_profiles` (room/social-style/availability/distance/mood), `profiles.connection_intent` (array), and `profiles.dating_preference` (gated: meet + age range). Dating sub-block only writes when "Open to dating" is in `connection_intent`. Confirm intent's master is onboarding so the quiz confirms rather than re-asks.
- **Cut fields:** ensure removed questions (age-proxy, fragile-state tags, living situation, LGBTQ community-signal) are not expected by any matching code. Reconfirm the locked principle that fragile/vulnerable life tags are not collected.
- **Pet:** decide if `pet` is used by matching; cut from the quiz if not.
- **LGBTQ+:** confirm the concrete, privacy-safe use before it ships as a stored field; it must never become a label on a person (consistent with accessibility-as-functional-attribute principle).

## Self-critique (passed)
Rubric + microcopy vibe-check run: no em-dashes, no machine reveals (timers/caps/ranking), no fragile tags, intent-neutral (open-to-dating 1 of 6, last), spark only at the three peaks (none in quiz), sensitive questions last + optional + "prefer not to say", endowed progress, immediate payoff at finish via the canonical Event Card.
