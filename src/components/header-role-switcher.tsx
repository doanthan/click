"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutOfClick } from "@/app/login/actions";
import { Avatar, Icon } from "./ds";
import { useDisclosure } from "./use-disclosure";

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
  { label: "People", href: "/people" },
  { label: "Your events", href: "/confirmed-events" },
  { label: "Calendar", href: "/dashboard/calendar" },
  { label: "Bookmarks", href: "/bookmarks" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Account settings", href: "/account-settings" },
];

export function HeaderRoleSwitcher({
  roles,
  userLabel,
  avatarUrl,
}: {
  roles: PortalRole[];
  userLabel: string;
  avatarUrl?: string | null;
}) {
  const { open, setOpen, ref } = useDisclosure<HTMLDivElement>();
  const pathname = usePathname();

  const currentRole: PortalRole = pathname?.startsWith("/admin")
    ? "admin"
    : pathname?.startsWith("/merchant")
      ? "merchant"
      : "user";

  const showPortalSwitcher = roles.length > 1;

  return (
    <div className="relative block" ref={ref}>
      {/* Disclosure, not an ARIA menu: the panel is a list of plain links, so
          Tab walks it naturally and we owe no arrow-key contract. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full p-0.5"
      >
        <Avatar name={userLabel} src={avatarUrl} size={34} ring={open} />
        <Icon
          name="chevD"
          size={14}
          stroke={2}
          className={`text-[color:var(--slate)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="menu-pop absolute right-0 z-50 mt-2 w-[300px] rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-2 shadow-[0_18px_44px_rgba(76,55,140,0.18)]">
          {/* Identity header - non-interactive */}
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={userLabel} src={avatarUrl} size={40} />
            <div className="min-w-0">
              <div className="font-display truncate text-[15px] font-semibold text-[color:var(--ink)]">
                Signed in as {userLabel.split(" ")[0]}
              </div>
              <div className="truncate text-[12.5px] text-[color:var(--slate)]">{userLabel}</div>
            </div>
          </div>

          <div className="my-1 h-px bg-[color:var(--line-soft)]" />

          <ul>
            {ACCOUNT_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl px-3 py-2.5 text-[14.5px] ${
                      active
                        ? "bg-[color:var(--lavender-100)] font-semibold text-[color:var(--purple-800)]"
                        : "font-medium text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {showPortalSwitcher ? (
            <>
              <div className="my-1 h-px bg-[color:var(--line-soft)]" />
              <p className="px-3 py-1.5 text-[11.5px] font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]">
                Switch portal
              </p>
              <ul>
                {roles.map((r) => {
                  const active = r === currentRole;
                  return (
                    <li key={r}>
                      <Link
                        href={PORTAL_HREF[r]}
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[14.5px] ${
                          active
                            ? "bg-[color:var(--lavender-100)] font-semibold text-[color:var(--purple-800)]"
                            : "font-medium text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                        }`}
                      >
                        <span>{PORTAL_LABEL[r]}</span>
                        {active ? (
                          <span className="text-[12px] text-[color:var(--slate)]">current</span>
                        ) : (
                          <Icon name="arrowR" size={15} stroke={2} className="text-[color:var(--slate)]" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          <div className="my-1 h-px bg-[color:var(--line-soft)]" />
          {/* Sign out is a quiet row - never error red, since signing out is not destructive. */}
          <form action={signOutOfClick}>
            <button
              type="submit"
              className="block w-full rounded-xl px-3 py-2.5 text-left text-[14.5px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
