import "server-only";
import type { Session } from "next-auth";
import { getPostgresPool } from "@/lib/postgres";
import { isProductionDeployment } from "@/lib/runtime-mode";
import { isTestSwitcherUnlocked } from "@/lib/test-switcher";
import {
  getMutualClicksForSession,
  getPostEventClickPrompts,
  getProposalsForSession,
  getViewerClickState,
  type MutualClickEntry,
  type ProposalEntry,
} from "@/lib/event-repository";

/**
 * The two-person click harness behind /test-click.
 *
 * WHY IT ACTS AS PEOPLE RATHER THAN SWITCHING COOKIES
 * ---------------------------------------------------
 * Every read and write in the click mechanic takes a `Session` and does nothing
 * with it but read `session.user.email` (getSessionEmail, event-repository.ts:1747).
 * A click is a two-sided fact - one side's send is invisible until the other side
 * reciprocates - so a harness driven by ONE browser session can only ever show you
 * half of it, and testing the half that matters means signing out and back in
 * between every step. Minting a synthetic session per side lets one page drive both
 * halves and render both views of the same instant, which is the only way the
 * privacy invariants ("they are never told") are observable at all.
 *
 * That is a real power, so it carries a real boundary, enforced in THREE places
 * that each fail closed:
 *
 *   1. `isProductionDeployment()` - the harness does not exist on letsclick.app.
 *   2. `isTestSwitcherUnlocked()` - the same gate the QA persona switcher uses.
 *      Acting as an account is exactly what that switcher hands out, so this must
 *      not be an easier door to the same room.
 *   3. `@click.local` only - the namespace 032_clear_seed_data.sql sweeps and the
 *      test-login provider already refuses anything outside of. A real Google
 *      account can never be impersonated here even by an unlocked admin.
 *
 * The third one is the load-bearing one, and it is checked at the point the
 * session is minted rather than at the page, so no future caller can route round
 * it by importing a lower-level helper.
 */

const QA_NAMESPACE = "@click.local";

export class HarnessRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessRefusedError";
  }
}

/** Gate 1 + 2. Every server action and the page itself run this first. */
export async function isHarnessAllowed(): Promise<boolean> {
  if (isProductionDeployment()) return false;
  return isTestSwitcherUnlocked();
}

export async function assertHarnessAllowed(): Promise<void> {
  if (!(await isHarnessAllowed())) {
    throw new HarnessRefusedError("The click harness is not available on this environment.");
  }
}

/**
 * Gate 3, and the mint. Returns a Session shaped exactly like the one `auth()`
 * hands the repository - email is the only field any click path reads, but name
 * and image are filled from the row so anything that logs a display name logs the
 * truth rather than the address.
 */
export async function harnessSession(email: string): Promise<Session> {
  await assertHarnessAllowed();
  const address = email.trim().toLowerCase();
  if (!address.endsWith(QA_NAMESPACE)) {
    throw new HarnessRefusedError(`The harness only acts as ${QA_NAMESPACE} accounts.`);
  }
  const pool = getPostgresPool();
  if (!pool) throw new HarnessRefusedError("No database connection.");
  // Must ALREADY exist. ensureProfileForSession is an upsert, so a typo'd address
  // would otherwise mint a brand new profile as a side effect of "testing".
  const found = await pool.query<{ display_name: string; photo_url: string | null }>(
    `select display_name, photo_url from profiles where email = $1 limit 1`,
    [address],
  );
  const row = found.rows[0];
  if (!row) throw new HarnessRefusedError(`No QA profile for ${address}.`);
  return {
    user: { email: address, name: row.display_name, image: row.photo_url },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } as Session;
}

export type HarnessPerson = {
  id: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  age: number | null;
  suburb: string | null;
  /** Every reason this person cannot take part, in the mechanic's own terms. */
  blockers: string[];
};

/**
 * The people the harness can drive: QA-namespace attendees who are actually
 * click-eligible. `blockers` is not decoration - a persona with no photo is
 * invisible to discovery and a persona with no birth date is refused at send,
 * and both failures otherwise read as "clicking is broken".
 */
