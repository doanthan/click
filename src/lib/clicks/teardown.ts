// Safety teardown — the §6.5 (block) / §6.7a (ban) state-machine sever, plus the
// §B4 coordination re-check gate (SAFE-01/02/03/06).
//
// Pure SQL helpers, no session / no Next imports — every function takes an OPEN
// transaction `client` so the caller owns the transaction boundary and can do the
// flag-write + teardown atomically. Shared by:
//   • blockUser                  → severPairCoordination   (one pair)
//   • banMemberAsAdmin           → severAllCoordinationForUser (every pair)
//   • confirm / propose-alternative → pairCoordinationAllowed (the re-check)
//
// Terminal states written (the read + coordination queries treat all three as
// non-live, so a torn-down pair drops from every mutual/proposal surface at once):
//   clicks.status          -> 'invalidated'  (§3 terminal; refunds the sender's
//                                              per-process cap, which excludes it)
//   mutual_clicks.status   -> 'expired'      (§B2 / B7.9: block and account deletion
//                                              are THE permanent exit - "NEVER
//                                              resurfaces ... the one real door".
//                                              Distinct from 'released', the 7-day
//                                              silence lapse (30d cooldown, then the
//                                              pair may rediscover), and 'suppressed',
//                                              the "not feeling it" soft-no (90d).
//                                              coord_state -> 'dormant')
//   click_proposals.status -> 'withdrawn'    (the live shared plan is pulled)
//
// These three mutual terminals were rotated one place for a while - a block wrote
// 'suppressed', "not feeling it" wrote 'released', and the 7-day lapse wrote 'expired'.
// Nothing gated on the difference at the time, so it was invisible; it stopped being
// invisible the moment a rediscovery cooldown and a "past clicks" shelf started reading
// the status to decide whether a pair may ever meet again.
//
// We mark terminal status rather than DELETE so the rows stay as an auditable
// tombstone and the partial-unique indexes (active mutual / pending proposal /
// pending discovery click) free up cleanly.

import type { PoolClient } from "pg";

// ---------------------------------------------------------------------------
// Pair-scoped sever (block). Order matters: clicks first, then the proposal
// (its join needs the still-active mutual), then end the mutual.
// ---------------------------------------------------------------------------
export async function severPairCoordination(
  client: PoolClient,
  profileAId: string,
  profileBId: string,
): Promise<void> {
  // 1. Invalidate every still-pending click between the pair (either direction,
  //    either process).
  await client.query(
    `update clicks set status = 'invalidated', updated_at = now()
       where status = 'pending'
         and ((sender_id = $1::uuid and receiver_id = $2::uuid)
           or (sender_id = $2::uuid and receiver_id = $1::uuid))`,
    [profileAId, profileBId],
  );

  // 2. Withdraw any live proposal (pending or accepted) under the pair's active
  //    mutual — done before the mutual is ended so the subselect still finds it.
  await client.query(
    `update click_proposals set status = 'withdrawn', updated_at = now()
       where status in ('pending', 'accepted')
         and mutual_click_id in (
           select id from mutual_clicks
           where status = 'active'
             and ((user_a_id = $1::uuid and user_b_id = $2::uuid)
               or (user_a_id = $2::uuid and user_b_id = $1::uuid))
         )`,
    [profileAId, profileBId],
  );

  // 3. End the pair's active mutual on the permanent terminal (B7.9: block never
  //    resurfaces, so this is 'expired', not the re-clickable 'released'/'suppressed').
  await client.query(
    `update mutual_clicks
        set status = 'expired', coord_state = 'dormant', ended_at = now(), updated_at = now()
      where status = 'active'
        and ((user_a_id = $1::uuid and user_b_id = $2::uuid)
          or (user_a_id = $2::uuid and user_b_id = $1::uuid))`,
    [profileAId, profileBId],
  );
}

