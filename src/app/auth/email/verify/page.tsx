import Link from "next/link";
import { AuthShell } from "@/components/auth-ui";
import { ckBtn } from "@/components/ds";
import { getMagicLinkDestination } from "@/lib/auth-magic-link";
import { confirmEmailSignIn } from "./actions";

export const metadata = {
  title: "Confirm email sign-in",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";
  // Check the token BEFORE offering a button that acts on it.
  const live = token ? await getMagicLinkDestination(token).catch(() => null) : null;

  return (
    <AuthShell
      title="Continue to Click"
      sub="One tap and you're in - this link works once, and expires 15 minutes after it was sent."
      footer={
        <Link href="/login" className="block text-center text-sm font-semibold text-[color:var(--purple)]">
          Request a new link
        </Link>
      }
    >
      {token && live ? (
        <form action={confirmEmailSignIn}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={ckBtn("primary", "lg", { full: true })}>
            Continue securely
          </button>
        </form>
      ) : (
        <p role="alert" className="text-sm font-semibold text-[color:var(--danger)]">
          {token
            ? "This sign-in link has already been used, or it's expired. Request a new one below."
            : "This sign-in link is incomplete. Request a new one."}
        </p>
      )}
    </AuthShell>
  );
}
