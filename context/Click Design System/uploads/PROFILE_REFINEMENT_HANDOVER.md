<!-- Click profile refinement handover. 28 Jun 2026. What changed, what to paste, what to commit, what to flag. Hyphens, not em-dashes. -->

# Click profile - refinement handover (28 Jun 2026)

Reworked the profile into ONE content model across THREE surfaces, split display from edit, switched the viewer to a centered modal, refreshed the own-profile visually, and propagated the modal change site-wide.

## What changed
- **Three surfaces, one content model:**
  - Own profile = a PAGE: a calm read-only-style preview of you + one "Edit profile" button. NO inline controls.
  - Viewing someone = a CENTERED MODAL (was a right-side drawer): read-only public subset + "click with [name]", shows the profile whole, keeps list context, no page load. One component opened from the click-with-someone list AND event attendees.
  - Profile edit = its OWN page: all editable fields PLUS the controls that were floating on the display - "Open to dating" toggle, "Show me in event attendee lists" toggle, dating preferences (gated), and the Privacy link.
- **Removed the photo-clicks nudge entirely** ("Add a few more - profiles with photos get far more clicks"). The only photo prompt now lives on Profile Edit and is gentle.
- **Intent chips** get a Lavender-tint fill so they read above interests, but stay display chips - deliberately NOT styled like the tappable "Type" filter buttons (affordance confusion).
- **Own-profile visual refresh:** cut the duplicate SUBURB/CITY row, removed the spark on the "Your profile" chip, tightened to one consistent 8pt section rhythm, left-aligned single column, balanced whitespace.

## Files
- NEW `Cowork/Click_Design_Prompt_Profile.md` (rewritten v3) - the two DISPLAY surfaces.
- NEW `Cowork/Click_Design_Prompt_ProfileEdit.md` - the edit page + all controls.
- EDITED (propagation - viewer is now a centered modal, not a drawer): `Cowork/Click_Design_Prompt_PeopleCard.md`, `Cowork/Click_Design_Prompt_ClickMechanic.md` (§F + the on-a-click-surface line + §E people-card refs), `Cowork/Click_Design_Prompt_EventDetail.md` (attendee tap), `Cowork/Click_Design_Prompt_Dashboard.md` + `Cowork/Click_Design_Prompt_WhoWasThere.md` (the "age is on the profile modal" refs), `Cowork/Click_Design_Prompt_FullBuildOut.md` (nav/modal rule, per-screen index + the own/edit line).
- The coordination drawer is unchanged - it is correctly still a drawer; only the PROFILE viewer became a modal.

## A. Paste into claude design (in this order)
1. `Cowork/Click_Design_Prompt_Profile.md` - own profile page + viewing-someone centered modal + visual refresh.
2. `Cowork/Click_Design_Prompt_ProfileEdit.md` - the new edit page (default + the dating-on variant).
Both are two-part (update the project design system / README first, then render at all breakpoints). If renders still show a side-drawer or the old mixed profile, the project README is stale - re-paste `CLAUDE_DESIGN_README_CANONICAL.md`.

## B. Commit to GitHub (cndykm/click-tech)
Files: the two new `Profile.md` / `ProfileEdit.md`, plus the five propagated prompts (PeopleCard, ClickMechanic, EventDetail, Dashboard, WhoWasThere, FullBuildOut), plus `UIUX_CHANGELOG.md`.
Suggested message:
`design(profile): one model / three surfaces - viewer centered modal, split edit page, visual refresh; propagate modal site-wide`

### Changelog entry (draft)
> **Profile rework (one model, three surfaces).** Own profile = read-only-style PAGE + "Edit profile"; viewing someone = CENTERED MODAL (was a right-side drawer) shown whole, launched identically from the click-with list and event attendees; NEW Profile Edit PAGE now owns every control (Open-to-dating toggle, Show-me-in-attendee-lists toggle, dating preferences, Privacy link) - the display holds none. Removed the "profiles with photos get far more clicks" nudge everywhere (gentle prompt now only on Edit). Intent shown as Lavender-tint display chips (above interests, not filter-button styled). Own-profile visual refresh (cut duplicate location row, removed decorative spark, tightened 8pt rhythm). Propagated drawer -> centered modal across PeopleCard / ClickMechanic §F / EventDetail / Dashboard / WhoWasThere / FullBuildOut. Coordination drawer unchanged.

## C. Flags to Doan (build)
- The viewer profile is a **centered modal** (not a route, not a drawer): focus-trap + restore-to-trigger on close; ✕/Esc/scrim dismiss without navigating.
- Display vs edit separation is now a hard rule: the profile display renders NO toggles/privacy; those live on the Edit page only. The "Open to dating" + "Show me in attendee lists" + dating preferences controls move to Edit.
- Intent labels remain the canonical six (CLICK_LANGUAGE §6.3) - Edit reuses onboarding's set, no rewording.
- No behaviour change to the coordination drawer.
