import { Pool } from "pg";

declare global {
  var clickPostgresPool: Pool | undefined;
}

export function getPostgresPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) return null;

  if (!globalThis.clickPostgresPool) {
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
