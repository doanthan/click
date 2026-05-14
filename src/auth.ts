import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

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
    (process.env.ADMIN_EMAILS ?? "admin@click.local")
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
    id: "email-login",
    name: "Email",
    credentials: {
      email: {
        label: "Email",
        type: "email",
        placeholder: "you@example.com",
      },
      password: {
        label: "Password",
        type: "password",
      },
    },
    async authorize(credentials) {
      const email = getStringCredential(credentials?.email).toLowerCase();
      const password = getStringCredential(credentials?.password);
      const magicPassword = process.env.AUTH_EMAIL_PASSWORD ?? process.env.AUTH_MAGIC_PASSWORD;

      if (!email || !magicPassword || password !== magicPassword) {
        return null;
      }

      return {
        id: `email-login:${email}`,
        email,
        name: nameFromEmail(email) || email,
      };
    },
  }),
);

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
      const protectedRoutes = ["/dashboard", "/merchant", "/admin", "/onboarding"];
      const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route),
      );

      if (!isProtectedRoute) return true;
      if (!session?.user) return false;
      if (pathname.startsWith("/admin")) {
        return isAdminEmail(session.user.email);
      }
      return true;
    },
  },
});
