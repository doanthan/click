import Link from "next/link";
import { auth, isAdminEmail } from "@/auth";
import { SUPPORT_EMAIL_DEFAULT } from "@/lib/email-templates/tokens";
import { getProfileStatus, getUnreadNotificationCount } from "@/lib/event-repository";
import { ButtonLink, Logo } from "./ds";
import { HeaderNav, type HeaderNavItem } from "./header-nav";
import { HeaderNotificationsBell } from "./header-notifications-bell";
import { HeaderRoleSwitcher, type PortalRole } from "./header-role-switcher";
import { LoginTrigger } from "./login-trigger";
import { MobileBottomNav, type BottomNavTab } from "./mobile-bottom-nav";

const HEADER_SHELL =
  "sticky top-0 z-50 border-b border-[color:var(--line-soft)] bg-[color:var(--champagne)]";
const HEADER_ROW = "mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3 sm:px-8 sm:py-3.5";

/**
 * Streamed placeholder for the real SiteHeader while it awaits its session +
 * profile queries. Mirrors the chrome (same sticky bar, same wordmark size) so
 * the live header swaps in with no layout shift.
 */
export function SiteHeaderShell({ marketing = true }: { marketing?: boolean }) {
  return (
    // The variant is NOT assumed. `site-header--marketing` is what the home
    // hero's overlay rules key on, and the overlay makes the bar
    // `position: absolute` - out of flow. Hardcoding it here meant a signed-in
    // visitor to "/" got a floating placeholder that swapped for a sticky,
    // in-flow cream bar, shoving the whole page down by the header height.
    // Which is precisely the layout shift this shell exists to prevent.
    <header className={`${HEADER_SHELL}${marketing ? " site-header--marketing" : ""}`}>
      <div className={HEADER_ROW}>
        <Logo size={26} />
        <div className="h-11 lg:h-10" aria-hidden />
      </div>
    </header>
  );
}

export async function SiteHeader({
  qaSwitcherUnlocked = false,
}: {
  qaSwitcherUnlocked?: boolean;
}) {
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Account";
  const isAdmin = !!session?.user && isAdminEmail(session.user.email);
  const profileStatus = session?.user ? await getProfileStatus(session) : null;
  const merchantProfile = profileStatus?.merchantProfile ?? null;
  // A merchant_profiles row exists from the moment someone APPLIES, so plain
  // truthiness is not "is a host". It was handing pending, rejected and
  // suspended applicants a Host nav tab, a Host entry in the portal switcher
  // and a wordmark pointing at /merchant - every one of which bounces straight
  // back out to a holding page.
  const isApprovedHost = merchantProfile?.verification_status === "approved";
  // Whether to still PITCH hosting. Anyone who has applied has answered that
  // question already, whatever the outcome - so the CTA keys off the row, not
  // the status.
  const hasHostApplication = !!merchantProfile;
  const avatarUrl = profileStatus?.photoUrl ?? session?.user?.image ?? null;
  const unreadCount = session?.user ? await getUnreadNotificationCount(session) : 0;

  // Logged-out MARKETING header: no app nav, no repeated big logo - just a
  // quiet "Log in" and the one primary "Sign up". The app nav belongs to
  // signed-in surfaces only.
  // site-header--marketing lets the home hero pull this bar onto the photo
  // (see the hero nav overlay rules in globals.css).
  if (!session?.user) {
    return (
      <header className={`${HEADER_SHELL} site-header--marketing`}>
        <div className={HEADER_ROW}>
          <Link href="/" aria-label="Click home" className="flex min-h-11 items-center lg:min-h-0">
            <Logo size={26} />
          </Link>
          <div className="flex items-center gap-2">
            <LoginTrigger className="rounded-xl px-4 py-2 text-sm font-semibold text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--purple)]" />
            <ButtonLink href="/signup" size="sm">
              Sign up
            </ButtonLink>
          </div>
        </div>
      </header>
    );
  }

  const portalRoles: PortalRole[] = ["user"];
  if (isApprovedHost) portalRoles.push("merchant");
  if (isAdmin) portalRoles.push("admin");

  // The wordmark points at the portal you actually work in (admin → /admin,
  // host → /merchant, otherwise the attendee dashboard).
  const logoHref = isAdmin ? "/admin" : isApprovedHost ? "/merchant" : "/dashboard";

  // App nav, per the DS: Discover · Dashboard · click (the people destination,
  // carrying the header's one spark) · Events.
  const navItems: HeaderNavItem[] = [
    { label: "Discover", href: "/discover", icon: "compass" },
    { label: "Dashboard", href: "/dashboard", icon: "home" },
    { label: "click", href: "/people", icon: "spark" },
    { label: "Events", href: "/confirmed-events", icon: "calendar" },
  ];
  if (isApprovedHost) navItems.push({ label: "Host", href: "/merchant", icon: "ticket" });
  if (isAdmin) navItems.push({ label: "Admin", href: "/admin", icon: "settings" });

  // Mobile: a sticky bottom action bar (a web pattern, not a native tab bar) -
  // the thumb-reachable stand-in for the desktop nav, which is hidden below lg.
  const bottomTabs: BottomNavTab[] = [
    { label: "Dashboard", href: "/dashboard", icon: "home" },
    { label: "Discover", href: "/discover", icon: "find" },
    { label: "click", href: "/people", icon: "spark" },
    { label: "Events", href: "/confirmed-events", icon: "calendar" },
  ];

  return (
    <>
      <header className={HEADER_SHELL}>
        <div className={HEADER_ROW}>
          <Link href={logoHref} aria-label="Click home" className="flex min-h-11 items-center lg:min-h-0">
            <Logo size={26} />
          </Link>

          <HeaderNav items={navItems} />

          <div className="flex items-center gap-2">
            {!hasHostApplication ? (
              <ButtonLink href="/merchant/signup" variant="secondary" size="sm" className="hidden sm:inline-flex">
                Host an event
              </ButtonLink>
            ) : null}
            <HeaderNotificationsBell unreadCount={unreadCount} />
            <HeaderRoleSwitcher
              roles={portalRoles}
              userLabel={userLabel}
              avatarUrl={avatarUrl}
              showHostCta={!hasHostApplication}
              canSwitchAccounts={qaSwitcherUnlocked}
              currentEmail={session.user.email}
            />
          </div>
        </div>
      </header>
      <MobileBottomNav tabs={bottomTabs} />
    </>
  );
}

