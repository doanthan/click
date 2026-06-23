import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Archivo,
  Fraunces,
  Hanken_Grotesk,
  IBM_Plex_Mono,
} from "next/font/google";
import { Toaster } from "sonner";
import DevSupabaseDrawer from "@/components/dev-supabase-drawer";
import SupportWidget from "@/components/support/support-widget";
import { TestAccountSwitcher } from "@/components/test-account-switcher";
import { SessionFreshness } from "@/components/session-freshness";
import { LoginModalHost } from "@/components/login-modal-host";
import { SiteFooter, SiteHeader, SiteHeaderShell } from "@/components/site-chrome";
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
      {/* pb on mobile reserves space for the fixed MobileBottomNav (its own
          height + the device safe-area inset) so page + footer content is never
          hidden behind it; cleared from lg up where the bottom bar is hidden. */}
      <body
        className="min-h-full flex flex-col pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0"
        suppressHydrationWarning
      >
        {/* The live header awaits the session profile + notification queries;
            stream it so those round-trips never block first paint of the page
            body. The shell keeps the bar's height so nothing shifts. */}
        <Suspense fallback={<SiteHeaderShell />}>
          <SiteHeader />
        </Suspense>
        {children}
        <SiteFooter />
        <LoginModalHost
          googleConfigured={googleConfigured}
          metaConfigured={metaConfigured}
          showDemoCredentials={showDemoCredentials}
        />
        <Toaster
          position="top-right"
          closeButton
          gap={10}
          toastOptions={{
            // Re-skin sonner into the warm-editorial surface: cream card,
            // hairline border, soft elevation, brand type — with rose for
            // errors and electric-lime for success instead of stock red/green.
            classNames: {
              toast:
                "!bg-[color:var(--cream)] !border !border-[color:var(--line)] !text-[color:var(--ink)] !rounded-2xl !shadow-[0_12px_28px_-10px_rgba(22,24,29,0.18)]",
              title: "!font-semibold !text-[color:var(--ink)]",
              description: "!text-[color:var(--mauve)] !font-medium",
              actionButton:
                "!bg-[color:var(--ink)] !text-[color:var(--champagne)] !rounded-full !font-semibold",
              cancelButton: "!bg-transparent !text-[color:var(--mauve)] !rounded-full",
              closeButton:
                "!bg-[color:var(--cream)] !border-[color:var(--line)] !text-[color:var(--mauve)] hover:!text-[color:var(--ink)]",
              error: "!border-[color:var(--rose)] [&_[data-icon]]:!text-[color:var(--rose)]",
              success: "[&_[data-icon]]:!text-[color:var(--ink)]",
              info: "[&_[data-icon]]:!text-[color:var(--mauve)]",
            },
          }}
        />
        <SessionFreshness />
        <DevSupabaseDrawer />
        {session?.user ? <SupportWidget /> : null}
        <TestAccountSwitcher currentEmail={session?.user?.email ?? null} />
      </body>
    </html>
  );
}
