"use client";

import { useEffect, useRef, useState } from "react";
import { signInAsTestAccount } from "@/app/login/actions";

// Dev-only test-account switcher. Renders a floating pill in the top-right that
// signs you in as one of the seeded accounts (database/002_seed.sql) without
// logging out first. Mounted from the root layout behind a
// NEXT_PUBLIC_MODE === "DEVELOPMENT" gate, and the server action it posts to is
// itself a no-op outside development.
type TestRole = "user" | "merchant" | "admin";

const TEST_ACCOUNTS: { role: TestRole; label: string; email: string }[] = [
  { role: "user", label: "Attendee", email: "maya@click.local" },
  { role: "merchant", label: "Merchant", email: "theo@click.local" },
  { role: "admin", label: "Admin", email: "admin@click.local" },
];

// `currentEmail` is the email of the actually signed-in session, passed from the
// root layout (which calls `auth()` server-side). The "CURRENT" badge marks the
// row whose email matches it, so it reflects the real session rather than the
// URL path.
export function TestAccountSwitcher({
  currentEmail = null,
}: {
  currentEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const normalizedCurrent = currentEmail?.toLowerCase() ?? null;
  const currentAccount = TEST_ACCOUNTS.find(
    (acct) => acct.email === normalizedCurrent,
  );

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
        {currentAccount ? currentAccount.label : "Test user"}
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
          <ul className="p-2">
            {TEST_ACCOUNTS.map((acct) => {
              const active = acct.email === normalizedCurrent;
              return (
                <li key={acct.email}>
                  <form action={signInAsTestAccount}>
                    <input type="hidden" name="email" value={acct.email} />
                    <button
                      type="submit"
                      onClick={() => setOpen(false)}
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
          </ul>
        </div>
      ) : null}
    </div>
  );
}
