<!-- Last updated: 2026-06-29 | Revision: v1 (new — adds the RELEASED ["expired"] state as a faded "Past clicks" shelf entry [soft-release, neutral no-loss copy, re-clickable] AND CORRECTS last session's v68 error: dormant was wrongly given a prominent card + "Browse together" CTA — canon [21 §B7] says dormant/released NEVER surface as states, only as quiet content. Establishes the whose-move visibility hierarchy [loud=your move · visible=a plan · quiet=no action · faded=history] and the dashboard one-banner / consolidate-2+ discipline. Source of truth: 21_CLICK_MECHANIC §B6 (dormant) + §B7.6 (soft release) + §B7 (status surface "never shown these words"), CLICK_LANGUAGE §5a (no loss-frame), CLICK_LIFECYCLE_PROCESS_MAP state table, Dashboard prompt (one-banner rule). ) -->
# Click — claude design prompt: expired/released ("Past clicks") + dormant correction + dashboard banner discipline

> Paste into the claude-design project after the GLOBAL block. Three-part: **(1) add the RELEASED state as a faded "Past clicks" shelf entry, (2) CORRECT dormant to be quiet content not a prominent CTA card [fixes a v68 error], (3) enforce the dashboard one-banner / consolidate-2+ rule.** 🔴 Binding canon: `21` §B7 — *"the user is NEVER shown these state words; `dormant` and `released` never surface as states — they surface as content (a quiet 'Past clicks' shelf) or not at all."* Visibility follows whose-move.

---

## The principle this enforces (your "next step must be clear, can't be drowned out")

Visibility = whose move it is. This is what KEEPS the next step clear — the quiet states recede so the real action stands alone:

| State | Your move? | Visibility |
|---|---|---|
| `proposed` (they suggested) | **Yes — respond** | **LOUD** — top priority, lavender accent border, prominent action |
| `open` (suggest a plan) | Yes — start | Prominent |
| `confirmed_together` (a plan) | No (a reward) | Visible, celebrated (warmest card) |
| `proposed` (you proposed, awaiting them) | No — calm wait | **Quiet** — reduced, "active Xh ago", no CTA |
| `dormant` | **No — the system is working it** | **Near-invisible** — quiet line, NO CTA card (🔴 correction below) |
| `released` ("expired") / `connected` | No — history | **Faded** — "Past clicks" shelf |

## A. RELEASED — the "expired" state (your "fade out" instinct, done to canon)

🔴 There is **no loud "expired" state** — the canon term is **soft release** (`21` §B7.6). After 7 days of total silence a mutual quietly drops to a **"Past clicks" shelf**:
- **Faded treatment** — reduced opacity, smaller avatar, no border emphasis, transparent/very-light card. It RECEDES; it does not announce a failure. (Your "fade out" = exactly right.)
- **Neutral, no-fault copy (locked, `CLICK_LANGUAGE` §5a):** "Still out there - if you cross paths again, you can pick it back up." 🔴 NEVER "expired", "winding down", "you missed your chance", "didn't line up" — loss-framing is banned.
- **Re-clickable** if they meet again (after the 30-day cooldown). The shelf is history, not a graveyard.
- Sits in the **"Past clicks"** section alongside `connected` ("We clicked 👍") — both are quiet history. `connected` is a *win* at rest, `released` is a no-fault lapse; neither shouts.
- 🔴 **Never-seen mutual exception** (`21` §B7.6a): if a user reached release without ever seeing the mutual existed, the FIRST time they'd see it, surface a one-time interstitial — "you two clicked - you just hadn't seen it yet" — as a live opportunity, NOT a faded shelf entry. (Read-time branch; flag to Doan, see below.)

## B. DORMANT — the correction (🔴 fixes a v68 error)

🔴 **Last session's prompt + README gave dormant a prominent card with a "Browse together" CTA. That was WRONG** — canon (`21` §B6/§B7) says dormant "never surfaces as a state"; it's a warm lead the SYSTEM works (re-checks every 4h, auto-revives the moment an event fits). There is **no required user action**, so it must NOT compete with real next steps. Correct treatment:
- **Quiet, near-invisible** — a reduced single line at most ("New events drop weekly - we'll nudge you when one fits"), NOT a CTA card, NOT a banner, NOT in the prominent "your move" zone.
- The optional "browse events together" affordance MAY exist as a quiet text link (manual propose still works) but is NOT a primary button and never draws the eye from a real next step.
- 🔴 **Dormant NEVER becomes a dashboard banner** (it's not your move). It lives — quietly — only on the "Your clicks" page, low in the order, if shown at all.
- When the system auto-revives it (`open` again, an event found), THEN it can surface normally as an `open` "Suggest a plan" — because now it IS your move.

## C. Dashboard banner discipline (your "don't overload with banners")

Canon (Dashboard prompt + `09`): the moment-banner is **state-aware, surfaces ONLY your-move states, ONE banner at a time**, and consolidates when several need you:
- 🔴 **Only YOUR-MOVE states become banners:** a fresh mutual ("Suggest a plan"), their proposal ("See their plan"), an agreed plan ("RSVP"). `dormant`, `released`, proposer-waiting, `connected` NEVER become banners.
- 🔴 **ONE banner at a time.** Never stack.
- 🔴 **2+ mutuals waiting on you → ONE consolidated banner:** "[Name] and [Name] are waiting on you ✨ · See your clicks →" routing to the "Your clicks" page — never two banners. (Research: aggregate, don't pile.)
- The dashboard shows the single highest-priority your-move moment; everything else lives on the "Your clicks" page where the full whose-move hierarchy (§ above) applies.

---

## States to mock

1. **"Your clicks" page** — the full hierarchy in order: loud (their proposal, then open) → visible (a plan, celebrated) → quiet (you-proposed waiting, dormant as a faded line) → faded "Past clicks" shelf (connected "We clicked 👍" + released "Still out there…").
2. **Released card** — faded, neutral copy, on the shelf.
3. **Dormant** — the corrected quiet treatment (a reduced line, no CTA card), low in the order.
4. **Dashboard** — ONE your-move banner (e.g. "See their plan"); then the consolidated variant ("[Name] and [Name] are waiting on you → See your clicks") proving 2+ never stacks.
5. **Never-seen-mutual interstitial** — the one-time "you two clicked - you just hadn't seen it yet" recovery (distinct from the faded shelf).
6. Mobile + desktop.

---

## Checklist (must all hold)

- 🔴 No loud "expired" state — `released` is a FADED "Past clicks" shelf entry, neutral no-loss copy ("Still out there…"), re-clickable; never "expired"/"missed"/"winding down".
- 🔴 Dormant is QUIET — no CTA card, no banner, never in the your-move zone (corrects v68). It's the system's job, not the user's.
- 🔴 Dashboard: only your-move states banner; ONE at a time; 2+ → one consolidated banner → "Your clicks".
- 🔴 Visibility follows whose-move (loud / visible / quiet / faded) — the real next step is never drowned by no-action states.
- Never-seen mutual gets a recovery interstitial, not a silent shelf decay.
- The user never sees the words dormant/released/open/proposed; they see a plan, an invite waiting, people to discover, and a quiet past-clicks shelf.
- Hyphens not em-dashes; tags neutral; one ✨ at peaks; 🎉 ≠ ✨; 8pt; ≥44px; reduced-motion; light mode.

---

## DO I NEED TO UPDATE EXISTING PROMPTS? (your question — yes, these)

1. 🔴 **`Click_Design_Prompt_MutualCard_StatusStates.md` (last session's v68)** — CORRECT the dormant row: it currently gives dormant a status line + "Browse together" primary action as if it's a normal card state. Change to: dormant is quiet/near-invisible, no CTA card, low order. (This is the main correction.)
2. 🔴 **`Click_Design_Prompt_ClickMechanic.md`** — ensure the lifecycle surfaces match: released → faded Past-clicks shelf (neutral copy), dormant → quiet not prominent, the never-seen interstitial exists.
3. 🔴 **`Click_Design_Prompt_Dashboard.md`** — reinforce: dormant/released/proposer-waiting/connected NEVER banner; only your-move states; one banner; 2+ → consolidate. (The one-banner rule is already there; add the explicit "which states never banner" list.)
4. 🔴 **`CLAUDE_DESIGN_README_CANONICAL.md` §4 People Card / §5** — CORRECT the v68 edit that described dormant as a surfaced card state with a "Browse together" CTA; align to "dormant/released never surface as states, only as quiet content / the Past-clicks shelf."

(No TECH spec changes — `21`/`09` already define all of this; the design side was out of step. This is design catching up to canon, not changing it.)

---

## FILES TO COMMIT (after Cindy signs off)

- `UIUX/Cowork/Click_Design_Prompt_MutualCard_StatusStates.md` — correct the dormant treatment (quiet, no CTA); add the released/Past-clicks shelf + visibility hierarchy. Bump header + rev note.
- `UIUX/Cowork/Click_Design_Prompt_ClickMechanic.md` — released shelf + dormant-quiet + never-seen interstitial. Bump.
- `UIUX/Cowork/Click_Design_Prompt_Dashboard.md` — the "which states never banner" list + consolidate-2+. Bump.
- `UIUX/CLAUDE_DESIGN_README_CANONICAL.md` — correct the dormant line in §4/§5 to "quiet content, never a surfaced state"; add released → Past-clicks shelf.
- `UIUX/UIUX_CHANGELOG.md` (v68 → v69) — new row + header bump (below).
- Suggested commit message: `design: released→faded Past-clicks shelf (no loss-frame) + CORRECT dormant to quiet content not a CTA card (v68 fix) + dashboard one-banner/consolidate discipline`

### Changelog row to add to `UIUX_CHANGELOG.md` (newest-first)
```
| 29 Jun 2026 | cowork/ MutualCard_StatusStates, ClickMechanic, Dashboard; CLAUDE_DESIGN_README_CANONICAL | **Released ("expired") shelf + dormant CORRECTION + dashboard banner discipline (Cindy).** RELEASED state = a FADED "Past clicks" shelf entry (soft-release per 21 §B7.6 — neutral no-loss copy "Still out there - if you cross paths again, you can pick it back up", re-clickable; NEVER "expired"/"missed"/loss-framed per CLICK_LANGUAGE §5a). Cindy's "fade out" = canon. 🔴 CORRECTION of v68: dormant was wrongly given a prominent card + "Browse together" CTA — canon (21 §B6/§B7) says dormant/released NEVER surface as states, only as quiet content; dormant is now QUIET/near-invisible (no CTA card, never a banner — the system auto-revives it every 4h; not the user's move). Established the whose-move visibility hierarchy: LOUD (their proposal / open = your move) · VISIBLE (a plan, celebrated) · QUIET (you-proposed waiting, dormant) · FADED (Past clicks: connected + released). 🔴 Dashboard banner discipline: ONLY your-move states banner (dormant/released/proposer-waiting/connected never do); ONE banner at a time; 2+ waiting → ONE consolidated "[Name] and [Name] are waiting on you → See your clicks". Added the never-seen-mutual recovery interstitial (21 §B7.6a) instead of silent shelf decay. **Flag to Doan:** released → Past-clicks shelf (status='released'); dormant is NOT surfaced as an actionable state; never-seen mutual = read-time branch on seen_at_a/seen_at_b → one-time interstitial; dashboard banner picker = your-move states only, consolidate 2+.
```

**Flag to Doan:**
- `released` mutuals (7-day soft release, `21` §B7.6) → the faded "Past clicks" shelf; re-clickable after 30d cooldown; neutral copy only.
- `dormant` is NOT surfaced as an actionable state — no CTA card, no banner; the 4h `click-scores-rebuild` auto-revives it to `open`, at which point it can surface as a your-move "Suggest a plan".
- Never-seen mutual: read-time branch on `seen_at_a`/`seen_at_b` (`21` §B7.6a) → one-time recovery interstitial, not a silent shelf entry.
- Dashboard banner picker: surface ONLY your-move states (`open` fresh-mutual / `proposed`-receiver / `confirmed_together`-needs-RSVP); ONE banner; 2+ → one consolidated banner routing to "Your clicks". `dormant`/`released`/proposer-waiting/`connected` never banner.

**Flag to Cindy:** this prompt CORRECTS last session's dormant treatment (v68 made it a prominent CTA card; canon says it should be quiet). Flagging so the change from what you saw last turn is deliberate and visible, not a silent reversal.
