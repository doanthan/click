"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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

  if (roles.length <= 1) {
    return (
      <Link
        href={PORTAL_HREF[roles[0] ?? "user"]}
        className="hidden max-w-44 truncate rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm sm:block"
      >
        {userLabel}
      </Link>
    );
  }

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex max-w-52 items-center gap-2 truncate rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
      >
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">
          {PORTAL_LABEL[currentRole]}
        </span>
        <span className="truncate">{userLabel}</span>
        <span aria-hidden className="text-[color:var(--mauve)]">▾</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-3 w-56 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow"
        >
          <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2">
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
                    {active ? <span className="text-xs">current</span> : <span aria-hidden>→</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] p-2">
            <Link
              href="/account-settings"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Account settings →
            </Link>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Your profile →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
