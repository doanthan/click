import type { Metadata } from "next";
import {
  Archivo,
  Fraunces,
  Hanken_Grotesk,
  IBM_Plex_Mono,
} from "next/font/google";
import { Toaster } from "sonner";
import DevSupabaseDrawer from "@/components/dev-supabase-drawer";
import { TestAccountSwitcher } from "@/components/test-account-switcher";
import { LoginModalHost } from "@/components/login-modal-host";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { auth } from "@/auth";
import "./globals.css";

// Body / UI grotesque — stand-in for River's Faktum / American Grotesk.
const hanken = Hanken_Grotesk({
  variable: "--font-click-body",
  subsets: ["latin"],
  display: "swap",
});

// Editorial high-contrast display serif — stand-in for River's Copernicus.
const fraunces = Fraunces({
  variable: "--font-click-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

// Condensed grotesque for eyebrows / labels / stat numerals — stand-in for
// River's American Grotesk Condensed.
const archivo = Archivo({
  variable: "--font-click-condensed",
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-click-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Click — A burst of YES",
  description:
    "Click helps ordinary people find local groups, dating, friendship and Sydney events with a reason to talk.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  const showDemoCredentials = true;
  const session = await auth();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${hanken.variable} ${fraunces.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
          cz-shortcut-listen, Grammarly) inject attributes onto <body> before
          React hydrates. This suppresses only body's own attribute mismatch,
          not mismatches inside the component tree. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SiteHeader />
        {children}
        <SiteFooter />
        <LoginModalHost
          googleConfigured={googleConfigured}
          metaConfigured={metaConfigured}
          showDemoCredentials={showDemoCredentials}
        />
        <Toaster position="top-right" richColors closeButton />
        <DevSupabaseDrawer />
        <TestAccountSwitcher currentEmail={session?.user?.email ?? null} />
      </body>
    </html>
  );
}
