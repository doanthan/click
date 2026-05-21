"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SupabaseLogDrawer from "./SupabaseLogDrawer";

type Check = {
  label: string;
  description: string;
};

export type RouteSpec = {
  href: string;
  label: string;
  notes: string;
  checks: Check[];
  auth?: "none" | "user" | "merchant" | "admin";
};

export type RouteGroup = {
  heading: string;
  routes: RouteSpec[];
};

type CheckStatus = "untested" | "pass" | "fail";
type StatusMap = Record<string, CheckStatus>;
type NotesMap = Record<string, string>;

const STATUS_KEY = "click-test-checks-v1";
const NOTES_KEY = "click-test-notes-v1";

function authBadge(auth: RouteSpec["auth"]) {
  if (!auth || auth === "none") {
    return {
      label: "Public",
      className: "bg-[color:var(--peach)] text-[color:var(--surface-deep)]",
    };
  }
  if (auth === "user") {
    return {
      label: "Logged in",
      className: "bg-[color:var(--rose)] text-[color:var(--surface-deep)]",
    };
  }
  if (auth === "merchant") {
    return {
      label: "Merchant",
      className: "bg-[color:var(--cream)] text-[color:var(--ink)]",
    };
  }
  return {
    label: "Admin",
    className: "bg-[color:var(--ink)] text-[color:var(--champagne)]",
  };
}

function checkKey(routeKey: string, idx: number) {
  return `${routeKey}::check::${idx}`;
}

function routeNoteKey(routeKey: string) {
  return `${routeKey}::notes`;
}

function nextStatus(current: CheckStatus): CheckStatus {
  if (current === "untested") return "pass";
  if (current === "pass") return "fail";
  return "untested";
}

function statusPillClass(status: CheckStatus) {
  if (status === "pass") {
    return "bg-[color:var(--rose)] text-[color:var(--surface-deep)] border-[color:var(--ink)]";
  }
  if (status === "fail") {
    return "bg-[color:var(--ink)] text-[color:var(--champagne)] border-[color:var(--ink)]";
  }
  return "bg-[color:var(--cream)] text-[color:var(--mauve)] border-[color:var(--line)]";
}

function statusLabel(status: CheckStatus) {
  if (status === "pass") return "Pass";
  if (status === "fail") return "Fail";
  return "Untested";
}

