// Step 2.2 safety teardown + re-check test (SAFE-01 / SAFE-03 / SAFE-06).
//
// Drives the EXACT teardown SQL from src/lib/clicks/teardown.ts against the real
// schema, asserting the launch-blocking invariants the audit calls for:
//
//   • block (severPairCoordination): the pair's pending clicks -> invalidated, the
//     active mutual -> suppressed/dormant/ended, the live proposal -> withdrawn; and
//     pairCoordinationAllowed() then returns FALSE (so confirm/propose refuse).
//   • ban  (severAllCoordinationForUser): the SAME teardown across EVERY pair the
//     banned user is in, and pairCoordinationAllowed() FALSE via is_banned.
//   • suspend = freeze, NOT teardown: a suspended partner makes pairCoordinationAllowed()
//     FALSE, but the mutual stays ACTIVE (reversible — only ban/block tear down).
//
// The SQL here MUST stay in lock-step with src/lib/clicks/teardown.ts. Self-cleaning.
//
//   node scripts/test-click-safety.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv(file) {
  try {
    for (const line of readFileSync(path.join(root, file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}
loadEnv(".env.local");
loadEnv(".env");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (.env.local / .env).");
  process.exit(1);
}
const needsSsl = /supabase\.(co|com)/.test(connectionString);
const pool = new Pool({
  connectionString,
  max: 5,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

let failures = 0;
const created = [];
function check(label, cond) {
  if (cond) {
    console.log(`  ok   — ${label}`);
  } else {
    failures++;
    console.error(`  FAIL — ${label}`);
  }
}

async function mkProfile(label) {
  const r = await pool.query(
    `insert into profiles (email, display_name, age, social_visible)
     values ($1, $2, 27, true) returning id::text`,
    [`safety-${randomUUID()}@test.local`, label],
  );
  created.push(r.rows[0].id);
  return r.rows[0].id;
}

// Build a live mutual + a pending proposal + two pending reciprocal clicks for a pair.
async function seedLiveCoordination(aId, bId) {
  const exp7 = new Date(Date.now() + 7 * 86400_000).toISOString();
  // Once a mutual forms, the pair's click rows are status='mutual' (history), not
  // pending — the teardown leaves these and tears down the relationship layer.
  await pool.query(
    `insert into clicks (sender_id, receiver_id, event_id, intent_mode, surface, status, expires_at)
     values ($1::uuid,$2::uuid,null,'friendship','discovery','mutual',$3::timestamptz),
            ($2::uuid,$1::uuid,null,'friendship','discovery','mutual',$3::timestamptz)`,
    [aId, bId, exp7],
  );
  const mut = await pool.query(
    `insert into mutual_clicks
       (user_a_id, user_b_id, intent_a, intent_b, status, coord_state, mutual_at, expires_at)
     values (least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid),
             'friendship','friendship','active','proposed', now(), now() + interval '7 days')
     returning id::text`,
    [aId, bId],
  );
  const mid = mut.rows[0].id;
  await pool.query(
    `insert into click_proposals (mutual_click_id, status, proposed_by, expires_at)
     values ($1::uuid, 'pending', $2::uuid, now() + interval '48 hours')`,
    [mid, aId],
  );
  return mid;
}

// --- mirrors of src/lib/clicks/teardown.ts (keep in lock-step) -------------------
async function severPair(aId, bId) {
  await pool.query(
    `update clicks set status='invalidated', updated_at=now()
       where status='pending'
         and ((sender_id=$1::uuid and receiver_id=$2::uuid) or (sender_id=$2::uuid and receiver_id=$1::uuid))`,
    [aId, bId],
  );
  await pool.query(
    `update click_proposals set status='withdrawn', updated_at=now()
       where status in ('pending','accepted')
         and mutual_click_id in (select id from mutual_clicks where status='active'
           and ((user_a_id=$1::uuid and user_b_id=$2::uuid) or (user_a_id=$2::uuid and user_b_id=$1::uuid)))`,
    [aId, bId],
  );
  await pool.query(
    `update mutual_clicks set status='suppressed', coord_state='dormant', ended_at=now(), updated_at=now()
       where status='active'
         and ((user_a_id=$1::uuid and user_b_id=$2::uuid) or (user_a_id=$2::uuid and user_b_id=$1::uuid))`,
    [aId, bId],
  );
}
async function severAllForUser(uid) {
  await pool.query(
    `update clicks set status='invalidated', updated_at=now()
       where status='pending' and (sender_id=$1::uuid or receiver_id=$1::uuid)`,
    [uid],
  );
  await pool.query(
    `update click_proposals set status='withdrawn', updated_at=now()
       where status in ('pending','accepted')
         and mutual_click_id in (select id from mutual_clicks where status='active' and (user_a_id=$1::uuid or user_b_id=$1::uuid))`,
    [uid],
  );
  await pool.query(
    `update mutual_clicks set status='suppressed', coord_state='dormant', ended_at=now(), updated_at=now()
       where status='active' and (user_a_id=$1::uuid or user_b_id=$1::uuid)`,
    [uid],
  );
}
async function coordinationAllowed(aId, bId) {
  const { rows } = await pool.query(
    `select
       exists (select 1 from user_blocks
         where (blocker_profile_id=$1::uuid and blocked_profile_id=$2::uuid)
            or (blocker_profile_id=$2::uuid and blocked_profile_id=$1::uuid)) as blocked,
       exists (select 1 from profiles where id in ($1::uuid,$2::uuid)
         and (is_banned or suspended_at is not null)) as frozen`,
    [aId, bId],
  );
  return !(rows[0].blocked || rows[0].frozen);
}
// --------------------------------------------------------------------------------

async function activeMutualCount(aId, bId) {
  const r = await pool.query(
    `select count(*)::int n from mutual_clicks where status='active'
       and ((user_a_id=$1::uuid and user_b_id=$2::uuid) or (user_a_id=$2::uuid and user_b_id=$1::uuid))`,
    [aId, bId],
  );
  return r.rows[0].n;
}
async function livePendingProposals(mid) {
  const r = await pool.query(
    `select count(*)::int n from click_proposals where mutual_click_id=$1::uuid and status in ('pending','accepted')`,
    [mid],
  );
  return r.rows[0].n;
}
async function invalidatedClicks(aId, bId) {
  const r = await pool.query(
    `select count(*)::int n from clicks where status='invalidated'
       and ((sender_id=$1::uuid and receiver_id=$2::uuid) or (sender_id=$2::uuid and receiver_id=$1::uuid))`,
    [aId, bId],
  );
  return r.rows[0].n;
}

try {
  // ---- SAFE-01: block teardown ----
  console.log("SAFE-01 block teardown:");
  {
    const a = await mkProfile("Block A");
    const b = await mkProfile("Block B");
    const mid = await seedLiveCoordination(a, b);
    check("precondition: 1 active mutual before block", (await activeMutualCount(a, b)) === 1);
    check("precondition: coordination allowed before block", (await coordinationAllowed(a, b)) === true);

    await pool.query(
      `insert into user_blocks (blocker_profile_id, blocked_profile_id) values ($1::uuid,$2::uuid) on conflict do nothing`,
      [a, b],
    );
    await severPair(a, b);

    check("active mutual gone after block", (await activeMutualCount(a, b)) === 0);
    check("live proposal withdrawn after block", (await livePendingProposals(mid)) === 0);
    const m = await pool.query(
      `select status::text, coord_state::text, ended_at from mutual_clicks where id=$1::uuid`,
      [mid],
    );
    check("mutual status=suppressed", m.rows[0].status === "suppressed");
    check("mutual coord_state=dormant", m.rows[0].coord_state === "dormant");
    check("mutual ended_at stamped", m.rows[0].ended_at != null);
    check("coordination REFUSED after block", (await coordinationAllowed(a, b)) === false);
  }

  // ---- SAFE-01b: pending one-way click invalidated by block ----
  console.log("SAFE-01 pending-click invalidation:");
  {
    const a = await mkProfile("Pend A");
    const b = await mkProfile("Pend B");
    const exp7 = new Date(Date.now() + 7 * 86400_000).toISOString();
    // A sent B a one-way discovery click that never matured (no reciprocal → no mutual).
    await pool.query(
      `insert into clicks (sender_id, receiver_id, event_id, intent_mode, surface, status, expires_at)
       values ($1::uuid,$2::uuid,null,'friendship','discovery','pending',$3::timestamptz)`,
      [a, b, exp7],
    );
    await pool.query(
      `insert into user_blocks (blocker_profile_id, blocked_profile_id) values ($1::uuid,$2::uuid) on conflict do nothing`,
      [b, a],
    );
    await severPair(b, a);
    check("pending one-way click invalidated", (await invalidatedClicks(a, b)) === 1);
    const stillPending = await pool.query(
      `select count(*)::int n from clicks where status='pending'
         and ((sender_id=$1::uuid and receiver_id=$2::uuid) or (sender_id=$2::uuid and receiver_id=$1::uuid))`,
      [a, b],
    );
    check("no pending clicks remain for pair", stillPending.rows[0].n === 0);
  }

  // ---- SAFE-06: ban teardown across all pairs ----
  console.log("SAFE-06 ban teardown (multi-pair):");
  {
    const a = await mkProfile("Ban A");
    const b = await mkProfile("Ban B");
    const c = await mkProfile("Ban C");
    const midB = await seedLiveCoordination(a, b);
    const midC = await seedLiveCoordination(a, c);
    check("precondition: 2 active mutuals for A", (await activeMutualCount(a, b)) === 1 && (await activeMutualCount(a, c)) === 1);

    // Real ban touches ONLY the dedicated is_banned column (decoupled from suspend/opt-out).
    await pool.query(`update profiles set is_banned=true where id=$1::uuid`, [a]);
    await severAllForUser(a);

    check("A↔B mutual suppressed after ban", (await activeMutualCount(a, b)) === 0);
    check("A↔C mutual suppressed after ban", (await activeMutualCount(a, c)) === 0);
    check("A↔B proposal withdrawn after ban", (await livePendingProposals(midB)) === 0);
    check("A↔C proposal withdrawn after ban", (await livePendingProposals(midC)) === 0);
    check("coordination REFUSED A↔B after ban (is_banned)", (await coordinationAllowed(a, b)) === false);
    check("coordination REFUSED A↔C after ban (is_banned)", (await coordinationAllowed(a, c)) === false);
  }

  // ---- Suspend = freeze, not teardown ----
  console.log("Suspend = freeze (not teardown):");
  {
    const a = await mkProfile("Susp A");
    const b = await mkProfile("Susp B");
    const mid = await seedLiveCoordination(a, b);
    await pool.query(`update profiles set suspended_at=now(), suspended_reason='test' where id=$1::uuid`, [b]);

    check("coordination REFUSED while suspended", (await coordinationAllowed(a, b)) === false);
    check("mutual STILL active (suspend doesn't tear down)", (await activeMutualCount(a, b)) === 1);
    check("proposal STILL live (suspend doesn't tear down)", (await livePendingProposals(mid)) === 1);
  }

  // ---- Ban/suspend decoupling: unban must not stomp an independent suspension ----
  console.log("Ban/unban decoupled from suspend:");
  {
    const a = await mkProfile("Decouple A");
    // Independently suspended, THEN banned, THEN unbanned (mirrors ban/unban SQL: is_banned only).
    await pool.query(`update profiles set suspended_at=now(), suspended_reason='legit suspension' where id=$1::uuid`, [a]);
    await pool.query(`update profiles set is_banned=true where id=$1::uuid`, [a]); // ban
    await pool.query(`update profiles set is_banned=false where id=$1::uuid`, [a]); // unban
    const r = await pool.query(`select is_banned, suspended_at, suspended_reason from profiles where id=$1::uuid`, [a]);
    check("is_banned cleared by unban", r.rows[0].is_banned === false);
    check("independent suspension SURVIVES unban", r.rows[0].suspended_at != null);
    check("suspension reason survives unban", r.rows[0].suspended_reason === "legit suspension");
  }
} catch (e) {
  failures++;
  console.error(`  ERROR: ${e.message}`);
} finally {
  if (created.length) {
    await pool.query(`delete from profiles where id = any($1::uuid[])`, [created]);
  }
  await pool.end();
}

if (failures === 0) {
  console.log("\nPASS — all safety teardown + re-check invariants hold.");
  process.exit(0);
} else {
  console.error(`\nFAIL — ${failures} assertion(s) failed.`);
  process.exit(1);
}
