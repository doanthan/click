<!-- Last updated: 2026-06-26 | Revision: v5 (dormant note + recovery-branches row clarified — dormant is NOT exempt from the 7-day silence clock, so a zero-engagement dormant pair soft-releases to released and never sits forever (B6/B7.6, already canon in 21 §B6); source-of-truth refs bumped to 21 v10 / 09 v12. No state-model change.) -->

# Click Mechanic — Full Lifecycle Process Map

**Source of truth:** `21_CLICK_MECHANIC.md` (Parts A+B) at revision v10 (+ `09` v12 for discovery + the suggestion-capacity floor). This map is downstream — on any conflict, the spec wins. Regenerate when `21` changes the state model.

**How to read it:** the mechanic has two layers that chain. The **Send layer** (Part A) takes a click to a mutual — and as of June 2026 there are **two parallel send processes** (discovery + post-event). The **Coordination + Lifecycle layer** (Part B) takes a mutual through planning, attendance, and its eventual terminal — with every terminal except `block`/`delete` looping back into a fresh cycle.

---

## Layer 1 — Send layer (Part A): click → mutual — TWO PROCESSES (21 v8)

Pre-event clicking was removed June 2026. A person is clicked either from **discovery** (Process 1, anonymous, person-bound, no event) or **after an event they attended** (Process 2). The event page itself is context-only — no clicking. The two processes never cross-match (rule 3).

```mermaid
stateDiagram-v2
    state "Process 1 — DISCOVERY click" as P1 {
        [*] --> d_pending: User clicks WITH someone<br/>from discovery feed (09)<br/>event_id = NULL · surface='discovery'
        d_pending --> d_mutual: other person clicks back<br/>(discovery↔discovery, both live)
        d_pending --> d_expired: 7 days pass<br/>(created_at + 7d, read-time)
        d_pending --> d_invalid: block OR profile gone
        d_mutual --> [*]: forms mutual_clicks (active)
        d_expired --> [*]
        d_invalid --> [*]
    }

    state "Process 2 — POST-EVENT click" as P2 {
        [*] --> p_pending: User clicks WITH someone<br/>from Who-was-there (§7B)<br/>event_id set · surface='who_was_there'<br/>ATTENDANCE-GATED · 3/event budget
        p_pending --> p_mutual: other person clicks back<br/>(same-event, both live)
        p_pending --> p_expired: window passes<br/>(event_end + 48h, read-time)
        p_pending --> p_invalid: booking cancelled OR block OR swap
        p_mutual --> [*]: forms mutual_clicks (active)
        p_expired --> [*]
        p_invalid --> [*]
    }

    note right of P1
        DISCOVERY (Process 1):
        • Anonymous + one-way until mutual; never revealed,
          even after the 7-day expiry. No "Likes You" queue —
          an expired click is gone; re-click is a fresh click.
        • Card shows "Clicked — we'll let you know if it's
          mutual ✨" while pending (derived only from the
          viewer's own click); "You two clicked ✨" once mutual.
        • A still-pending click down-ranks the receiver from the
          featured slot for one ~6h cycle (09 v9) — never hidden.
    end note

    note right of P2
        POST-EVENT (Process 2):
        • Attendance-gated: receiver must have HELD a booking at
          event end (not just booked). 48h event-anchored window.
        • Two yes-branches at the prompt: "we clicked" (offline,
          no suggestion) vs "we clicked — suggest another".
        • Response byte-identical across mutual/blocked/hidden/
          absent (21A timing floor ~350ms) — same as discovery.
    end note

    note left of P2
        BOTH processes resolve to ONE mutual_clicks row
        (one active mutual per pair, any process). The two
        NEVER cross-match: a discovery click + a post-event
        click between the same pair do not form a mutual
        together (rule 3). Every mutual → a shared-tag,
        has-capacity EVENT SUGGESTION (never a chat).
    end note
```

---

## Layer 2 — Coordination + Lifecycle (Part B): mutual → terminal → re-click

The mutual is the asset. An event is just the current *attempt* to realise it. A failed attempt never kills the mutual — it returns to a recoverable state.

```mermaid
stateDiagram-v2
    [*] --> entry: mutual forms (Layer 1)
    entry --> connected: post-event "we clicked"<br/>(offline — they swapped numbers,<br/>no event needed, B7.1)
    entry --> active: discovery mutual<br/>OR post-event "suggest another"

    state active {
        [*] --> open
        open --> proposed: one proposes an event (B4)
        proposed --> open: declined / countered /<br/>proposal expires 48h (B4.2)
        proposed --> confirmed_together: both accept + both booked (B5)
        open --> dormant: no viable shared event (B6)
        dormant --> open: 4h auto-revival finds one (B6)
        confirmed_together --> open: seat race lost /<br/>event cancelled (untouched, B5.5)

        note right of open
            Suggestions shown (48h–30d window).
            7-day clock; ANY coordination renews it (B4.3).
        end note
        note right of dormant
            Not a dead end — system actively
            re-checks every 4h. Doesn't count
            toward the actionable-mutual cap (B7.2).
            But NOT exempt from the 7-day silence
            clock: a dormant pair with zero
            engagement still soft-releases to
            'released' (B6/B7) — nothing sits forever.
        end note
    }

    active --> connected: both attend together<br/>OR either taps "We clicked 👍"<br/>(B7.1) — SUCCESS
    active --> released: 7-day silence<br/>(soft release, B7.6)
    active --> suppressed: either taps "Not feeling it"<br/>(B7.1) — silent 90d
    active --> expired_mutual: block / account deletion<br/>(B7) — permanent

    connected --> active: re-click at another event<br/>(B7.8) — fresh active row
    released --> active: rediscovery after 30d cooldown<br/>(B7.9) OR cross paths again
    suppressed --> active: re-click allowed after 90d<br/>(B7.5)

    expired_mutual --> [*]: NEVER resurfaces<br/>(the one real door)

    note right of connected
        SUCCESS TERMINAL. Rests in "Past clicks".
        connected_reason = co_attended (verified)
        | we_clicked (self-report, offline numbers).
        Re-clickable anytime — the win condition,
        never churned.
    end note

    note right of released
        Neutral copy: "Still out there — if you
        cross paths again, you can pick it back up."
        NO verdict, NO "didn't line up" (Hinge model).
        Frees an active-cap slot.
    end note
```