export default function TestPageClient({ groups }: { groups: RouteGroup[] }) {
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [notes, setNotes] = useState<NotesMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawStatus = window.localStorage.getItem(STATUS_KEY);
      if (rawStatus) setStatuses(JSON.parse(rawStatus));
      const rawNotes = window.localStorage.getItem(NOTES_KEY);
      if (rawNotes) setNotes(JSON.parse(rawNotes));
    } catch {
      // ignore parse errors — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STATUS_KEY, JSON.stringify(statuses));
  }, [statuses, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes, hydrated]);

  const totals = useMemo(() => {
    let total = 0;
    let pass = 0;
    let fail = 0;
    for (const group of groups) {
      for (const route of group.routes) {
        const routeKey = `${group.heading}::${route.href}::${route.label}`;
        for (let i = 0; i < route.checks.length; i += 1) {
          total += 1;
          const status = statuses[checkKey(routeKey, i)] ?? "untested";
          if (status === "pass") pass += 1;
          if (status === "fail") fail += 1;
        }
      }
    }
    return { total, pass, fail, untested: total - pass - fail };
  }, [groups, statuses]);

  function toggleCheck(routeKey: string, idx: number) {
    setStatuses((prev) => {
      const key = checkKey(routeKey, idx);
      const current = prev[key] ?? "untested";
      return { ...prev, [key]: nextStatus(current) };
    });
  }

  function markRouteAllPass(routeKey: string, checkCount: number) {
    setStatuses((prev) => {
      const next = { ...prev };
      for (let i = 0; i < checkCount; i += 1) {
        next[checkKey(routeKey, i)] = "pass";
      }
      return next;
    });
  }

  function resetRoute(routeKey: string, checkCount: number) {
    setStatuses((prev) => {
      const next = { ...prev };
      for (let i = 0; i < checkCount; i += 1) {
        next[checkKey(routeKey, i)] = "untested";
      }
      return next;
    });
  }

  function setRouteNote(routeKey: string, value: string) {
    setNotes((prev) => ({ ...prev, [routeNoteKey(routeKey)]: value }));
  }

  function resetAll() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Reset every check status and clear every note?")
    ) {
      return;
    }
    setStatuses({});
    setNotes({});
  }

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          QA index
        </p>
        <h1 className="font-display mt-4 text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          Test <span className="italic text-[color:var(--rose)]">every page</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          Click each check to cycle Untested → Pass → Fail. Notes and statuses
          live in your browser&apos;s localStorage, so they survive reloads.
        </p>

        <div className="sticky top-4 z-10 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-[color:var(--ink)]">
              Total {totals.total}
            </span>
            <span className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--rose)] px-3 py-1 text-[color:var(--surface-deep)]">
              Pass {totals.pass}
            </span>
            <span className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-3 py-1 text-[color:var(--champagne)]">
              Fail {totals.fail}
            </span>
            <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 text-[color:var(--mauve)]">
              Untested {totals.untested}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SupabaseLogDrawer />
            <button
              type="button"
              onClick={resetAll}
              className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--ink)] transition hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
            >
              Reset all
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-8">
          {groups.map((group) => (
            <section key={group.heading}>
              <h2 className="font-display text-3xl font-light leading-tight">
                {group.heading}
              </h2>
              <ul className="mt-4 grid gap-3">
                {group.routes.map((route) => {
                  const badge = authBadge(route.auth);
                  const routeKey = `${group.heading}::${route.href}::${route.label}`;
                  const routeStatuses = route.checks.map(
                    (_, i) => statuses[checkKey(routeKey, i)] ?? "untested",
                  );
                  const passCount = routeStatuses.filter(
                    (s) => s === "pass",
                  ).length;
                  const failCount = routeStatuses.filter(
                    (s) => s === "fail",
                  ).length;
                  const allPassed =
                    route.checks.length > 0 && passCount === route.checks.length;
                  const noteValue = notes[routeNoteKey(routeKey)] ?? "";

                  return (
                    <li
                      key={routeKey}
                      className={`rounded-2xl border-2 p-5 hard-shadow-sm ${
                        allPassed
                          ? "border-[color:var(--rose)] bg-[color:var(--rose)]/10"
                          : "border-[color:var(--line)] bg-[color:var(--champagne)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={route.href}
                            target="_blank"
                            rel="noreferrer"
                            className="font-display text-2xl font-light leading-tight text-[color:var(--ink)] hover:underline"
                          >
                            {route.label}
                          </Link>
                          {allPassed ? (
                            <span className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--rose)] px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[color:var(--surface-deep)]">
                              All passed
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`rounded-full border-2 border-[color:var(--line)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Link
                          href={route.href}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)] hover:underline"
                        >
                          {route.href} ↗
                        </Link>
                        <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                          · {passCount}/{route.checks.length} pass
                          {failCount > 0 ? ` · ${failCount} fail` : ""}
                        </span>
                      </div>

                      <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                        {route.notes}
                      </p>

                      <div className="mt-4 rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                            Verify
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                markRouteAllPass(routeKey, route.checks.length)
                              }
                              className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--rose)] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--surface-deep)] transition hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
                            >
                              Mark all passed
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                resetRoute(routeKey, route.checks.length)
                              }
                              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)] transition hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                        <ul className="mt-3 grid gap-3">
                          {route.checks.map((check, idx) => {
                            const status = routeStatuses[idx];
                            return (
                              <li
                                key={`${routeKey}-check-${idx}`}
                                className="grid gap-1"
                              >
                                <div className="flex items-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleCheck(routeKey, idx)}
                                    aria-label={`Toggle status for ${check.label}`}
                                    className={`mt-0.5 shrink-0 rounded-full border-2 px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] transition ${statusPillClass(status)}`}
                                  >
                                    {statusLabel(status)}
                                  </button>
                                  <span className="font-bold text-[color:var(--ink)]">
                                    {check.label}
                                  </span>
                                </div>
                                <p className="ml-[5.25rem] text-xs font-medium leading-5 text-[color:var(--mauve)]">
                                  {check.description}
                                </p>
                              </li>
                            );
                          })}
                        </ul>

                        <label className="mt-4 block">
                          <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                            Notes
                          </span>
                          <textarea
                            value={noteValue}
                            onChange={(e) =>
                              setRouteNote(routeKey, e.target.value)
                            }
                            placeholder="What broke, what to follow up on, screenshots URLs…"
                            rows={2}
                            className="mt-1 w-full resize-y rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-sm font-medium text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/60 focus:border-[color:var(--ink)] focus:outline-none"
                          />
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section>
            <h2 className="font-display text-3xl font-light leading-tight">
              API routes
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              Server-only — no page to open. Probe with curl if needed.
            </p>
            <ul className="mt-4 grid gap-2 font-mono text-xs font-bold text-[color:var(--ink)]">
              <li>POST /api/events/[eventId]/register → 401 when logged out</li>
              <li>DELETE /api/events/[eventId]/register → cancels RSVP</li>
              <li>POST /api/events/[eventId]/bookmark → toggles save</li>
              <li>
                POST /api/events/[eventId]/checkout → 503 when Stripe unset, else returns
                checkout URL
              </li>
              <li>POST /api/webhooks/stripe → 400/503 without valid signature</li>
              <li>POST /api/merchant → merchant signup</li>
              <li>POST /api/onboarding → save attendee profile</li>
              <li>POST /api/admin/events/[eventId]/approve → admin only</li>
              <li>* /api/auth/[...nextauth]</li>
            </ul>
          </section>

          <p className="mt-6 text-center font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]/40">
            ✷ doan is the best ✷
          </p>
        </div>
      </section>
    </main>
  );
}
