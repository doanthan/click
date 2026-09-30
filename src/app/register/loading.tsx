import {
  AuthButtonSkeleton,
  AuthConsent,
  AuthDivider,
  AuthPilotNote,
  FieldSkeleton,
  SignupRoleChoiceSkeleton,
} from "@/components/auth-ui";
import { RegisterFrame } from "./register-frame";
import { RouteSkeleton } from "@/components/route-transition";

/**
 * Loading shell for /register (and /signup, which redirects here): the page's
 * own frame and copy, with the controls as shimmer. The column below mirrors
 * <RegisterForm>'s, attendee side, so nothing moves when the form lands.
 */
export default function RegisterLoading() {
  // The page's own provider check: Facebook shows only when configured.
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  return (
    <RouteSkeleton>
      <RegisterFrame>
        <div className="grid gap-5">
          <SignupRoleChoiceSkeleton />
          <div className="grid gap-2.5">
            <AuthButtonSkeleton />
            {metaConfigured ? <AuthButtonSkeleton /> : null}
          </div>
          <AuthDivider />
          <div className="grid gap-4">
            <FieldSkeleton label="Email" />
            <AuthButtonSkeleton />
          </div>
          <AuthConsent action="creating an account" />
          <AuthPilotNote />
        </div>
      </RegisterFrame>
    </RouteSkeleton>
  );
}
