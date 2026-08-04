import type { Metadata } from "next";
import { Suspense } from "react";
import { IBM_Plex_Mono, Poppins } from "next/font/google";
import { Toaster } from "sonner";
import DevSupabaseDrawer from "@/components/dev-supabase-drawer";
import SupportWidget from "@/components/support/support-widget";
import { TestAccountSwitcher } from "@/components/test-account-switcher";
import { SessionFreshness } from "@/components/session-freshness";
import { LoginModalHost } from "@/components/login-modal-host";
import { SiteFooter, SiteHeader, SiteHeaderShell } from "@/components/site-chrome";
import { auth } from "@/auth";
import { isLocalDevelopment } from "@/lib/runtime-mode";
import "./globals.css";

// Display voice - Poppins, the Click DS face: headings, the lowercase
// wordmark, primary-button + tab labels, big numbers (SemiBold-led).
// Body/paragraphs are the SYSTEM font stack per the DS - --font-click-body
// is defined in globals.css, so no body webfont is loaded at all.
const poppins = Poppins({
  variable: "--font-click-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-click-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.letsclick.app"),
  title: {
    default: "Click · Find fun things to do in Sydney",
    template: "%s · Click",
  },
  description:
    "Discover and book fun Sydney activities, meet people naturally, and see who you click with.",
  applicationName: "Click",
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName: "Click",
    url: "/",
    title: "Click · Find fun things to do in Sydney",
    description:
      "Discover and book fun Sydney activities, meet people naturally, and see who you click with.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Click · Find fun things to do in Sydney",
    description:
      "Discover and book fun Sydney activities, meet people naturally, and see who you click with.",
  },
  icons: {
    icon: "/click-mark.svg",
    apple: "/click-mark.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  const showInternalTools = isLocalDevelopment();
  const session = await auth();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${poppins.variable} ${plexMono.variable} h-full antialiased`}
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
        {/* First tab stop everywhere: jump past the sticky header straight to
            the page content. */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {/* The live header awaits the session profile + notification queries;
            stream it so those round-trips never block first paint of the page
            body. The shell keeps the bar's height so nothing shifts. */}
        <Suspense fallback={<SiteHeaderShell />}>
          <SiteHeader />
        </Suspense>
        {/* Every page renders its own <main>; this wrapper is the one stable
            skip-link target above them all. flex-1 keeps short pages pushing
            the footer down, exactly as the bare children did. */}
        <div id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          {children}
        </div>
        <SiteFooter />
        <LoginModalHost
          googleConfigured={googleConfigured}
          metaConfigured={metaConfigured}
          showDemoCredentials={showInternalTools}
        />
        <Toaster
          position="top-right"
          closeButton
          gap={10}
          toastOptions={{
            // Re-skin sonner into the DS surface: white card, hairline
            // border, soft elevation, brand type - destructive red for
            // errors and Sage for success per the DS status map.
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
              error: "!border-[color:var(--danger)] [&_[data-icon]]:!text-[color:var(--danger)]",
              success: "[&_[data-icon]]:!text-[color:var(--sage)]",
              info: "[&_[data-icon]]:!text-[color:var(--mauve)]",
            },
          }}
        />
        <SessionFreshness />
        {showInternalTools ? <DevSupabaseDrawer /> : null}
        {session?.user ? <SupportWidget /> : null}
        {showInternalTools ? (
          <TestAccountSwitcher currentEmail={session?.user?.email ?? null} />
        ) : null}
      </body>
    </html>
  );
}
