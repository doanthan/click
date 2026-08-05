// Validation for post-auth `?next=` deep links, shared by /post-login and
// /onboarding so a link that survives sign-in also survives onboarding. Kept in
// one place because each copy of this rule is a chance to forget the
// protocol-relative ("//evil.com") case.

const KNOWN_PORTAL_ROOTS = ["/dashboard", "/admin", "/merchant", "/onboarding"];

export function safeNext(value: string | undefined | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // The marketing home page is never a meaningful post-login destination -
  // logging in from "/" should hand off to the role dispatch (dashboard /
  // merchant / admin) rather than bouncing the user straight back to home.
  if (value === "/") return null;
  if (KNOWN_PORTAL_ROOTS.some((root) => value === root)) return null;
  return value;
}
