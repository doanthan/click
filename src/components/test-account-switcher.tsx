"use client";

import { useEffect, useRef, useState } from "react";
import {
  signInAsTestAccount,
  signOutOfTestAccount,
} from "@/app/login/actions";

// Dev-only test-account switcher. Renders a floating pill in the top-right that
// signs you in as one of the seeded accounts (database/002_seed.sql) without
// logging out first — or signs you out into the "Not signed in" state. Mounted
// unconditionally from the root layout. SECURITY: the server actions it posts
// to no longer gate on NEXT_PUBLIC_MODE, so this performs passwordless
// impersonation (including admin) in ANY environment — keep deploys private.
//
// Two variants:
//  - "floating" (default): the fixed top-right pill + dropdown.
//  - "inline": a static, always-open panel for embedding as a page section
//    (used on /test). `redirectTo` controls where sign-out lands so the inline
//    panel can keep you on /test instead of bouncing home.
type TestRole = "user" | "merchant" | "admin";

const TEST_ACCOUNTS: { role: TestRole; label: string; email: string }[] = [
  { role: "user", label: "Attendee", email: "maya@click.local" },
  { role: "merchant", label: "Merchant", email: "theo@click.local" },
  { role: "admin", label: "Admin", email: "admin@click.local" },
];

// `currentEmail` is the email of the actually signed-in session, passed from the
// root layout / page (which calls `auth()` server-side). The "CURRENT" badge
// marks the row whose email matches it; when null, the "Not signed in" row is
// current, so the panel reflects the real session rather than the URL path.
export function TestAccountSwitcher({
  currentEmail = null,
  variant = "floating",
  redirectTo = "/",
}: {
  currentEmail?: string | null;
  variant?: "floating" | "inline";
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant !== "floating") return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [variant]);

  const normalizedCurrent = currentEmail?.toLowerCase() ?? null;
  const currentAccount = TEST_ACCOUNTS.find(
    (acct) => acct.email === normalizedCurrent,
  );
  const signedOut = !normalizedCurrent;

  // The list of rows, shared by both variants. Submitting a row triggers a
  // server-side sign-in/out that redirects, which tears the dropdown down for
  // us — so we deliberately DON'T close it via onClick here. Doing so
  // (setOpen(false)) would synchronously unmount the <form> during the click,
  // before the browser dispatches its `submit` event, and React 19 would never
  // run the form action — the sign-in would silently no-op.
  function AccountRows() {
    return (
      <ul className="p-2">
        {TEST_ACCOUNTS.map((acct) => {
          const active = acct.email === normalizedCurrent;
          return (
            <li key={acct.email}>
              <form action={signInAsTestAccount}>
                <input type="hidden" name="email" value={acct.email} />
                <button
                  type="submit"
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                    active
                      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                      : "text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                  }`}
                >
                  <span>
                    {acct.label}
                    <span className="block font-mono text-[0.6rem] font-medium normal-case text-[color:var(--mauve)]">
                      {acct.email}
                    </span>
                  </span>
                  {active ? (
                    <span className="text-[0.6rem] uppercase">current</span>
                  ) : (
                    <span aria-hidden>→</span>
                  )}
                </button>
              </form>
            </li>
          );
        })}
        {/* Signed-out state: clears the session so you can test public /
            unauthenticated flows without a real logout. */}
        <li>
          <form action={signOutOfTestAccount}>
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button
              type="submit"
              disabled={signedOut}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                signedOut
                  ? "cursor-default bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                  : "text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
              }`}
            >
              <span>
                Not signed in
                <span className="block font-mono text-[0.6rem] font-medium normal-case text-[color:var(--mauve)]">
                  signed-out / public
                </span>
              </span>
              {signedOut ? (
                <span className="text-[0.6rem] uppercase">current</span>
              ) : (
                <span aria-hidden>→</span>
              )}
            </button>
          </form>
        </li>
      </ul>
    );
  }

  const currentLabel = currentAccount ? currentAccount.label : "Not signed in";

  if (variant === "inline") {
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] hard-shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-4 py-2 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[color:var(--champagne)]">
          <span>Sign in as</span>
          <span className="text-[color:var(--rose)]">{currentLabel}</span>
        </div>
        <AccountRows />
      </div>
    );
  }

  return (
    <div ref={ref} className="fixed right-3 top-3 z-[60]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[color:var(--champagne)] shadow-2xl transition hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)]"
      >
        <span aria-hidden>🧪</span>
        {currentLabel}
        <span aria-hidden>▾</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] shadow-2xl"
        >
          <div className="border-b-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[color:var(--champagne)]">
            Sign in as
          </div>
          <AccountRows />
        </div>
      ) : null}
    </div>
  );
}
