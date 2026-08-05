import Link from "next/link";
import { AuthShell } from "@/components/auth-ui";
import { ckBtn } from "@/components/ds";
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

  return (
    <AuthShell
      title="Continue to Click"
      sub="Confirm this sign-in in the browser where you opened the email."
      footer={
        <Link href="/login" className="block text-center text-sm font-semibold text-[color:var(--purple)]">
          Request a new link
        </Link>
      }
    >
      {token ? (
        <form action={confirmEmailSignIn}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={ckBtn("primary", "lg", { full: true })}>
            Continue securely
          </button>
        </form>
      ) : (
        <p role="alert" className="text-sm font-semibold text-[color:var(--danger)]">
          This sign-in link is incomplete. Request a new one.
        </p>
      )}
    </AuthShell>
  );
}
