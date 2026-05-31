import Image from "next/image";
import Link from "next/link";
import type { ReactNode, SVGProps } from "react";

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
  { key: "events", label: "Events & Venues", icon: "events" },
  { key: "bookings", label: "Bookings", icon: "bookings" },
  { key: "finances", label: "Finances", icon: "finances" },
];

const NAV_SECONDARY: NavItem[] = [
  { key: "settings", label: "Settings", icon: "settings" },
];

const ICON_PATHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
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
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
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

    return (
      <Link
        key={item.key}
        href={`/merchant?tab=${item.key}`}
        aria-current={isActive ? "page" : undefined}
        className={`group flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left text-[0.92rem] font-bold transition ${
          isActive
            ? "border-[color:var(--line)] bg-[color:var(--ink)] text-[color:var(--champagne)] hard-shadow-sm"
            : "border-transparent text-[color:var(--mauve)] hover:bg-[color:var(--cream)] hover:text-[color:var(--ink)]"
        }`}
      >
        <Icon name={item.icon} className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {typeof count === "number" ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[0.65rem] font-black tabular-nums ${
              isActive
                ? "bg-[color:var(--champagne)] text-[color:var(--ink)]"
                : "bg-[color:var(--cream)] text-[color:var(--ink)]"
            }`}
          >
            {count}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <aside className="lg:sticky lg:top-6 lg:w-[17.5rem] lg:shrink-0">
      <nav className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3 pb-4 hard-shadow">
        <div className="flex items-center gap-3 px-2 pb-4 pt-2">
          <Image
            src="/click_blob_mascot.svg"
            alt=""
            width={44}
            height={44}
            aria-hidden
            className="h-11 w-11 shrink-0"
          />
          <span className="min-w-0">
            <span className="block truncate text-lg font-extrabold leading-tight text-[color:var(--ink)]">
              {businessName}
            </span>
            <span className="eyebrow mt-0.5 block">Merchant Portal</span>
          </span>
        </div>

        <div className="flex flex-col gap-1">{NAV_PRIMARY.map(renderItem)}</div>

        <div className="mx-1 my-3 border-t-2 border-[color:var(--line)]" />

        <div className="flex flex-col gap-1">{NAV_SECONDARY.map(renderItem)}</div>

        <Link
          href="/merchant/events/create"
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-3.5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
        >
          + Create event
        </Link>
      </nav>
    </aside>
  );
}
