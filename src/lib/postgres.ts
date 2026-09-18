import { Pool } from "pg";

declare global {
  var clickPostgresPool: Pool | undefined;
}

export function getPostgresPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) return null;

  if (!globalThis.clickPostgresPool) {
    // The direct host (db.<ref>.supabase.co) is IPv6-only. IPv4-only / serverless
    // hosts (Vercel, Lambda) can't resolve it -> getaddrinfo ENOTFOUND. Use the
    // Transaction-mode pooler instead: aws-<n>-<region>.pooler.supabase.com:6543
    // with user "postgres.<ref>" (see .env.example).
    if (/db\.[a-z0-9]+\.supabase\.co/.test(connectionString)) {
      console.warn(
        "[postgres] DATABASE_URL points at the IPv6-only direct Supabase host " +
          "(db.*.supabase.co), which fails on IPv4-only/serverless hosts such as " +
          "Vercel. Switch to the Transaction-mode pooler (*.pooler.supabase.com:6543).",
      );
    }

    // Supabase's pooler requires TLS. The cert chain isn't always presented to
    // node-postgres directly, so disable strict verification rather than ship a
    // bundled CA. Connection is still encrypted.
    const needsSsl = /supabase\.(co|com)/.test(connectionString);

    globalThis.clickPostgresPool = new Pool({
      connectionString,
      max: 5,
      // Every one of these is a timeout, and the reason is the same: without
      // them a saturated pool HANGS rather than fails. pg waits forever for a
      // free connection by default, so under load the whole site stops
      // responding instead of erroring - which also defeats an uptime monitor
      // that only watches for a non-200.
      //
      // 5s to acquire: shorter than any plausible Vercel function limit, so a
      // starved request returns a real error we can see rather than being
      // killed by the platform with no signal.
      connectionTimeoutMillis: 5_000,
      // Hand idle connections back to the Supabase pooler instead of pinning
      // them across warm lambda invocations.
      idleTimeoutMillis: 10_000,
      // Server-side backstop: one runaway query cannot pin a connection for
      // the life of the process.
      statement_timeout: 10_000,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalThis.clickPostgresPool;
}

/**
 * Runs `worker` over `items` with at most `limit` of them in flight.
 *
 * This lives next to the pool because it exists entirely to respect it. Every
 * fan-out in this app bottoms out in a pool query, and the pool above is
 * `max: 5` with a 5-second acquire timeout. A bare
 * `Promise.all(rows.map(...))` over a list whose length is decided by the data
 * - every attendee on a cancelled event, every reminder due tonight - does not
 * merely run hot: past five in flight the remainder queue on the pool, and
 * past five seconds of queueing they throw. On the bulk-cancel path those
 * throws are refunds, so the failure mode is real money that never moved,
 * recorded as a connection timeout nobody was watching for.
 *
 * The default of 4 keeps one connection free for the rest of the request.
 * Rejection semantics match `Promise.all`: the first rejection propagates.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  limit = 4,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  // `next++` is read and incremented synchronously before the await, and JS is
  // single-threaded, so two runners can never claim the same index.
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}
