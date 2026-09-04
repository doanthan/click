import "server-only";
import { getPostgresPool } from "@/lib/postgres";
import { FIXTURE_SLUGS } from "@/lib/click-test-fixtures";

/**
 * The harness activity log: what each step did, and why a refusal refused.
 *
 * WHY A ROW DIFF AND NOT JUST THE MESSAGE
 * ---------------------------------------
 * §6.1 makes a send's response byte-identical whether it formed a mutual click,
 * was a no-op, or spent a budget slot - that is the anti-probing rule, and the
 * harness must not break it to make itself readable. So the response text can
 * never be the record of what happened. This snapshots the pair's actual rows
 * before and after every step and reports the difference, which is the only
 * honest answer to "what did that do" - and it is the same evidence a refusal
 * needs, because a step that reports success and changes nothing is a no-op, not
 * a pass.
 *
 * WHY A REFUSAL CARRIES TWO STRINGS
 * ---------------------------------
 * Every receiver-state refusal in the send layer collapses to one sentence on
 * purpose (notEligibleError, event-repository.ts:8756) - underage, banned, opted
 * out, paused, blocked, suppressed, or not at the event all answer identically so
 * no pair of requests can separate them. The real cause rides on the error as
 * `auditReason`, server-side only. The log prints both: `message` is what the
 * person would have seen, `reason` is what actually closed the gate.
 *
 * ponytail: a module-level ring buffer, not a table. The harness is gated to a
 * single dev process (isProductionDeployment + the QA unlock), so a shared server
 * is not a case that exists; a restart losing the log is the correct trade for
 * not adding a migration to a QA page. Move it to a table if this ever needs to
 * survive a deploy.
 */

const MAX_ENTRIES = 80;

export type HarnessLogOutcome = "ok" | "refused" | "noop";

export type HarnessLogEntry = {
  id: number;
  at: number;
  step: string;
  actor: string | null;
  outcome: HarnessLogOutcome;
  /** What the person would have been shown. Deliberately uniform on refusals. */
  message: string;
  /** The gate that actually closed, from `auditReason` where the message hides it. */
  reason: string | null;
  /** The rule behind it, named so a refusal can be checked against the spec. */
  rule: string | null;
  /** What changed in the database, row by row. Empty means nothing was written. */
  changes: string[];
  /**
   * Writes that landed AFTER the response was handed back. The mutual click's
   * notification and both emails are deliberately deferred this way (afterResponse,
   * event-repository.ts:8775) so their cost cannot be read off the reply's latency -
   * which means the step that caused them cannot see them, and they have to be
   * attributed on the next render instead of being lost.
   */
  late: string[];
  ms: number;
  /** Which pair this belongs to, so late writes are attributed to the right step. */
  pairKey: string;
  /** Not rendered - the baseline the next reconcile diffs against. */
  snapshot: PairSnapshot | null;
};

const entries: HarnessLogEntry[] = [];
let nextId = 1;

export function readHarnessLog(): HarnessLogEntry[] {
  return entries;
}

export function clearHarnessLog(): void {
  entries.length = 0;
}

export function appendHarnessLog(entry: Omit<HarnessLogEntry, "id">): void {
  entries.unshift({ ...entry, id: nextId++ });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
}

/**
 * Catch the writes that landed after the response, and attribute them to the step
 * that caused them.
 *
 * Called from the board on every render. The alternative - sleeping in the action
 * until the deferred work settles - would defeat the reason it is deferred, so the
 * log picks them up one render later and says so rather than pretending the step
 * saw them.
 */
export function reconcileHarnessLog(
  pairKey: string,
  current: PairSnapshot,
  names: PairNames,
): void {
  const entry = entries.find((candidate) => candidate.pairKey === pairKey && candidate.snapshot);
  if (!entry?.snapshot) return;
  const late = diffSnapshots(entry.snapshot, current, names);
  entry.snapshot = current;
  if (late.length > 0) entry.late.push(...late);
}

/**
 * The rule behind a refusal, matched on the string the code actually throws.
 *
 * Substrings, not equality, because several of these are built with a constant
 * interpolated into them. Keyed on the REASON first and the message second, so a
 * §6.1 refusal resolves to the gate that closed rather than to the one sentence
 * every one of them shares.
 */