/**
 * The global footer - EXACTLY two rows, no tagline, no divider between them, on
 * the same cream canvas as the page. The old fat three-column dark band is gone
 * by rule: supply is carried by the "Host an event" link, not a stacked band.
 */
export async function SiteFooter() {
  const links: Array<[string, string]> = [
    ["Discover", "/discover"],
    // /categories was reachable only by typing the URL - nothing in the app
    // linked it, so a live, on-DS browse surface that reads real event and tag
    // counts sat orphaned. The footer is where a secondary browse entry belongs;
    // its cards route into /discover?category=, so it feeds the main surface
    // rather than competing with it.
    ["Categories", "/categories"],
    ["How it works", "/how-it-works"],
    // /merchant/signup, not /merchant: for a logged-OUT visitor /merchant is
    // gated by the proxy and bounces to /merchant/login, so the footer's supply
    // link cost a new host two extra hops through a login they have no account
    // for. /merchant/signup self-routes for every session state (auth gate ->
    // wizard -> existing merchants redirected to /merchant by its layout).
    ["Host an event", "/merchant/signup"],
    ["Safety", "/safety"],
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
    ["Refunds", "/refund-policy"],
    ["Security", "/security"],
  ];

  return (
    <footer className="border-t border-[color:var(--line-soft)] bg-[color:var(--champagne)]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2.5 px-5 py-6 sm:px-8">
        {/* Row 1 - wordmark left, the essential links right */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Logo size={22} />
          <div className="flex flex-1 flex-wrap items-center justify-start gap-x-3.5 gap-y-1.5 sm:justify-end">
            {links.map(([label, href], i) => (
              <span key={href} className="flex items-center gap-3.5">
                {i > 0 ? (
                  <span aria-hidden className="text-xs text-[color:var(--ink-faint)]">
                    ·
                  </span>
                ) : null}
                <Link
                  href={href}
                  className="text-[13px] font-medium whitespace-nowrap text-[color:var(--slate)] transition-colors hover:text-[color:var(--purple-700)]"
                >
                  {label}
                </Link>
              </span>
            ))}
          </div>
        </div>

        {/* Row 2 - copyright left, social + email right */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] whitespace-nowrap text-[color:var(--slate)]">
            © {new Date().getFullYear()} Click · Made in Sydney
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--slate)]">
            <SocialLink label="Click's Instagram" href="https://instagram.com/click.irl">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
            </SocialLink>
            <SocialLink label="Click's Threads" href="https://threads.net/@click.irl">
              <path d="M12 21c-4.4 0-7-2.9-7-9s2.6-9 7-9c3.5 0 5.7 1.8 6.6 4.5" />
              <path d="M16.5 11.5c-.2-3.1-2-4.7-4.6-4.7-2.4 0-4.3 1.5-4.3 3.8 0 2 1.5 3.3 3.6 3.3 2.4 0 3.6-1.6 3.6-3.9" />
              <path d="M9.3 13.2c.6 1.2 1.8 1.6 3 1.5 2-.2 3-1.6 2.8-4" />
            </SocialLink>
            <a
              href={`mailto:${SUPPORT_EMAIL_DEFAULT}`}
              className="ml-1.5 transition-colors hover:text-[color:var(--purple-700)]"
            >
              {SUPPORT_EMAIL_DEFAULT}
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Monochrome line icon - Slate, going Deep Purple on hover. Labelled link, hidden glyph. */
function SocialLink({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex size-7 items-center justify-center transition-colors hover:text-[color:var(--purple-700)]"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </a>
  );
}
