import type { Metadata } from "next";
import { Suspense } from "react";
import { IBM_Plex_Mono, Poppins } from "next/font/google";
import { Toaster } from "sonner";
import DevSupabaseDrawer from "@/components/dev-supabase-drawer";
import SupportWidget from "@/components/support/support-widget";
import { TestAccountSwitcher } from "@/components/test-account-switcher";
import { SessionFreshness } from "@/components/session-freshness";
import { LoginModalHost } from "@/components/login-modal-host";
import { ChromeGate } from "@/components/chrome-gate";
import { SiteFooter, SiteHeader, SiteHeaderShell } from "@/components/site-chrome";
import { SiteNotices } from "@/components/site-notices";
import { QaSessionBanner } from "@/components/qa-session-banner";
import { QaFreshStateClearer } from "@/components/qa-fresh-state-clearer";
import { QaTestingDrawer } from "@/components/qa-testing-drawer";
import { auth, isAdminEmail } from "@/auth";
import { getSystemSettings } from "@/lib/event-repository";
import { AccountScopeProvider } from "@/lib/account-scope";
import { isLocalDevelopment } from "@/lib/runtime-mode";
import { isTestSwitcherUnlocked } from "@/lib/test-switcher";
import { canTriageSupportTickets } from "@/lib/support-access";
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
  // Separate from showInternalTools: the persona switcher is the one internal
  // tool that also runs on a deployed environment, for a browser that unlocked
  // it with TEST_SWITCHER_KEY. The Supabase drawer and demo credentials stay
  // local-only.
  const qaSwitcherUnlocked = await isTestSwitcherUnlocked();
  const qaSessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const isQaSession = qaSessionEmail.endsWith("@click.local");
  // Anyone may report a bug; only an operator may read the queue back.
  const canTriageBugs = await canTriageSupportTickets();
  // Only to pick the header PLACEHOLDER's variant, so the streamed bar reserves
  // the same space the real one will take. Cheap: the session is a signed
  // cookie, and this layout already resolves it above.
  const headerSession = await auth();
  // The two platform-wide switches on /admin/system. Read here because this is
  // the only layout every route passes through; both had no consumer at all
  // before, so saving either changed nothing anyone could see. getSystemSettings
  // swallows its own database errors and returns defaults, so an outage renders
  // the site normally rather than curtaining it by accident.
  const { maintenanceMode, marketingBanner } = await getSystemSettings();
  const viewerIsAdmin = isAdminEmail(session?.user?.email);

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
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Tells every form draft which account it belongs to, so one browser
            signing in as several people (the QA switcher, a shared laptop)
            never hands the next person the last one's half-filled form. */}
        <AccountScopeProvider scope={session?.user?.email}>
        <QaFreshStateClearer />
        {/* First tab stop everywhere: jump past the sticky header straight to
            the page content. */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {/* Above the header on purpose: an announcement or a "we're offline"
            notice that sits below the nav is one someone has to scroll to find.
            Renders nothing at all when both switches are off. */}
        <SiteNotices
          maintenance={maintenanceMode}
          banner={marketingBanner}
          viewerIsAdmin={viewerIsAdmin}
        />
        {/* A QA identity is a real session, not a visual preview. Keep that
            fact visible on every surface, including chromeless onboarding
            pages. The exit remains available after the 12-hour unlock expires
            so a tester is never stranded inside a seeded account. */}
        {isQaSession ? (
          <QaSessionBanner currentEmail={qaSessionEmail} unlocked={qaSwitcherUnlocked} />
        ) : null}
        {/* The live header awaits the session profile + notification queries;
            stream it so those round-trips never block first paint of the page
            body. The shell keeps the bar's height so nothing shifts.
            ChromeGate drops the whole bar on the auth, quiz and onboarding
            routes, which draw their own wordmark. That wordmark is a link home:
            those surfaces carry no app nav, but a screen with no way out at all
            is a trap, and the real gate on an unfinished profile is server-side
            (assertBookingEligible), not the missing header. */}
        <ChromeGate>
          <Suspense fallback={<SiteHeaderShell marketing={!headerSession?.user} />}>
            <SiteHeader qaSwitcherUnlocked={qaSwitcherUnlocked} />
          </Suspense>
        </ChromeGate>
        {/* Every page renders its own <main>; this wrapper is the one stable
            skip-link target above them all. flex-1 keeps short pages pushing
            the footer down, exactly as the bare children did. */}
        <div id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          {children}
        </div>
        <ChromeGate>
          <SiteFooter />
          {/* Reserves the fixed MobileBottomNav's height (its own + the device
              safe-area inset) so page and footer content is never hidden behind
              it. It sits WITH the nav rather than on <body> so a chromeless
              route doesn't reserve space for a bar it never renders - and so
              logged-out visitors, who never get the bar, don't either. */}
          {session?.user ? (
            <div aria-hidden className="h-[calc(56px+env(safe-area-inset-bottom))] lg:hidden" />
          ) : null}
        </ChromeGate>
        <LoginModalHost
          googleConfigured={googleConfigured}
          metaConfigured={metaConfigured}
          showDemoCredentials={showInternalTools}
        />
        <Toaster
          position="top-right"
          closeButton
          gap={10}
          // On phones sonner ignores the corner and spans the full width 16px
          // from the top - directly over the sticky header's logo, bell and
          // avatar. Clear the header instead of covering it.
          mobileOffset={{ top: "76px", left: "12px", right: "12px" }}
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
        {/* The recorder follows one unlocked browser through real admin,
            customer, host and signed-out QA states. Its client timeline is
            privacy-bounded and session-scoped; mounting remains behind the
            same server-side gate that protects the persona switcher. */}
        {qaSwitcherUnlocked ? (
          <QaTestingDrawer currentEmail={session?.user?.email ?? null} />
        ) : null}
        {showInternalTools ? <DevSupabaseDrawer /> : null}
        {/* Pre-launch: shown to everyone, signed in or not, so a bug on the
            signed-out surfaces (login, register, discover) can be reported.
            Reporting only - the "Bugs on this page" tab reads other people's
            tickets (reporter name + free text), so it needs canTriageBugs. */}
        <SupportWidget canTriage={canTriageBugs} />
        {/* Once signed in, the same picker lives under Avatar -> Test as.
            Keep this fallback only for the signed-out test state,
            which has no avatar menu and would otherwise strand the tester. */}
        {qaSwitcherUnlocked && !session?.user ? (
          <TestAccountSwitcher currentEmail={session?.user?.email ?? null} />
        ) : null}
        </AccountScopeProvider>
      </body>
    </html>
  );
}
