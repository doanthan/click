import Link from "next/link";
import type { ReactNode, SVGProps } from "react";
import { Avatar, ButtonLink, Icon } from "./ds";
import { mCard } from "./merchant-ds";
import { PortalMobileNav, type PortalMobileNavItem } from "./portal-mobile-nav";

// Merchant portal tab keys. Unlike the admin console (which uses real routes +
// usePathname), the merchant portal is a single page driven by `?tab=`, so the
// active item is passed in from the server component rather than read from the
// pathname — this component stays a server component as a result.
export type MerchantTabKey =
  | "dashboard"
  | "events"
  | "bookings"
  | "finances"
  | "settings";

export type MerchantSidebarCounts = Partial<Record<MerchantTabKey, number>>;

type IconName = "dashboard" | "events" | "bookings" | "finances" | "settings";

type NavItem = {
  key: MerchantTabKey;
  label: string;
  icon: IconName;
};

const NAV_PRIMARY: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "events", label: "Events & venues", icon: "events" },
  { key: "bookings", label: "Bookings", icon: "bookings" },
  { key: "finances", label: "Finances", icon: "finances" },
];

const NAV_SECONDARY: NavItem[] = [
  { key: "settings", label: "Settings", icon: "settings" },
];

// Line glyphs in the DS voice: even 1.9px stroke, rounded joins, currentColor.
const ICON_PATHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  events: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  bookings: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  finances: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" />
      <path d="M12 8.5v7" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

function NavIcon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

export function MerchantSidebar({
  activeTab,
  businessName,
  counts = {},
}: {
  activeTab: MerchantTabKey;
  businessName: string;
  counts?: MerchantSidebarCounts;
}) {
  function renderItem(item: NavItem) {
    const isActive = item.key === activeTab;
    const count = counts[item.key];

    // Selected is ALWAYS Deep Purple - flat, no gradient, no glow, and never a
    // status colour. Radius 12, matching the button footprint.
    return (
      <Link
        key={item.key}
        href={`/merchant?tab=${item.key}`}
        aria-current={isActive ? "page" : undefined}
        className={`flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors ${
          isActive
            ? "bg-[color:var(--purple)] font-semibold text-[color:var(--champagne)]"
            : "font-medium text-[color:var(--ink-soft)] hover:bg-[color:var(--lavender-100)]"
        }`}
      >
        <NavIcon
          name={item.icon}
          className={`size-[17px] shrink-0 ${isActive ? "" : "text-[color:var(--slate)]"}`}
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {typeof count === "number" ? (
          <span
            className={`min-w-[20px] shrink-0 rounded-full px-1.5 text-center text-[11.5px] font-bold leading-5 tabular-nums ${
              isActive
                ? "bg-[color:var(--champagne)]/20 text-[color:var(--champagne)]"
                : "bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]"
            }`}
          >
            {count}
          </span>
        ) : null}
      </Link>
    );
  }

  const mobileItems: PortalMobileNavItem[] = [...NAV_PRIMARY, ...NAV_SECONDARY].map(
    (item) => ({
      key: item.key,
      label: item.label,
      href: `/merchant?tab=${item.key}`,
      count: counts[item.key],
      active: item.key === activeTab,
    }),
  );

  return (
    <>
      <PortalMobileNav
        title="Merchant portal"
        items={mobileItems}
        cta={{ label: "Create event", href: "/merchant/events/create" }}
      />
      <aside className="hidden lg:sticky lg:top-6 lg:block lg:w-56 lg:shrink-0">
        <nav className={`${mCard} flex flex-col gap-1 p-3.5`}>
          <div className="flex items-center gap-2.5 px-1.5 pb-3 pt-1">
            <Avatar name={businessName} size={38} />
            <span className="min-w-0">
              <span className="font-display block truncate text-[13.5px] font-semibold leading-tight text-[color:var(--ink)]">
                {businessName}
              </span>
              <span className="mt-0.5 block text-[10.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--purple-600)]">
                Merchant portal
              </span>
            </span>
          </div>

          {NAV_PRIMARY.map(renderItem)}

          <div className="mx-1 my-2 h-px bg-[color:var(--mist)]" />

          {NAV_SECONDARY.map(renderItem)}

          {/* The portal's persistent create affordance. The content column below
              carries exactly ONE more (its TabHeader action or its empty state) -
              never both. */}
          <ButtonLink href="/merchant/events/create" size="sm" full className="mt-2">
            <Icon name="plus" size={15} />
            Create event
          </ButtonLink>
        </nav>
      </aside>
    </>
  );
}
