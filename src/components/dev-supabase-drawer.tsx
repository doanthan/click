"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LogEntry = {
  id: string;
  table: string;
  createdAt: string;
  label: string;
  detail: string;
  entityId: string | null;
  data: Record<string, unknown>;
};

type LogResponse = {
  ok: boolean;
  entries: LogEntry[];
  tables: string[];
  tableErrors?: { table: string; error: string }[];
  error?: string;
  fetchedAt?: string;
};

// ── Email log ──────────────────────────────────────────────────────────────
// Mirrors the writes tab but reads `email_events`. The HTML body comes back
// inline so the drawer can render a sandboxed iframe without a second fetch.

type EmailEntry = {
  id: string;
  template: string;
  toEmail: string;
  toProfileId: string | null;
  subject: string;
  html: string;
  vars: Record<string, unknown>;
  createdAt: string;
};

type EmailLogResponse = {
  ok: boolean;
  entries: EmailEntry[];
  error?: string;
  fetchedAt?: string;
};

// How often to poll the write log while the tab is visible.
const POLL_MS = 5000;

const tableColors: Record<string, string> = {
  profiles: "bg-[color:var(--rose)] text-[color:var(--surface-deep)]",
  merchant_profiles: "bg-[color:var(--peach)] text-[color:var(--surface-deep)]",
  events: "bg-[color:var(--ink)] text-[color:var(--champagne)]",
  event_attendees: "bg-[color:var(--cream)] text-[color:var(--ink)]",
  event_waitlists: "bg-[color:var(--cream)] text-[color:var(--ink)]",
  bookmarks: "bg-[color:var(--cream)] text-[color:var(--ink)]",
  payment_transactions: "bg-[color:var(--rose)] text-[color:var(--surface-deep)]",
  user_clicks: "bg-[color:var(--peach)] text-[color:var(--surface-deep)]",
  audit_logs: "bg-[color:var(--ink)] text-[color:var(--champagne)]",
};

