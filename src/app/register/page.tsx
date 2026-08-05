import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthedRedirect } from "@/components/authed-redirect";
import { AuthNote, AuthShell } from "@/components/auth-ui";
import { RegisterForm } from "@/components/register-form";

export const metadata = {
  title: "Create your account | Click",
  description: "Sign up for Click with Email, Facebook, or Google.",
};

type RegisterPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
    emailSent?: string;
  }>;
};

const errorCopy: Record<string, string> = {
  CredentialsSignin: "Enter a valid email address to continue.",
  InvalidEmail: "Enter a valid email address to continue.",
  RateLimited: "Too many signup emails were requested. Try again in an hour.",
  EmailUnavailable:
    "We could not send your signup email right now. Try Google or try again later.",
  OAuthSignin: "The social signup could not start. Check the provider configuration.",
  OAuthCallback: "The social signup callback failed. Check the provider callback URL.",
  Configuration: "Authentication is missing provider or secret configuration.",
};

function safeCallbackUrl(value: string | undefined) {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  return "/post-login";
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params?.callbackUrl);

  // Already signed in? Skip the signup form entirely - route through
  // /post-login like the /login page does, so an authed visit never dead-ends
  // on an auth form.
  const session = await auth();
  if (session?.user) {
    redirect(
      callbackUrl === "/post-login"
        ? "/post-login"
        : `/post-login?next=${encodeURIComponent(callbackUrl)}`,
    );
  }

  const errorMessage = params?.error ? errorCopy[params.error] ?? "Sign up failed." : "";
  const emailSent = params?.emailSent === "1";
  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);

  return (
    <AuthShell
      title="Create your account"
      sub="One step to real-life events near you."
      footer={
        <p className="text-center text-sm text-[color:var(--slate)]">
          Already on Click?{" "}
          <Link href="/login" className="font-semibold text-[color:var(--purple)] hover:underline">
            Log in instead
          </Link>
        </p>
      }
    >
      <AuthedRedirect />

      {/* The signup is answered HERE now, in signup language - it used to hand
          you to /login, which greets you with "Welcome back". */}
      {emailSent ? (
        <div className="mb-5">
          <AuthNote icon="mail">
            Check your inbox - we&apos;ve sent a one-time link that finishes creating your account.
          </AuthNote>
        </div>
      ) : null}

      <RegisterForm
        callbackUrl={callbackUrl}
        errorMessage={errorMessage}
        googleConfigured={googleConfigured}
        metaConfigured={metaConfigured}
      />
    </AuthShell>
  );
}
