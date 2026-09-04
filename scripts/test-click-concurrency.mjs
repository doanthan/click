// §4 mutual-detection concurrency test (START_HERE Step 2.1 mandate).
//
// "Two users clicking with each other simultaneously must produce exactly ONE
//  mutual, with no deadlock surfacing as a 500 (a 500 is an anonymity leak)."
//
// This drives the EXACT send-click transaction from createUserClickForSession
// (event-repository.ts) - advisory per-pair lock → insert click → FOR UPDATE
// reciprocal → insert mutual (partial-unique on status='active') → mark both
// clicks mutual - from two connections at once, A→B and B→A, many times over.
//
//   node scripts/test-click-concurrency.mjs
//
// Asserts every iteration: exactly 1 active mutual for the pair, both click rows
// 'mutual', and no thrown error. Self-cleaning (deletes its throwaway profiles).

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

const ITERATIONS = 30;

// Mirrors the discovery-click arm of createUserClickForSession's transaction.
async function sendClick(client, senderId, receiverId) {
  await client.query("begin");
  try {
    const [lo, hi] = [senderId, receiverId].sort();
    await client.query(`select pg_advisory_xact_lock(hashtext($1)::bigint)`, [
      `click-pair:${lo}:${hi}`,
    ]);
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    await client.query(
      `insert into clicks (sender_id, receiver_id, event_id, intent_mode, surface, status, expires_at)
       values ($1::uuid, $2::uuid, null, 'friendship', 'discovery', 'pending', $3::timestamptz)
       on conflict do nothing`,
      [senderId, receiverId, expiresAt],
    );
    const recip = await client.query(
      `select id::text from clicks
        where sender_id = $1::uuid and receiver_id = $2::uuid
          and status = 'pending' and expires_at > now() and event_id is null
        order by created_at limit 1 for update`,
      [receiverId, senderId],
    );
    if (recip.rows[0]) {
      const mut = await client.query(
        `insert into mutual_clicks
           (user_a_id, user_b_id, intent_a, intent_b, status, coord_state, mutual_at, expires_at)
         values (least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid),
                 'friendship', 'friendship', 'active', 'open', now(), now() + interval '7 days')
         on conflict (user_a_id, user_b_id) where status = 'active' do nothing
         returning id::text`,
        [senderId, receiverId],
      );
      const mid = mut.rows[0]?.id;
      if (mid) {
        await client.query(
          `update clicks set status = 'mutual', mutual_click_id = $3::uuid, updated_at = now()
            where status = 'pending'
              and ((sender_id = $1::uuid and receiver_id = $2::uuid)
                or (sender_id = $2::uuid and receiver_id = $1::uuid))
              and event_id is null`,
          [senderId, receiverId, mid],
        );
      }
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  }
}

async function seedPair() {
  const mk = async (label) => {
    const r = await pool.query(
      `insert into profiles (email, display_name, age, social_visible)
       values ($1, $2, 25, true) returning id::text`,
      [`cc-${randomUUID()}@test.local`, label],
    );
    return r.rows[0].id;
  };
  return { a: await mk("Concurrency A"), b: await mk("Concurrency B") };
}

let failures = 0;
let errors = 0;
try {
  for (let i = 0; i < ITERATIONS; i++) {
    const { a, b } = await seedPair();
    const ca = await pool.connect();
    const cb = await pool.connect();
    try {
      // The hot path: both fire at once, each direction on its own connection.
      await Promise.all([sendClick(ca, a, b), sendClick(cb, b, a)]);
    } catch (e) {
      errors++;
      console.error(`  iter ${i}: ERROR (would be a 500 → anonymity leak): ${e.message}`);
    } finally {
      ca.release();
      cb.release();
    }
    const mutual = await pool.query(
      `select count(*)::int as n from mutual_clicks
        where user_a_id = least($1::uuid,$2::uuid) and user_b_id = greatest($1::uuid,$2::uuid)
          and status = 'active'`,
      [a, b],
    );
    const marked = await pool.query(
      `select count(*)::int as n from clicks
        where status = 'mutual'
          and ((sender_id = $1::uuid and receiver_id = $2::uuid)
            or (sender_id = $2::uuid and receiver_id = $1::uuid))`,
      [a, b],
    );
    const nMutual = mutual.rows[0].n;
    const nMarked = marked.rows[0].n;
    if (nMutual !== 1 || nMarked !== 2) {
      failures++;
      console.error(`  iter ${i}: FAIL - active mutuals=${nMutual} (want 1), clicks marked mutual=${nMarked} (want 2)`);
    }
    await pool.query(`delete from profiles where id in ($1::uuid, $2::uuid)`, [a, b]);
  }
} finally {
  await pool.end();
}

if (failures === 0 && errors === 0) {
  console.log(`PASS - ${ITERATIONS}/${ITERATIONS} iterations: exactly one mutual, no errors.`);
  process.exit(0);
} else {
  console.error(`FAIL - ${failures} wrong-count + ${errors} errored of ${ITERATIONS} iterations.`);
  process.exit(1);
}
