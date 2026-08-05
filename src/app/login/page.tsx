import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthedRedirect } from "@/components/authed-redirect";
import {
  AuthDivider,
  AuthError,
  Field,
  AuthNote,
  AuthShell,
  SsoButton,
} from "@/components/auth-ui";
import { ckBtn } from "@/components/ds";
import { isLocalDevelopment } from "@/lib/runtime-mode";
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
    emailSent?: string;
  }>;
};

const errorCopy: Record<string, string> = {
  CredentialsSignin: "Enter a valid email address to continue.",
  InvalidEmail: "Enter a valid email address to continue.",
  EmailNotFound: "No account found for that email. Check the spelling, or sign up.",
  InvalidMagicLink: "That sign-in link is invalid or expired. Request a new one.",
  RateLimited: "Too many sign-in emails were requested. Try again in an hour.",
  EmailUnavailable: "We could not send a sign-in email right now. Try Google or try again later.",
  OAuthSignin: "The social login could not start. Check the provider configuration.",
  OAuthCallback: "The social login callback failed. Check the provider callback URL.",
  Configuration: "Authentication is missing provider or secret configuration.",
};

function safeCallbackUrl(value: string | undefined) {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  return "/post-login";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params?.callbackUrl);

  // Already signed in? Never show the login form - hand off to /post-login
  // (preserving any deep-link target) so the user lands where their session
  // would have taken them. Without this, a signed-in user opening /login saw
  // the form again and assumed their login "didn't work".
  const session = await auth();
  if (session?.user) {
    redirect(
      callbackUrl === "/post-login"
        ? "/post-login"
        : `/post-login?next=${encodeURIComponent(callbackUrl)}`,
    );
  }

  const errorMessage = params?.error ? errorCopy[params.error] ?? "Login failed." : "";
  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  const showDemoCredentials = isLocalDevelopment();

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
      <AuthedRedirect />

      {params?.emailSent === "1" ? (
        <AuthNote icon="mail">Check your inbox for a secure, one-time sign-in link.</AuthNote>
      ) : null}

      {/* SSO - one footprint, the provider carried by the mark */}
      <div className="grid gap-2.5">
        <form action={signInWithGoogle}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <SsoButton
            provider="google"
            disabled={!googleConfigured}
            label={googleConfigured ? "Continue with Google" : "Google · setup required"}
          />
        </form>

        {/* An unconfigured provider is hidden rather than shown disabled - a
            dead "setup required" button reads as a broken site to a visitor. */}
        {metaConfigured ? (
          <form action={signInWithMeta}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <SsoButton provider="facebook" label="Continue with Facebook" />
          </form>
        ) : null}
      </div>

      <div className="my-4">
        <AuthDivider />
      </div>

      {/* Email */}
      <form action={signInWithEmail} className="grid gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        {/* Login surface: an unknown email is rejected ("no account found")
            rather than passwordless-creating a junk profile (#181). */}
        <input type="hidden" name="mode" value="login" />

        {errorMessage ? <AuthError>{errorMessage}</AuthError> : null}

        <Field
          label="Email"
          icon="mail"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />

        <button type="submit" className={ckBtn("primary", "lg", { full: true })}>
          <span className="ck-btn__label">Continue with email</span>
        </button>

        <Link
          href="/forgot-password"
          className="text-center text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--purple)]"
        >
          Forgot password, or need a fresh access email?
        </Link>
      </form>

      {showDemoCredentials ? (
        <div className="mt-5">
          <AuthNote icon="info">
            <p className="font-semibold">Preview build - no password yet.</p>
            <ul className="mt-1.5 grid gap-1">
              <li>
                <b className="font-semibold">Attendee</b> - any email (e.g. jane@example.com) to
                browse and RSVP.
              </li>
              <li>
                <b className="font-semibold">Host</b> - any email, then &quot;Host an event&quot; on
                your dashboard.
              </li>
              <li>
                <b className="font-semibold">Admin</b> - admin@click.local.
              </li>
            </ul>
          </AuthNote>
        </div>
      ) : null}
    </AuthShell>
  );
}
