"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Spark, type IconName } from "./ds";

// The icon is named, not passed as a component, so the server-rendered header
// can build the tab list without shipping components across the boundary.
export type HeaderNavItem = { label: string; href: string; icon: IconName | "spark" };

/**
 * The app nav - signed-in surfaces only. A resting pill goes lavender-tinted
 * with Deep-Purple text when it is the current page; nothing else in the bar is
 * purple. The "click" tab carries the ONE spark in the header (the DS rations
 * the sparkle hard - this and the three mechanic peaks, nowhere else).
 */
export function HeaderNav({ items }: { items: HeaderNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1.5 lg:flex">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-[7px] rounded-full px-[15px] py-[9px] text-[14.5px] transition-colors ${
              active
                ? "bg-[color:var(--lavender-100)] font-semibold text-[color:var(--purple-700)]"
                : "font-medium text-[color:var(--ink-soft)] hover:bg-[color:var(--lavender-100)]"
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
