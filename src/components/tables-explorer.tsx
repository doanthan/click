"use client";

import { useEffect, useState } from "react";
import type { DatabaseTable } from "@/lib/database-tables";

function formatCount(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-AU").format(value);
}

export function TablesExplorer({
  tables,
  isLive,
}: {
  tables: DatabaseTable[];
  isLive: boolean;
}) {
  const [selectedName, setSelectedName] = useState(tables[0]?.name ?? "");
  const [view, setView] = useState<"schema" | "data">("schema");
  const selected =
    tables.find((table) => table.name === selectedName) ?? tables[0] ?? null;

  if (!selected) {
    return (
      <p className="mt-8 font-mono text-sm font-bold text-[color:var(--mauve)]">
        No tables to show.
      </p>
    );
  }

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* Sidebar - table picker */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 px-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
          {tables.length} tables
        </p>
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
          {tables.map((table) => {
            const isActive = table.name === selected.name;
            return (
              <button
                key={table.name}
                type="button"
                onClick={() => setSelectedName(table.name)}
                aria-current={isActive ? "true" : undefined}
                className={`flex shrink-0 items-center justify-between gap-3 rounded-2xl border-2 px-4 py-2.5 text-left transition-colors lg:shrink ${
                  isActive
                    ? "border-[color:var(--line)] bg-[color:var(--rose)] text-[color:var(--surface-deep)] hard-shadow-sm"
                    : "border-[color:var(--line)]/40 bg-[color:var(--champagne)] text-[color:var(--ink)] hover:border-[color:var(--line)] hover:bg-[color:var(--cream)]"
                }`}
              >
                <span className="truncate font-mono text-sm font-bold">
                  {table.name}
                </span>
                <span
                  className={`shrink-0 font-mono text-[0.65rem] font-bold uppercase tracking-wider ${
                    isActive
                      ? "text-[color:var(--surface-deep)]/70"
                      : "text-[color:var(--mauve)]"
                  }`}
                >
                  {isLive ? formatCount(table.rowCount) : table.columns.length}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main - selected table detail */}
      <article className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[color:var(--line)]/40 pb-5">
          <div className="min-w-0">
            <h3 className="font-mono text-2xl font-bold tracking-tight text-[color:var(--ink)] break-words">
              {selected.name}
            </h3>
            {selected.description ? (
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                {selected.description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)]">
              {selected.columns.length} cols
            </span>
            {isLive ? (
              <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)]">
                {formatCount(selected.rowCount)} rows
              </span>
            ) : null}
          </div>
        </div>

        {isLive ? (
          <>
            {/* Schema / Data toggle */}
            <div className="mt-5 flex w-fit gap-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-1">
              {(["schema", "data"] as const).map((tab) => {
                const isActive = view === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setView(tab)}
                    aria-pressed={isActive}
                    className={`rounded-full px-4 py-1.5 font-mono text-[0.7rem] font-bold uppercase tracking-wider transition-colors ${
                      isActive
                        ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                        : "text-[color:var(--mauve)] hover:text-[color:var(--ink)]"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {view === "schema" ? (
              <SchemaTable columns={selected.columns} />
            ) : (
              <TableData key={selected.name} table={selected.name} />
            )}
          </>
        ) : (
          <p className="mt-5 font-mono text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]">
            {selected.columns.length} columns - set{" "}
            <code className="font-mono">DATABASE_URL</code> to introspect live
            field names, types, keys, and data.
          </p>
        )}
      </article>
    </div>
  );
}

function SchemaTable({ columns }: { columns: DatabaseTable["columns"] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-[color:var(--line)]/40 font-mono text-[0.65rem] uppercase tracking-wider text-[color:var(--mauve)]">
            <th className="py-2 pr-4 font-bold">Field</th>
            <th className="py-2 pr-4 font-bold">Type</th>
            <th className="py-2 font-bold">Constraints</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr
              key={column.name}
              className="border-b border-[color:var(--line)]/20 align-baseline"
            >
              <td className="py-2.5 pr-4 font-mono text-sm font-bold text-[color:var(--ink)]">
                {column.name}
              </td>
              <td className="py-2.5 pr-4 font-mono text-xs font-semibold text-[color:var(--mauve)]">
                {column.dataType}
              </td>
              <td className="py-2.5">
                <span className="flex flex-wrap gap-1.5">
                  {column.isPrimaryKey ? (
                    <span className="rounded border border-[color:var(--line)] bg-[color:var(--rose)] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[color:var(--surface-deep)]">
                      PK
                    </span>
                  ) : null}
                  {!column.nullable && !column.isPrimaryKey ? (
                    <span className="rounded border border-[color:var(--line)]/50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                      not null
                    </span>
                  ) : null}
                  {column.default ? (
                    <span className="rounded border border-[color:var(--line)]/50 px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold text-[color:var(--mauve)]">
                      default {column.default}
                    </span>
                  ) : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RowsResponse = {
  ok: true;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function formatCell(value: unknown): { text: string; muted: boolean } {
  if (value === null || value === undefined) return { text: "null", muted: true };
  if (typeof value === "boolean") return { text: value ? "true" : "false", muted: false };
  if (typeof value === "object") return { text: JSON.stringify(value), muted: false };
  const text = String(value);
  return { text: text === "" ? "(empty)" : text, muted: text === "" };
}

function TableData({ table }: { table: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<RowsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/tables/${encodeURIComponent(table)}/rows?page=${page}&pageSize=${pageSize}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.ok) {
          throw new Error(json.error || `Request failed (${response.status}).`);
        }
        return json as RowsResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load rows.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [table, page, pageSize]);

  if (error) {
    return (
      <p className="mt-5 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-4 font-mono text-xs font-bold text-[color:var(--surface-deep)]">
        {error}
      </p>
    );
  }

  if (loading && !data) {
    return (
      <p className="mt-5 font-mono text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]">
        Loading rows…
      </p>
    );
  }

  if (!data) return null;

  const startRow = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const endRow = Math.min(data.page * data.pageSize, data.total);

  return (
    <div className="mt-4">
      {data.rows.length === 0 ? (
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]">
          This table is empty.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-[color:var(--line)]/40">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-[color:var(--line)]/40 bg-[color:var(--cream)] font-mono text-[0.62rem] uppercase tracking-wider text-[color:var(--mauve)]">
                {data.columns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-3 py-2 font-bold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-[color:var(--line)]/20 odd:bg-[color:var(--champagne)] even:bg-[color:var(--cream)]/40"
                >
                  {data.columns.map((column) => {
                    const { text, muted } = formatCell(row[column]);
                    return (
                      <td
                        key={column}
                        title={text}
                        className={`max-w-[22rem] truncate px-3 py-2 font-mono text-xs ${
                          muted
                            ? "italic text-[color:var(--mauve)]/60"
                            : "font-semibold text-[color:var(--ink)]"
                        }`}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
          {data.total === 0
            ? "0 rows"
            : `${formatCount(startRow)}–${formatCount(endRow)} of ${formatCount(data.total)}`}
        </p>
        <div className="flex items-center gap-2">
          <label className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
                setLoading(true);
              }}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 font-mono text-[0.7rem] font-bold text-[color:var(--ink)]"
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={data.page <= 1 || loading}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
              setLoading(true);
            }}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)] transition-colors hover:bg-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <span className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)]">
            {data.page} / {data.pageCount}
          </span>
          <button
            type="button"
            disabled={data.page >= data.pageCount || loading}
            onClick={() => {
              setPage((current) => Math.min(data.pageCount, current + 1));
              setLoading(true);
            }}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)] transition-colors hover:bg-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
