import { getPostgresPool } from "@/lib/postgres";

export type AuditEntry = {
  actorProfileId: string | null;
  action: string;
  entityTable: string;
  entityId: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const pool = getPostgresPool();
  if (!pool) return;

  try {
    await pool.query(
      `
        insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
        values ($1::uuid, $2, $3, $4::uuid, $5::jsonb)
      `,
      [
        entry.actorProfileId,
        entry.action,
        entry.entityTable,
        entry.entityId,
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("audit log write failed", error);
    }
  }
}
