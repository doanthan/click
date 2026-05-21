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
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            account access
          </span>
          <h1 className="font-display mt-6 text-5xl font-light leading-[0.94] tracking-tight sm:text-6xl">
            Get back to your plans.
          </h1>
          <p className="mt-5 max-w-md text-base font-medium leading-7 text-[color:var(--mauve)]">
            Enter your email and we’ll send the right account access instructions.
            For the MVP, Click uses email sign-in rather than stored passwords.
          </p>
        </div>

        <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow sm:p-7">
          {sent ? (
            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5">
              <p className="font-display text-3xl font-light leading-tight">
                Check your email.
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                If that address exists, Click has sent access instructions. You can
                safely return to login.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <form action={requestPasswordReset} className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/55 outline-none focus:bg-[color:var(--cream)]"
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
              >
                Send access email
              </button>
              <Link
                href="/login"
                className="text-sm font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
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
