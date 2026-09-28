export type AdminActor = { email: string; name: string | null; image: string | null };
export type AccountImpersonation = { actor: AdminActor; expiresAt: number };

type SwitchSession = {
  user?: { email?: string | null; name?: string | null; image?: string | null };
  impersonation?: AccountImpersonation;
};

/** A real member's account stays open to an admin for at most an hour. */
export const MEMBER_VIEWING_MS = 60 * 60 * 1000;
/** A @click.local test account gets the same 12 hours as the QA unlock
 *  (TEST_SWITCHER_MAX_AGE_SECONDS), so a testing session is not cut off hourly. */
export const TEST_ACCOUNT_VIEWING_MS = 12 * 60 * 60 * 1000;

/**
 * When a switch into `targetEmail` has to end. Never later than `runningUntil`
 * (the grant already running, or the admin's own session), so a chain of
 * switches can only shorten it: hopping through test accounts never buys more
 * time on a real member.
 */
export function viewingExpiresAt(targetEmail: string, runningUntil: number, now = Date.now()) {
  const limit = targetEmail.trim().toLowerCase().endsWith("@click.local")
    ? TEST_ACCOUNT_VIEWING_MS
    : MEMBER_VIEWING_MS;
  return Math.min(runningUntil, now + limit);
}

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
