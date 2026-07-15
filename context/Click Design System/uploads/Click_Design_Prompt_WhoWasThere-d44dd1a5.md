<!-- "Who was there" — the post-event (Process 2) click surface, 48h window. 27 Jun 2026. Built to the click-design skill. Responsive WEBSITE. Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Source of truth: 21_CLICK_MECHANIC §7B (Process 2), 09, 13 §9. The ONLY surface where a post-event click happens (the event page itself is context-only, no click button). -->
# Click — "Who was there" (post-event click surface, Process 2)

The signature **post-event** moment: after an event you **attended**, a calm surface lets you anonymously **click with people who were actually there** — within a short window. This is the ONLY place a post-event click happens (the event detail page is context-only, no click button). Reached from the **post-event prompt**, not from browsing.

**Grounding:** `21_CLICK_MECHANIC.md` §7B (Process 2), `09`, `13 §9` (privacy rails). Click behaviour + the pending state = the canonical **People Card** rules (`Click_Design_Prompt_PeopleCard.md`); this doc is the SCREEN (entry, attendee grid, gates, states).

**Locked rules (don't deviate):**
- **Attendance-gated:** only people who actually attended AND are visible-to-attendees appear. No-shows and hidden users never show.
- **Anonymous:** a click here is one-way, anonymous-until-mutual — identical to discovery. Never a "likes you" queue, never reveal a one-way click.
- **Magic-protected:** frame the window as "while it's fresh / the people who were actually there" — NEVER expose the 48h timer or a countdown. Opportunity-framed, never loss/urgency.
- **Privacy:** aggregate signals only; NEVER tag a named person with intent/dating; sensitive life tags never shown.
- **Photo encouragement:** if the viewer has no profile photo, nudge them (a face helps people recognise you / place a click) — on-brand, calm, never coral.

```
=== PROMPT (paste under the GLOBAL block from Click_Design_Prompt_FullBuildOut.md) ===
ROLE: Principal product designer. Design Click's "WHO WAS THERE" post-event click surface as a responsive WEBSITE (375 → 1440). Calm, warm, low-stakes, anonymous. Compact per the GLOBAL density. NOT a native app. This is reached from the post-event prompt, never from browsing.

=== ENTRY (the post-event prompt) ===
A gentle prompt = the **shared dashboard moment-banner component** (icon-circle · eyebrow "LAST NIGHT · [EVENT]" · title "Did you click with anyone?" · sub "No rush - just the people who were there." · "See who was there"), NOT nagging. Tapping opens this surface. Headline on the surface: **"Did you click with anyone?"** (the locked string — *click* = connect/hit-it-off) + a calm sub-line **"No rush - just the people who were there."** (🔴 drop "actually"; hyphen not em-dash; never show a timer/countdown.)

=== THE SCREEN ===
1. CONTEXT STRIP — small: the event you attended (thumbnail + title + "you were there"). Quiet, so the focus is the people.
2. ATTENDEE GRID — the people who were there (attendance-gated). The TILE form of the **canonical People Card** (same component, grid layout — there may be 8–20 people). 🔴 **Consistency + UI/UX refresh (Cindy 28 Jun — the render's tiles were airy + tags stale):** each tile = avatar (~56–64, top) · **name ONLY (NO age** — age lives on the profile drawer; the doc previously said "name · age" — corrected) · sentence-case intent label · **up to 3 shared-interest tags at the canonical 22/12 size** (one line + "+N", never the old 28/13) · per-tile primary **"click with [Name]"** (filled Deep Purple, the ONE Button, radius 12) pinned at the tile bottom. **Even padding ~16px, equal-height tiles, footers aligned, NOT tall/airy.** Click → optimistic muted **"clicked"** pending (same footprint, NO ✨, unnamed) + the once-per-screen anonymous line. Canonical People Card behaviour throughout (no bio on the tile; conditional context never fabricated). Tidy responsive grid: 1–2-up mobile / 3-up desktop, consistent gap (16px). Same card quality + tag size + button as the "click with someone" page — just arranged as a grid.
3. ANONYMOUS REASSURANCE — once for the screen: "🔒 Clicking is anonymous — we'll only show you if it's mutual." + a quiet "How clicking works →".
4. PHOTO NUDGE — if the viewer has no photo: a calm Lavender-tint card "Add a photo so people recognise you →" (Deep-Purple link, NOT coral), tied to the mechanic (a face helps when someone you met looks for you). Dismissible.

=== TWO YES-BRANCHES (when you reconnect with someone you actually met) ===
Beyond a plain anonymous click, if you met someone and want to mark it: "We clicked 👍" (offline — you swapped details, done → closure) vs "We clicked — suggest something" (→ the coordination flow, ClickMechanic §C). Calm, optional, never forced.

=== STATES (mock all) ===
- DEFAULT grid (some tiles default, one or two showing the muted "clicked" pending state — same button footprint, no ✨).
- PENDING (you've clicked someone) — the SAME button switches to its muted "clicked" state (no ✨, same footprint, NOT a smaller pill), unnamed, never "you clicked with [Name]". The anonymous reassurance shows ONCE at the top, not on a tile.
- EMPTY — no eligible people (small event / others hidden): warm, not a dead end ("Quiet one — no one to click with here. Your next event is where it happens.").
- DIDN'T-ATTEND / not-eligible — if somehow opened without having attended: a calm note (you click with people from events you went to).
- WINDOW CLOSED — after the window passes: a kind, non-loss line ("This one's wrapped up — catch the next one"). NEVER "expired/you missed it".
- PHOTO-NUDGE present/absent · loading skeleton (tile-shaped).

=== ROMANTIC OVERLAY (10 §4 — only to viewers with Dating mode ON) ===
An aggregate add-on only ("a few people here are open to dating", ≥3), NEVER on a named tile, never to non-dating viewers. No per-person dating tag, ever.

=== RULES ===
- Attendance-gated + anonymous + magic-protected (no timer/countdown shown). NO event-page-style "click with" leak — this IS the post-event click surface, distinct from the context-only event page.
- "click with [name]" (lowercase, single space), muted "clicked" pending (unnamed, no ✨), mutual = Sage "clicked ✨"; "Who's…/Who was there" never "who's clicked in". **Name only on tiles — NO age** (age lives on the profile drawer). Aggregate social proof only; never a named person tagged with intent; sensitive life tags never shown.
- Cream canvas; Deep Purple primary; status colour on badges only; lowercase `click` + ✨ nav; Poppins headings + system body; compact density; refined line icons; real Sydney names, FIRST NAME ONLY no age (Mia, Tom, Priya, Jules, Hassan, Bec); 8pt; ≥44px targets; visible focus; reduced-motion. Light-mode only; web-only (no native chrome).

=== DELIVERABLE ===
The post-event prompt → the Who-was-there grid (default + a pending tile), empty state, window-closed state, the photo nudge, and the two yes-branches. Tiles show name only (no age). Mobile 375 (2-up) + desktop 1024 (3–4-up). Click → pulse → muted "clicked" (no ✨); the anonymous line once at the top. No timer/countdown anywhere.
=== END PROMPT ===
```

## Notes for Cindy
- **This is the only place a post-event click happens** — the event page stays context-only (no click button), so this surface carries Process 2.
- **Attendance-gated + anonymous + no timer shown** — you only see people who were actually there, clicks are anonymous-until-mutual, and the 48h window is never exposed as a countdown (magic-protection).
- **Reuses the People Card behaviour** for the click + pending state, so it's consistent with the discovery surface; the tiles are just a denser grid (more people than the curated 3).
- **The photo nudge** appears here too (it directly feeds this mechanic — a face helps someone you met place a click).
