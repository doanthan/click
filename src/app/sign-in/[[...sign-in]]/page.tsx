import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export const metadata = {
  title: "Sign in | Bible Study Connect",
};

export default function SignInPage() {
  const configured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)]">
      <section className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="font-display mt-4 text-5xl font-light leading-tight sm:text-6xl">
            Sign in to Bible Study Connect.
          </h1>
          <p className="mt-5 max-w-md text-base font-medium leading-7 text-[color:var(--mauve)]">
            Clerk handles email/password, Google sign in, password reset, and
            active sessions. The app database never stores passwords.
          </p>
          <Link
            href="/groups"
            className="mt-6 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-3 text-sm font-bold text-[color:var(--ink)]"
          >
            Browse groups first
          </Link>
        </div>
        <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
          {configured ? (
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
          ) : (
            <div className="p-6">
              <p className="font-display text-3xl font-light leading-tight">
                Clerk keys required.
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to
                enable Clerk sign in locally.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
