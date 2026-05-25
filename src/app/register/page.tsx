import Link from "next/link";
import { RegisterForm } from "@/components/register-form";

export const metadata = {
  title: "Create your account | Click",
  description: "Sign up for Click with Email, Facebook, or Google.",
};

type RegisterPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

const errorCopy: Record<string, string> = {
  CredentialsSignin: "Enter a valid email address to continue.",
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
  const errorMessage = params?.error ? errorCopy[params.error] ?? "Sign up failed." : "";
  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);

  return (
    <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <div className="confetti-field absolute inset-0 opacity-25" aria-hidden />

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div className="relative">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Click sign up · new here
          </span>

          <h1 className="font-display mt-6 text-5xl font-light leading-[0.94] tracking-tight text-[color:var(--ink)] sm:text-7xl">
            Make your{" "}
            <span className="italic">
              <span className="peach-highlight">first Click</span>
            </span>{" "}
            in 30 seconds.
          </h1>

          <p className="mt-6 max-w-xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
            Tell us your name and what you&apos;re here for, share your location
            so we can surface the right rooms, then continue with Google,
            Facebook, or Email.
          </p>

          <ul className="mt-8 grid gap-3 text-sm font-semibold text-[color:var(--mauve)]">
            <li className="flex items-start gap-3">
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-xs font-bold text-[color:var(--surface-deep)]">
                ✓
              </span>
              Location stays on your device unless you finish onboarding.
            </li>
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
              You can edit every detail later from your dashboard.
            </li>
          </ul>

          <p className="font-script mt-10 text-3xl text-[color:var(--rose)]">
            welcome in ✷
          </p>
        </div>

        <div className="relative rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow">
          <div className="flex items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)]" />
              <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--punch)]" />
              <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)]" />
            </div>
            <span className="font-mono hidden text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)] sm:block">
              ✷ new account
            </span>
          </div>

          <RegisterForm
            callbackUrl={callbackUrl}
            errorMessage={errorMessage}
            googleConfigured={googleConfigured}
            metaConfigured={metaConfigured}
          />

          <div className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-6 py-4 sm:px-7">
            <p className="text-sm font-medium text-[color:var(--mauve)]">
              Already on Click?{" "}
              <Link
                href="/login"
                className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
              >
                Log in instead
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
