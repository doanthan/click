import "server-only";
import type { Pool, PoolClient } from "pg";
import { generateDailyPicksForAll } from "./event-repository";
import { backfillEventSubTags, refreshAllUserFeatures } from "./matching/feature-store";
import { getPostgresPool } from "./postgres";

/**
 * The two jobs behind the admin Run-now buttons (03 §10) - and behind their
 * crons, which call the same entries here, so a press can never be a shortcut
 * version of the scheduled run.
 */
export const SCHEDULED_JOBS = {
  rebuild_suggestion_scores: {
    label: "Rebuild suggestion scores",
    cron: "/api/cron/refresh-matching-features",
    run: async (pool: Pool) => ({
      eventsTagged: await backfillEventSubTags(pool),
      profilesRefreshed: await refreshAllUserFeatures(pool),
    }),
  },
  build_daily_picks: {
    label: "Build today's suggestions",
    cron: "/api/cron/daily-picks",
    run: async () => generateDailyPicksForAll(),
  },
} as const;

export type ScheduledJob = keyof typeof SCHEDULED_JOBS;

export type ScheduledJobRun =
  | { ran: true; result: Record<string, number> }
  | { ran: false; reason: string };

/**
 * Run a job under its own advisory lock, so a second start while it runs -
 * a second press, or a press during the cron - is told "already running"
 * instead of doing the work twice. pg_try_advisory_xact_lock rather than the
 * session-level pg_try_advisory_lock 03 §10 names: it is released by the
 * transaction ending, so it holds the same way through the pooler (which can
 * hand a session-level lock's connection to someone else) and can never be
 * left behind by a crash. The lock rides an open transaction on one pooled
 * connection for the length of the job; the job itself uses the others.
 *
 * `gate` runs while the lock is held and can refuse with a message - the admin
 * path uses it for its 2-minute limit and audit row, so two presses can never
 * both get past the check.
 */
export async function runScheduledJob(
  job: ScheduledJob,
  gate?: (client: PoolClient) => Promise<string | null>,
): Promise<ScheduledJobRun> {
  const pool = getPostgresPool();
  if (!pool) throw new Error("Database unavailable.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const lock = await client.query<{ locked: boolean }>(
      `select pg_try_advisory_xact_lock(hashtext($1)::bigint) as locked`,
      [`scheduled-job:${job}`],
    );
    if (!lock.rows[0]?.locked) {
      await client.query("rollback");
      return { ran: false, reason: "Already running - it will finish on its own." };
    }
    const refusal = gate ? await gate(client) : null;
    if (refusal) {
      await client.query("rollback");
      return { ran: false, reason: refusal };
    }
    const result = await SCHEDULED_JOBS[job].run(pool);
    await client.query("commit");
    return { ran: true, result };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** 03 §10: a Run-now press runs at most once per this many minutes. */
export const RUN_NOW_MIN_INTERVAL_MINUTES = 2;

/**
 * The admin Run-now gate (03 §10): at most once per RUN_NOW_MIN_INTERVAL_MINUTES
 * per job, and every press that gets through is audited before the job starts -
 * on its own connection, so a job that then fails still leaves its row.
 */
export function runNowGate(job: ScheduledJob, actorProfileId: string) {
  return async (client: PoolClient): Promise<string | null> => {
    const recent = await client.query<{ recent: boolean }>(
      `select exists (
         select 1 from audit_logs
         where action = $1
           and created_at > now() - interval '${RUN_NOW_MIN_INTERVAL_MINUTES} minutes'
       ) as recent`,
      [`run_now.${job}`],
    );
    if (recent.rows[0]?.recent) {
      return `Ran less than ${RUN_NOW_MIN_INTERVAL_MINUTES} minutes ago - try again shortly.`;
    }
    const pool = getPostgresPool();
    if (!pool) return "Database unavailable.";
    await pool.query(
      `insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
       values ($1::uuid, $2, 'system_settings', null, $3::jsonb)`,
      [actorProfileId, `run_now.${job}`, JSON.stringify({ job, cron: SCHEDULED_JOBS[job].cron })],
    );
    return null;
  };
}