const RULES: Array<[string, string]> = [
  ["under 18", "§6.7b age gate - MIN_CLICK_AGE = 18, asserted in the click layer independently of signup."],
  ["banned", "§6.1 receiver state - a banned profile is unclickable and is never named as banned."],
  ["opted out", "§6.1 receiver state - social_visible = false removes them from the graph in both directions."],
  ["paused", "§6.1 receiver state - paused_until is in the future."],
  ["blocked the other", "§6.1 - a block is symmetric here, and neither side learns which way it points."],
  ["suppression", `§B7.1 - "Not feeling it" holds the pair apart for PAIR_SUPPRESSION_DAYS = 90.`],
  ["No profile with that id", "§6.1 - a bad id answers exactly like an unavailable person, so the endpoint is not a profile-existence oracle."],
  ["participant list", "§6.1 - both people must be on event_participants_v, and this refusal never says which of the two failed."],
  ["hidden from this event", "§6.1 - default_attend_visibility = false, byte-identical to not having been there."],
  ["wrapped up now", `§5 - the post-event window is event_end to event_end + POST_EVENT_CLICK_WINDOW_HOURS = 48. The event clock is public, so this one is safe to say plainly.`],
  ["cannot Click yourself", "§2 - a self-click is a validation error, not a receiver-state refusal, because it discloses nothing."],
  ["at your click limit", `§2 rule 5 - DISCOVERY_CLICK_CAP = 20 live clicks, POST_EVENT_CLICK_CAP = 3 per attended event.`],
  ["went unused", "§B7.3 - two free-event no-shows in 90 days withdraws the post-event surface for 30 days. The sender's own state, so it is safe to name."],
  ["already a plan here", "§B4 - one live plan per mutual click. A second suggestion must re-point the first, never stack on it."],
  ["already settled", "§B0/§B6 - a confirmed plan whose event is still joinable is terminal."],
  ["limit of 3 alternative", "§B4 - PROPOSAL_ALTERNATIVES_CAP = 3. Recovering from an event that died underneath the pair spends none of it."],
  ["room for two", "§B4.1 / CAP-5 - a plan needs 2 free seats at propose time, so a sold-out event can never become the live plan."],
  ["no longer available", "SAFE-03 - block, ban and suspend are re-checked before any write to shared coordination state."],
  ["Proposal not found", "§B3 - the actor is not one of the two people in this mutual click. Not a 404 for them, a refusal to act."],
  ["not available to click with right now", "§6.1 R_NOT_ELIGIBLE - the single refusal every receiver-state check collapses to."],
  ["only acts as", "Harness gate 3 - synthetic sessions are limited to the @click.local namespace."],
  ["not available on this environment", "Harness gates 1 and 2 - production deployment, or the QA unlock is not set."],
];

