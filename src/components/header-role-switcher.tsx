"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { signOutOfClick } from "@/app/login/actions";
import { Avatar, Icon } from "./ds";
import { TestAccountRows } from "./test-account-switcher";
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
  // "Saved" everywhere: the page h1, the dashboard section and this menu.
  { label: "Saved", href: "/bookmarks" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Account settings", href: "/account-settings" },
];

export function HeaderRoleSwitcher({
  roles,
  userLabel,
  avatarUrl,
  showHostCta = false,
  canSwitchAccounts = false,
  currentEmail = null,
}: {
  roles: PortalRole[];
  userLabel: string;
  avatarUrl?: string | null;
  /** Only for people with NO host application on file. `roles` can't answer
   *  this: it carries "merchant" for approved hosts only, so inferring from it
   *  would re-pitch hosting to someone whose application is sitting in the
   *  admin queue. */
  showHostCta?: boolean;
  /** The production QA gate has already been verified server-side. The forms
   *  inside the picker independently re-check it before changing sessions. */
  canSwitchAccounts?: boolean;
  currentEmail?: string | null;
}) {
  const { open, setOpen, ref } = useDisclosure<HTMLDivElement>();
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const accountPickerId = useId();
  const pathname = usePathname();
  const isQaSession = currentEmail?.trim().toLowerCase().endsWith("@click.local") ?? false;

  const currentRole: PortalRole = pathname?.startsWith("/admin")
    ? "admin"
    : pathname?.startsWith("/merchant")
      ? "merchant"
      : "user";

  const showPortalSwitcher = roles.length > 1;

  // The header's "Host an event" button is desktop-only (hidden sm:inline-flex)
  // and the mobile bottom bar has no host tab, so on a phone this menu was the
  // only reachable route to hosting - and it didn't carry one.
  const links = showHostCta
    ? [...ACCOUNT_LINKS, { label: "Host an event", href: "/merchant/signup" }]
    : ACCOUNT_LINKS;

  return (
    <div className="relative block" ref={ref}>
      {/* Disclosure, not an ARIA menu: the panel is a list of plain links, so
          Tab walks it naturally and we owe no arrow-key contract. */}
      <button
        type="button"
        onClick={() => {
          // An outside click may have closed the whole disclosure while its
          // nested picker state was still true. Always reopen at the account
          // menu's first level instead of surprising the user with a stale
          // side panel.
          if (!open) setAccountPickerOpen(false);
          setOpen(!open);
        }}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex min-h-11 items-center gap-1.5 rounded-full p-0.5 lg:min-h-0"
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
        <div className="menu-pop absolute right-0 z-50 mt-2 max-h-[calc(100dvh-14rem)] w-[min(340px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-2 shadow-[0_18px_44px_rgba(76,55,140,0.18)] sm:max-h-[calc(100dvh-10rem)]">
          {canSwitchAccounts && accountPickerOpen ? (
            <section id={accountPickerId} role="dialog" aria-label="Test as another person">
              <div className="sticky top-0 z-[1] flex items-center gap-3 border-b border-[color:var(--line-soft)] bg-[color:var(--paper)] px-1 py-2.5">
                <button
                  type="button"
                  onClick={() => setAccountPickerOpen(false)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-xl px-2 text-[12.5px] font-semibold text-[color:var(--purple-800)] transition-colors hover:bg-[color:var(--lavender-100)]"
                >
                  <Icon name="chevL" size={15} stroke={2} />
                  Back
                </button>
                <div className="min-w-0">
                  <h2 className="font-display truncate text-[14px] font-semibold text-[color:var(--ink)]">
                    Test as another person
                  </h2>
                  <p className="truncate text-[11.5px] text-[color:var(--slate)]">
                    Switch without resetting progress
                  </p>
                </div>
              </div>
              <TestAccountRows currentEmail={currentEmail} />
            </section>
          ) : (
            <>
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
                {links.map((link) => {
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
                              <Icon
                                name="arrowR"
                                size={15}
                                stroke={2}
                                className="text-[color:var(--slate)]"
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}

              {canSwitchAccounts ? (
                <>
                  <div className="my-1 h-px bg-[color:var(--line-soft)]" />
                  <button
                    type="button"
                    onClick={() => setAccountPickerOpen(true)}
                    aria-controls={accountPickerId}
                    aria-expanded={false}
                    aria-haspopup="dialog"
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
                  >
                    <span>
                      <span className="block">Test as another person</span>
                      <span className="mt-0.5 block text-[11.5px] font-normal text-[color:var(--slate)]">
                        Keep their current test progress
                      </span>
                    </span>
                    <Icon name="chevR" size={15} stroke={2} className="text-[color:var(--slate)]" />
                  </button>
                  <Link
                    href="/test"
                    onClick={() => setOpen(false)}
                    className="mt-1 block rounded-xl px-3 py-2.5 text-[14.5px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
                  >
                    <span className="block">Testing workspace</span>
                    <span className="mt-0.5 block text-[11.5px] font-normal text-[color:var(--slate)]">
                      Start a scenario from a clean state
                    </span>
                  </Link>
                </>
              ) : null}

              <div className="my-1 h-px bg-[color:var(--line-soft)]" />
              {/* Sign out is a quiet row - never error red, since signing out is not destructive. */}
              <form action={signOutOfClick}>
                <button
                  type="submit"
                  className="block w-full rounded-xl px-3 py-2.5 text-left text-[14.5px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                >
                  {isQaSession ? "Exit test account" : "Sign out"}
                </button>
              </form>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
