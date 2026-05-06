import { Pool } from "pg";

declare global {
  var clickPostgresPool: Pool | undefined;
}

export function getPostgresPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) return null;

  if (!globalThis.clickPostgresPool) {
    globalThis.clickPostgresPool = new Pool({
      connectionString,
      max: 5,
    });
  }

  return globalThis.clickPostgresPool;
}