// ---------------------------------------------------------------------------
// User-scoped sever (ban, §6.7a) — every pair the banned user is part of.
// ---------------------------------------------------------------------------
export async function severAllCoordinationForUser(
  client: PoolClient,
  profileId: string,
): Promise<void> {
  // 1. Invalidate every pending click the user sent OR received.
  await client.query(
    `update clicks set status = 'invalidated', updated_at = now()
       where status = 'pending'
         and (sender_id = $1::uuid or receiver_id = $1::uuid)`,
    [profileId],
  );

  // 2. Withdraw every live proposal under any of the user's active mutuals.
  await client.query(
    `update click_proposals set status = 'withdrawn', updated_at = now()
       where status in ('pending', 'accepted')
         and mutual_click_id in (
           select id from mutual_clicks
           where status = 'active' and (user_a_id = $1::uuid or user_b_id = $1::uuid)
         )`,
    [profileId],
  );

  // 3. End every active mutual the user is in, on the permanent terminal.
  await client.query(
    `update mutual_clicks
        set status = 'expired', coord_state = 'dormant', ended_at = now(), updated_at = now()
      where status = 'active' and (user_a_id = $1::uuid or user_b_id = $1::uuid)`,
    [profileId],
  );
}

// ---------------------------------------------------------------------------
// Coordination re-check (SAFE-02/03/04). A shared-plan MUTATION (confirm a plan,
// counter-propose, RSVP-reminder) must be refused/skipped when, for the pair:
//   • either has blocked the other (either direction), OR
//   • either party is banned or suspended.
// Mute is deliberately NOT here (SAFE-09): mute suppresses the in-app ping only,
// never the state machine — that gate stays on the notification insert.
// ---------------------------------------------------------------------------
export async function pairCoordinationAllowed(
  client: PoolClient,
  profileAId: string,
  profileBId: string,
): Promise<boolean> {
  const { rows } = await client.query<{ blocked: boolean; frozen: boolean }>(
    `select
       exists (
         select 1 from user_blocks
         where (blocker_profile_id = $1::uuid and blocked_profile_id = $2::uuid)
            or (blocker_profile_id = $2::uuid and blocked_profile_id = $1::uuid)
       ) as blocked,
       exists (
         select 1 from profiles
         where id in ($1::uuid, $2::uuid)
           and (is_banned or suspended_at is not null)
       ) as frozen`,
    [profileAId, profileBId],
  );
  const r = rows[0];
  return !(r?.blocked || r?.frozen);
}

// ---------------------------------------------------------------------------
// §B5.6 — a partner cancels their booking during `confirmed_together`.
//
// Marked launch-blocking in the spec, and it existed in no form: not one cancel
// path touched mutual_clicks or click_proposals. The survivor kept a "Going with
// [Name]" plan pointing at somebody who had cancelled (the ghost plan §B0 exists
// to prevent), and the canceller kept being told to "grab your seat" for the event
// they had just left - the guilt mechanic step 7 bans by name.
//
// This runs INSIDE the cancel's own transaction, matching this module's convention,
// so the booking flip and the coordination teardown cannot come apart.
//
// The seven steps, in order:
//   1. Re-evaluate §B5.3 FIRST - if the pair still both hold seats on some OTHER
//      shared future event, confirmed_together stands, re-pointed. No teardown, no
//      notification. (A pair with two plans does not lose both.)
//   2. coord_state -> 'open'. The mutual is UNTOUCHED - status stays 'active'; a
//      cancelled attempt is a failed attempt like any other (§B0).
//   3. The accepted proposal retires to 'partner_cancelled', which is what the
//      drawer reads to render S18 instead of the peak.
//   4. The canceller's pending clicks for that event -> 'invalidated' (§6.2).
//   5/6/7 are the caller's: the survivor notification, priority re-suggest, and
//      "the canceller gets nothing extra" (which falls out of retiring the
//      proposal - it is what was driving both of their re-book prompts).
//
// Returns one row per survivor so the caller can notify AFTER it commits. Empty
// when nothing was torn down, which makes the both-cancel case idempotent for
// free: the second cancel finds coord_state already 'open' and matches nothing.
// ---------------------------------------------------------------------------
export type PartnerCancelSurvivor = {
  mutualId: string;
  survivorId: string;
  cancellerName: string;
  eventTitle: string;
};

