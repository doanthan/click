import { AuthShellSkeleton } from "@/components/auth-ui";

/**
 * Loading shell for /register (and /signup, which redirects here): the
 * attendee/host choice, then the same controls as /login.
 */
export default function RegisterLoading() {
  // The page's own provider check: Facebook shows only when configured.
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  return <AuthShellSkeleton ssoButtons={metaConfigured ? 2 : 1} roleChoice />;
}
