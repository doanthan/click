"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type LogEntry = {
  id: string;
  table: string;
  createdAt: string;
  label: string;
  detail: string;
  entityId: string | null;
};

type LogResponse = {
  ok: boolean;
  entries: LogEntry[];
  tables: string[];
  tableErrors?: { table: string; error: string }[];
  error?: string;
  fetchedAt?: string;
};

const TICKS_KEY = "click-test-supabase-ticks-v1";

function formatTime(iso: string) {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
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
    const then = new Date(iso).getTime();
    const now = Date.now();
    const seconds = Math.max(0, Math.round((now - then) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

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
  return (
    tableColors[table] ?? "bg-[color:var(--cream)] text-[color:var(--ink)]"
  );
}

export default function SupabaseLogDrawer() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [hideTicked, setHideTicked] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(TICKS_KEY);
        if (raw) setTicked(JSON.parse(raw));
      } catch {
        // ignore
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(TICKS_KEY, JSON.stringify(ticked));
  }, [ticked, hydrated]);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test/supabase-log", { cache: "no-store" });
      const json = (await res.json()) as LogResponse;
      setData(json);
      if (!json.ok && json.error) {
        setError(json.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !data && !loading) {
      queueMicrotask(() => void fetchLog());
    }
  }, [open, data, loading, fetchLog]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const allEntries = data?.entries ?? [];
  const tables = data?.tables ?? [];

  const filtered = useMemo(() => {
    return allEntries.filter((entry) => {
      if (tableFilter !== "all" && entry.table !== tableFilter) return false;
      if (hideTicked && ticked[entry.id]) return false;
      return true;
    });
  }, [allEntries, tableFilter, hideTicked, ticked]);

  const tickedCount = useMemo(
    () => allEntries.filter((e) => ticked[e.id]).length,
    [allEntries, ticked],
  );

  function toggleTick(id: string) {
    setTicked((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  function tickAllVisible() {
    setTicked((prev) => {
      const next = { ...prev };
      for (const entry of filtered) next[entry.id] = true;
      return next;
    });
  }

  function clearTicks() {
    if (!window.confirm("Untick every Supabase log row?")) return;
    setTicked({});
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--champagne)] transition hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)]"
      >
        Open Supabase log
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close drawer"
            onClick={() => setOpen(false)}
            className="flex-1 bg-[color:var(--ink)]/40 backdrop-blur-sm transition"
          />
          <aside
            role="dialog"
            aria-label="Supabase log"
            className="flex h-full w-full max-w-xl flex-col border-l-2 border-[color:var(--ink)] bg-[color:var(--champagne)] shadow-2xl"
          >
            <header className="flex items-center justify-between border-b-2 border-[color:var(--line)] px-5 py-4">
              <div>
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Supabase
                </p>
                <h2 className="font-display text-2xl font-light leading-tight">
                  Table log
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchLog()}
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
                  {allEntries.length} rows
                </span>
                <span className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--rose)] px-2.5 py-0.5 text-[color:var(--surface-deep)]">
                  Ticked {tickedCount}
                </span>
                {data?.fetchedAt ? (
                  <span className="font-mono text-[color:var(--mauve)]">
                    fetched {relativeTime(data.fetchedAt)}
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
                <label className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  <input
                    type="checkbox"
                    checked={hideTicked}
                    onChange={(e) => setHideTicked(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[color:var(--rose)]"
                  />
                  Hide ticked
                </label>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={tickAllVisible}
                    disabled={filtered.length === 0}
                    className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--rose)] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--surface-deep)] transition hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:opacity-40"
                  >
                    Tick visible
                  </button>
                  <button
                    type="button"
                    onClick={clearTicks}
                    className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)] transition hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]"
                  >
                    Clear ticks
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {error ? (
                <div className="rounded-xl border-2 border-[color:var(--ink)] bg-[color:var(--rose)]/20 p-4 text-sm font-medium text-[color:var(--ink)]">
                  {error}
                </div>
              ) : null}

              {data?.tableErrors && data.tableErrors.length > 0 ? (
                <div className="mb-4 rounded-xl border-2 border-dashed border-[color:var(--ink)] bg-[color:var(--cream)] p-3 text-xs font-medium text-[color:var(--mauve)]">
                  <p className="font-bold text-[color:var(--ink)]">
                    Some tables failed:
                  </p>
                  <ul className="mt-1 grid gap-0.5">
                    {data.tableErrors.map((te) => (
                      <li key={te.table} className="font-mono">
                        {te.table}: {te.error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {loading && !data ? (
                <p className="text-sm font-medium text-[color:var(--mauve)]">
                  Loading log…
                </p>
              ) : null}

              {!loading && filtered.length === 0 && !error ? (
                <p className="text-sm font-medium text-[color:var(--mauve)]">
                  {allEntries.length === 0
                    ? "No rows yet. Create something in the app and refresh."
                    : "No rows match the current filter."}
                </p>
              ) : null}

              <ul className="grid gap-2">
                {filtered.map((entry) => {
                  const isTicked = !!ticked[entry.id];
                  return (
                    <li
                      key={entry.id}
                      className={`rounded-xl border-2 p-3 transition ${
                        isTicked
                          ? "border-[color:var(--rose)] bg-[color:var(--rose)]/10"
                          : "border-[color:var(--line)] bg-[color:var(--cream)]"
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isTicked}
                          onChange={() => toggleTick(entry.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--rose)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border-2 border-[color:var(--ink)] px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] ${tableBadgeClass(entry.table)}`}
                            >
                              {entry.table}
                            </span>
                            <span
                              className={`text-sm font-bold ${isTicked ? "line-through text-[color:var(--mauve)]" : "text-[color:var(--ink)]"}`}
                            >
                              {entry.label}
                            </span>
                          </div>
                          <p className="mt-1 break-words text-xs font-medium leading-5 text-[color:var(--mauve)]">
                            {entry.detail}
                          </p>
                          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                            {formatTime(entry.createdAt)} ·{" "}
                            {relativeTime(entry.createdAt)}
                            {entry.entityId
                              ? ` · #${entry.entityId.slice(0, 8)}`
                              : ""}
                          </p>
                        </div>
                      </label>
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