function tableBadgeClass(table: string) {
  return tableColors[table] ?? "bg-[color:var(--cream)] text-[color:var(--ink)]";
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string) {
  try {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  } catch {
    return "";
  }
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

type DrawerTab = "writes" | "emails";

export default function DevSupabaseDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("writes");

  // ── Writes tab state ─────────────────────────────────────────────────
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [tableErrors, setTableErrors] = useState<{ table: string; error: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState("all");

  // ── Emails tab state ─────────────────────────────────────────────────
  const [emailEntries, setEmailEntries] = useState<EmailEntry[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailFetchedAt, setEmailFetchedAt] = useState<string | null>(null);
  const [newEmailIds, setNewEmailIds] = useState<Set<string>>(new Set());

  // Every row id we've ever observed. The first poll seeds this as the
  // "baseline" so existing rows don't flash — only rows created afterwards do.
  const knownRef = useRef<Set<string>>(new Set());
  const baselineRef = useRef(false);

  const knownEmailRef = useRef<Set<string>>(new Set());
  const emailBaselineRef = useRef(false);

  const poll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/test/supabase-log", { cache: "no-store" });
      const json = (await res.json()) as LogResponse;
      const fetched = json.entries ?? [];

      setEntries(fetched);
      setTables(json.tables ?? []);
      setTableErrors(json.tableErrors ?? []);
      setFetchedAt(json.fetchedAt ?? null);
      setError(json.ok ? null : json.error ?? null);

      if (!baselineRef.current) {
        for (const entry of fetched) knownRef.current.add(entry.id);
        baselineRef.current = true;
        return;
      }

      const fresh = fetched.filter((entry) => !knownRef.current.has(entry.id));
      if (fresh.length === 0) return;

      for (const entry of fresh) knownRef.current.add(entry.id);
      setNewIds((prev) => {
        const next = new Set(prev);
        for (const entry of fresh) next.add(entry.id);
        return next;
      });
      // Auto-expand brand-new rows so the written data is visible immediately.
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const entry of fresh) next.add(entry.id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load log");
    } finally {
      setLoading(false);
    }
  }, []);

  const pollEmails = useCallback(async () => {
    setEmailLoading(true);
    try {
      const res = await fetch("/api/test/email-log", { cache: "no-store" });
      const json = (await res.json()) as EmailLogResponse;
      const fetched = json.entries ?? [];

      setEmailEntries(fetched);
      setEmailFetchedAt(json.fetchedAt ?? null);
      setEmailError(json.ok ? null : json.error ?? null);

      if (!emailBaselineRef.current) {
        for (const entry of fetched) knownEmailRef.current.add(entry.id);
        emailBaselineRef.current = true;
        return;
      }

      const fresh = fetched.filter((entry) => !knownEmailRef.current.has(entry.id));
      if (fresh.length === 0) return;

      for (const entry of fresh) knownEmailRef.current.add(entry.id);
      setNewEmailIds((prev) => {
        const next = new Set(prev);
        for (const entry of fresh) next.add(entry.id);
        return next;
      });
      // Don't auto-expand emails — the iframes are heavy and a single fresh
      // one collapses the others on its own when the dev clicks it.
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to load email log");
    } finally {
      setEmailLoading(false);
    }
  }, []);

  // Poll continuously (even while closed) so the badge surfaces new writes.
  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active || document.hidden) return;
      void poll();
      void pollEmails();
    };
    // Defer the first poll a tick so we don't setState synchronously on mount.
    const initial = setTimeout(tick, 0);
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      active = false;
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [poll, pollEmails]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Filter to the selected table and re-sort latest-first. The API already
  // sorts, but doing it here too means a stale poll or a future API change
  // can't quietly put older rows above newer ones in the drawer.
  const filtered = useMemo(
    () =>
      entries
        .filter((entry) => tableFilter === "all" || entry.table === tableFilter)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [entries, tableFilter],
  );

  const newCount = newIds.size;
  const newEmailCount = newEmailIds.size;
  // Combined badge — the launcher button doesn't know which tab the dev
  // cares about, so we surface either.
  const totalNew = newCount + newEmailCount;

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <style>{`
        @keyframes clickDevFlash {
          0% { background-color: color-mix(in srgb, var(--rose) 45%, transparent); }
          100% { background-color: var(--cream); }
        }
        .click-dev-flash { animation: clickDevFlash 1.6s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .click-dev-flash { animation: none; }
        }
      `}</style>

      {/* Floating launcher — present on every page while in DEVELOPMENT mode. */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          // Mark whichever tab the dev is about to look at as "seen". The
          // other tab's badge sticks around until they switch over.
          if (tab === "writes") setNewIds(new Set());
          else setNewEmailIds(new Set());
        }}
        className="fixed bottom-5 right-5 z-[55] flex items-center gap-2 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-4 py-2 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--champagne)] shadow-2xl transition hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)]"
        aria-label="Open Supabase write tracker"
      >
        <span
          className="inline-block h-2 w-2 rounded-full bg-[color:var(--rose)]"
          style={{ animation: "clickDevFlash 1.6s ease-out infinite" }}
          aria-hidden
        />
        Supabase
        {totalNew > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-[color:var(--champagne)] bg-[color:var(--rose)] px-1.5 text-[0.6rem] font-bold text-[color:var(--surface-deep)]">
            {totalNew > 99 ? "99+" : totalNew}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex">
          <button
            type="button"
            aria-label="Close tracker"
            onClick={() => setOpen(false)}
            className="flex-1 bg-[color:var(--ink)]/40 backdrop-blur-sm"
          />
          <aside
            role="dialog"
            aria-label="Supabase write tracker"
            className="flex h-full w-full max-w-lg flex-col border-l-2 border-[color:var(--ink)] bg-[color:var(--champagne)] shadow-2xl"
          >
            <header className="flex items-center justify-between border-b-2 border-[color:var(--line)] px-5 py-4">
              <div>
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Dev mode · live
                </p>
                <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.025em]">
                  {tab === "writes" ? "Supabase writes" : "Email log"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (tab === "writes") void poll();
                    else void pollEmails();
                  }}
                  disabled={tab === "writes" ? loading : emailLoading}
                  className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--cream)] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--ink)] transition hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:opacity-50"
                >
                  {(tab === "writes" ? loading : emailLoading) ? "Loading…" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-3 py-1 text-xs font-bold text-[color:var(--champagne)]"
                >
                  ✕
                </button>
              </div>
            </header>

            {/* Tab switcher — same visual treatment as the table-filter pill row
                below it so the two feel like one control surface. */}
            <div
              role="tablist"
              aria-label="Drawer view"
              className="flex border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 pt-3"
            >
              <DrawerTabButton
                active={tab === "writes"}
                onClick={() => {
                  setTab("writes");
                  setNewIds(new Set());
                }}
                badge={newCount}
              >
                Writes
              </DrawerTabButton>
              <DrawerTabButton
                active={tab === "emails"}
                onClick={() => {
                  setTab("emails");
                  setNewEmailIds(new Set());
                }}
                badge={newEmailCount}
              >
                Emails
              </DrawerTabButton>
            </div>

            {tab === "writes" ? (
              <WritesView
                entries={entries}
                filtered={filtered}
                tables={tables}
                tableErrors={tableErrors}
                error={error}
                fetchedAt={fetchedAt}
                newIds={newIds}
                expandedIds={expandedIds}
                tableFilter={tableFilter}
                setTableFilter={setTableFilter}
                clearNew={() => setNewIds(new Set())}
                toggleExpand={toggleExpand}
              />
            ) : (
              <EmailsView
                entries={emailEntries}
                error={emailError}
                fetchedAt={emailFetchedAt}
                newIds={newEmailIds}
                clearNew={() => setNewEmailIds(new Set())}
              />
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function DrawerTabButton({
  active,
  onClick,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-[2px] flex items-center gap-2 border-b-4 px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] transition-colors ${
        active
          ? "border-[color:var(--ink)] text-[color:var(--ink)]"
          : "border-transparent text-[color:var(--mauve)] hover:text-[color:var(--ink)]"
      }`}
    >
      {children}
      {badge > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-[color:var(--ink)] bg-[color:var(--rose)] px-1.5 text-[0.55rem] font-bold text-[color:var(--surface-deep)]">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

// ── Writes view ────────────────────────────────────────────────────────────
// Extracted to a child so the tab switch is a clean swap. State stays in the
// parent so polling continues for both views regardless of which is mounted.

function WritesView({
  entries,
  filtered,
  tables,
  tableErrors,
  error,
  fetchedAt,
  newIds,
  expandedIds,
  tableFilter,
  setTableFilter,
  clearNew,
  toggleExpand,
}: {
  entries: LogEntry[];
  filtered: LogEntry[];
  tables: string[];
  tableErrors: { table: string; error: string }[];
  error: string | null;
  fetchedAt: string | null;
  newIds: Set<string>;
  expandedIds: Set<string>;
  tableFilter: string;
  setTableFilter: (value: string) => void;
  clearNew: () => void;
  toggleExpand: (id: string) => void;
}) {
  const newCount = newIds.size;

  return (
    <>
      <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.16em]">
          <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-2.5 py-0.5 text-[color:var(--ink)]">
            {entries.length} rows
          </span>
          <span className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--rose)] px-2.5 py-0.5 text-[color:var(--surface-deep)]">
            {newCount} new
          </span>
          {fetchedAt ? (
            <span className="font-mono text-[color:var(--mauve)]">
              polled {relativeTime(fetchedAt)}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] px-3 py-1 text-xs font-bold text-[color:var(--ink)]"
          >
            <option value="all">All tables</option>
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {newCount > 0 ? (
            <button
              type="button"
              onClick={clearNew}
              className="ml-auto rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)] transition hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]"
            >
              Mark all seen
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error ? (
          <div className="mb-4 rounded-xl border-2 border-[color:var(--ink)] bg-[color:var(--rose)]/20 p-4 text-sm font-medium text-[color:var(--ink)]">
            {error}
          </div>
        ) : null}

        {tableErrors.length > 0 ? (
          <div className="mb-4 rounded-xl border-2 border-dashed border-[color:var(--ink)] bg-[color:var(--cream)] p-3 text-xs font-medium text-[color:var(--mauve)]">
            <p className="font-bold text-[color:var(--ink)]">Some tables failed:</p>
            <ul className="mt-1 grid gap-0.5">
              {tableErrors.map((te) => (
                <li key={te.table} className="font-mono">
                  {te.table}: {te.error}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {filtered.length === 0 && !error ? (
          <p className="text-sm font-medium text-[color:var(--mauve)]">
            {entries.length === 0
              ? "No rows yet. Do something in the app — new writes appear here automatically."
              : "No rows match the current filter."}
          </p>
        ) : null}

        <ul className="grid gap-2">
          {filtered.map((entry) => {
            const isNew = newIds.has(entry.id);
            const isExpanded = expandedIds.has(entry.id);
            return (
              <li
                key={entry.id}
                className={`rounded-xl border-2 p-3 ${
                  isNew
                    ? "click-dev-flash border-[color:var(--rose)] bg-[color:var(--cream)]"
                    : "border-[color:var(--line)] bg-[color:var(--cream)]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border-2 border-[color:var(--ink)] px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] ${tableBadgeClass(entry.table)}`}
                  >
                    {entry.table}
                  </span>
                  {isNew ? (
                    <span className="rounded-full bg-[color:var(--rose)] px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em] text-[color:var(--surface-deep)]">
                      New
                    </span>
                  ) : null}
                  <span className="text-sm font-bold text-[color:var(--ink)]">
                    {entry.label}
                  </span>
                </div>

                <p className="mt-1 break-words text-xs font-medium leading-5 text-[color:var(--mauve)]">
                  {entry.detail}
                </p>

                <button
                  type="button"
                  onClick={() => toggleExpand(entry.id)}
                  className="mt-2 font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)] underline-offset-2 hover:text-[color:var(--ink)] hover:underline"
                >
                  {isExpanded ? "▾ hide data" : "▸ show data"}
                </button>

                {isExpanded ? (
                  <dl className="mt-2 grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1 rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-2.5 font-mono text-[0.62rem]">
                    {Object.entries(entry.data).map(([key, value]) => (
                      <div key={key} className="contents">
                        <dt className="truncate font-bold text-[color:var(--mauve)]">
                          {key}
                        </dt>
                        <dd className="break-all text-[color:var(--ink)]">
                          {formatValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                  {formatTime(entry.createdAt)} · {relativeTime(entry.createdAt)}
                  {entry.entityId ? ` · #${entry.entityId.slice(0, 8)}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

// ── Emails view ────────────────────────────────────────────────────────────
// Lists rows from `email_events`. Click a card to open a full-size modal with
// the rendered HTML in a sandboxed iframe (same `srcDoc` approach as /email's
// preview). `allow-same-origin` lets Google Fonts load; no `allow-scripts` so
// no email JS can run — same rule real clients enforce.

function EmailsView({
  entries,
  error,
  fetchedAt,
  newIds,
  clearNew,
}: {
  entries: EmailEntry[];
  error: string | null;
  fetchedAt: string | null;
  newIds: Set<string>;
  clearNew: () => void;
}) {
  const [sending, setSending] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string>("user-signup");
  const [scenarios, setScenarios] = useState<{ id: string; label: string; to: string }[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  // The email currently shown in the preview modal (null = closed).
  const [preview, setPreview] = useState<EmailEntry | null>(null);

  // Esc closes the modal only — registered in the capture phase with
  // stopImmediatePropagation so the drawer's own Esc-to-close (a bubble-phase
  // window listener) doesn't also fire and yank the whole drawer shut.
  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setPreview(null);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [preview]);

  // Load the scenario list lazily — it's just a static array on the server
  // but importing it directly would pull all the email-template builders
  // (and their fixtures) into this client bundle.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/test/email/scenarios", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          scenarios: { id: string; label: string; to: string }[];
        };
        if (!active) return;
        setScenarios(json.scenarios ?? []);
      } catch {
        // Non-critical — the "Send fake email" form just won't have options
        // until the page is reloaded.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function sendFake() {
    setSending(scenario);
    setSendError(null);
    try {
      const res = await fetch("/api/test/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setSendError(json.error ?? `Request failed (${res.status})`);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(null);
    }
  }

  const newCount = newIds.size;
  // Same defence as the writes tab — guarantee latest-first regardless of
  // what /api/test/email-log returned.
  const sortedEntries = useMemo(
    () =>
      entries
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [entries],
  );

  return (
    <>
      <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.16em]">
          <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-2.5 py-0.5 text-[color:var(--ink)]">
            {entries.length} emails
          </span>
          <span className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--rose)] px-2.5 py-0.5 text-[color:var(--surface-deep)]">
            {newCount} new
          </span>
          {fetchedAt ? (
            <span className="font-mono text-[color:var(--mauve)]">
              polled {relativeTime(fetchedAt)}
            </span>
          ) : null}
        </div>

        {/* Send-fake form. Picks a scenario, hits POST /api/test/email/send.
            The new row arrives via the next poll, so no manual list mutation. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            disabled={scenarios.length === 0}
            className="min-w-0 max-w-[16rem] flex-1 truncate rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] px-3 py-1 text-xs font-bold text-[color:var(--ink)] disabled:opacity-50"
          >
            {scenarios.length === 0 ? (
              <option>Loading scenarios…</option>
            ) : (
              scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} → {s.to}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={() => void sendFake()}
            disabled={sending !== null || scenarios.length === 0}
            className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--champagne)] transition hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)] disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send fake email"}
          </button>
          {newCount > 0 ? (
            <button
              type="button"
              onClick={clearNew}
              className="ml-auto rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)] transition hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]"
            >
              Mark all seen
            </button>
          ) : null}
        </div>

        {sendError ? (
          <p className="mt-2 font-mono text-[0.62rem] text-[color:var(--rose)]">
            {sendError}
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error ? (
          <div className="mb-4 rounded-xl border-2 border-[color:var(--ink)] bg-[color:var(--rose)]/20 p-4 text-sm font-medium text-[color:var(--ink)]">
            {error}
            {/* Most common cause — surface the migration path inline. */}
            {error.toLowerCase().includes("email_events") ? (
              <span className="mt-2 block font-mono text-[0.65rem] text-[color:var(--mauve)]">
                Run <code>database/012_email_events.sql</code> against your Supabase project.
              </span>
            ) : null}
          </div>
        ) : null}

        {entries.length === 0 && !error ? (
          <p className="text-sm font-medium text-[color:var(--mauve)]">
            No emails yet. Hit{" "}
            <span className="font-mono">Send fake email</span> above, or trigger
            a wired flow (sign up, RSVP, create an event) and the rendered
            output lands here.
          </p>
        ) : null}

        <ul className="grid gap-2">
          {sortedEntries.map((entry) => {
            const isNew = newIds.has(entry.id);
            return (
              <li key={entry.id}>
                {/* Whole card is the trigger — click opens the preview modal. */}
                <button
                  type="button"
                  onClick={() => setPreview(entry)}
                  className={`w-full rounded-xl border-2 p-3 text-left transition hover:border-[color:var(--ink)] ${
                    isNew
                      ? "click-dev-flash border-[color:var(--rose)] bg-[color:var(--cream)]"
                      : "border-[color:var(--line)] bg-[color:var(--cream)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--peach)] px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[color:var(--surface-deep)]">
                      {entry.template}
                    </span>
                    {isNew ? (
                      <span className="rounded-full bg-[color:var(--rose)] px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em] text-[color:var(--surface-deep)]">
                        New
                      </span>
                    ) : null}
                    <span className="ml-auto font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                      view ↗
                    </span>
                  </div>

                  <p className="mt-2 break-words text-sm font-bold leading-snug text-[color:var(--ink)]">
                    {entry.subject}
                  </p>
                  <p className="mt-1 break-words font-mono text-[0.7rem] text-[color:var(--mauve)]">
                    to {entry.toEmail}
                  </p>

                  <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                    {formatTime(entry.createdAt)} · {relativeTime(entry.createdAt)}
                    {` · #${entry.id.slice(0, 8)}`}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {preview ? (
        <EmailPreviewModal entry={preview} onClose={() => setPreview(null)} />
      ) : null}
    </>
  );
}

// ── Email preview modal ──────────────────────────────────────────────────────
// Full-size render of a single `email_events` row, layered above the drawer
// (z-[70] > the drawer's z-[60]). Backdrop click or the ✕ closes it; Esc is
// handled by EmailsView. Same sandboxed-iframe rules as the inline preview.

function EmailPreviewModal({
  entry,
  onClose,
}: {
  entry: EmailEntry;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--ink)]/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.template} email preview`}
        className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b-2 border-[color:var(--line)] px-5 py-4">
          <div className="min-w-0">
            <span className="inline-block rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--peach)] px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[color:var(--surface-deep)]">
              {entry.template}
            </span>
            <h3 className="mt-2 break-words text-base font-bold leading-snug text-[color:var(--ink)]">
              {entry.subject}
            </h3>
            <p className="mt-1 break-words font-mono text-[0.7rem] text-[color:var(--mauve)]">
              to {entry.toEmail} · {formatTime(entry.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-3 py-1 text-xs font-bold text-[color:var(--champagne)]"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--cream)]">
          <iframe
            title={`${entry.template} preview`}
            srcDoc={entry.html}
            sandbox="allow-same-origin"
            style={{
              width: "100%",
              height: "70vh",
              border: "none",
              background: "var(--cream)",
              display: "block",
            }}
          />
        </div>
      </div>
    </div>
  );
}
