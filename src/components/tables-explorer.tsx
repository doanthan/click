"use client";

import { useState } from "react";
import type { DatabaseTable } from "@/lib/database-tables";

function formatCount(value: number | null) {
  if (value === null) return "—";
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
      {/* Sidebar — table picker */}
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

      {/* Main — selected table detail */}
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
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[color:var(--line)]/40 font-mono text-[0.65rem] uppercase tracking-wider text-[color:var(--mauve)]">
                  <th className="py-2 pr-4 font-bold">Field</th>
                  <th className="py-2 pr-4 font-bold">Type</th>
                  <th className="py-2 font-bold">Constraints</th>
                </tr>
              </thead>
              <tbody>
                {selected.columns.map((column) => (
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
        ) : (
          <p className="mt-5 font-mono text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]">
            {selected.columns.length} columns — set{" "}
            <code className="font-mono">DATABASE_URL</code> to introspect live
            field names, types, and keys.
          </p>
        )}
      </article>
    </div>
  );
}
