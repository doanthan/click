import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  signInWithEmail,
  signInWithGoogle,
  signInWithMeta,
} from "@/app/login/actions";

// Merchant-branded sign-in surface. Hits the exact same NextAuth backend as
// the customer /login — only the copy, default callback, and signup CTA
// differ. Per spec context/02_MERCHANT_JOURNEY.md §1 the merchant entry point
// stays distinct from the customer one even though identities are shared
// (one user can be both attendee and merchant via profiles.role).

export const metadata = {
  title: "Host login | Click",
  description:
    "Log in to your Click merchant portal to manage events, attendees, and payouts.",
};

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

const errorCopy: Record<string, string> = {
  CredentialsSignin: "Enter a valid email address to continue.",
  InvalidEmail: "Enter a valid email address to continue.",
  EmailNotFound: "No account found for that email. Check the spelling, or sign up.",
  OAuthSignin: "The social login could not start. Check the provider configuration.",
  OAuthCallback: "The social login callback failed. Check the provider callback URL.",
  Configuration: "Authentication is missing provider or secret configuration.",
};

function safeMerchantCallbackUrl(value: string | undefined) {
  // Restrict callbacks to /merchant* — a merchant logging in via this surface
  // should always land back in the merchant area, never on a customer page.
  // Deep links (e.g. /merchant/events/create) ride through as ?next=; the bare
  // portal root rides as ?portal=merchant because /post-login deliberately
  // ignores portal roots in ?next= (it owns the role dispatch) — without the
  // portal hint, a merchant-surface login landed on the attendee side.
  if (
    value?.startsWith("/merchant") &&
    !value.startsWith("//") &&
    value !== "/merchant"
  ) {
    return `/post-login?next=${encodeURIComponent(value)}`;
  }
  return "/post-login?portal=merchant";
}

export default async function MerchantLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeMerchantCallbackUrl(params?.callbackUrl);

  // Already signed in? Go straight to the host portal instead of re-showing
  // the login form.
  const session = await auth();
  if (session?.user) {
    redirect(callbackUrl);
  }

  const errorMessage = params?.error ? errorCopy[params.error] ?? "Login failed." : "";
  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);

  return (
    <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-12 text-[color:var(--ink)] sm:px-6">

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        {/* ---------- LEFT: Host-focused intro ---------- */}
        <div className="relative">
          <span className="sticker sticker--peach inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--purple)] pulse-ring" />
            Host portal · welcome back
          </span>

          <h1 className="font-display mt-6 text-5xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-7xl">
            Back to your{" "}
            <span className="text-[color:var(--purple)]">guest list</span>
            .
          </h1>

          <p className="mt-6 max-w-xl text-base font-medium leading-7 text-[color:var(--slate)] sm:text-lg">
            One sign-in for your Click host portal. Manage events, attendees,
            payouts, and discounts - all in one place.
          </p>

          <ul className="mt-8 grid gap-3 text-sm font-medium text-[color:var(--slate)]">
            <li className="flex items-start gap-3">
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-[color:var(--lavender-100)] text-xs font-semibold text-[color:var(--purple-700)]">
                ✓
              </span>
              Same account as your attendee profile - one identity, two surfaces.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-[color:var(--lavender-100)] text-xs font-semibold text-[color:var(--purple-700)]">
                ✓
              </span>
              First-time host? Use sign-up to set up your business profile.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-[color:var(--lavender-100)] text-xs font-semibold text-[color:var(--purple-700)]">
                ✓
              </span>
              Approved merchants land on the portal. Pending applications land on the holding page.
            </li>
          </ul>

          <p className="font-script mt-10 text-3xl text-[color:var(--purple)]">
            see you backstage
          </p>
        </div>

        {/* ---------- RIGHT: Auth card ---------- */}
        <div className="relative overflow-hidden rounded-[18px] bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[color:var(--purple)]" />
              <span className="size-3 rounded-full bg-[color:var(--lavender)]" />
              <span className="size-3 rounded-full bg-[color:var(--lavender-100)]" />
            </div>
            <span className="hidden text-[12.5px] font-semibold text-[color:var(--slate)] sm:block">
              host sign-in
            </span>
          </div>

          <div className="p-6 sm:p-7">
            <div className="grid gap-3">
              <form action={signInWithGoogle}>
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <button
                  type="submit"
                  disabled={!googleConfigured}
                  aria-label="Continue with Google"
                  className="ck-btn ck-btn--secondary ck-btn--lg ck-btn--full"
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
                  className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-5 text-base font-semibold text-white transition hover:bg-[#1566d6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FacebookMark className="size-6 shrink-0" />
                  <span>{metaConfigured ? "Continue with Facebook" : "Facebook · setup required"}</span>
                </button>
              </form>
            </div>

            <div className="my-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-[color:var(--mist)]" />
              <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
                or with email
              </span>
              <span className="h-px flex-1 bg-[color:var(--mist)]" />
            </div>

            <form action={signInWithEmail} className="grid gap-4">
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
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
                  className="rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-base text-[color:var(--ink)] placeholder:text-[color:var(--slate)]/55 outline-none focus:border-[color:var(--purple)] focus:ring-2 focus:ring-[color:var(--lavender-100)]"
                  placeholder="you@yourbusiness.com"
                />
              </label>

              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_8%,var(--paper))] px-4 py-3 text-sm font-semibold text-[color:var(--danger)]"
                >
                  {errorMessage}
                </p>
              ) : null}

              <button type="submit" className="ck-btn ck-btn--primary ck-btn--lg">
                Continue with Email
                <span aria-hidden>→</span>
              </button>
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-[color:var(--purple)] underline underline-offset-4 hover:text-[color:var(--purple-hover)]"
              >
                Forgot password or need a fresh access email?
              </Link>
            </form>
          </div>

          <div className="border-t border-[color:var(--line)] bg-[color:var(--champagne)] px-6 py-4 sm:px-7">
            <p className="text-sm font-medium text-[color:var(--slate)]">
              New host?{" "}
              <Link
                href="/merchant/signup"
                className="font-semibold text-[color:var(--purple)] underline underline-offset-4 hover:text-[color:var(--purple-hover)]"
              >
                Set up your business profile
              </Link>
              .
            </p>
            <p className="mt-2 text-sm font-medium text-[color:var(--slate)]">
              Looking for the attendee login?{" "}
              <Link
                href="/login"
                className="font-semibold text-[color:var(--purple)] underline underline-offset-4 hover:text-[color:var(--purple-hover)]"
              >
                Browse Click as a guest
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------- Brand marks (matched to /login) ---------- */

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="currentColor"
        d="M22 12.061C22 6.504 17.523 2 12 2S2 6.504 2 12.061C2 17.084 5.657 21.245 10.438 22v-7.03H7.898v-2.91h2.54v-2.213c0-2.523 1.493-3.917 3.776-3.917 1.094 0 2.238.196 2.238.196v2.476h-1.262c-1.243 0-1.63.775-1.63 1.57v1.888h2.773l-.443 2.91h-2.33V22C18.343 21.245 22 17.084 22 12.061Z"
      />
    </svg>
  );
}
