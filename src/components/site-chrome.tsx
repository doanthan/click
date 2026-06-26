import Link from "next/link";
import Image from "next/image";
import { auth, isAdminEmail } from "@/auth";
import {
  getProfileStatus,
  getUnreadNotificationCount,
} from "@/lib/event-repository";
import { HeaderNotificationsBell } from "./header-notifications-bell";
import { HeaderRoleSwitcher, type PortalRole } from "./header-role-switcher";
import { LoginTrigger } from "./login-trigger";
import { MobileBottomNav, type BottomNavTab } from "./mobile-bottom-nav";

// Static placeholder streamed while the real SiteHeader awaits its session +
// profile queries. Mirrors the header chrome (same sticky bar, same logo
// height) so there is no layout shift when the live header swaps in — only
// the nav links and the action cluster pop in.
export function SiteHeaderShell() {
  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[color:var(--champagne)]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2 sm:px-8 sm:py-3.5 lg:px-12">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Image
            src="/click_blob_mascot.svg"
            alt=""
            width={44}
            height={44}
            aria-hidden
            className="h-8 w-8 shrink-0 sm:h-10 sm:w-10"
          />
          <span className="click-wordmark text-[1.4rem] text-[color:var(--ink)] sm:text-[1.85rem]">
            Click
            <span className="click-wordmark__period" aria-hidden />
          </span>
        </div>
        <div className="h-8 sm:h-10" aria-hidden />
      </div>
    </header>
  );
}

export async function SiteHeader() {
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Account";
  const isAdmin = !!session?.user && isAdminEmail(session.user.email);
  const profileStatus = session?.user ? await getProfileStatus(session) : null;
  const hasMerchantProfile = !!profileStatus?.merchantProfile;
  const avatarUrl = profileStatus?.photoUrl ?? session?.user?.image ?? null;
  const unreadCount = session?.user ? await getUnreadNotificationCount(session) : 0;

  const portalRoles: PortalRole[] = [];
  if (session?.user) portalRoles.push("user");
  if (hasMerchantProfile) portalRoles.push("merchant");
  if (isAdmin) portalRoles.push("admin");

  // Logged-in users get the logo pointed at their portal home (admin → /admin,
  // host → /merchant, otherwise the attendee dashboard) so the wordmark is a
  // shortcut back to where they work, not the marketing landing page. Logged-out
  // visitors still get the public home page.
  const logoHref = !session?.user
    ? "/"
    : isAdmin
      ? "/admin"
      : hasMerchantProfile
        ? "/merchant"
        : "/dashboard";

  const navItems: Array<{ label: string; href: string }> = [
    { label: "Discover", href: "/discover" },
  ];
  if (session?.user) {
    navItems.push({ label: "Dashboard", href: "/dashboard" });
    // "People" is the core click-with-someone loop; it had no global nav entry,
    // so attendees on /discover couldn't find it (bug board #216).
    navItems.push({ label: "People", href: "/people" });
  }
  // Existing hosts get a direct link to their portal in the nav, labelled "Host
  // dashboard" so it reads as the management hub (the actual "Host an event" CTA
  // lives on the dashboard + portal). Everyone else (logged-out visitors +
  // attendees) gets the prominent "Host an event" button in the action cluster
  // below instead, so the entry point is always visible.
  if (hasMerchantProfile) {
    navItems.push({ label: "Host dashboard", href: "/merchant" });
  }
  if (isAdmin) {
    navItems.push({ label: "Admin", href: "/admin" });
  }

  // Mobile bottom tab bar — the thumb-reachable replacement for the desktop nav
  // (which is `hidden lg:flex`). Four slots, role-aware. The header bell already
  // covers notifications on mobile, so it isn't duplicated here.
  const bottomTabs: BottomNavTab[] = [{ label: "Find", href: "/discover", icon: "find" }];
  if (session?.user) {
    // People over Calendar in the 4 thumb slots: it's the core social loop and
    // had no nav entry (bug board #216). Calendar stays reachable from the
    // dashboard ("You" tab → "View calendar").
    bottomTabs.push({ label: "People", href: "/people", icon: "people" });
    bottomTabs.push({
      label: "Host",
      href: hasMerchantProfile ? "/merchant" : "/merchant/signup",
      icon: "host",
    });
    bottomTabs.push({ label: "You", href: "/dashboard", icon: "you" });
  } else {
    bottomTabs.push({ label: "How it works", href: "/how-it-works", icon: "info" });
    bottomTabs.push({ label: "Host", href: "/merchant/signup", icon: "host" });
    bottomTabs.push({ label: "Sign up", href: "/signup", icon: "spark" });
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[color:var(--champagne)]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2 sm:px-8 sm:py-3.5 lg:px-12">
        <Link
          href={logoHref}
          className="group flex items-center gap-1.5 sm:gap-2"
          aria-label="Click home"
        >
          <Image
            src="/click_blob_mascot.svg"
            alt=""
            width={44}
            height={44}
            aria-hidden
            className="h-8 w-8 shrink-0 transition-transform duration-300 group-hover:rotate-6 sm:h-10 sm:w-10"
          />
          <span className="click-wordmark text-[1.4rem] text-[color:var(--ink)] sm:text-[1.85rem]">
            Click
            <span className="click-wordmark__period" aria-hidden />
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-[0.95rem] font-medium text-[color:var(--mauve)] lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group/nav relative py-1 transition-colors hover:text-[color:var(--ink)]"
            >
              <span className="relative z-10">{item.label}</span>
              <span className="absolute inset-x-0 -bottom-0.5 h-[3px] origin-left scale-x-0 rounded-full bg-[color:var(--peach)] transition-transform duration-300 group-hover/nav:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {/* Host entry — shown to logged-out visitors and attendees (anyone
              who isn't already a host). Routes through login when needed and
              brings them back to register as a host. */}
          {!hasMerchantProfile && (
            <Link
              href="/merchant/signup"
              className="hidden rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] sm:block"
            >
              Host an event
            </Link>
          )}
          {session?.user ? (
            <>
              <HeaderNotificationsBell unreadCount={unreadCount} />
              <HeaderRoleSwitcher roles={portalRoles} userLabel={userLabel} avatarUrl={avatarUrl} />
            </>
          ) : (
            <>
              <LoginTrigger className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition-colors hover:text-[color:var(--rose)] sm:block" />
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface-deep)] px-4 py-2 text-sm font-semibold text-[color:var(--on-deep)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black"
              >
                Sign up
                <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
      <MobileBottomNav tabs={bottomTabs} />
    </>
  );
}

