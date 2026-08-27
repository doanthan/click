"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  signInAsTestAccount,
  signOutOfTestAccount,
} from "@/app/login/actions";
import { QA_PERSONAS, QA_SCENARIO_GROUPS } from "@/lib/qa-personas";
import { Icon } from "./ds";

// QA persona switcher. Signed-in people reach these rows from "Test as another person"
// in the avatar menu. The floating variant remains for the signed-out state,
// where there is no avatar menu but a tester still needs a route back in.
//
// Picking a persona here CONTINUES its current state. Starting over belongs in
// /test, where the selected scenario is reset explicitly before sign-in. This
// distinction is what lets a tester switch between two people without erasing
// the interaction they are testing.
//
// Mounted in local dev, and on a deployed environment only for a browser
// holding the TEST_SWITCHER_KEY unlock cookie. Every server action behind it
// re-checks that gate independently, and so does the test-login provider - this
// component going missing is not what keeps a stranger out of the admin console.
//
// Two variants:
//  - "floating" (default): the fixed top-right pill + dropdown.
//  - "inline": a static, always-open panel for embedding as a page section
//    (used on /test). `redirectTo` controls where sign-out lands so the inline
//    panel can keep you on /test instead of bouncing home.

function PersonaButton({
  label,
  exercises,
  active,
  pendingLabel = "Switching...",
}: {
  label: string;
  exercises: string;
  active: boolean;
  /** Replaces `exercises` while this row's form is in flight. */
  pendingLabel?: string;
}) {
  // signInAsTestAccount provisions the persona's whole data set BEFORE minting
  // the session, then redirects - seconds, not milliseconds. With no busy state
  // the press read as ignored and testers clicked a second persona on top of it.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-current={active || undefined}
      aria-busy={pending || undefined}
      /* aria-disabled, not `disabled`: the browser blurs a disabled element, so
         disabling the row the user just pressed would dump keyboard and screen
         reader users at the top of the document mid-switch. Same trade the DS
         Button makes - and like it, the click guard below is what actually stops
         a second provision run, since aria-disabled is advisory only. */
      aria-disabled={pending || undefined}
      onClick={
        pending
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
          : undefined
      }
      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
        active
          ? "bg-[color:var(--purple)] text-[color:var(--paper)]"
          : "text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
      } ${pending ? "cursor-progress" : ""}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-semibold">{label}</span>
        {pending ? (
          /* Reuses the DS ck-spin keyframes; .ck-btn__spinner itself is
             position:absolute and only works inside a .ck-btn. Under
             prefers-reduced-motion the global block freezes it - the label is
             what carries the meaning. */
          <span
            aria-hidden
            style={{ animation: "ck-spin .7s linear infinite" }}
            className="h-3.5 w-3.5 shrink-0 self-center rounded-full border-2 border-current border-t-transparent opacity-70"
          />
        ) : active ? (
          <span className="rounded-md bg-[rgba(255,255,255,0.18)] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.08em]">
            Now
          </span>
        ) : null}
      </span>
      <span
        className={`mt-0.5 block text-[11.5px] leading-[1.4] ${
          active ? "text-[rgba(255,255,255,0.78)]" : "text-[color:var(--slate)]"
        }`}
      >
        {pending ? pendingLabel : exercises}
      </span>
    </button>
  );
}

function PersonaRows({
  normalizedCurrent,
  redirectTo,
}: {
  normalizedCurrent: string | null;
  redirectTo: string;
}) {
  const signedOut = !normalizedCurrent;
  return (
    <div className="max-h-[70vh] overflow-y-auto">
      {QA_SCENARIO_GROUPS.map((group) => (
        <section key={group.id}>
          <h3 className="px-3.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-faint)]">
            {group.label}
          </h3>
          <ul className="grid gap-1 px-2 pb-1">
            {QA_PERSONAS.filter((persona) => persona.group === group.id).map((persona) => (
              <li key={persona.email}>
                <form action={signInAsTestAccount}>
                  <input type="hidden" name="email" value={persona.email} />
                  <PersonaButton
                    label={persona.label}
                    exercises={persona.exercises}
                    active={persona.email === normalizedCurrent}
                  />
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h3 className="px-3.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-faint)]">
          Signed out
        </h3>
        <ul className="grid gap-1 px-2 pb-2">
          <li>
            <form action={signOutOfTestAccount}>
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <fieldset disabled={signedOut} className="contents">
                <PersonaButton
                  label="Not signed in"
                  exercises="Public surfaces, sign-up and the login gate"
                  pendingLabel="Signing out..."
                  active={signedOut}
                />
              </fieldset>
            </form>
          </li>
        </ul>
      </section>

      <div className="border-t border-[color:var(--mist)] p-2">
        <a
          href="/test"
          className="block rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--lavender-100)]"
        >
          <span className="block text-[13.5px] font-semibold text-[color:var(--purple-800)]">
            Open testing workspace
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-[1.4] text-[color:var(--slate)]">
            Start a scenario fresh or use the advanced reset.
          </span>
        </a>
      </div>
    </div>
  );
}

/**
 * The account rows shared by the avatar-menu popover, the signed-out floating
 * fallback and the always-open /test panel. Keeping the forms here means every
 * entry point uses the same gated server actions and active-account treatment.
 */
export function TestAccountRows({
  currentEmail = null,
  redirectTo = "/",
}: {
  currentEmail?: string | null;
  redirectTo?: string;
}) {
  return (
    <PersonaRows
      normalizedCurrent={currentEmail?.toLowerCase() ?? null}
      redirectTo={redirectTo}
    />
  );
}

// `currentEmail` is the email of the actually signed-in session, passed from the
// root layout / page (which calls `auth()` server-side). The "Now" badge marks
// the row whose email matches it; when null, the "Not signed in" row is current,
// so the panel reflects the real session rather than the URL path.
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [variant]);

  const normalizedCurrent = currentEmail?.toLowerCase() ?? null;
  const currentPersona = QA_PERSONAS.find((persona) => persona.email === normalizedCurrent);
  const currentLabel = currentPersona ? currentPersona.label : "Not signed in";

  const panelHeader = (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--mist)] px-3.5 py-2.5">
      <span className="font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--slate)]">
        Testing as
      </span>
      <a
        href="/qa-unlock?lock=1"
        className="text-[11.5px] font-semibold text-[color:var(--purple)] hover:underline"
      >
        Hide
      </a>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="overflow-hidden rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] shadow-[0_2px_8px_rgba(28,24,48,.06)]">
        {panelHeader}
        <TestAccountRows currentEmail={normalizedCurrent} redirectTo={redirectTo} />
      </div>
    );
  }

  return (
    <div ref={ref} className="fixed right-3 top-3 z-[70]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="font-display flex items-center gap-2 rounded-xl bg-[color:var(--purple)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--paper)] shadow-[0_4px_14px_rgba(59,47,129,.28)] transition-colors hover:bg-[color:var(--purple-hover)]"
      >
        <Icon name="users" size={15} stroke={2} />
        {currentLabel}
        <span aria-hidden className="text-[10px] opacity-80">
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[290px] overflow-hidden rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] shadow-[0_12px_32px_rgba(28,24,48,.16),0_2px_6px_rgba(28,24,48,.08)]"
        >
          {panelHeader}
          <TestAccountRows currentEmail={normalizedCurrent} redirectTo={redirectTo} />
        </div>
      ) : null}
    </div>
  );
}
