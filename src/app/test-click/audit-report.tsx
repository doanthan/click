// On-page engineering audit for /test-click. Content is the verified output of
// a multi-agent audit that diffed every claim on this page against the live
// Click mechanic (src/lib/event-repository.ts + the proposal/RSVP flow). Every
// item carries the code reference that proves it. Static data - update by hand
// when the mechanic changes.

type Sev = "high" | "medium" | "low";
type Item = { sev: Sev; area: string; title: string; detail: string; ref: string };

const EYEBROW =
  "font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]";

const ACCURATE: string[] = [
  "A pending Click is genuinely silent - sending one only writes a row; no notification, email, or badge reaches the other person. The first time anyone is told is the mutual.",
  "The mutual is symmetric: both people get the same “Mutual Click found” notification (→ /proposals) and the same email, at the same moment.",
  "You can’t click with yourself, and a block in either direction blocks the Click (enforced in app + a DB constraint).",
  "Confirming a proposal does not book a seat - both people still RSVP separately. “Confirming ≠ holding a seat” is exact.",
  "One tap by either person confirms the plan for the pair - there’s no two-sided handshake on the plan itself.",
  "“Both going 🎉” really does require both to hold a confirmed seat (or a claimed guest +1) for the same upcoming event.",
  "The proposal surface has no free text anywhere - alternatives come from a real-events dropdown. “Never a chat” holds.",
  "Discovery Clicks need no shared past event; post-event Clicks are correctly gated to both being confirmed attendees of an event ended 12h+ ago.",
];

const CORRECTIONS: string[] = [
  "Dropped the “Click again to reopen” promise - a lapsed proposal can’t be reopened today.",
  "“Ranked by shared interest tags” → “how well you click” (Matching v2 re-ranks the pool, and it’s ON by default).",
  "Step 5: the 🎉 lives only on the dashboard - /proposals never shows it (both-going is computed from RSVPs, not from Confirm).",
  "Softened the blocking pill - a block governs discovery + new Clicks, not an existing mutual.",
  "Step 4: noted that one-tap Confirm only works while the suggested event is still bookable.",
  "Decoupled the demo dates - the 7-day proposal clock runs from when you clicked, not the event date.",
];

const EDGE_CASES: Item[] = [
  {
    sev: "high",
    area: "Going/RSVP",
    title: "A waitlist (full) event can be the suggested plan - so “both going” can never fire for it",
    detail:
      "The auto-suggestion, catalogue, and “suggest alternative” all accept waitlist-status events. But RSVPing a waitlist event makes you “waitlisted”, and the both-going check only counts “confirmed” seats. So both people RSVP, both land on the waitlist, and the celebration silently dead-ends until seats open for both.",
    ref: "event-repository.ts:7165 · :3012–3024 · :10794",
  },
  {
    sev: "high",
    area: "Going/RSVP",
    title: "Cancelling an RSVP silently un-celebrates “both going” - and nobody tells your partner",
    detail:
      "“Both going” is live state, not a stored badge. Cancelling only flips your attendee row to cancelled; it never touches the mutual or proposal. The 🎉 card just disappears for both on the next load, with no alert to the still-going partner. If the proposal was explicitly Confirmed, it stays “confirmed” forever, so /proposals keeps showing a stale “RSVP needed” card.",
    ref: "event-repository.ts:7491–7600 · :10788–10814",
  },
  {
    sev: "medium",
    area: "Sending",
    title: "Re-clicking re-arms a fresh 30-day window and can revive an expired Click - no cooldown",
    detail:
      "The click upsert resets status to pending, pushes expires_at to now + 30 days, and overwrites created_at every time. So clicking someone you already have an expired (or even mutual) row for silently brings it back to life. The “30 days then it expires” framing implies a one-shot timer; it’s re-armable on every tap.",
    ref: "event-repository.ts:7076–7088",
  },
  {
    sev: "medium",
    area: "Mutual",
    title: "A mutual only forms while both Clicks are unexpired",
    detail:
      "After you click, the reciprocal lookup requires the other person’s row to still be live (expires_at > now). If they clicked you 31 days ago, that click has lapsed and no mutual forms - you just get a fresh pending click. A mutual is the overlap of two live 30-day windows.",
    ref: "event-repository.ts:7090–7100",
  },
  {
    sev: "medium",
    area: "Suggestion",
    title: "A mutual can form with no suggested event - the proposal opens empty",
    detail:
      "The suggestion is best-effort. If no future, in-stock, interest-matching event exists, the mutual + proposal are still created with a null event; the dashboard shows “No plan yet - pick one together.” Step 2’s “we auto-suggest an event” isn’t guaranteed.",
    ref: "event-repository.ts:7111–7232 · dashboard/page.tsx:357–366",
  },
  {
    sev: "medium",
    area: "Proposal",
    title: "The “3 alternatives” cap is one shared budget across both people, not 3 each",
    detail:
      "alternatives_count is a single integer on the proposal, incremented whenever either person suggests an alternative, capped at 3 total. “3 of 3 left” is a joint budget between the two of you - not 6 swaps.",
    ref: "event-repository.ts:11578–11611 · database/019_proposals.sql:21",
  },
  {
    sev: "medium",
    area: "Notifications",
    title: "Mute silences the in-app mutual ping - but the mutual still forms and the email still sends",
    detail:
      "Mute is notification-suppression only, distinct from block. On a mutual, the proposal and email both run regardless; only the two in-app notifications check for a mute. The mutual-click email isn’t mute-gated at all.",
    ref: "event-repository.ts:7201–7245 · :7249–7331",
  },
  {
    sev: "medium",
    area: "Sending",
    title: "The post-event prompt uses several windows - not one clean “12h gate”",
    detail:
      "The click action is gated to ended + 12h; the dashboard rail shows co-attendees from +12h to −14 days; the event-page prompt shows from event end (no 12h gate) to −30 days; the push cron fires +12h to −7 days. So you can see the Click button on an event page before 12h and have the submit rejected.",
    ref: "event-repository.ts:7058 · :11198 · :11277 · :11329",
  },
  {
    sev: "medium",
    area: "Going/RSVP",
    title: "RSVPing to a full paid event joins the waitlist for free - payment is skipped up front",
    detail:
      "Stripe checkout is only required for a paid event that isn’t full. A full or waitlist-status paid event drops straight to a free “waitlisted” row; you only pay later if a seat is offered and you accept. “Paid event → Stripe checkout” is only true when seats are available.",
    ref: "event-repository.ts:3012–3063",
  },
  {
    sev: "medium",
    area: "Going/RSVP",
    title: "“Both going” celebrates any shared upcoming event - and keeps a lapsed mutual alive",
    detail:
      "The both-going check scans every upcoming event for one where both are confirmed (or claimed-guest); it doesn’t require the proposal’s suggested event. So a pair who independently RSVP some unrelated event - never opening the proposal - still get the 🎉, and that overrides the dead-mutual drop after 7 days.",
    ref: "event-repository.ts:10788–10827",
  },
];

