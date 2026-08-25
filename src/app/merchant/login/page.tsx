import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  signInWithEmail,
  signInWithGoogle,
  signInWithMeta,
} from "@/app/login/actions";
import { AuthNote, SsoButton } from "@/components/auth-ui";
import { SubmitButton } from "@/components/ds-client";
import { authErrorMessage } from "@/lib/auth-error-copy";

// Merchant-branded sign-in surface. Hits the exact same NextAuth backend as
// the customer /login - only the copy, default callback, and signup CTA
// differ. Per spec context/02_MERCHANT_JOURNEY.md §1 the merchant entry point
// stays distinct from the customer one even though identities are shared
// (one user can be both attendee and merchant via profiles.role).

export const metadata = {
  title: "Host login",
  description:
    "Log in to your Click merchant portal to manage events, attendees, and payouts.",
};

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
    emailSent?: string;
  }>;
};


function safeMerchantCallbackUrl(value: string | undefined) {
  // Restrict callbacks to /merchant* - a merchant logging in via this surface
  // should always land back in the merchant area, never on a customer page.
  // Deep links (e.g. /merchant/events/create) ride through as ?next=; the bare
  // portal root rides as ?portal=merchant because /post-login deliberately
  // ignores portal roots in ?next= (it owns the role dispatch) - without the
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

  const errorMessage = authErrorMessage(params?.error);
  // signInWithEmail redirects back to `${formPath}?emailSent=1`. This page
  // posts formPath=/merchant/login (below) but never read the answer, so the
  // send looked like a no-op and hosts re-tapped until the 5/hour limit locked
  // them out of the only email door into the portal.
  const emailSent = params?.emailSent === "1";
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
            and payouts - all in one place.
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
            {/* The shared SsoButton, not a local copy - see the header comment in
                auth-ui.tsx. This page was the last surface still carrying its own
                marks and its own button, and they had drifted: the local GoogleMark
                used a different SVG to the one /login renders, and Facebook sat on a
                hardcoded #1877F2 slab that is not in the palette. */}
            <div className="grid gap-3">
              <form action={signInWithGoogle}>
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <SsoButton
                  provider="google"
                  disabled={!googleConfigured}
                  label={googleConfigured ? "Continue with Google" : "Google · setup required"}
                />
              </form>

              {/* An unconfigured provider is hidden rather than shown disabled - a
                  dead "setup required" button reads as a broken site, and this is
                  the surface a prospective host lands on. Same rule as /login. */}
              {metaConfigured ? (
                <form action={signInWithMeta}>
                  <input type="hidden" name="callbackUrl" value={callbackUrl} />
                  <SsoButton provider="facebook" label="Continue with Facebook" />
                </form>
              ) : null}
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
              {/* Without this, signInWithEmail's safeFormPath falls back to
                  /login and answered a host on the HOST sign-in page with the
                  attendee one - different chrome, different copy, and the host
                  reasonably wonders whether their link went to the right place.
                  The mechanism already existed for exactly this reason (see the
                  comment above safeFormPath); this form just never opted in. */}
              <input type="hidden" name="formPath" value="/merchant/login" />

              {emailSent ? (
                <AuthNote icon="mail">
                  Check your inbox for a secure, one-time sign-in link. It works
                  once and expires in 15 minutes.
                </AuthNote>
              ) : null}

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

              <SubmitButton size="lg" full pendingLabel="Sending your link...">
                Continue with Email
              </SubmitButton>
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-[color:var(--purple)] underline underline-offset-4 hover:text-[color:var(--purple-hover)]"
              >
                {/* Click has no passwords - sign-in is a one-time emailed link,
                    and /forgot-password now just delegates to the same
                    signInWithEmail this form calls. Offering to recover a
                    password a host never set sent them looking for one. */}
                Didn&apos;t get your link? Send another.
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
            {/* "Browse Click as a guest" used to point at /login - the attendee
                sign-in wall, which is the one thing a guest cannot browse from.
                The label was the honest half, so the destination moved to meet
                it: /discover renders for a logged-out session. The attendee
                sign-in door stays on the line as its own link, because that was
                the other thing this sentence was carrying. */}
            <p className="mt-2 text-sm font-medium text-[color:var(--slate)]">
              Not a host?{" "}
              <Link
                href="/discover"
                className="font-semibold text-[color:var(--purple)] underline underline-offset-4 hover:text-[color:var(--purple-hover)]"
              >
                Browse Click as a guest
              </Link>
              , or{" "}
              <Link
                href="/login"
                className="font-semibold text-[color:var(--purple)] underline underline-offset-4 hover:text-[color:var(--purple-hover)]"
              >
                sign in as an attendee
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

