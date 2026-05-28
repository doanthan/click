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
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalThis.clickPostgresPool;
}