export function ruleFor(reason: string | null, message: string): string | null {
  for (const [needle, rule] of RULES) {
    if (reason?.includes(needle)) return rule;
  }
  for (const [needle, rule] of RULES) {
    if (message.includes(needle)) return rule;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The snapshot, and the diff that turns two of them into English.
// ---------------------------------------------------------------------------

export type PairSnapshot = {
  clicks: Record<string, string>;
  mutual: string | null;
  proposal: string | null;
  suppressed: boolean;
  blocked: boolean;
  seats: Record<string, string>;
  notifications: Record<string, number>;
  emails: Record<string, number>;
};

const EMPTY: PairSnapshot = {
  clicks: {},
  mutual: null,
  proposal: null,
  suppressed: false,
  blocked: false,
  seats: {},
  notifications: {},
  emails: {},
};

/**
 * Everything about this pair that a step could plausibly move, in one shot.
 *
 * Reads rows directly rather than through the repository's view functions: the
 * point is to see what was WRITTEN, including the parts a given person's session
 * is not allowed to see. The per-side views are already rendered in the two
 * columns and answer the other half of the question.
 */
export async function snapshotPair(aId: string, bId: string): Promise<PairSnapshot> {
  const pool = getPostgresPool();
  if (!pool) return EMPTY;
  const pair = [aId, bId];
  const slugs = FIXTURE_SLUGS as unknown as string[];

  const [clicks, mutual, proposal, suppression, block, seats, notifications, emails] =
    await Promise.all([
      pool.query<{ k: string; v: string }>(
        `select c.sender_id::text || '->' || c.receiver_id::text || coalesce('@' || e.slug, '') as k,
                c.status::text || ' / ' || c.surface as v
           from clicks c left join events e on e.id = c.event_id
          where (c.sender_id = $1::uuid and c.receiver_id = $2::uuid)
             or (c.sender_id = $2::uuid and c.receiver_id = $1::uuid)`,
        pair,
      ),
      pool.query<{ v: string }>(
        `select status::text || ' / ' || coord_state::text
                || ' / seen ' || (seen_at_a is not null)::text || (seen_at_b is not null)::text
                || coalesce(' / via ' || connected_reason, '') as v
           from mutual_clicks
          where user_a_id = least($1::uuid, $2::uuid) and user_b_id = greatest($1::uuid, $2::uuid)`,
        pair,
      ),
      pool.query<{ v: string }>(
        `select p.status::text || ' / ' || coalesce(e.slug, 'no event')
                || ' / alts ' || p.alternatives_count::text as v
           from click_proposals p
           join mutual_clicks m on m.id = p.mutual_click_id
           left join events e on e.id = p.suggested_event_id
          where m.user_a_id = least($1::uuid, $2::uuid) and m.user_b_id = greatest($1::uuid, $2::uuid)
          order by p.created_at desc limit 1`,
        pair,
      ),
      pool.query(
        `select 1 from pair_suppressions
          where user_a_id = least($1::uuid, $2::uuid) and user_b_id = greatest($1::uuid, $2::uuid)
            and expires_at > now()`,
        pair,
      ),
      pool.query(
        `select 1 from user_blocks
          where (blocker_profile_id = $1::uuid and blocked_profile_id = $2::uuid)
             or (blocker_profile_id = $2::uuid and blocked_profile_id = $1::uuid)`,
        pair,
      ),
      // Seats on the fixture events, for both people and in total. "Both going" and
      // "it sold out underneath them" are only legible if both halves are visible.
      pool.query<{ k: string; v: string }>(
        `select e.slug as k,
                cap.seats_taken::text || '/' || e.capacity::text
                  || ' · a=' || coalesce(
                       (select ea.status::text from event_attendees ea
                         where ea.event_id = e.id and ea.profile_id = $1::uuid), '-')
                  || ' b=' || coalesce(
                       (select ea.status::text from event_attendees ea
                         where ea.event_id = e.id and ea.profile_id = $2::uuid), '-') as v
           from events e join event_capacity_v cap on cap.event_id = e.id
          where e.slug = any($3::text[])`,
        [aId, bId, slugs],
      ),
      pool.query<{ k: string; n: string }>(
        `select profile_id::text as k, count(*)::text as n from notifications
          where profile_id = any($1::uuid[]) group by profile_id`,
        [pair],
      ),
      pool.query<{ k: string; n: string }>(
        `select to_profile_id::text as k, count(*)::text as n from email_events
          where to_profile_id = any($1::uuid[]) group by to_profile_id`,
        [pair],
      ),
    ]);

  const map = (rows: Array<{ k: string; v: string }>) =>
    Object.fromEntries(rows.map((row) => [row.k, row.v]));
  const counts = (rows: Array<{ k: string; n: string }>) =>
    Object.fromEntries(rows.map((row) => [row.k, Number(row.n)]));

  return {
    clicks: map(clicks.rows),
    mutual: mutual.rows[0]?.v ?? null,
    proposal: proposal.rows[0]?.v ?? null,
    suppressed: suppression.rows.length > 0,
    blocked: block.rows.length > 0,
    seats: map(seats.rows),
    notifications: counts(notifications.rows),
    emails: counts(emails.rows),
  };
}

/** Name the two people so the diff reads as people, not uuids. */
export type PairNames = { aId: string; bId: string; aName: string; bName: string };

export function diffSnapshots(
  before: PairSnapshot,
  after: PairSnapshot,
  names: PairNames,
): string[] {
  const who = (id: string) => (id === names.aId ? names.aName : id === names.bId ? names.bName : "someone");
  const arrow = (key: string) => {
    const [pairPart, slug] = key.split("@");
    const [from, to] = pairPart.split("->");
    return `${who(from)} → ${who(to)}${slug ? ` @ ${slug}` : ""}`;
  };
  const lines: string[] = [];

  for (const key of new Set([...Object.keys(before.clicks), ...Object.keys(after.clicks)])) {
    const was = before.clicks[key];
    const now = after.clicks[key];
    if (was === now) continue;
    if (!was) lines.push(`click created · ${arrow(key)} · ${now}`);
    else if (!now) lines.push(`click deleted · ${arrow(key)} · was ${was}`);
    else lines.push(`click · ${arrow(key)} · ${was} → ${now}`);
  }

  if (before.mutual !== after.mutual) {
    if (!before.mutual) lines.push(`mutual click formed · ${after.mutual}`);
    else if (!after.mutual) lines.push(`mutual click deleted · was ${before.mutual}`);
    else lines.push(`mutual click · ${before.mutual} → ${after.mutual}`);
  }

  if (before.proposal !== after.proposal) {
    if (!before.proposal) lines.push(`plan created · ${after.proposal}`);
    else if (!after.proposal) lines.push(`plan deleted · was ${before.proposal}`);
    else lines.push(`plan · ${before.proposal} → ${after.proposal}`);
  }

  if (before.suppressed !== after.suppressed) {
    lines.push(after.suppressed ? "pair suppression written · 90 days" : "pair suppression cleared");
  }
  if (before.blocked !== after.blocked) {
    lines.push(after.blocked ? "block written" : "block cleared");
  }

  for (const slug of new Set([...Object.keys(before.seats), ...Object.keys(after.seats)])) {
    if (before.seats[slug] !== after.seats[slug]) {
      lines.push(`seats · ${slug} · ${before.seats[slug] ?? "gone"} → ${after.seats[slug] ?? "gone"}`);
    }
  }

  for (const id of [names.aId, names.bId]) {
    const dn = (after.notifications[id] ?? 0) - (before.notifications[id] ?? 0);
    if (dn !== 0) lines.push(`${who(id)} notified ×${dn}`);
    const de = (after.emails[id] ?? 0) - (before.emails[id] ?? 0);
    if (de !== 0) lines.push(`${who(id)} emailed ×${de} (logged to email_events)`);
  }

  return lines;
}
