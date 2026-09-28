"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Logo, Spark, type IconName } from "./ds";

// The icon is named, not passed as a component, so the server-rendered header
// can build the tab list without shipping components across the boundary.
export type HeaderNavItem = { label: string; href: string; icon: IconName | "spark" };

/**
 * The app nav - signed-in surfaces only. A resting pill goes lavender-tinted
 * with Deep-Purple text when it is the current page; nothing else in the bar is
 * purple. The "click" tab carries the ONE spark in the header (the DS rations
 * the sparkle hard - this and the three mechanic peaks, nowhere else).
 */
// An event detail page belongs to the Discover lane: nothing else prefixes
// /events/…, so the whole nav used to read as "you are nowhere".
function isTabActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/discover" && pathname.startsWith("/events/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav({ items }: { items: HeaderNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1.5 lg:flex">
      {items.map((item) => {
        const active = isTabActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-[7px] rounded-full px-[15px] py-[9px] text-[14.5px] transition-colors ${
              active
                ? "bg-[color:var(--lavender-100)] font-semibold text-[color:var(--purple-700)]"
                : "font-medium text-[color:var(--ink-soft)] hover:bg-[color:var(--lav-bg)]"
            }`}
          >
            {item.icon === "spark" ? (
              <Spark size={20} tone="var(--purple)" toneSmall="var(--purple-400)" className="-translate-y-0.5" />
            ) : (
              <Icon name={item.icon} size={18} stroke={2} />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The wordmark goes to the dashboard of the view you are IN, read off the path
 * the same way HeaderRoleSwitcher decides which portal is current. It used to
 * point at the highest portal you hold (admin → /admin, host → /merchant) on
 * every page, so a host browsing as an attendee who tapped it to get back to
 * their dashboard was put in the host portal every time (bug board #290).
 */
export function HeaderLogoLink({ portals }: { portals: ("merchant" | "admin")[] }) {
  const pathname = usePathname() ?? "";
  const href =
    pathname.startsWith("/admin") && portals.includes("admin")
      ? "/admin"
      : pathname.startsWith("/merchant") && portals.includes("merchant")
        ? "/merchant"
        : "/dashboard";

  return (
    <Link href={href} aria-label="Click home" className="flex min-h-11 items-center lg:min-h-0">
      <Logo size={26} />
    </Link>
  );
}