export async function SiteFooter() {
  const session = await auth();
  const isAdmin = !!session?.user && isAdminEmail(session.user.email);

  const footerGroups: Array<[string, ...string[]]> = [
    ["Product", "Discover", "Dashboard"],
    isAdmin
      ? ["Platform", "Host events", "Admin", "Scale"]
      : ["Platform", "Host events"],
    ["Legal", "Terms", "Privacy", "Security", "Refunds", "Safety"],
  ];

  return (
    <footer className="relative overflow-hidden bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]">
      <div className="h-1 w-full bg-[color:var(--coral)]" />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:px-12 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <span className="click-wordmark text-5xl text-[color:var(--on-deep)]">
            Click
            <span
              className="click-wordmark__period"
              aria-hidden
              style={{ background: "var(--coral)" }}
            />
          </span>
          <p className="mt-5 max-w-sm text-[0.95rem] leading-7 text-[color:var(--on-deep)]/65">
            An event-first people platform for friendship, dating, local groups,
            and shared-interest discovery in Sydney.
          </p>
          <p className="font-display mt-7 text-2xl font-semibold italic text-[color:var(--coral)]">
            See you out there.
          </p>
        </div>
        {footerGroups.map(([title, ...items]) => (
          <div key={title}>
            <p className="eyebrow text-[color:var(--on-deep)]/45">{title}</p>
            <div className="mt-4 grid gap-2.5 text-[0.95rem] text-[color:var(--on-deep)]/65">
              {items.map((item) => (
                <Link
                  href={linkForFooterItem(item)}
                  key={item}
                  className="w-fit transition-colors hover:text-[color:var(--coral)]"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[color:var(--on-deep)]/12">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-5 py-6 font-condensed text-xs uppercase tracking-[0.18em] text-[color:var(--on-deep)]/45 sm:flex-row sm:items-center sm:px-8 lg:px-12">
          <span>Made in Sydney · Click {new Date().getFullYear()}</span>
          <span>People → Events → Familiar Faces</span>
        </div>
      </div>
    </footer>
  );
}

function linkForFooterItem(item: string) {
  const normalized = item.toLowerCase();

  if (normalized === "discover") return "/discover";
  if (normalized === "events") return "/events";
  if (normalized === "categories") return "/categories";
  if (normalized === "dashboard") return "/dashboard";
  if (normalized === "onboarding") return "/onboarding";
  if (normalized === "host events" || normalized === "merchant") return "/merchant";
  if (normalized === "admin") return "/admin";
  if (normalized === "scale") return "/scale";
  if (normalized === "terms") return "/terms";
  if (normalized === "privacy") return "/privacy";
  if (normalized === "security") return "/security";
  if (normalized === "refunds") return "/refund-policy";
  if (normalized === "safety") return "/safety";
  return "/";
}
