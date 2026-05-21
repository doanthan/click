import Link from "next/link";
import {
  signInWithEmail,
  signInWithGoogle,
  signInWithMeta,
} from "./actions";

export const metadata = {
  title: "Log in | Click",
  description: "Log in to Click with Email, Facebook, or Google.",
};

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

const errorCopy: Record<string, string> = {
  CredentialsSignin: "Enter a valid email address to continue.",
  OAuthSignin: "The social login could not start. Check the provider configuration.",
  OAuthCallback: "The social login callback failed. Check the provider callback URL.",
  Configuration: "Authentication is missing provider or secret configuration.",
};

function safeCallbackUrl(value: string | undefined) {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params?.callbackUrl);
  const errorMessage = params?.error ? errorCopy[params.error] ?? "Login failed." : "";
  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  const showDemoCredentials = true;

  return (
    <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <div className="confetti-field absolute inset-0 opacity-25" aria-hidden />

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        {/* ---------- LEFT: Editorial intro ---------- */}
        <div className="relative">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Click login · welcome back
          </span>

          <h1 className="font-display mt-6 text-5xl font-light leading-[0.94] tracking-tight text-[color:var(--ink)] sm:text-7xl">
            Get into your{" "}
            <span className="italic">
              <span className="peach-highlight">real-world</span>
            </span>{" "}
            plans.
          </h1>

          <p className="mt-6 max-w-xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
            Continue with Google, Facebook, or Email. One account keeps your
            Click Radar, saved events, RSVPs, and private Clicks together.
          </p>

          <ul className="mt-8 grid gap-3 text-sm font-semibold text-[color:var(--mauve)]">
            <li className="flex items-start gap-3">
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-xs font-bold text-[color:var(--surface-deep)]">
                ✓
              </span>
              Private Clicks stay private until there is mutual interest.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-xs font-bold text-[color:var(--surface-deep)]">
                ✓
              </span>
              Social login uses OAuth. Email uses Click’s secure email access flow.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-xs font-bold text-[color:var(--surface-deep)]">
                ✓
              </span>
              30 seconds to RSVP your next plan.
            </li>
          </ul>

          <p className="font-script mt-10 text-3xl text-[color:var(--rose)]">
            see you out there ✷
          </p>
        </div>

        {/* ---------- RIGHT: Auth card ---------- */}
        <div className="relative rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow">
          {/* window chrome */}
          <div className="flex items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)]" />
              <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--punch)]" />
              <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)]" />
            </div>
            <span className="font-mono hidden text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)] sm:block">
              ✷ secure sign-in
            </span>
          </div>

          <div className="p-6 sm:p-7">
            {/* Social buttons */}
            <div className="grid gap-3">
              <form action={signInWithGoogle}>
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <button
                  type="submit"
                  disabled={!googleConfigured}
                  aria-label="Continue with Google"
                  className="group/btn flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 text-base font-bold text-[color:var(--ink)] hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--shadow-ink)] hover:bg-[color:var(--cream)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                >
                  <GoogleMark className="size-6 shrink-0" />
                  <span>{googleConfigured ? "Continue with Google" : "Google · setup required"}</span>
                </button>
              </form>

              <form action={signInWithMeta}>
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <button
                  type="submit"
                  disabled={!metaConfigured}
                  aria-label="Continue with Facebook"
                  className="group/btn flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full border-2 border-[color:var(--line)] bg-[#1877F2] px-5 text-base font-bold text-white hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--shadow-ink)] hover:bg-[#1566d6] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                >
                  <FacebookMark className="size-6 shrink-0" />
                  <span>{metaConfigured ? "Continue with Facebook" : "Facebook · setup required"}</span>
                </button>
              </form>
            </div>

            {/* Divider */}
            <div className="my-7 flex items-center gap-3">
              <span className="h-[2px] flex-1 bg-[color:var(--line-soft)]" />
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                or with email
              </span>
              <span className="h-[2px] flex-1 bg-[color:var(--line-soft)]" />
            </div>

            {/* Email form */}
            <form action={signInWithEmail} className="grid gap-4">
              <input type="hidden" name="callbackUrl" value={callbackUrl} />

              <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/55 outline-none focus:bg-[color:var(--cream)]"
                  placeholder="you@example.com"
                />
              </label>

              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]"
                >
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                className="group/cta inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--shadow-ink)] hover:bg-[color:var(--ink)]"
              >
                Continue with Email
                <span aria-hidden className="transition-transform group-hover/cta:translate-x-1">→</span>
              </button>
              <Link
                href="/forgot-password"
                className="text-sm font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
              >
                Forgot password or need a fresh access email?
              </Link>
            </form>

            {showDemoCredentials ? (
              <div className="mt-5 rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  ✷ MVP preview · no password yet
                </p>
                <ul className="mt-3 grid gap-2">
                  <li>
                    <span className="font-bold">Attendee</span> — sign in with
                    any email (e.g.{" "}
                    <span className="font-mono">jane@example.com</span>) to
                    browse and RSVP.
                  </li>
                  <li>
                    <span className="font-bold">Event organiser</span> — sign
                    in with any email, then click{" "}
                    <span className="font-mono">Become a host</span> on your
                    dashboard to create events.
                  </li>
                  <li>
                    <span className="font-bold">Admin</span> — sign in as{" "}
                    <span className="font-mono font-bold">
                      admin@click.local
                    </span>{" "}
                    to approve pending events.
                  </li>
                </ul>
              </div>
            ) : null}

            <p className="mt-6 text-sm font-medium text-[color:var(--mauve)]">
              New to Click?{" "}
              <Link
                href="/register"
                className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
              >
                Create your account
              </Link>
              .
            </p>
            <p className="mt-3 text-sm font-medium text-[color:var(--mauve)]">
              Need to browse first?{" "}
              <Link
                href="/discover"
                className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
              >
                Return to discovery
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------- Brand marks ---------- */

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.972 31.668 29.418 34 24 34c-5.523 0-10.5-4.477-10.5-10S18.477 14 24 14c2.504 0 4.789.945 6.523 2.488l5.657-5.657C32.945 7.582 28.713 6 24 6 14.059 6 6 14.059 6 24s8.059 18 18 18 18-8.059 18-18c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 19.001 14 24 14c2.504 0 4.789.945 6.523 2.488l5.657-5.657C32.945 7.582 28.713 6 24 6 16.318 6 9.656 10.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 42c4.626 0 8.882-1.578 12.247-4.275l-6.184-5.057C28.084 33.987 26.13 35 24 35c-5.4 0-9.94-3.317-11.273-8h-6.5C9.45 37.61 16.118 42 24 42z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.218-2.227 4.106-4.087 5.474l.005-.003 6.184 5.057C36.971 39.205 42 34.5 42 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function FacebookMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M22 12.061C22 6.504 17.523 2 12 2S2 6.504 2 12.061C2 17.084 5.657 21.245 10.438 22v-7.03H7.898v-2.91h2.54v-2.213c0-2.523 1.493-3.917 3.776-3.917 1.094 0 2.238.196 2.238.196v2.476h-1.262c-1.243 0-1.63.775-1.63 1.57v1.888h2.773l-.443 2.91h-2.33V22C18.343 21.245 22 17.084 22 12.061Z"
      />
    </svg>
  );
}
