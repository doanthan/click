/**
 * The single source of truth for "does this address hold admin power".
 *
 * WHY THIS IS ITS OWN LEAF MODULE
 *   There used to be two answers to that question and they disagreed.
 *   `isAdminEmail` in src/auth.ts fell back to "" (nobody) when ADMIN_EMAILS
 *   was unset in production; `isConfiguredAdminEmail` in event-repository.ts
 *   fell back to "admin@click.local" with no environment guard at all, so an
 *   unset variable in production would have handed the console to a fixed,
 *   publicly-guessable address. Only deployment config kept them from
 *   diverging in practice.
 *
 *   They could not simply share the auth.ts copy: importing "@/auth" pulls the
 *   whole NextAuth initialisation into every module that touches the
 *   repository layer. So the parsing lives here, in a module that imports
 *   nothing but runtime-mode, and both callers re-export from it.
 *
 * FAIL CLOSED. An unset ADMIN_EMAILS grants nobody anything on a deployed
 * environment. The `admin@click.local` convenience default exists only when
 * NODE_ENV === "development", where it matches the seeded local admin.
 */
// Deliberately inlined rather than imported from ./runtime-mode: this module
// has to stay dependency-free so tests/admin-emails.test.mjs can import it
// under `node --test`, which strips TS types but does not resolve extensionless
// TS specifiers. Same expression as isLocalDevelopment() in runtime-mode.ts.
const isDevelopment = () => process.env.NODE_ENV === "development";

function configuredAdminEmails() {
  const configured =
    process.env.ADMIN_EMAILS ?? (isDevelopment() ? "admin@click.local" : "");

  return new Set(
    configured
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return configuredAdminEmails().has(email.trim().toLowerCase());
}

/**
 * Is there anybody who COULD be an admin here? Only for deciding whether a
 * feature an admin might use is worth registering at all - never for deciding
 * whether a particular caller may use it. `isAdminEmail` is that question.
 */
export function hasConfiguredAdmins(): boolean {
  return configuredAdminEmails().size > 0;
}
