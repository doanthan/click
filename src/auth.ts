import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import { isLocalDevelopment } from "@/lib/runtime-mode";

function getStringCredential(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nameFromEmail(email: string) {
  const [name] = email.split("@");
  return name
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? (isLocalDevelopment() ? "admin@click.local" : ""))
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined) {
  return !!email && configuredAdminEmails().has(email.toLowerCase());
}

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

// Local-only identity switcher for seeded QA accounts. Production email auth
// uses the single-use token provider above; knowing an email address alone can
// never create a session.
if (isLocalDevelopment()) {
  providers.push(
    Credentials({
      id: "test-login",
      name: "Local test account",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
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
  callbacks: {
    authorized({ auth: session, request }) {
      const pathname = request.nextUrl.pathname;
      const protectedRoutes = [
        "/dashboard",
        "/merchant",
        "/admin",
        "/onboarding",
        "/post-login",
      ];
      const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route),
      );

      if (!isProtectedRoute) return true;
      if (!session?.user) return false;
      // Admin-page access denial is rendered inline by the page itself so the
      // user gets an explicit "no admin access" message instead of bouncing
      // back to /login in a loop while already signed in.
      return true;
    },
  },
});
