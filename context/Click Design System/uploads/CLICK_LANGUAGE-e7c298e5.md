<!-- Last updated: 2026-06-28 | Revision: v17 (NEW §5b rejection-proof framing rule [Cindy 28 Jun — reduce rejection fear for socially anxious / introverted readers]: anywhere we describe the click, frame a non-mutual outcome as private + costless and lead with the upside ["you only ever hear about the people who clicked with you too"], never plant the could-be-no ["tells you if the feeling was mutual", "if they feel the same", "find out if they liked you back" all banned]; welcome quiet/anxious readers by making them feel safe, never by labelling them [no "for the shy/lonely", "beat your anxiety", "find your tribe"]. Applied to How It Works v3. Flag to Doan — control doc, applies site-wide.) Plus v16 (Acquisition CTA "Join the waitlist" → "Request an invite" [Cindy 28 Jun — invite-only brand, active/exclusive framing; distinct from the per-event "Join waitlist" action]. + Out-of-area signups are NEVER blocked: anyone in Sydney can request an invite; out-of-area suburb/postcode still completes + confirms "we'll tell you the moment Click reaches you" [Landing + onboarding, consistent]. Part of the microcopy audit batch 1 [Landing + How It Works]. Flag to Doan — control doc.) Plus v15 (Your-clicks list cards [Live mutuals / Plans / Past clicks] carry NO name-adjacent state pill [Cindy 28 Jun]: section header + quiet state accent + action carry the state; banned card pills "You two clicked"/"You both clicked"/"You're both going"/"We clicked 🔥"/"Released gently" + no ✨ on a list card; "We clicked 👍" stays only as the closure action. Flag to Doan — control doc.) Plus v14 ("Open to dating" displays ONLY when BOTH people have dating mode on — site-wide [Cindy]: a friends-only viewer never sees a dating label anywhere; intent-neutral + mutual-opt-in. Flag to Doan [10/12].) Plus v13 (mutual headline/push/notification "You two clicked." → "You clicked with [Name]." [Cindy: warmer, names the person, drops couple-y "you two", intent-neutral; applies to reveal + push + dashboard nudge + bell]. Flag to Doan — control doc, propagate to 09/21/build.) Plus v12 (pending click label → just "clicked" [NO ✨ — pending isn't a peak]; mutual persistent card-state → "clicked ✨" [Sage, shortened from "You two clicked ✨"; the "You two clicked." headline stays on the reveal moment]; anonymous reassurance shows ONCE at section top, never per-card; "Sold out" is a STATE/badge never a button — full event action = "Join waitlist" → "Joined waitlist"; ✨ usage rule updated [pending none, mutual one]. Flag to Doan — control doc.) + v11 (pending click card-state clarified: it is the click button in its quiet PENDING treatment — SAME footprint as the live "click with [name]" button, only colour+label change, NOT a separate smaller pill [the pill mis-read as a confirmation]; must read pending/unresolved, never confirmed/mutual. + added the locked ✨-usage rule: max one ✨ per element, never decoration, concentrate at the three peaks. Flag to Doan — control doc.) + v10 (post-event prompt → "Did you click with anyone?" (supersedes "Who'd you click with?"); clarified click=connect is the encouraged mechanic sense, only the literal button-tap "click" is banned. + v9: UI chrome lowercased: nav "✨ click", header "click with someone", button "click with [name]", pill "clicked ✨" — the mechanic/feeling is lowercase in UI labels, only the platform name stays capital "Click". + v8: pending "clicked ✨" + anonymous helper. + v7: Events-vs-"plans". + v6: RSVP CTA. Control doc — flag to VERSION_CHANGELOG.) | prior: v4 click-action-button surface ref -->
# Click — Language Reference & Site Audit Guide
## `CLICK_LANGUAGE.md` — canonical, single source of truth
**Purpose:** Use this document to review any page, UI string, notification, or code identifier and determine whether it uses Click language correctly. Written to be handed to Claude (or any reviewer) alongside site copy or a codebase.
**Last updated:** June 2026 (lifecycle strings + §5a framing rule added)
**Conflicts:** If any other document contradicts this one, this one wins.

---

## 1. The three meanings — never confuse them

| Word | Meaning | Capitalisation | Example |
|---|---|---|---|
| **Click** | The platform | Capital C in all prose. Lowercase permitted in the wordmark/logo only. | "Click launches in Sydney this year." |
| **click** | The feeling / the mechanic — connecting / hitting it off with someone (click = connect) | Always lowercase | "We just clicked." / "Did you click with anyone?" / "You clicked with [Name]." — the connect sense is the core verb and is ENCOURAGED; only the literal button-tap sense (below) is banned. |
| *(avoid)* | The literal mouse/tap action | — | Never use "click" for UI interaction. Use **tap**, **select**, or **choose**. This is mandatory — it's what keeps the brand verb unambiguous. |

**The capitalisation split is functional, not cosmetic:** *"Click is where you find your next click"* only works because the two are distinguishable.

**UI chrome follows the feeling rule (locked 27 Jun):** because the nav item, the page header, and the action button all name the *mechanic/feeling*, they render **lowercase** — nav **"✨ click"**, header **"click with someone"**, button **"click with [name]"**, pill **"clicked ✨"**. The ONLY capital-C "Click" in the product is the platform name in prose and the wordmark/logo. (A UI label may sit at the visual start of an element but it is still the verb, so it stays lowercase — this is intentional brand stylisation, not a typo. In running prose, normal sentence-start capitalisation still applies to the platform name.)

---

## 2. The one binding grammar rule

> It is always **"click with someone."** Never "click on someone."

"With" is mutual by grammar — two people, one feeling. "On" is directional (one person acting on another) and collides with literal UI clicking. This applies to copy, code identifiers, analytics event names, and comments.

- ✅ `click_with`, `clicked_with`, "who you've clicked with"
- ❌ `click_on`, `clickOn`, "people you clicked on"

---

## 3. Banned terms — fail the audit on sight

| Banned | Why | Use instead |
|---|---|---|
| **match / matched / it's a match / mutual match** | Dating-app coded; collapses the brand into Hinge | "click with" / "you clicked with each other" / "mutual click" (sparingly, mostly internal) |
| **swipe** (even negatively) | Don't give it airtime | — (omit) |
| **"just looking for friends"** | The "just" demotes friendship | "here for friends" |
| **connect / connection** (when referring to the mechanic) | Generic; the mechanic has a name | "click" |
| **lonely / isolated / struggling / hard to meet people** | Deficit framing | "appetite for more" / "want more from your city" / "open to" |
| **"make friends as an adult"** | Self-help coded | — |
| **find your tribe / meet your people / meaningful connections** | Hollow, overused | Specific, concrete alternatives |
| **buy a ticket / "RSVP to unlock" / price inside the button** | Transactional / jargon / redundant (the price already shows on the card) | **"RSVP"** (all events; the price shows on the card, never inside the button) |
| **refer a friend / reward points** | Generic growth language | "bring your people into Click" / "click credit" |
| **click on [a person]** | See §2 | "click with" |
| **"if they feel the same" / "if they like you back" / "if they're interested" / "you'll be the first to know"** | Frames a non-mutual as romantic interest being **judged or declined** — implies rejection, and assumes a romantic frame the user may not be in. A pending click is just *private until mutual*, nothing more. | State the mechanic neutrally: **"🔒 Clicking is anonymous — we'll only show you if it's mutual."** For discovery, desire-framed: **"we think you may click"** / "someone you might click with". |
| **click** as UI verb ("click here", "click the button") | Collides with brand verb | "tap" / "select" |

**Codebase audit greps:** `match`, `Match`, `click_on`, `clickOn`, `clicked on`, `connection` (review hits in mechanic context), `click here`, `Click the`.

---

## 4. Where "click" earns its place — and where plain language wins

The brand verb is used **only when referring to the mechanic or the feeling**. Forcing it elsewhere reads as parody.

| Surface | Wrong (forced) | Right |
|---|---|---|
| Attendee list label | "See who's clicking in" | "Who's going" |
| Booking CTA | "Click your spot" / "RSVP · $97" | "RSVP" (one label; price shows on the card, not in the button) |
| Full event (action) | "Sold out" as a button | "Join waitlist" → once joined, "Joined waitlist" (muted, same button footprint). **"Sold out" is a STATE (Slate badge), never a button** — a full event still offers an action (join the waitlist), so the button is never dead. |
| Pre-launch / acquisition CTA (Landing, How It Works) | "Join the waitlist" | **"Request an invite"** (Cindy 28 Jun — invite-only brand; active, exclusive framing converts better than a passive "list"). This is the ACQUISITION CTA and is distinct from the per-event "Join waitlist" action above — don't conflate them. |
| Out-of-area signup (acquisition) | turning away / blocking non-pilot postcodes | **Never block an out-of-area signup.** Pilot launches in inner Sydney, but anyone in Sydney can request an invite; an out-of-area suburb/postcode still completes and confirms: "we'll tell you the moment Click reaches you." Keep the invite-only pull, widen the door — applies on Landing AND onboarding (consistent promise). Microcopy: "Somewhere else in Sydney? Join anyway - we'll tell you the moment Click reaches you." |
| Already booked | "Manage RSVP" | "View details" / "You're going" |

**Events vs "plans" (consistency rule).** Use **"event(s)"** for all labels, nav, page titles and buttons (Discover · My Events · Event detail · Host an event · "RSVP to this event") — the platform is built on events end-to-end, and a second noun for the same object breaks consistency. **"plans"** is allowed ONLY as warm body / empty-state copy ("got plans this weekend?", "no plans yet — find something near you"), never as a label. Keeps the brand warm without ambiguity.
| Event discovery | "Click into events near you" | "What's on near you" |
| The mechanic | "Connect with someone" | "click with someone" (lowercase — the feeling/verb) |
| Click action button (discovery card or post-event Who-was-there) | a bare sparkle ✦ icon, or bare "click" | **"click with [name]"** — lowercase "click" (the feeling/verb, per the click/Click split); the **"with [name]"** + the ✨ + context carry the meaning, so it never reads as the banned bare UI verb. Bare "click"/bare ✦ still banned. |
| Mutual notification | "It's a match!" | "You clicked with [Name]." (+ intent line; see §5) |
| Empty state (mechanic) | "No connections yet" | "No clicks yet — your next event is where it happens." |

**Rule of thumb:** if removing the word "click" and substituting "connect" changes the meaning, it's the mechanic — use click. If it reads the same, it's decoration — use plain language.

---

## 5. Locked UI strings (mechanic surfaces)

These exact strings (or their approved doc versions in `click_mechanic_explainer_copy.md`) are binding. Developers must not improvise alternates, including placeholder copy — placeholders ship.

| Surface | Locked string |
|---|---|
| Post-event prompt (push) | "Good night at [Event]? Did you click with anyone?" |
| Post-event screen headline | "Did you click with anyone?" (supersedes "Who'd you click with?" — a gentler yes/no opener; *click* = connect/hit-it-off, the correct mechanic sense) |
| Mutual push | "It's mutual — you clicked with [Name]. ✨" |
| Mutual in-app headline | **"You clicked with [Name]."** (Cindy 27 Jun — supersedes "You two clicked.": warmer, names the person, drops the couple-y "you two", stays intent-neutral; the intent line below still carries the friends/dating context. Lowercase "clicked" = the feeling.) |
| Intent line on mutual (non-optional, sits under the headline) | **Equal intents** → "You're both here for [shared intent]." **Different intents** → show BOTH, disclosed never collapsed → "You're here for [yours] · they're open to [theirs]." **Binding: never round a mixed pair into one frame** — a friends-intent user must never be shown as romantic, and a dating-intent user never as "just friends." The headline is the same for every pair; only the intent line differs. (The hard `relationship_friends`↔romantic exclusion is enforced live upstream — `10` §3 — so a platonic-only user can never be in a romantic mutual at all; this line only ever discloses the *allowed* friends×open-to-more mix, honestly.) |
| Already-clicked / post-click state | "🔒 Clicking is anonymous — we'll only show you if it's mutual." (Replaces the earlier "if they feel the same, you'll be the first to know" — **"feel the same" is banned: it frames a non-mutual as romantic rejection.** State the privacy rule neutrally; never imply the other person judged or declined you.) |
| Pending one-way click card-state (discovery card or post-event Who-was-there) | **"clicked"** (lowercase, the *feeling*, never the brand; **NO ✨** — pending is not a peak) shown as the click button **in its quiet/muted pending treatment — the SAME button footprint as the live "click with [name]" button, only the fill colour + label change** (NOT a separate, smaller pill — that mis-renders as a confirmation). It must read as **pending/unresolved**, never as confirmed or mutual. The anonymous reassurance ("🔒 Clicking is anonymous — we'll only show you if it's mutual.") shows **ONCE at the top of the section/page, never under a card** (repeating it per-card breaks the layout). Derived ONLY from your own outgoing click — says "you clicked," NEVER "they did/didn't" (anonymity). (Supersedes "clicked ✨" + the per-card helper + the "calm pill instead of a button" treatment.) |
| Mutual card-state (discovery card or post-event Who-was-there) | **"clicked ✨"** (Sage treatment, one ✨ — the peak) — the SAME click-button footprint switches to its mutual state once an `active` mutual exists; taps through to the mutual, never starts a new click. The big **"You clicked with [Name]."** headline belongs to the separate mutual-*reveal* moment, not this persistent chip. (Supersedes the persistent "You two clicked ✨" chip — shortened to "clicked ✨" per Cindy 27 Jun.) |
| Your-clicks list card (Live mutuals / Plans / Past clicks) — state marker | **No name-adjacent state PILL** (Cindy 28 Jun). The SECTION HEADER + a quiet state accent + the action carry the state; the card leads with the NAME. **Banned as card pills: "You two clicked", "You both clicked", "You're both going", "We clicked 🔥", "Released gently"**, and any ✨ on a list card (the list is not a peak). "We clicked 👍" stays only as the closure ACTION on a Past-clicks card. (Drops the redundant section-name badge + the decorative ✨; supersedes the live render's pills.) |
| Discovery-card suggestion framing | "We think you may click." (Why this person is shown. Possibility, never a verdict — never "your match", never anything implying they've assessed you.) |
| "We clicked" closure button | "We clicked 👍" — the success/closure action on a mutual. **NEVER "We connected"** — `connect` is banned (§3) even here. This marks the pair as a win (they met, maybe swapped numbers); it is celebrated, not an exit. |
| Closure confirmation | "Love that. That's what Click's for. ✨" |
| Soft-release (silent click expiry) | "Still out there — if you cross paths again, you can pick it back up." (Neutral, no-fault — Hinge-style silent expiry. Never "didn't line up", "expired", "winding down", "you missed your chance" — verdict/loss framing banned, §5a.) |
| Day-4 opportunity nudge | "[Name] + [event] this weekend could be a good one." (Opportunity frame only.) |
| "Not feeling it" (soft exit) | "Not feeling it" — silent to the other person, always. Never surfaces "[X] isn't feeling it" to anyone. |
| Opt-out of being clickable | "Show me in event attendee lists" + "Off means people at your events can't click with you. You'll still see everything and book anything." |
| Decline-pressure line | "Not feeling it? No worries — just ignore this." |

**✨ usage (locked).** The spark is reserved and rationed: **at most ONE ✨ per element**, and ✨ is **never decoration**. The **pending** click state carries **NO ✨** (label just "clicked" — it is not a peak). ✨ appears on the **mutual** card-state ("clicked ✨"), the three peak moments (mutual / both-going / connected), and the nav item ("✨ click") — never two on one control, never sprinkled on context/overlap lines (e.g. a "Both into pottery…" line carries a plain glyph, not a ✨). Concentrate the celebratory ✨ at the peaks. Over-use cheapens it.

---

## 6. Tone & framing rules (summary — full version in `click_brand_voice_brief_v2.md`)

1. **Desire, not deficit.** Name the appetite ("want more from your city"), never the lack ("hard to meet people").
2. **Activity first.** The event is the pitch; connection is the outcome. Copy that leads with meeting people fails the audit.
3. **Intent-neutral.** Dating is never the default or implied. Friendship, community, networking are equal. The coupled persona must never feel excluded by phrasing. **Intent labels name a desire, never a status:** the platonic-only option (`relationship_friends`) must read as "Here to meet people, not to date" — never "In a relationship." A status label forces a partnered person to disclose their circumstance to get the safety, and strands a single person who wants friends-only with no honest option. Frame what they want, not who they are.
   - 🔴 **"Open to dating" displays ONLY when BOTH people have dating mode on — SITE-WIDE (Cindy 27 Jun).** The "Open to dating" intent label / the "both open to dating" line / any dating signal shows ONLY when the VIEWER and the other person both have dating mode visible on (mutual opt-in). A friends-only viewer NEVER sees a dating label on anyone, anywhere (people cards, mutual cards, attendee lists, profiles). This keeps the product intent-neutral (a friends-only user never sees dating coding) AND is the mutual-opt-in privacy rule. Applies everywhere. (Flag to Doan — touches `10`/`12`.)
4. **Mutual is the lead reassurance, anonymity the supporting detail.** Repeating "anonymous" implies something to hide. "Nothing happens unless it's both of you" carries the trust.
5. **Chilled.** No streaks, no nudges, no guilt mechanics, no urgency language except the honest 48-hour window. "No pressure" should be felt, not just stated.
6. **No "just."** Audit every instance of the word "just" before an intent or persona — it almost always demotes something.

---

---

## 5a. Framing rule — opportunity, never loss (lifecycle copy)

The click lifecycle (`21_CLICK_MECHANIC.md` Part B) must never use **loss framing**. A click that goes quiet is *released gently*, not *failed* or *expired-at-you*.

| Banned (loss frame) | Use instead (opportunity / neutral) |
|---|---|
| "Your click is about to expire" | "[Name] + [event] this weekend could be a good one." |
| "Your click with [Name] is winding down" | (soft-release copy, §5) |
| "You missed your chance" | "If you cross paths again, you can pick it back up." |
| "It's a match!" | "You clicked with [Name]." |
| "We connected" (the closure button) | "We clicked 👍" |

Why this is a language rule, not just a product one: deficit/loss framing contradicts the whole brand position (§3 bans lonely/isolated/struggling for the same reason). The mechanic should feel like doors opening, never like a deadline you're failing.

---

## 5b. Framing rule — rejection-proof (anywhere we describe the click)

A large share of the people Click is for hold back because of **fear of rejection** (and, for the socially anxious, fear of being judged for it). The product is structurally rejection-proof — a one-way click is never shown to anyone — so the copy must *say so*, and must never accidentally re-introduce the fear it removes.

**The rule:** whenever we describe what happens when you click, frame the non-mutual outcome as **private and costless**, and lead with the upside. State it positively — "you only ever hear about the people who clicked with you too" — rather than dwelling on the could-be-no.

| Banned (plants rejection) | Use instead (rejection-proof) |
|---|---|
| "...tells you if the feeling was mutual" / "...if they feel the same" | "you only ever hear about the people who clicked with you too" |
| "find out if they liked you back" | "if it's mutual - and only then - you both find out" |
| "they'll see you clicked" (ever, for a one-way click) | "a one-way click is never shown to anyone" |
| "put yourself out there" (exposure frame) | "there's nothing to risk by hoping" / "it stays your secret" |

Also: **welcome quiet/introverted/anxious readers by making them feel safe, never by labelling them** — no "for the shy", "for the lonely", "beat your social anxiety", "find your tribe". Show the safety (activity-first, never rated, private, you control your visibility); don't name the wound.

---

## 7. Audit checklist — run against any page or PR

1. Any banned term from §3? (grep list provided)
2. Any "click on [person]" or directional click grammar?
3. Any "click" used for literal UI interaction?
4. Platform name capitalised in prose? (lowercase only in wordmark)
5. Brand verb forced where plain language belongs (§4)?
6. Mechanic surfaces using locked strings (§5) verbatim?
7. Any deficit framing — lonely, isolated, hard-to, struggling?
8. Does any copy assume romantic intent or single users? **Does any intent label name a status ("in a relationship") instead of a desire ("here to meet people, not to date")? Does any pending/click-sent state imply rejection or judgement ("if they feel the same", "if they like you back") instead of stating the neutral mechanic ("anonymous — only shown if mutual")?**
9. Does the page lead with people instead of the activity?
10. Mutual-click anonymity: does any string, state, or response reveal a non-mutual click? (This is a product-integrity check, not just copy.)
11. Any loss framing in lifecycle copy (§5a) — "expire", "winding down", "missed", "last chance"?
12. Closure button says "We clicked 👍", never "We connected"?

A page passes when all twelve are clean.

---

*Companion documents: `click_brand_voice_brief_v2.md` (full tone rationale), `click_mechanic_explainer_copy.md` (full mechanic copy), `21_CLICK_MECHANIC.md` (engineering spec).*
