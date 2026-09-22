export type AdminActor = { email: string; name: string | null; image: string | null };
export type AccountImpersonation = { actor: AdminActor; expiresAt: number };

type SwitchSession = {
  user?: { email?: string | null; name?: string | null; image?: string | null };
  impersonation?: AccountImpersonation;
};

/** QA unlocks must never become access to real customer accounts. */
export function accountSwitchActor(
  session: SwitchSession | null,
  isAdmin: (email: string) => boolean,
  now = Date.now(),
): AdminActor | null {
  const acting = session?.impersonation;
  if (acting && (!Number.isFinite(acting.expiresAt) || acting.expiresAt <= now)) return null;
  const user = acting?.actor ?? session?.user;
  const email = user?.email?.trim().toLowerCase();
  if (!email || email.endsWith("@click.local") || !isAdmin(email)) return null;
  return { email, name: user?.name ?? null, image: user?.image ?? null };
}