export async function severConfirmedTogetherForCancel(
  client: PoolClient,
  cancellerProfileId: string,
  eventId: string,
): Promise<PartnerCancelSurvivor[]> {
  // Step 1 + 2 + 3 in one statement. The `not exists` arm is the §B5.3 re-point
  // guard: if another shared upcoming event still has BOTH of them in it, this
  // mutual is skipped entirely and keeps confirmed_together.
  const torn = await client.query<{
    mutual_id: string;
    survivor_id: string;
    event_title: string;
  }>(
    `
      with affected as (
        select m.id,
               case when m.user_a_id = $1::uuid then m.user_b_id else m.user_a_id end as survivor_id
        from mutual_clicks m
        where m.status = 'active'
          and m.coord_state = 'confirmed_together'
          and (m.user_a_id = $1::uuid or m.user_b_id = $1::uuid)
          -- The partner is still going to THIS event: that is what makes them a
          -- survivor rather than someone who already left too.
          and exists (
            select 1 from event_participants_v pv
            where pv.event_id = $2::uuid
              and pv.profile_id = case when m.user_a_id = $1::uuid then m.user_b_id else m.user_a_id end
          )
          -- Step 1: no OTHER shared future event holds them both.
          and not exists (
            select 1
            from events e2
            where e2.id <> $2::uuid
              and e2.starts_at > now()
              and e2.status in ('live', 'featured')
              and exists (
                select 1 from event_participants_v pv
                where pv.event_id = e2.id and pv.profile_id = m.user_a_id
              )
              and exists (
                select 1 from event_participants_v pv
                where pv.event_id = e2.id and pv.profile_id = m.user_b_id
              )
          )
      ),
      reopened as (
        update mutual_clicks m
        set coord_state = 'open', updated_at = now()
        from affected a
        where m.id = a.id
        returning m.id
      ),
      retired as (
        update click_proposals cp
        set status = 'partner_cancelled', updated_at = now()
        from affected a
        where cp.mutual_click_id = a.id
          and cp.status in ('pending', 'accepted')
          and cp.suggested_event_id = $2::uuid
        returning cp.mutual_click_id
      )
      -- The two UPDATE CTEs need no reference from here: Postgres runs
      -- data-modifying statements in WITH exactly once and always to completion,
      -- whether or not the primary query reads their output. They also share this
      -- statement's snapshot, so both see the same 'affected' set.
      select a.id::text as mutual_id,
             a.survivor_id::text as survivor_id,
             e.title as event_title
      from affected a
      join events e on e.id = $2::uuid
    `,
    [cancellerProfileId, eventId],
  );

  if (torn.rowCount === 0) return [];

  // Step 4 (§6.2): the canceller's clicks for that event are invalidated in the
  // same transaction as the cancellation. 'pending' only - an already-formed
  // mutual is never unmade.
  await client.query(
    `update clicks set status = 'invalidated', updated_at = now()
     where event_id = $2::uuid and status = 'pending'
       and (sender_id = $1::uuid or receiver_id = $1::uuid)`,
    [cancellerProfileId, eventId],
  );

  const canceller = await client.query<{ display_name: string }>(
    `select display_name from profiles where id = $1::uuid`,
    [cancellerProfileId],
  );
  const cancellerName = canceller.rows[0]?.display_name ?? "They";

  return torn.rows.map((r) => ({
    mutualId: r.mutual_id,
    survivorId: r.survivor_id,
    cancellerName,
    eventTitle: r.event_title,
  }));
}