export async function listHarnessPeople(): Promise<HarnessPerson[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  const result = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    photo_url: string | null;
    age: number | null;
    suburb: string | null;
    is_banned: boolean;
    social_visible: boolean;
    paused: boolean;
  }>(
    `
      select id::text, email::text, display_name, photo_url, age, suburb,
             is_banned, social_visible,
             (paused_until is not null and paused_until > now()) as paused
        from profiles
       where email like '%' || $1
         and role <> 'merchant'
       order by display_name
    `,
    [QA_NAMESPACE],
  );
  return result.rows.map((row) => {
    const blockers: string[] = [];
    if (!row.photo_url) blockers.push("no photo - invisible to discovery");
    if ((row.age ?? 0) < 18) blockers.push("no date of birth - every send is refused");
    if (row.is_banned) blockers.push("banned");
    if (!row.social_visible) blockers.push("opted out of the social graph");
    if (row.paused) blockers.push("clicking paused");
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      photoUrl: row.photo_url,
      age: row.age,
      suburb: row.suburb,
      blockers,
    };
  });
}

export type RawClick = {
  id: string;
  direction: "a_to_b" | "b_to_a";
  surface: string;
  status: string;
  eventTitle: string | null;
  expiresAt: string;
  createdAt: string;
};

export type RawMutual = {
  id: string;
  status: string;
  coordState: string;
  connectedReason: string | null;
  mutualAt: string;
  expiresAt: string;
  seenByA: boolean;
  seenByB: boolean;
};

export type RawProposal = {
  id: string;
  status: string;
  eventTitle: string | null;
  proposedBy: string | null;
  alternativesCount: number;
  expiresAt: string;
  confirmedAt: string | null;
};

/** One side's view, assembled from the SAME functions the real surfaces call. */
export type SideView = {
  email: string;
  displayName: string;
  /** getViewerClickState - what the other person's profile card shows this side. */
  seesClicked: boolean;
  seesMutual: boolean;
  /** getMutualClicksForSession, narrowed to this pair. */
  mutual: MutualClickEntry | null;
  /** getProposalsForSession, narrowed to this pair. */
  proposal: ProposalEntry | null;
  /** How many post-event prompts this side is being asked right now. */
  postEventPrompts: number;
  error: string | null;
};

export type PairState = {
  a: HarnessPerson;
  b: HarnessPerson;
  clicks: RawClick[];
  mutual: RawMutual | null;
  proposal: RawProposal | null;
  suppressedUntil: string | null;
  blocked: boolean;
  viewA: SideView;
  viewB: SideView;
};

