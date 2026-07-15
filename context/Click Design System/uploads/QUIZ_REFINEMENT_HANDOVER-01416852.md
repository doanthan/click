<!-- Click persona quiz - refinement handover. 28 Jun 2026. What changed, what to paste, what to commit, what to flag. Hyphens, not em-dashes. -->

# Click persona quiz - refinement handover (28 Jun 2026)

The quiz was audited, reconciled against canon, and rewritten. Paste prompt: `Cowork/Click_Design_Prompt_Quiz.md`.

## The big reconciliation (this changed the design)
Canon already defines two things my first pass had wrongly put in the quiz:
- **The "Click persona quiz" is already a planned item**, deferred from onboarding to the dashboard "finish setting up" checklist (`Cowork/Click_Design_Prompt_HowItWorks_Onboarding.md` line 60). So this quiz IS that, and launching it as a modal from the dashboard + Settings is correct.
- **Intent + gated dating preferences already live in ONBOARDING Step 2** - the six intent cards (multi-select `connection_intent` array: Open to dating · Friends · Locals · Activities · Networking · "Here to meet people, not to date") and the "Open to dating -> interested in Men/Women/Everyone + age range + visibility toggle" sub-block, edited later in Settings. The gating Cindy asked for ALREADY EXISTS there. The quiz must NOT re-ask it (single source of truth - duplicating it = drift). The quiz now stays intent-neutral and contains no intent/dating question.

Net: the quiz only adds the personalisation layer onboarding doesn't - room preference, social style, social mood, availability, travel range, optional life-chapter. Nothing onboarding already owns (no name/age/gender/location/intent/dating/interests).

## Architecture
Full-screen modal takeover (not a page, not a small popup), launched from the dashboard checklist card and a Settings row. Auto-save/resume, every question optional, editable anytime. Endowed (pre-filled) progress bar, fast-early - same pattern as onboarding.

## Decisions resolved (change if you disagree)
1. **LGBTQ+:** kept, moved last, Yes / No / Prefer not to say, soft non-revealing line. It is a SENSITIVE life tag - never shown on a person (08). Old "we quietly signal others" copy removed.
2. **Intent / dating prefs:** NOT in the quiz - confirmed they belong to onboarding/Settings. No duplication.
3. **Pet:** kept but flagged - cut if matching doesn't use it.
4. **Finish spark:** "You're all set ✨" carries ONE trailing spark, matching the onboarding done screen (CLICK_LANGUAGE v21 sanctions the completion celebration as a spark moment). No spark anywhere else in the flow.

## A. Paste into claude design
Paste `Cowork/Click_Design_Prompt_Quiz.md` UNDER the GLOBAL block. Two-part: (1) update the project design system / README, then (2) render the quiz modal + dashboard checklist card + Settings row at all breakpoints. If renders drift, re-paste `CLAUDE_DESIGN_README_CANONICAL.md` (the project reads its own README first).

## B. Commit to GitHub (cndykm/click-tech)
- `UIUX/Cowork/Click_Design_Prompt_Quiz.md` - NEW.
- `UIUX/Cowork/Click_Design_Prompt_FullBuildOut.md` - add the quiz to the per-screen index (one row).
- `UIUX/UIUX_CHANGELOG.md` - new top entry (draft below).
- Delete the earlier mis-placed copies if they were synced (they were written to `Documents\CLAUDE\CLICK`, not the repo).

Suggested message:
`design(quiz): add Click persona quiz modal - personalisation layer only (no onboarding-owned fields), reorder + microcopy + brand-lock pass`

### Changelog entry (draft)
> **Click persona quiz (modal).** Formalised the dashboard-checklist persona quiz as a full-screen modal (dashboard + Settings entry, auto-save/resume, editable, endowed progress). Reconciled with canon: removed the intent question + dating sub-block (onboarding Step 2 + Settings own these - the quiz must not duplicate them). Reordered fun-first / sensitive-last; merged availability + distance; cut the disguised-age question, fragile-state tags (recently single / navigating a big change) and the living-situation question; LGBTQ+ moved last, optional, softened (sensitive life tag - never shown on a person). Removed spark decoration (kept only the sanctioned finish celebration "You're all set ✨") and all em-dashes; privacy line reframed desire-led.

## C. Flags to Doan (spec / build)
- **Schema:** quiz writes to `personality_profiles` (room / social-style / mood / availability / travel-range) and non-sensitive life tags. It must NOT write `connection_intent` or `dating_preference` (onboarding/Settings own those).
- **Life tags:** "New to Sydney / New parent / Student / Recently retired" = non-sensitive life tags (silent; only surface post-mutual as shared, per 08). LGBTQ+ = SENSITIVE life tag - confirm a concrete, privacy-safe use (e.g. the shared-viewer belonging signal) before storing; never a label on a person.
- **Pet:** confirm matching uses it, else cut.
- **No new intent vocabulary** introduced - onboarding's six labels remain the single source (CLICK_LANGUAGE §6.3).

## Self-critique (passed)
Rubric + microcopy vibe-check: no em-dashes; no machine reveals; no fragile tags; intent-neutral (no intent/dating in quiz at all); spark only at the sanctioned finish; sensitive last + optional + "prefer not to say"; endowed progress; payoff at finish via the canonical Event Card; no onboarding duplication.
