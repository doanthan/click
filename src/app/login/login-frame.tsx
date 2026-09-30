import Link from "next/link";
import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth-ui";

/**
 * /login's title, subline and footer, shared with its loading.tsx so the
 * loading screen is this same page with the controls still to come.
 */
export function LoginFrame({ children }: { children: ReactNode }) {
  return (
    <AuthShell
      title="Welcome back"
      sub="Sign in to pick up where you left off."
      footer={
        <>
          <p className="text-center text-sm text-[color:var(--slate)]">
            New to Click?{" "}
            <Link href="/register" className="font-semibold text-[color:var(--purple)] hover:underline">
              Create your account
            </Link>
          </p>
          {/* The host path used to exist only inside the login MODAL, so anyone
              who landed on this full page had no way to find it. */}
          <p className="mt-2 text-center text-sm text-[color:var(--slate)]">
            Want to run events?{" "}
            <Link
              href="/merchant/signup"
              className="font-semibold text-[color:var(--purple)] hover:underline"
            >
              Host on Click
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-[color:var(--slate)]">
            Want a look around first?{" "}
            <Link href="/discover" className="font-semibold text-[color:var(--purple)] hover:underline">
              See what&apos;s on
            </Link>
          </p>
        </>
      }
    >
      {children}
    </AuthShell>
  );
}
