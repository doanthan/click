import Link from "next/link";
import { requestPasswordReset } from "./actions";

export const metadata = {
  title: "Forgot password | Click",
  description: "Request a fresh Click email sign-in link.",
};

type ForgotPasswordPageProps = {
  searchParams?: Promise<{ sent?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const sent = params?.sent === "1";

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="eyebrow">Account access</p>
          <h1 className="font-display mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            Get back to your plans.
          </h1>
          <p className="mt-5 max-w-md text-base font-medium leading-7 text-[color:var(--mauve)]">
            Enter your email and we’ll send the right account access instructions.
            For the MVP, Click uses email sign-in rather than stored passwords.
          </p>
        </div>

        <div className="rounded-[20px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-7">
          {sent ? (
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-5">
              <p className="font-display text-2xl font-semibold leading-tight text-[color:var(--ink)]">
                Check your email.
              </p>
              <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                If that address exists, Click has sent access instructions. You can
                safely return to login.
              </p>
              <Link href="/login" className="ck-btn ck-btn--primary ck-btn--md mt-5">
                Back to login
              </Link>
            </div>
          ) : (
            <form action={requestPasswordReset} className="grid gap-4">
              {/* Without this the form submits no mode, requestEmailSignIn
                  falls through to purpose "signup", and someone who already has
                  an account gets "Finish creating your Click account" when they
                  asked to get back INTO it. Unknown addresses still get the
                  no-account email - that branch keys off the profile lookup,
                  not off this field. */}
              <input type="hidden" name="mode" value="login" />
              <label className="grid gap-2">
                <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-base text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
                />
              </label>
              <button type="submit" className="ck-btn ck-btn--primary ck-btn--lg">
                Send access email
              </button>
              <Link
                href="/login"
                className="text-sm font-semibold text-[color:var(--purple)] underline decoration-2 underline-offset-4 hover:text-[color:var(--purple-700)]"
              >
                Return to login
              </Link>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
