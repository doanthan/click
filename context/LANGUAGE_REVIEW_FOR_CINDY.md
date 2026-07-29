# Language review for Cindy — judgment-tier copy (Step 2.6)

The Step 2.6 language sweep (`CODE_AUDIT.md` §7 Job B) split into two tiers:

- **Mechanical tier** — applied in branch `feat/click-2.6-language` (directional "click on" → "click with", "match/matched" for the connection → mutual-click language, capital-C mechanic verb → lowercase, the locked §5 mutual push string). No judgment needed; these are hard `CLICK_LANGUAGE.md` rules.
- **Judgment tier (this doc)** — the audit's **L7**: `connect` / `connection` in the legal/marketing prose. `CLICK_LANGUAGE.md` §Do-not-use lists "connect (for the mechanic)" as banned, **but** several of these read as *product-category positioning* ("social connection platform"), not the click mechanic. Changing them is a brand-voice call, so they were **left untouched** for you to rule on.

The rule to apply: **the click mechanic** (two people hitting it off) must never be called "connecting" — that's "click with". But **the product category** ("an event-first social ___ platform") is arguably a legitimate descriptor. You decide, line by line.

## L7 — `connect` / `connection` occurrences (not auto-applied)

| File:line | Current text (excerpt) | Reads as | Question |
|---|---|---|---|
| `terms/page.tsx:14` | "an event-first social **connection** platform operated in Sydney" | category positioning | Keep, or "event-first social platform"? |
| `terms/page.tsx:74` | heading: "How Click works - **connection** by design" | category / mechanic | Keep, or "clicking by design" / "clicks by design"? |
| `terms/page.tsx:79` | "**Connection** happens through shared events and mutual interest." | mechanic | Likely → "Clicking happens through shared events…" |
| `terms/page.tsx:242` | "Click facilitates **connections** and bookings for in-person events" | mechanic/category | Keep, or "facilitates clicks and bookings"? |
| `safety/page.tsx:14` | "Click is built so that **connection** happens through shared, real-world events - never through cold messages." | mechanic | Likely → "so that clicking happens through…" |
| `safety/page.tsx:54` | "When **connection** is for [dating/…]" | mechanic | Likely → "When a click is for…" |
| `privacy/page.tsx:35` | "your **connection** intent, interest tags, quiz responses…" | field name (intent_mode) | Keep "connection intent", or "click intent" / "intent mode"? |
| `privacy/page.tsx:36` | "Activity & **connection** signals: … your private clicks and mutual clicks" | field/mechanic | Keep, or "Activity & click signals"? |
| `privacy/page.tsx:63` | "…mutual **connections**; send transactional messages…" | mechanic | Likely → "mutual clicks" |

**Not in scope (leave):** every "Stripe **Connect**" (`terms:187`, `privacy:101`) — that's the payment product name, not the mechanic.

## Related — flagged to Doan separately (product decisions, not copy)

- **UIUX-9 / UIUX-10** — the account-settings "Mutual Click alerts" toggle is never read; the mutual email always sends. Honour the pref or document that the mutual notification is non-suppressible. (Product call.)
- **UIUX-11** — the audit's Job-A canonical targets `/for-merchants` + `/for-merchants/how-it-works` don't exist (we have `/how-it-works` + `/merchant`). Whether to create/rename is an IA call.
- **`/test-click`** — the deliberately code-faithful explainer (`click-walkthrough.tsx`) still narrates the *old* mechanic ("Mutual Click found" push, "Click again to reopen isn't wired", 7-day-or-it-dies, "Who did you click with?", "12 hours after event end"). Per `CLAUDE.md` it must be re-diffed against the *new* mechanic now that Steps 2.1-2.5 have landed — its own task, not a string swap.

## Dead exports (banned strings cleaned, but rendered nowhere)

`src/lib/click-data.ts` `roleCards` / `notificationRows` / `dashboardSections` are exported but consumed by no page. Their banned strings were fixed in 2.6 for a clean grep, but they're Step-3 teardown candidates (delete wholesale). `notificationRows` also still claims "12 hours after event end" (now +2h) - moot once deleted.
