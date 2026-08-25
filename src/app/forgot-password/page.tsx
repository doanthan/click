import Link from "next/link";
import { MagicLinkSentNote } from "@/components/auth-ui";
import { authErrorMessage } from "@/lib/auth-error-copy";
import { requestPasswordReset } from "./actions";

// The route is still /forgot-password because that is where the login page and
// old emails point, but nothing here resets a password - Click has not stored
// one since the move to magic links. Naming the tab after a password sent
// someone hunting for a reset field that does not exist.
export const metadata = {
  title: "Get a sign-in link",
  description: "Request a fresh Click email sign-in link.",
};

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    sent?: string;
    emailSent?: string;
    sentTo?: string;
    error?: string;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  // `emailSent` is what signInWithEmail actually writes.
  const sent = params?.emailSent === "1" || params?.sent === "1";
  const sentTo = typeof params?.sentTo === "string" ? params.sentTo : null;
  const error = typeof params?.error === "string" ? params.error : null;

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="eyebrow">Account access</p>
          <h1 className="font-display mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            Get back to your plans.
          </h1>
          <p className="mt-5 max-w-md text-base font-medium leading-7 text-[color:var(--mauve)]">
            Enter your email and we’ll send you a fresh sign-in link. Click signs
            you in by email, so there’s no password to remember.
          </p>
        </div>

        <div className="rounded-[20px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-7">
          {sent ? (
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-5">
              <p className="font-display text-2xl font-semibold leading-tight text-[color:var(--ink)]">
                Check your email.
              </p>
              {/* The shared note, not a fourth wording of the same moment. It
                  also drops the old "if that address exists" hedge, which was
                  simply untrue here - requestEmailSignIn mails every address it
                  is given, deliberately, so that a sign-in attempt can't be used
                  to find out who has an account. Hedging about a send we always
                  make only made people doubt a link that was already on its
                  way, and it named neither the inbox nor the expiry. */}
              <div className="mt-3">
                <MagicLinkSentNote email={sentTo} />
              </div>
              <Link href="/login" className="ck-btn ck-btn--primary ck-btn--md mt-5">
                Back to login
              </Link>
            </div>
          ) : (
            <form action={requestPasswordReset} className="grid gap-4">
              {error ? (
                <p
                  role="alert"
                  className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper))] px-3 py-2 text-sm font-medium text-[color:var(--danger)]"
                >
                  {/* The shared table, the same one /merchant/login and
                      /merchant/signup read. The local ternary here answered
                      everything that wasn't RateLimited with "try again in a
                      moment", and InvalidEmail lands in that bucket - the
                      server's check wants a dot in the domain and <input
                      type="email"> does not, so "jane@gmailcom" clears the
                      browser and fails here. Retrying that address can never
                      work; the person has to be told to fix it. */}
                  {authErrorMessage(error)}
                </p>
              ) : null}
              {/* Land the answer on THIS page. Without it safeFormPath falls
                  back to /login, so both the success and the error state
                  appeared on a page the user did not submit from. */}
              <input type="hidden" name="formPath" value="/forgot-password" />
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
                Send my sign-in link
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