---

## The infinite cycle (the spine)

```mermaid
flowchart LR
    P1[discovery click<br/>person-bound · 7d] --> B{reciprocated<br/>in same process?}
    P2[post-event click<br/>attended · 48h] --> B
    B -->|no| Z[no reveal, ever<br/>discovery: silent expiry · no Likes-You<br/>post-event: reframed as attending]
    B -->|yes| C[mutual ✨<br/>one per pair]
    C --> Y{post-event<br/>which yes?}
    Y -->|we clicked<br/>offline| G
    Y -->|suggest another<br/>· or any discovery mutual| D[coordinate<br/>propose → accept]
    D --> E[confirmed together]
    E --> F[attend]
    F --> G[connected 👍]
    G -->|re-click at<br/>another event| C
    G -.->|or just rest in<br/>Past clicks| H[done — a win,<br/>nothing owed]

    style C fill:#C8B8F8,color:#1a1a2e
    style G fill:#3B2F81,color:#fff
    style Z fill:#F9F6F0,color:#1a1a2e
    style H fill:#F9F6F0,color:#1a1a2e
    style P1 fill:#EDE7FA,color:#1a1a2e
    style P2 fill:#EDE7FA,color:#1a1a2e
```

The "we clicked (offline)" yes-branch short-circuits straight to `connected` (they swapped numbers — no event needed); every other path — "suggest another," and *all* discovery mutuals — flows through coordination. Both still land at `connected`, the win condition.

---

## State reference (binding — every term maps to one (status, coord_state) pair)

| User sees | `status` | `coord_state` | Re-clickable? | Counts to cap? |
|---|---|---|---|---|
| a live mutual | `active` | `open` / `proposed` / `dormant` | n/a (live) | yes if `open`/`proposed`, **no** if `dormant` |
| a plan / going together | `active` | `confirmed_together` | n/a | no (handled) |
| "We clicked" / connected | `connected` | frozen | yes → new `active` | no (history) |
| released / softly expired | `released` | frozen | yes after 30d | no (history) |
| not feeling it / suppressed | `suppressed` | frozen | yes after 90d | no (history) |
| blocked / deleted | `expired` | frozen | **no, while cause persists** | no (history) |

**Five foolproof invariants** (enforced + sim-tested):
1. Exactly one `active` mutual per pair, ever (partial unique index on `status='active'`).
2. A mutual leaves `active` only via four named exits — `connected` / `released` / `suppressed` / `expired`. No fifth, no stuck state.
3. Three of the four are re-clickable (`connected` / `released` / `suppressed`-after-90d). Only `expired` is a real door.
4. No coordination dead-end: every `coord_state` has an explicit way out; `dormant` is actively revived.
5. The cycle is infinite: connected → re-click → active → confirmed_together → attend → connected → … each lap clean.

---

## Recovery branches (the unhappy paths, all defined)

| Situation | What happens | Spec |
|---|---|---|
| Discovery click not reciprocated (Process 1) | No reveal, ever; the click silently expires at 7d. No "Likes You" queue — it's just gone; re-click anytime is a fresh click. While pending, the receiver isn't walled out of discovery — only down-ranked from the featured slot for ~one cycle | §6.1, `09` v9, `21` v8 §5 |
| Post-event click not reciprocated (Process 2) | No reveal, ever; reframed as *attending*, with an aggregate "getting noticed" warmth signal. Sender's surface shows "Clicked — we'll let you know if it's mutual ✨" (own click only) | §6.1, `06` §2.6, `21` v8 §7B |
| Proposal sent, never answered | Expires to `open` at 48h, both nudged once, mutual untouched; proposer's copy softens after 24h receiver-inactivity | B4.2 |
| Seat race lost to another pair | Neutral "filled up just now" + priority re-suggest + waitlist-together; never strands/blames/reveals | B5.5 |
| No viable event right now | `dormant`, auto-revived every 4h; still under the 7-day silence clock so it can't sit forever → `released` if zero engagement | B6 / B7.6 |
| 7-day silence | Soft-release, neutral no-fault copy, resurfaces via rediscovery | B7.6 / B7.9 |
| Recipient never saw the mutual | Read-time awareness gate → first-open interstitial recovers the missed mutual; never the lie | B7.6a |
| Partner pauses / suspended / deletes / blocks mid-coordination | Survivor sees one neutral line ("That one's run its course…"), snapshot revoked, no ghost proposal | B7.4a-i |
| Overloaded popular user (40+ incoming) | Cap counts *actionable* mutuals (soft 8); down-rank in discovery, never hard-block; calendar spread absorbs load | B7.2 |
