import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
// Machine-made until the member picks one - src/lib/display-name.ts explains why
// the surfaces that publish a name have to tell the two apart.
import { hasConfiguredAdmins } from "@/lib/admin-emails";
import { nameFromEmail } from "@/lib/display-name";
import { isLocalDevelopment } from "@/lib/runtime-mode";
import { isTestSwitcherConfigured } from "@/lib/test-switcher";

function getStringCredential(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// Re-exported, not defined here: src/lib/admin-emails.ts is the one place that
// decides who is an admin, so the repository layer can ask the same question
// without importing NextAuth. See the comment in that file for why there were
// two answers and why they disagreed.
export { isAdminEmail } from "@/lib/admin-emails";

const providers: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  providers.push(
    Facebook({
      name: "Meta",
    }),
  );
}

providers.push(
  Credentials({
    id: "email-magic-link",
    name: "Email magic link",
    credentials: {
      token: { label: "One-time token", type: "text" },
    },
    async authorize(credentials) {
      const token = getStringCredential(credentials?.token);
      if (!token) return null;
      const { consumeMagicLink } = await import("@/lib/auth-magic-link");
      const email = await consumeMagicLink(token);
      if (!email) return null;

      return {
        id: `email-magic-link:${email}`,
        email,
        name: nameFromEmail(email) || email,
      };
    },
  }),
);

// Identity switcher for the seeded QA personas. Production email auth uses the
// single-use token provider above; knowing an email address alone can never
// create a session.
//
// Registered in local dev, and on a deployed environment when anyone could
// hold an unlock: TEST_SWITCHER_KEY is set, or ADMIN_EMAILS names someone who
// can unlock it with their own session. Registration is not the security
// boundary though - `authorize` re-checks the unlock cookie on every attempt,
// because a provider that merely exists can be driven by POSTing straight at
// /api/auth/callback/test-login. Without that check, "email=admin@click.local"
// would be an admin session for anyone who guessed the provider id.
if (isLocalDevelopment() || isTestSwitcherConfigured() || hasConfiguredAdmins()) {
  providers.push(
    Credentials({
      id: "test-login",
      name: "QA persona",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const { isTestSwitcherUnlocked } = await import("@/lib/test-switcher");
        if (!(await isTestSwitcherUnlocked())) return null;

        const email = getStringCredential(credentials?.email).toLowerCase();
        if (!email || !email.endsWith("@click.local")) return null;

        return {
          id: `test-login:${email}`,
          email,
          name: nameFromEmail(email) || email,
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers,
  // No `authorized` callback, deliberately. It used to list protected routes
  // here and return a boolean - and that boolean was thrown away. Our middleware
  // (src/proxy.ts) passes its OWN handler to auth(), and next-auth's handleAuth
  // takes the `else if (userMiddlewareOrRoute)` branch BEFORE the `else if
  // (!authorized)` one, so with a custom handler only a Response return from
  // `authorized` has any effect - never a false. The callback ran on every
  // request and decided nothing, while reading like the app's access control.
  //
  // The real gates: src/proxy.ts for the route-level session redirects, and
  // each page / route handler calling auth() itself. Put new rules in proxy.ts.
});
