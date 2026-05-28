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

export default function DevSupabaseDrawer() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [tableErrors, setTableErrors] = useState<{ table: string; error: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState("all");

  // Every row id we've ever observed. The first poll seeds this as the
  // "baseline" so existing rows don't flash — only rows created afterwards do.
  const knownRef = useRef<Set<string>>(new Set());
  const baselineRef = useRef(false);

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

  // Poll continuously (even while closed) so the badge surfaces new writes.
  useEffect(() => {
    let active = true;
    const tick = () => {
      if (active && !document.hidden) void poll();
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
  }, [poll]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = useMemo(
    () => entries.filter((entry) => tableFilter === "all" || entry.table === tableFilter),
    [entries, tableFilter],
  );

  const newCount = newIds.size;

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
          setNewIds(new Set());
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
        {newCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-[color:var(--champagne)] bg-[color:var(--rose)] px-1.5 text-[0.6rem] font-bold text-[color:var(--surface-deep)]">
            {newCount > 99 ? "99+" : newCount}
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
                <h2 className="font-display text-2xl font-light leading-tight">
                  Supabase writes
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void poll()}
                  disabled={loading}
                  className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--cream)] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--ink)] transition hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Refresh"}
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
                    onClick={() => setNewIds(new Set())}
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
          </aside>
        </div>
      ) : null}
    </>
  );
}
