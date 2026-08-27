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
