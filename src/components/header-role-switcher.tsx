"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signOutOfClick } from "@/app/login/actions";

export type PortalRole = "user" | "merchant" | "admin";

const PORTAL_HREF: Record<PortalRole, string> = {
  user: "/dashboard",
  merchant: "/merchant",
  admin: "/admin",
};
const PORTAL_LABEL: Record<PortalRole, string> = {
  user: "Attendee",
  merchant: "Host",
  admin: "Admin",
};

type AccountLink = { label: string; href: string };

const ACCOUNT_LINKS: AccountLink[] = [
  { label: "Your profile", href: "/profile" },
  { label: "Your events", href: "/confirmed-events" },
  { label: "Bookmarks", href: "/bookmarks" },
  { label: "Account settings", href: "/account-settings" },
];

export function HeaderRoleSwitcher({
  roles,
  userLabel,
}: {
  roles: PortalRole[];
  userLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const currentRole: PortalRole =
    pathname?.startsWith("/admin")
      ? "admin"
      : pathname?.startsWith("/merchant")
        ? "merchant"
        : "user";

  const showPortalSwitcher = roles.length > 1;

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex max-w-52 items-center gap-2 truncate rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
      >
        {showPortalSwitcher ? (
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">
            {PORTAL_LABEL[currentRole]}
          </span>
        ) : null}
        <span className="truncate">{userLabel}</span>
        <span aria-hidden className="text-[color:var(--mauve)]">▾</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-3 w-60 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow"
        >
          <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2">
            <span className="block font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Signed in as
            </span>
            <span className="block truncate text-sm font-bold text-[color:var(--ink)]">
              {userLabel}
            </span>
          </div>

          <ul className="p-2">
            {ACCOUNT_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {showPortalSwitcher ? (
            <>
              <div className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2">
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Switch portal
                </span>
              </div>
              <ul className="p-2">
                {roles.map((r) => {
                  const active = r === currentRole;
                  return (
                    <li key={r}>
                      <Link
                        href={PORTAL_HREF[r]}
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-bold ${
                          active
                            ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                            : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                        }`}
                      >
                        <span>{PORTAL_LABEL[r]}</span>
                        {active ? (
                          <span className="text-xs">current</span>
                        ) : (
                          <span aria-hidden>→</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          <div className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] p-2">
            <form action={signOutOfClick}>
              <button
                type="submit"
                className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
