import Link from "next/link";
import Image from "next/image";
import { auth, isAdminEmail, signOut } from "@/auth";
import {
  getProfileStatus,
  getUnreadNotificationCount,
} from "@/lib/event-repository";
import { HeaderNotificationsBell } from "./header-notifications-bell";
import { HeaderRoleSwitcher, type PortalRole } from "./header-role-switcher";
import { LoginTrigger } from "./login-trigger";

export async function SiteHeader() {
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Account";
  const isAdmin = !!session?.user && isAdminEmail(session.user.email);
  const profileStatus = session?.user ? await getProfileStatus(session) : null;
  const hasMerchantProfile = !!profileStatus?.merchantProfile;
  const unreadCount = session?.user ? await getUnreadNotificationCount(session) : 0;

  const portalRoles: PortalRole[] = [];
  if (session?.user) portalRoles.push("user");
  if (hasMerchantProfile) portalRoles.push("merchant");
  if (isAdmin) portalRoles.push("admin");

  const navItems: Array<{ label: string; href: string }> = [
    { label: "Discover", href: "/discover" },
    { label: "Events", href: "/events" },
  ];
  if (session?.user) {
    navItems.push({ label: "Dashboard", href: "/dashboard" });
  }
  // Host entry is always visible — logged-out visitors land on /merchant/signup,
  // which routes through login and brings them back to register as a host.
  navItems.push({
    label: hasMerchantProfile ? "Host" : "Host an event",
    href: hasMerchantProfile ? "/merchant" : "/merchant/signup",
  });
  if (isAdmin) {
    navItems.push({ label: "Admin", href: "/admin" });
  }

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 transition-transform duration-300 hover:-rotate-2"
          aria-label="Click home"
        >
          <Image
            src="/click_blob_mascot.svg"
            alt=""
            width={48}
            height={48}
            aria-hidden
            className="h-11 w-11 shrink-0 transition-transform duration-300 group-hover:rotate-[8deg] sm:h-12 sm:w-12"
          />
          <span className="click-wordmark text-3xl text-[color:var(--ink)] sm:text-[2.1rem]">
            Click
            <span className="click-wordmark__period" aria-hidden />
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-bold uppercase tracking-wider text-[color:var(--mauve)] lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative py-1 transition hover:text-[color:var(--ink)] hover:[text-shadow:0_0_0_currentColor]"
            >
              <span className="relative z-10">{item.label}</span>
              <span className="absolute inset-x-0 bottom-0 h-2 origin-left scale-x-0 bg-[color:var(--peach)] transition-transform duration-300 hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {session?.user ? (
            <>
              <HeaderNotificationsBell unreadCount={unreadCount} />
              <HeaderRoleSwitcher roles={portalRoles} userLabel={userLabel} />
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-2 text-sm font-bold text-[color:var(--champagne)] hard-shadow-sm hover:bg-[color:var(--ink-deep)]"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <LoginTrigger className="hidden rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)] sm:block" />
              <Link
                href="/discover"
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)]"
              >
                Explore →
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const session = await auth();
  const isAdmin = !!session?.user && isAdminEmail(session.user.email);

  const footerGroups: Array<[string, ...string[]]> = [
    ["Product", "Discover", "Events", "Dashboard", "Onboarding"],
    isAdmin
      ? ["Platform", "Host events", "Admin", "Privacy", "Matching"]
      : ["Platform", "Host events", "Privacy", "Matching"],
    ["Modes", "Friendship", "Dating", "Networking", "Exploring"],
  ];

  return (
    <footer className="relative overflow-hidden border-t-2 border-[color:var(--surface-deep)] bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]">
      <div className="diagonal-stripes h-3 w-full" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <span className="click-wordmark text-6xl text-[color:var(--peach)]">
            Click
            <span
              className="click-wordmark__period"
              aria-hidden
              style={{ background: "var(--rose)", borderColor: "var(--peach)" }}
            />
          </span>
          <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-[color:var(--on-deep)]/72">
            An event-first people platform for friendship, dating, local groups,
            and shared-interest discovery in Sydney.
          </p>
          <p className="font-script mt-6 text-2xl text-[color:var(--peach)]">
            see you out there ✷
          </p>
        </div>
        {footerGroups.map(([title, ...items]) => (
          <div key={title}>
            <p className="eyebrow !text-[color:var(--peach)]">{title}</p>
            <div className="mt-3 grid gap-2 text-sm font-semibold text-[color:var(--on-deep)]/72">
              {items.map((item) => (
                <Link
                  href={linkForFooterItem(item)}
                  key={item}
                  className="w-fit transition hover:text-[color:var(--peach)]"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[color:var(--on-deep)]/15">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-5 text-xs font-mono uppercase tracking-[0.2em] text-[color:var(--on-deep)]/60 sm:flex-row sm:items-center sm:px-6">
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
  if (normalized === "dashboard") return "/dashboard";
  if (normalized === "onboarding") return "/onboarding";
  if (normalized === "host events" || normalized === "merchant") return "/merchant";
  if (normalized === "admin") return "/admin";
  return "/";
}
