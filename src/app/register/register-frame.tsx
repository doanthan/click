import Link from "next/link";
import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth-ui";

/**
 * /register's title, subline and footer, shared with its loading.tsx so the
 * loading screen is this same page with the controls still to come.
 */
export function RegisterFrame({ children }: { children: ReactNode }) {
  return (
    <AuthShell
      title="Create your account"
      sub="Real-life events near you - come along, or host your own."
      footer={
        <p className="text-center text-sm text-[color:var(--slate)]">
          Already on Click?{" "}
          <Link href="/login" className="font-semibold text-[color:var(--purple)] hover:underline">
            Log in instead
          </Link>
        </p>
      }
    >
      {children}
    </AuthShell>
  );
}