const GAPS: Item[] = [
  {
    sev: "high",
    area: "Proposal",
    title: "A lapsed proposal can’t be reopened - the card’s “Click again to reopen” is aspirational",
    detail:
      "Once you’re mutual, the Click button is disabled / the person is filtered out, so you can’t re-click them; and the proposal upsert never resets status or pushes the expiry. So an expired proposal stays expired. Either build the reopen or fix the product copy.",
    ref: "event-repository.ts:7226–7245 · proposal-card.tsx:150",
  },
  {
    sev: "high",
    area: "System",
    title: "Nothing flips a lapsed proposal / pending Click to “expired” - expiry is read-time only",
    detail:
      "No cron sweeps user_clicks or event_proposals. A pending Click after 30 days just stops counting; the row persists. A proposal only becomes “expired” if someone taps Confirm too late - otherwise it sits as pending with a past expiry, treated as dead purely by read-time guards. DB state is never reconciled.",
    ref: "event-repository.ts:10894 · :11520–11527 · vercel.json",
  },
  {
    sev: "high",
    area: "Sending",
    title: "No way to withdraw a sent Click, and no way to decline a proposal",
    detail:
      "The click endpoint is create-only - a sent pending Click can’t be retracted (it persists until it expires or you block). There’s no decline/cancel/dismiss for a proposal either: you can only Confirm, burn a swap, or wait 7 days. Blocking is the only hard exit.",
    ref: "api/clicks/route.ts · proposal-card.tsx:154–175",
  },
  {
    sev: "high",
    area: "Safety",
    title: "Blocking after a mutual leaves the mutual + proposal fully alive",
    detail:
      "Block deletes pending clicks in both directions but never touches the mutual or proposal, and the mutual/proposal queries + confirm/suggest actions don’t re-check blocks. So after a block, both people still see the “you both clicked” card and the live proposal, and the non-blocked person can still Confirm/Suggest.",
    ref: "event-repository.ts:10882–10899 · :11446 · :11478–11504",
  },
  {
    sev: "medium",
    area: "Safety",
    title: "No report / block / mute inside the Click flow - only on the public profile page",
    detail:
      "Block/mute/report live only on /profile/[userId]. The proposal card has no profile link and the proposals page has no safety controls, so from inside a mutual or proposal there’s no path to report them.",
    ref: "proposal-card.tsx · profile-safety-controls.tsx",
  },
  {
    sev: "medium",
    area: "Notifications",
    title: "The RSVP-reminder cron ignores mute/block and has no expiry guard",
    detail:
      "The hourly “don’t forget to RSVP” nudge has no mute/block check, so a muter can still be nudged about a plan with someone they muted. It also selects pending proposals 24h+ old with no “not expired” guard, so a lapsed-but-still-pending proposal can fire one stray reminder.",
    ref: "event-repository.ts:3169–3218",
  },
  {
    sev: "medium",
    area: "Suggestion",
    title: "Capacity checks ignore claimed guest +1s, so a guest-full event can still be suggested",
    detail:
      "Every place that validates a suggested/proposed event counts only attendees (confirmed + live payment holds) toward capacity - claimed guest spots aren’t counted, even though they otherwise count toward capacity. So an event that’s actually full once guest +1s are included can still be offered.",
    ref: "event-repository.ts:7133–7176 · database/046_guest_spots.sql:13",
  },
  {
    sev: "medium",
    area: "Suggestion",
    title: "Muted users aren’t hidden from discovery, and already-clicked people still take a slot",
    detail:
      "The discovery pool excludes self, non-attendees, suspended, incomplete profiles, and blocked pairs - but not muted users, and not people you’ve already clicked with (they stay in the pool, just disabled). If mute should also hide from discovery, that’s a code gap.",
    ref: "event-repository.ts:10642–10672",
  },
  {
    sev: "low",
    area: "Notifications",
    title: "The mutual notification/email ignores the user’s notify preference",
    detail:
      "The mutual-click notification + email only honor mutes - the account-settings “mutual click” toggle is never consulted, so a user who turned it off still gets both. Separately, the “event reminder” toggle is advertised but has no cron and is never sent.",
    ref: "event-repository.ts:7249–7331 · account-settings/page.tsx:149",
  },
  {
    sev: "low",
    area: "Suggestion",
    title: "/people still says “ranked by shared interest tags” (same fix needed there)",
    detail:
      "This page’s copy is corrected, but the live People page still describes the ranking as shared-interest tags, even though Matching v2 (default ON) re-ranks by the pair model. Worth fixing there too for consistency.",
    ref: "people/page.tsx:47 · event-repository.ts:10680–10693",
  },
];

