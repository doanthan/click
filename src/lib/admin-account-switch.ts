import { auth, isAdminEmail } from "@/auth";
import { accountSwitchActor } from "@/lib/account-switch-policy";
import { getPostgresPool } from "@/lib/postgres";

export type SwitchAccount = { id: string; email: string; name: string; role: string };

export async function searchSwitchAccounts(search: string): Promise<SwitchAccount[]> {
  const actor = accountSwitchActor(await auth(), isAdminEmail);
  if (!actor) throw new Error("Sign in with your own admin account to switch accounts.");
  const pool = getPostgresPool();
  if (!pool) throw new Error("Account search is unavailable. Please try again.");
  const result = await pool.query<SwitchAccount>(
    `select id::text, email::text, display_name as name, role::text
     from profiles
     where email is not null and
       (email::text ilike $1 or display_name ilike $1)
     order by lower(email::text) = lower($2) desc, display_name, id
     limit 50`,
    [`%${search.trim().slice(0,200).replace(/[\\%_]/g, "\\$&")}%`, search.trim().slice(0,200)],
  );
  return result.rows;
}

/** Runs inside the credentials provider too, so direct callback POSTs are gated. */
export async function authorizeAccountSwitch(targetId: string, returning: boolean) {
  const session = await auth();
  const actor = accountSwitchActor(session, isAdminEmail);
  if (!actor || (returning && !session?.impersonation)) return null;
  if (!returning && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) return null;
  const pool = getPostgresPool();
  if (!pool) throw new Error("Account switching requires a database connection.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owner = await client.query<{ id: string }>(
      `select id::text from profiles where email = $1::citext
       and suspended_at is null and not coalesce(is_banned, false) for share`, [actor.email],
    );
    if (!owner.rows[0]) { await client.query("rollback"); return null; }
    const target = await client.query<SwitchAccount & { image: string | null }>(
      `select id::text, email::text, display_name as name, role::text, photo_url as image
       from profiles where ${returning ? "email = $1::citext" : "id = $1::uuid"} for share`,
      [returning ? actor.email : targetId],
    );
    const user = target.rows[0];
    if (!user?.email) { await client.query("rollback"); return null; }
    const backToSelf = user.email.toLowerCase() === actor.email;
    const expiresAt = session?.impersonation?.expiresAt ?? Math.min(
      Date.now() + 60 * 60 * 1000,
      Date.parse(session!.expires),
    );
    // Require the audit write to succeed before issuing the switched session.
    await client.query(
      `insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
       values ($1::uuid, $2, 'profiles', $3::uuid, $4::jsonb)`,
      [owner.rows[0].id, backToSelf ? "account_switch_return" : "account_switch_start", user.id,
        JSON.stringify({ actorEmail: actor.email, fromEmail: session?.user?.email, targetEmail: user.email, expiresAt })],
    );
    await client.query("commit");
    return {
      id: user.id, email: user.email, name: user.name, image: user.image,
      ...(backToSelf ? {} : { impersonation: { actor, expiresAt } }),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}
