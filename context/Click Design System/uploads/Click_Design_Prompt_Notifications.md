<!-- Notifications — the bell + panel + push. 27 Jun 2026. The global notification surface the click mechanic + booking + waitlist feed into. Responsive WEBSITE (no native push dialogs). Brand-locked: CLICK_PALETTE / CLICK_TYPE / CLICK_LANGUAGE. Refs: ClickMechanic (mutual/proposal), EventDetail/Booking (waitlist/reminders), 21_CLICK_MECHANIC, 22_ANALYTICS. Grounded in notification-UX best practice (PatternFly / Smashing / Courier / MagicBell): consistent masthead entry, dot-not-count for low volume, read/unread distinction, group by time, mark-all-read, badge clears on interaction, calm cadence (no flooding). -->
# Click — Notifications (the bell + panel + push)

The calm signal layer. It exists mainly to make the **mutual** unmissable (the dopamine moment a user might otherwise miss), plus the other time-sensitive moments. **Positive-only, never a flood, magic-protected.** The whole system is judged by how it behaves over time, not how one row looks — Click earns trust by being quiet and only ever good news.

**🔴 Non-negotiables (brand + mechanic):**
- **Positive-only.** NEVER notify a one-way click ("someone clicked you" / "likes you") — only the MUTUAL. Never "[X] isn't feeling it", never any rejection/verdict. Anonymity + psychological safety hold (research: dating apps show matches, never rejections).
- **Calm cadence — no FOMO flood.** Group, threshold, and rate-limit. A handful of meaningful signals, never a stream. The brand bans urgency/loss framing — notifications follow.
- **Outcomes + one warm line.** Never expose internal rules (windows, caps, ranking). Link to the relevant surface, not an explanation.
- Web push is **optional + sparing** (post-permission) — NOT a native push-permission dialog on load; a calm in-product "turn on notifications?" ask at a good moment.

```
=== PROMPT (paste under the GLOBAL block from Click_Design_Prompt_FullBuildOut.md) ===
ROLE: Principal product designer. Design Click's NOTIFICATION system for a responsive WEBSITE (375 → 1440) — a bell in the top nav + a panel + the row anatomy + states. Calm, warm, low-volume, trustworthy. NOT a native app (no OS push-permission dialog; web patterns only).

=== THE BELL (masthead entry — consistent, discoverable) ===
- A line-icon BELL in the top nav, right side, just left of the avatar (the place people already look). Same position every page.
- UNREAD INDICATOR: a small **Deep-Purple/Lavender DOT** for "something new" (low volume — a dot, not a number). Only if several unread, a small count badge ("3"). 🔴 The badge **CLEARS once the user opens the panel** (interaction resolves it) — never a stale count.
- aria-label "Notifications, N unread"; keyboard-focusable; the dot is not the only signal (the aria count carries it for SR).

=== THE PANEL (a dropdown on desktop, a sheet on mobile — NOT a new page) ===
- DESKTOP: a panel ~360–400px wide, right-aligned under the bell, soft low shadow, cream surface, rounded; opens/closes by toggling the bell; Esc / click-outside closes; focus moves into the panel.
- MOBILE: a full-width bottom/right SHEET (web pattern, not native), same content.
- HEADER: "Notifications" + a quiet **"Mark all as read"** (right). Optional small "settings" gear → notification preferences.
- GROUPED by time, newest first: **Today** · **Earlier** (light Slate eyebrows). Auto-archive read items after ~30 days.
- EMPTY STATE: calm, warm — "You're all caught up." (no ✨ — not a peak), a small line icon.
- LOADING: 2–3 calm skeleton rows.

=== ROW ANATOMY (one consistent row) ===
[ avatar OR a small type-icon ] · [ one-line text — outcome + warm, Ink, name where relevant ] · [ timestamp, Slate, right or under ] — the WHOLE row is tappable → the relevant surface.
- READ vs UNREAD must differ visually: **unread = a subtle Lavender-tint row + a small leading dot; read = plain.** Opening the panel marks seen; tapping a row marks it read.
- ✨ appears ONLY on a genuine peak row (mutual / both-going) — never decoratively; max one per row.

=== NOTIFICATION TYPES (Click's real set — positive-only) ===
- ✨ **Mutual** (the key one): "✨ You clicked with Mia — suggest a plan." → opens the reveal / coordination drawer (ClickMechanic §B/§C). This is the row the whole bell exists for.
- **Proposal received:** "Mia suggested Greenhouse terrarium — you in?" → the coordination drawer.
- ✨ **Both going:** "You're both going to Greenhouse terrarium." → the plan / event.
- **Post-event prompt:** "Good night at Pasta from scratch? Did you click with anyone?" → Who-was-there.
- **Waitlist offer (time-sensitive):** "A spot opened at Wheel throwing — you've got 30 minutes." → the event. (The 30-min is real + honest, not fake urgency.)
- **Event reminder:** "Wheel throwing is tomorrow, 6:30pm — venue's unlocked." → the event.
- **Light milestone** (occasional): a warm, low-key line. Never streaks/points.
- 🔴 NEVER: a one-way click, "someone viewed your profile", "[X] isn't feeling it", any rejection, any internal-rule exposure.

=== WEB PUSH (optional, sparing, post-permission) ===
- A calm in-product ask at a good moment ("Want a heads-up when someone clicks back? Turn on notifications.") — NOT an OS dialog on first load. Web push only.
- Push copy is the locked strings, used sparingly: mutual = **"It's mutual — you clicked with [Name]. ✨"**; waitlist offer; post-event prompt. Never marketing blasts.

=== STATES (mock all) ===
Bell with a dot (unread) · bell clean (no unread) · panel OPEN with a mix of unread + read rows grouped Today/Earlier (incl. a ✨ mutual row, a proposal row, a waitlist-offer row, a post-event row) · empty "You're all caught up" · loading skeletons · the in-product "turn on notifications?" ask · mobile sheet. At 375 + 1440.

=== RULES / CRAFT ===
- Positive-only; never a one-way click; never a flood; outcomes + warm line; never internal rules.
- Cream panel; Deep-Purple/Lavender unread tint + dot; status colour never used here except a Sage tick on a "both going"; Poppins for the "Notifications" header, system body for rows; 8pt; refined line icons; ≥44px tap rows; visible focus; reduced-motion; light-mode; web-only (no native push dialog).
- The bell is the SAME component on every page (per GLOBAL consistency). Badge clears on open.
=== END PROMPT ===
```

## Notes for Cindy
- **Why the bell matters now:** the click flow leans on it — a mutual that happens while you're away has to reach you, or the magic moment is lost (research: a delayed/missed match notification kills the reward). The bell + the dashboard "you clicked with [Name] → suggest a plan" surfacing together make it unmissable.
- **It stays on-brand by being quiet:** positive-only, low-volume, no FOMO flood, no rejection ever — trust comes from the system only ever bringing good news.
- **Web, not native:** the bell + panel are web patterns; push is optional and asked for calmly in-product, never an OS dialog on load.
- **Indexed** in `Click_Design_Prompt_FullBuildOut.md` (Phase 2). The bell is added to the GLOBAL nav so it's consistent site-wide.
