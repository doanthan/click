import Link from "next/link";
import {
  AuthButtonSkeleton,
  AuthConsent,
  AuthDivider,
  FieldSkeleton,
} from "@/components/auth-ui";
import { LoginFrame } from "./login-frame";
import { RouteSkeleton } from "@/components/route-transition";

/**
 * Loading shell for /login. Without its own, a tap on "Log in" flashed the
 * root "Loading Click…" card before the form arrived. The page's own frame
 * and copy, with the controls as shimmer; the spacing mirrors page.tsx, so
 * nothing moves when the form lands.
 */
export default function LoginLoading() {
  // The page's own provider check: Facebook shows only when configured.
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  return (
    <RouteSkeleton>
      <LoginFrame>
        <div className="grid gap-2.5">
          <AuthButtonSkeleton />
          {metaConfigured ? <AuthButtonSkeleton /> : null}
        </div>

        <div className="my-4">
          <AuthDivider />
        </div>

        <div className="grid gap-4">
          <FieldSkeleton label="Email" />
          <AuthButtonSkeleton />
          <Link
            href="/forgot-password"
            className="text-center text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--purple)]"
          >
            Send me a fresh sign-in link
          </Link>
        </div>

        <div className="mt-5">
          <AuthConsent />
        </div>
      </LoginFrame>
    </RouteSkeleton>
  );
}