async function sideView(person: HarnessPerson, other: HarnessPerson): Promise<SideView> {
  const base = {
    email: person.email,
    displayName: person.displayName,
    seesClicked: false,
    seesMutual: false,
    mutual: null,
    proposal: null,
    postEventPrompts: 0,
    error: null as string | null,
  };
  try {
    const session = await harnessSession(person.email);
    const [viewer, mutuals, proposals, prompts] = await Promise.all([
      getViewerClickState(session, other.id),
      getMutualClicksForSession(session),
      getProposalsForSession(session),
      getPostEventClickPrompts(session),
    ]);
    return {
      ...base,
      seesClicked: viewer.alreadyClicked,
      seesMutual: viewer.isMutual,
      mutual: mutuals.find((m) => m.otherProfileId === other.id) ?? null,
      proposal: proposals.find((p) => p.otherId === other.id) ?? null,
      postEventPrompts: prompts.length,
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function readPairState(
  aEmail: string,
  bEmail: string,
): Promise<PairState | null> {
  await assertHarnessAllowed();
  const people = await listHarnessPeople();
  const a = people.find((p) => p.email === aEmail);
  const b = people.find((p) => p.email === bEmail);
  if (!a || !b || a.id === b.id) return null;

  const pool = getPostgresPool();
  if (!pool) return null;

  const [clicks, mutual, proposal, suppression, block] = await Promise.all([
    pool.query<{
      id: string;
      sender_id: string;
      surface: string;
      status: string;
      event_title: string | null;
      expires_at: string;
      created_at: string;
    }>(
      `select c.id::text, c.sender_id::text, c.surface, c.status::text,
              e.title as event_title, c.expires_at::text, c.created_at::text
         from clicks c
         left join events e on e.id = c.event_id
        where (c.sender_id = $1::uuid and c.receiver_id = $2::uuid)
           or (c.sender_id = $2::uuid and c.receiver_id = $1::uuid)
        order by c.created_at desc`,
      [a.id, b.id],
    ),
    pool.query<{
      id: string;
      status: string;
      coord_state: string;
      connected_reason: string | null;
      mutual_at: string;
      expires_at: string;
      user_a_id: string;
      seen_at_a: string | null;
      seen_at_b: string | null;
    }>(
      `select id::text, status::text, coord_state::text, connected_reason,
              mutual_at::text, expires_at::text, user_a_id::text,
              seen_at_a::text, seen_at_b::text
         from mutual_clicks
        where user_a_id = least($1::uuid, $2::uuid)
          and user_b_id = greatest($1::uuid, $2::uuid)
        order by created_at desc
        limit 1`,
      [a.id, b.id],
    ),
    pool.query<{
      id: string;
      status: string;
      event_title: string | null;
      proposed_by: string | null;
      alternatives_count: number;
      expires_at: string;
      confirmed_at: string | null;
    }>(
      `select p.id::text, p.status::text, e.title as event_title,
              pr.display_name as proposed_by, p.alternatives_count,
              p.expires_at::text, p.confirmed_at::text
         from click_proposals p
         join mutual_clicks m on m.id = p.mutual_click_id
         left join events e on e.id = p.suggested_event_id
         left join profiles pr on pr.id = p.proposed_by
        where m.user_a_id = least($1::uuid, $2::uuid)
          and m.user_b_id = greatest($1::uuid, $2::uuid)
        order by p.created_at desc
        limit 1`,
      [a.id, b.id],
    ),
    pool.query<{ expires_at: string }>(
      `select expires_at::text from pair_suppressions
        where user_a_id = least($1::uuid, $2::uuid)
          and user_b_id = greatest($1::uuid, $2::uuid)
          and expires_at > now()
        limit 1`,
      [a.id, b.id],
    ),
    pool.query<{ blocked: boolean }>(
      `select exists (
         select 1 from user_blocks
          where (blocker_profile_id = $1::uuid and blocked_profile_id = $2::uuid)
             or (blocker_profile_id = $2::uuid and blocked_profile_id = $1::uuid)
       ) as blocked`,
      [a.id, b.id],
    ),
  ]);

  const mutualRow = mutual.rows[0] ?? null;
  // user_a_id is the LOW uuid, not "the person on the left" - so which of
  // seen_at_a / seen_at_b belongs to whom depends on the ordered pair, never on
  // the order the harness happens to display them in.
  const aIsUserA = mutualRow ? mutualRow.user_a_id === a.id : true;

  const [viewA, viewB] = await Promise.all([sideView(a, b), sideView(b, a)]);

  return {
    a,
    b,
    clicks: clicks.rows.map((row) => ({
      id: row.id,
      direction: row.sender_id === a.id ? "a_to_b" : "b_to_a",
      surface: row.surface,
      status: row.status,
      eventTitle: row.event_title,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
    mutual: mutualRow
      ? {
          id: mutualRow.id,
          status: mutualRow.status,
          coordState: mutualRow.coord_state,
          connectedReason: mutualRow.connected_reason,
          mutualAt: mutualRow.mutual_at,
          expiresAt: mutualRow.expires_at,
          seenByA: !!(aIsUserA ? mutualRow.seen_at_a : mutualRow.seen_at_b),
          seenByB: !!(aIsUserA ? mutualRow.seen_at_b : mutualRow.seen_at_a),
        }
      : null,
    proposal: proposal.rows[0]
      ? {
          id: proposal.rows[0].id,
          status: proposal.rows[0].status,
          eventTitle: proposal.rows[0].event_title,
          proposedBy: proposal.rows[0].proposed_by,
          alternativesCount: proposal.rows[0].alternatives_count,
          expiresAt: proposal.rows[0].expires_at,
          confirmedAt: proposal.rows[0].confirmed_at,
        }
      : null,
    suppressedUntil: suppression.rows[0]?.expires_at ?? null,
    blocked: !!block.rows[0]?.blocked,
    viewA,
    viewB,
  };
}

/**
 * Put the pair back to "never met".
 *
 * DESTRUCTIVE, and deliberately narrow. It resolves BOTH ids from the
 * `@click.local` roster before it deletes anything, so a pair containing a real
 * account cannot be passed in - the lookup simply will not find them. Nothing
 * here is scoped by "everything in this table"; every statement is keyed on the
 * two ids.
 *
 * Scenarios are only worth running if they are re-runnable: a suppression lasts
 * 90 days and a mutual is unique per pair while active, so without this the
 * second run of "not feeling it" is refused for a quarter of a year.
 */
export async function resetPair(aEmail: string, bEmail: string): Promise<string[]> {
  await assertHarnessAllowed();
  const people = await listHarnessPeople();
  const a = people.find((p) => p.email === aEmail.trim().toLowerCase());
  const b = people.find((p) => p.email === bEmail.trim().toLowerCase());
  if (!a || !b) throw new HarnessRefusedError("Both people must be QA personas.");

  const pool = getPostgresPool();
  if (!pool) throw new HarnessRefusedError("No database connection.");
  const client = await pool.connect();
  const cleared: string[] = [];
  try {
    await client.query("begin");
    const pair = [a.id, b.id];
    // click_proposals cascades off mutual_clicks, so deleting the mutual takes
    // the coordination history with it - the ON DELETE CASCADE in 049.
    const steps: Array<[string, string]> = [
      [
        "clicks",
        `delete from clicks
          where (sender_id = $1::uuid and receiver_id = $2::uuid)
             or (sender_id = $2::uuid and receiver_id = $1::uuid)`,
      ],
      [
        "mutual_clicks (+ proposals)",
        `delete from mutual_clicks
          where user_a_id = least($1::uuid, $2::uuid)
            and user_b_id = greatest($1::uuid, $2::uuid)`,
      ],
      [
        "pair_suppressions",
        `delete from pair_suppressions
          where user_a_id = least($1::uuid, $2::uuid)
            and user_b_id = greatest($1::uuid, $2::uuid)`,
      ],
      [
        "click_swaps",
        `delete from click_swaps where sender_id = $1::uuid or sender_id = $2::uuid`,
      ],
      [
        "post_event_click_answers",
        `delete from post_event_click_answers where profile_id = $1::uuid or profile_id = $2::uuid`,
      ],
      [
        "user_blocks",
        `delete from user_blocks
          where (blocker_profile_id = $1::uuid and blocked_profile_id = $2::uuid)
             or (blocker_profile_id = $2::uuid and blocked_profile_id = $1::uuid)`,
      ],
    ];
    for (const [label, sql] of steps) {
      const result = await client.query(sql, pair);
      if (result.rowCount) cleared.push(`${label}: ${result.rowCount}`);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return cleared.length > 0 ? cleared : ["nothing to clear - the pair was already fresh"];
}

export type ClockTarget = "clicks" | "mutual" | "proposal";

/**
 * Wind one of the three clocks back so the real sweep can act on it.
 *
 * The mechanic runs on three INDEPENDENT windows - a discovery click's 7 days, a
 * mutual's own 7 days, and a proposal's 48 hours - and every expiry rule reads
 * `expires_at > now()`. Waiting a week to see a lapse is not a test, and writing
 * the LAPSED state directly would be worse than not testing at all: it produces a
 * state the app never actually makes, and skips the very sweep under test.
 *
 * So this only backdates the deadline. `expireClickLifecycles()` - the real cron
 * body, untouched - is what then does the expiring, exactly as it would in a week.
 */
export async function windBackClock(
  aEmail: string,
  bEmail: string,
  target: ClockTarget,
): Promise<string> {
  await assertHarnessAllowed();
  const people = await listHarnessPeople();
  const a = people.find((p) => p.email === aEmail.trim().toLowerCase());
  const b = people.find((p) => p.email === bEmail.trim().toLowerCase());
  if (!a || !b) throw new HarnessRefusedError("Both people must be QA personas.");
  const pool = getPostgresPool();
  if (!pool) throw new HarnessRefusedError("No database connection.");

  const pair = [a.id, b.id];
  if (target === "clicks") {
    const result = await pool.query(
      `update clicks set expires_at = now() - interval '1 minute', updated_at = now()
        where status = 'pending'
          and ((sender_id = $1::uuid and receiver_id = $2::uuid)
            or (sender_id = $2::uuid and receiver_id = $1::uuid))`,
      pair,
    );
    return `${result.rowCount ?? 0} pending click(s) backdated - run the sweep to expire them.`;
  }
  if (target === "mutual") {
    const result = await pool.query(
      `update mutual_clicks set expires_at = now() - interval '1 minute', updated_at = now()
        where status = 'active'
          and user_a_id = least($1::uuid, $2::uuid)
          and user_b_id = greatest($1::uuid, $2::uuid)`,
      pair,
    );
    return `${result.rowCount ?? 0} active mutual backdated - run the sweep to end it.`;
  }
  const result = await pool.query(
    `update click_proposals p set expires_at = now() - interval '1 minute', updated_at = now()
       from mutual_clicks m
      where m.id = p.mutual_click_id and p.status = 'pending'
        and m.user_a_id = least($1::uuid, $2::uuid)
        and m.user_b_id = greatest($1::uuid, $2::uuid)`,
    pair,
  );
  return `${result.rowCount ?? 0} pending plan(s) backdated - run the sweep to lapse them.`;
}

/**
 * Fill the fixture plan event to the brim so an agreed plan can be watched
 * falling through underneath the pair - the S14 "that one just filled up" path.
 *
 * Seats are taken by OTHER QA people, never by the pair, because the pair losing
 * the event to their own booking is not the scenario. Uses `event_capacity_v` to
 * work out how many are actually needed, so it is correct whatever the fixture's
 * capacity is.
 */
export async function fillEventToCapacity(slug: string, exclude: string[]): Promise<string> {
  await assertHarnessAllowed();
  const pool = getPostgresPool();
  if (!pool) throw new HarnessRefusedError("No database connection.");
  if (!slug.startsWith("qa-")) {
    throw new HarnessRefusedError("Only QA fixture events can be filled by the harness.");
  }
  const result = await pool.query<{ added: number }>(
    `
      with target as (
        select e.id, cap.available
          from events e join event_capacity_v cap on cap.event_id = e.id
         where e.slug = $1
      ),
      fillers as (
        select p.id from profiles p, target
         where p.email like '%@click.local' and p.role <> 'merchant'
           and p.id <> all($2::uuid[])
           and not exists (
             select 1 from event_attendees ea
              where ea.event_id = target.id and ea.profile_id = p.id
                and ea.status in ('confirmed', 'waitlisted')
           )
         limit (select available from target)
      )
      insert into event_attendees (event_id, profile_id, status, visible_to_attendees)
      select target.id, fillers.id, 'confirmed', true from target, fillers
      returning 1 as added
    `,
    [slug, exclude],
  );
  const added = result.rowCount ?? 0;
  return added > 0
    ? `${added} seat(s) taken by other QA people - ${slug} is now full.`
    : `${slug} had no free seats to take (it is already full).`;
}

/**
 * A QA persona who is NOT one of the pair, for the authorization edge case.
 *
 * Acting on a mutual click you are not part of has to be refused, and there is no
 * way to check that from inside a two-person board without a third person to try
 * it as. `assertProposalParticipant` (event-repository.ts:16022) joins the mutual
 * on the actor's own id, so an outsider gets "Proposal not found" - a refusal to
 * act, deliberately shaped like an absence rather than a "not yours".
 */
export async function pickOutsider(aEmail: string, bEmail: string): Promise<HarnessPerson> {
  const people = await listHarnessPeople();
  const outsider = people.find(
    (person) =>
      person.email !== aEmail.trim().toLowerCase() &&
      person.email !== bEmail.trim().toLowerCase() &&
      person.blockers.length === 0,
  );
  if (!outsider) throw new HarnessRefusedError("No third QA persona to act as an outsider.");
  return outsider;
}

/**
 * Take one person off a fixture event's guest list.
 *
 * The post-event surface refuses when the two people were not both there, and it
 * refuses with the SAME sentence as every other receiver-state gate - so the only
 * way to see that rule fire is to make it true. Fixture events only, and only the
 * actor's own seat.
 */
export async function leaveFixtureEvent(email: string, slug: string): Promise<string> {
  await assertHarnessAllowed();
  const people = await listHarnessPeople();
  const person = people.find((candidate) => candidate.email === email.trim().toLowerCase());
  if (!person) throw new HarnessRefusedError("Not a QA persona.");
  if (!slug.startsWith("qa-")) {
    throw new HarnessRefusedError("Only QA fixture events can be left from the harness.");
  }
  const pool = getPostgresPool();
  if (!pool) throw new HarnessRefusedError("No database connection.");
  const result = await pool.query(
    `delete from event_attendees ea using events e
      where e.id = ea.event_id and e.slug = $1 and ea.profile_id = $2::uuid`,
    [slug, person.id],
  );
  return result.rowCount
    ? `${person.displayName} is no longer on ${slug}'s guest list.`
    : `${person.displayName} was not on ${slug} to begin with.`;
}

/** Other QA personas the actor can spend a click budget at, most recent first. */
export async function otherPeopleFor(
  email: string,
  exclude: string[],
  limit: number,
): Promise<HarnessPerson[]> {
  const people = await listHarnessPeople();
  const skip = new Set([email.trim().toLowerCase(), ...exclude.map((e) => e.trim().toLowerCase())]);
  return people.filter((person) => !skip.has(person.email) && person.blockers.length === 0).slice(0, limit);
}
