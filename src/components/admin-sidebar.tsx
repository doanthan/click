"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, SVGProps } from "react";

export type AdminTabKey =
  | "overview"
  | "events"
  | "members"
  | "merchants"
  | "transactions"
  | "tags"
  | "matching"
  | "audit"
  | "system";

export type AdminSidebarCounts = Partial<Record<AdminTabKey, number>>;

type IconName =
  | "dashboard"
  | "events"
  | "attendees"
  | "merchants"
  | "transactions"
  | "contents"
  | "matching"
  | "audit"
  | "system";

type NavItem = {
  key: AdminTabKey;
  label: string;
  icon: IconName;
  href: string;
};

const NAV_PRIMARY: NavItem[] = [
  { key: "overview", label: "Dashboard", icon: "dashboard", href: "/admin" },
  { key: "events", label: "Events Management", icon: "events", href: "/admin/events" },
  { key: "members", label: "Attendees Management", icon: "attendees", href: "/admin/members" },
  { key: "merchants", label: "Merchants Management", icon: "merchants", href: "/admin/merchants" },
  { key: "transactions", label: "Transactions Management", icon: "transactions", href: "/admin/transactions" },
  { key: "tags", label: "Tags & Categories", icon: "contents", href: "/admin/tags" },
  { key: "matching", label: "Matching Formula", icon: "matching", href: "/admin/matching" },
];

const NAV_SECONDARY: NavItem[] = [
  { key: "audit", label: "Audit Log", icon: "audit", href: "/admin/audit" },
  { key: "system", label: "System", icon: "system", href: "/admin/system" },
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
  attendees: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  merchants: (
    <>
      <path d="m3 9 1.5-5h15L21 9" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18" />
      <path d="M9 20v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
    </>
  ),
  transactions: (
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </>
  ),
  contents: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  matching: (
    <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>
  ),
  audit: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </>
  ),
  system: (
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

function isActiveItem(pathname: string, item: NavItem) {
  if (item.href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminSidebar({ counts }: { counts: AdminSidebarCounts }) {
  const pathname = usePathname() ?? "/admin";

  function renderItem(item: NavItem) {
    const isActive = isActiveItem(pathname, item);
    const count = counts[item.key];

    return (
      <Link
        key={item.key}
        href={item.href}
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
      <nav className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3 hard-shadow">
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
            <span className="click-wordmark block truncate text-2xl text-[color:var(--ink)]">
              Let&apos;s Click
            </span>
            <span className="eyebrow mt-0.5 block">Admin Console</span>
          </span>
        </div>

        <div className="flex flex-col gap-1">{NAV_PRIMARY.map(renderItem)}</div>

        <div className="mx-1 my-3 border-t-2 border-[color:var(--line)]" />

        <div className="flex flex-col gap-1">{NAV_SECONDARY.map(renderItem)}</div>
      </nav>
    </aside>
  );
}