function SevBadge({ sev }: { sev: Sev }) {
  const palette =
    sev === "high"
      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
      : sev === "medium"
        ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
        : "bg-[color:var(--cream)] text-[color:var(--mauve)]";
  return (
    <span
      className={`shrink-0 rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em] ${palette}`}
    >
      {sev}
    </span>
  );
}

function ItemList({ items }: { items: Item[] }) {
  return (
    <div className="mt-5 grid gap-3">
      {items.map((item) => (
        <details
          key={item.title}
          className="group rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm [&_summary]:cursor-pointer"
        >
          <summary className="flex list-none items-start gap-3">
            <SevBadge sev={item.sev} />
            <span className="shrink-0 rounded-full border border-[color:var(--line)] bg-[color:var(--lav-bg)] px-2.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em] text-[color:var(--ink)]">
              {item.area}
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold leading-6 text-[color:var(--ink)]">
              {item.title}
            </span>
            <span
              aria-hidden
              className="shrink-0 font-mono text-xs font-bold text-[color:var(--mauve)] transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">{item.detail}</p>
          <p className="mt-2 font-mono text-[0.65rem] font-semibold tracking-tight text-[color:var(--mauve)]/80">
            ↳ {item.ref}
          </p>
        </details>
      ))}
    </div>
  );
}

export function ClickAuditReport() {
  return (
    <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className={EYEBROW}>Engineering audit</p>
        <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
          Does this page match the code?
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
          We diffed every claim on this page against the live mechanic - the click, mutual, suggestion,
          proposal, and RSVP code. Here’s what’s verified, what we tightened, and the edge cases + gaps
          worth knowing. Each finding cites the code that proves it.
        </p>

        {/* Verified accurate */}
        <div className="mt-10">
          <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
            ✓ Verified accurate
          </h3>
          <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">
            What this page already shows exactly right.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {ACCURATE.map((line) => (
              <li
                key={line}
                className="flex gap-2 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-3 text-sm font-medium leading-6 text-[color:var(--ink)]"
              >
                <span aria-hidden className="shrink-0 font-bold text-[color:var(--rose)]">
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Corrections applied */}
        <div className="mt-10">
          <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
            Corrections we applied
          </h3>
          <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">
            The audit caught these inaccuracies on this page - now fixed in the copy above.
          </p>
          <ul className="mt-4 grid gap-2">
            {CORRECTIONS.map((line) => (
              <li
                key={line}
                className="flex gap-2 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--lav-bg)] p-3 text-sm font-semibold leading-6 text-[color:var(--ink)]"
              >
                <span aria-hidden className="shrink-0 font-bold text-[color:var(--purple)]">
                  ✎
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Edge cases */}
        <div className="mt-10">
          <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
            Edge cases
          </h3>
          <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">
            Real branches the happy-path walkthrough doesn’t show. Tap to expand.
          </p>
          <ItemList items={EDGE_CASES} />
        </div>

        {/* Gaps */}
        <div className="mt-10">
          <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
            Gaps &amp; not-built-yet
          </h3>
          <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">
            Things the product doesn’t do yet, or dependencies a reader should know.
          </p>
          <ItemList items={GAPS} />
        </div>
      </div>
    </section>
  );
}
