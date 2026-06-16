"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Shared mobile navigation for the admin + merchant portals. Both portals use a
// fat left sidebar at `lg+` (admin-sidebar / merchant-sidebar), but below `lg`
// that sidebar used to dump its whole vertical nav list as a giant block above
// the page content. This replaces that on mobile with one compact sticky bar:
// the current section + a toggle that opens a dropdown of every section.
//
// Generic over both portals: the parent passes the section list with `active`
// already resolved (admin resolves it from the route, merchant from `?tab=`),
// so this component doesn't need to know either portal's routing scheme.
export type PortalMobileNavItem = {
  key: string;
  label: string;
  href: string;
  count?: number;
  active: boolean;
};

export function PortalMobileNav({
  title,
  items,
  cta,
}: {
  title: string;
  items: PortalMobileNavItem[];
  // Optional trailing action kept reachable from the bar (merchant's "Create
  // event"). Rendered as a pinned button inside the open panel.
  cta?: { label: string; href: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click (mirrors header-role-switcher). Navigation itself is
  // handled by each item's onClick → setOpen(false), so we don't watch the route.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const activeItem = items.find((i) => i.active);

  return (
    // Sticky just below the global SiteHeader (sticky top-0). The header is
    // ~49px tall on phones and ~69px from `sm` up (py + logo height); these
    // offsets keep the bar pinned right under it. Hidden from `lg` up where the
    // desktop sidebar takes over.
    <div
      ref={ref}
      className="sticky top-[49px] z-40 -mx-4 mb-2 sm:top-[69px] sm:-mx-6 lg:hidden"
    >
      <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)]/95 px-4 py-2 backdrop-blur-xl sm:px-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-2.5 text-left font-bold text-[color:var(--ink)] hard-shadow-sm"
        >
          <Image
            src="/click_blob_mascot.svg"
            alt=""
            width={28}
            height={28}
            aria-hidden
            className="h-7 w-7 shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="eyebrow block truncate leading-none">{title}</span>
            <span className="mt-0.5 block truncate text-[0.95rem] leading-tight">
              {activeItem?.label ?? "Menu"}
            </span>
          </span>
          {typeof activeItem?.count === "number" ? (
            <span className="rounded-full bg-[color:var(--peach)] px-2 py-0.5 text-[0.65rem] font-black tabular-nums text-[color:var(--ink)]">
              {activeItem.count}
            </span>
          ) : null}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`size-4 shrink-0 text-[color:var(--mauve)] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open ? (
        <div
          role="menu"
          className="absolute inset-x-4 z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-2 hard-shadow sm:inset-x-6"
        >
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-[0.92rem] font-bold transition ${
                    item.active
                      ? "border-[color:var(--line)] bg-[color:var(--ink)] text-[color:var(--champagne)] hard-shadow-sm"
                      : "border-transparent text-[color:var(--mauve)] hover:bg-[color:var(--cream)] hover:text-[color:var(--ink)]"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {typeof item.count === "number" ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.65rem] font-black tabular-nums ${
                        item.active
                          ? "bg-[color:var(--champagne)] text-[color:var(--ink)]"
                          : "bg-[color:var(--cream)] text-[color:var(--ink)]"
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          {cta ? (
            <Link
              href={cta.href}
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-3.5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              {cta.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
