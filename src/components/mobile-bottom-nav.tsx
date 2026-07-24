"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Spark } from "./ds";

// Icon keys kept as a closed union so the server-built tab list can name an
// icon without shipping a component across the server/client boundary.
export type BottomNavIcon = "find" | "calendar" | "host" | "you" | "info" | "spark" | "people";

export type BottomNavTab = {
  label: string;
  href: string;
  icon: BottomNavIcon;
};

// Thumb-reachable bottom tab bar — the mobile replacement for the desktop nav
// links, which are `hidden lg:flex` in the header. Hidden from `lg` up, where
// the header nav takes over. Tabs are computed server-side (role-aware) in
// SiteHeader and passed in; active state is resolved here against the pathname.
export function MobileBottomNav({ tabs }: { tabs: BottomNavTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[color:var(--line)] bg-[color:var(--champagne)]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map((tab) => {
          // `/discover` shouldn't light up on `/`; match exact for the root-ish
          // tabs and prefix-match for section tabs so nested pages stay active.
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.68rem] font-semibold transition-colors ${
                  active
                    ? "text-[color:var(--purple)]"
                    : "text-[color:var(--slate)] hover:text-[color:var(--ink)]"
                }`}
              >
                {/* Non-colour active cue: a short bar riding the top hairline,
                    so the current tab reads at a glance (and for low-vision
                    users colour alone never carries the state). */}
                <span
                  aria-hidden
                  className={`absolute top-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-[color:var(--purple)] transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <BottomNavGlyph icon={tab.icon} active={active} />
                <span className="leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function BottomNavGlyph({ icon, active }: { icon: BottomNavIcon; active: boolean }) {
  // The people tab is the one spark in the bar - the brand glyph, never a
  // starburst of strokes and never the orange emoji.
  if (icon === "spark") {
    return <Spark size={24} tone={active ? "var(--purple)" : "var(--slate)"} toneSmall={active ? "var(--purple-400)" : "var(--slate)"} />;
  }
  const stroke = "currentColor";
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (icon) {
    case "find":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </svg>
      );
    case "host":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "you":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" />
        </svg>
      );
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 19c0-3 2.9-5 6.5-5s6.5 2 6.5 5" />
          <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M21.5 19c0-2.4-1.6-4.2-4-4.8" />
        </svg>
      );
    case "info":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.5h.01" />
        </svg>
      );
    default:
      return null;
  }
}
