import { AuthShellSkeleton } from "@/components/auth-ui";

/**
 * Loading shell for /login. Without its own, a tap on "Log in" flashed the
 * root "Loading Click…" card before the form arrived.
 */
export default function LoginLoading() {
  // The page's own provider check: Facebook shows only when configured.
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  return <AuthShellSkeleton ssoButtons={metaConfigured ? 2 : 1} footerLines={3} />;
}
