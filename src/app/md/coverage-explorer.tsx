"use client";

import { useMemo, useState } from "react";
import {
  coverageData,
  repoMeta,
  type DocCoverage,
  type ReqStatus,
} from "./coverage-data";

// ── Status vocab ──────────────────────────────────────────────────────────
const REQ_META: Record<
  ReqStatus,
  { label: string; dot: string; chipBg: string; chipText: string; bar: string }
> = {
  covered: {
    label: "Covered",
    dot: "#15803d",
    chipBg: "#dcfce7",
    chipText: "#14532d",
    bar: "#16a34a",
  },
  partial: {
    label: "Partial",
    dot: "#b45309",
    chipBg: "#fef3c7",
    chipText: "#7c4a03",
    bar: "#f59e0b",
  },
  missing: {
    label: "Missing",
    dot: "#b91c1c",
    chipBg: "#fde2dd",
    chipText: "#8a1c0f",
    bar: "#ef4444",
  },
  future: {
    label: "Future / deferred",
    dot: "#5C616B",
    chipBg: "#e7e4dc",
    chipText: "#3f444d",
    bar: "#9aa0a8",
  },
};

const REQ_ORDER: ReqStatus[] = ["covered", "partial", "missing", "future"];

function countByStatus(doc: DocCoverage) {
  const c: Record<ReqStatus, number> = {
    covered: 0,
    partial: 0,
    missing: 0,
    future: 0,
  };
  for (const r of doc.requirements) c[r.status] += 1;
  return c;
}

function coverageTone(pct: number) {
  if (pct >= 80) return "#16a34a";
  if (pct >= 50) return "#f59e0b";
  if (pct >= 25) return "#ea7317";
  return "#ef4444";
}

// ── Small UI atoms ──────────────────────────────────────────────────────────
function StatusChip({ status }: { status: ReqStatus }) {
  const m = REQ_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: m.chipBg, color: m.chipText }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: m.dot }}
      />
      {m.label}
    </span>
  );
}

function SegmentBar({ doc }: { doc: DocCoverage }) {
  const counts = countByStatus(doc);
  const total = doc.requirements.length || 1;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--line-soft)]">
      {REQ_ORDER.map((s) =>
        counts[s] ? (
          <div
            key={s}
            style={{
              width: `${(counts[s] / total) * 100}%`,
              background: REQ_META[s].bar,
            }}
            title={`${counts[s]} ${REQ_META[s].label}`}
          />
        ) : null,
      )}
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────
function Overview({
  docs,
  onPick,
}: {
  docs: DocCoverage[];
  onPick: (id: string) => void;
}) {
  const agg = useMemo(() => {
    const c = { covered: 0, partial: 0, missing: 0, future: 0 };
    for (const d of docs)
      for (const r of d.requirements)
        c[r.status] += 1;
    const total = c.covered + c.partial + c.missing + c.future;
    const scored = total - c.future || 1;
    const pct = Math.round(((c.covered + c.partial * 0.5) / scored) * 100);
    return { ...c, total, pct };
  }, [docs]);

  const topGaps = useMemo(
    () =>
      docs
        .filter((d) => d.status !== "covered")
        .sort((a, b) => a.coveragePercent - b.coveragePercent)
        .slice(0, 8),
    [docs],
  );

  return (
    <div className="space-y-8">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-cream p-4 hard-shadow-sm">
          <div className="eyebrow">Specs audited</div>
          <div className="font-display text-4xl tracking-tight">{docs.length}</div>
        </div>
        <div className="rounded-2xl border border-line bg-cream p-4 hard-shadow-sm">
          <div className="eyebrow">Requirements</div>
          <div className="font-display text-4xl tracking-tight">{agg.total}</div>
        </div>
        <div className="rounded-2xl border border-line bg-cream p-4 hard-shadow-sm">
          <div className="eyebrow">Weighted coverage</div>
          <div
            className="font-display text-4xl tracking-tight"
            style={{ color: coverageTone(agg.pct) }}
          >
            {agg.pct}%
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-cream p-4 hard-shadow-sm">
          <div className="eyebrow">Covered · Partial · Missing</div>
          <div className="font-display text-2xl tracking-tight">
            <span style={{ color: REQ_META.covered.bar }}>{agg.covered}</span>
            <span className="text-mauve"> · </span>
            <span style={{ color: REQ_META.partial.bar }}>{agg.partial}</span>
            <span className="text-mauve"> · </span>
            <span style={{ color: REQ_META.missing.bar }}>{agg.missing}</span>
          </div>
          {agg.future ? (
            <div className="mt-1 text-xs text-mauve">+{agg.future} deferred / future-phase</div>
          ) : null}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-mauve">
        <span className="font-semibold uppercase tracking-wide">Legend:</span>
        {REQ_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: REQ_META[s].bar }} />
            {REQ_META[s].label}
          </span>
        ))}
      </div>

      {/* Coverage matrix */}
      <div>
        <h2 className="font-display text-2xl tracking-tight">Coverage by spec</h2>
        <p className="mt-1 text-sm text-mauve">
          Tap a row to open the full breakdown. Bars show the mix of requirement statuses.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-cream hard-shadow-sm">
          {docs.map((d, i) => {
            const counts = countByStatus(d);
            return (
              <button
                key={d.docId}
                onClick={() => onPick(d.docId)}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-champagne-deep"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--line-soft)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{d.title}</span>
                    <span className="shrink-0 rounded-md bg-champagne-deep px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-mauve">
                      {d.category}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-40 max-w-[40vw]">
                      <SegmentBar doc={d} />
                    </div>
                    <span className="text-[11px] text-mauve">
                      {counts.covered}/{d.requirements.length} covered
                    </span>
                  </div>
                </div>
                <div
                  className="shrink-0 font-display text-2xl tabular-nums"
                  style={{ color: coverageTone(d.coveragePercent) }}
                >
                  {d.coveragePercent}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Biggest gaps */}
      {topGaps.length ? (
        <div>
          <h2 className="font-display text-2xl tracking-tight">Where the gaps are</h2>
          <p className="mt-1 text-sm text-mauve">Lowest-coverage specs first.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {topGaps.map((d) => (
              <div
                key={d.docId}
                className="rounded-2xl border border-line bg-cream p-4 hard-shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => onPick(d.docId)}
                    className="text-left font-semibold underline-offset-2 hover:underline"
                  >
                    {d.title}
                  </button>
                  <span
                    className="font-display text-xl tabular-nums"
                    style={{ color: coverageTone(d.coveragePercent) }}
                  >
                    {d.coveragePercent}%
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5 text-sm text-ink/80">
                  {d.topGaps.slice(0, 3).map((g, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Single-doc panel ─────────────────────────────────────────────────────────
function DocPanel({ doc }: { doc: DocCoverage }) {
  const counts = countByStatus(doc);
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{doc.category}</span>
          <span className="font-mono text-[11px] text-mauve">{doc.docId}.md</span>
        </div>
        <h2 className="mt-1 font-display text-3xl tracking-tight">{doc.title}</h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink/80">{doc.summary}</p>
      </div>

      {/* Coverage header */}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-cream px-5 py-4 hard-shadow-sm">
          <div
            className="font-display text-5xl tabular-nums leading-none"
            style={{ color: coverageTone(doc.coveragePercent) }}
          >
            {doc.coveragePercent}%
          </div>
          <div className="text-xs leading-tight text-mauve">
            weighted
            <br />
            coverage
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3 rounded-2xl border border-line bg-cream px-5 py-4 hard-shadow-sm">
          <SegmentBar doc={doc} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mauve">
            {REQ_ORDER.map((s) =>
              counts[s] ? (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: REQ_META[s].bar }} />
                  {counts[s]} {REQ_META[s].label.toLowerCase()}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>

      {/* Architecture note */}
      {doc.architectureNotes ? (
        <div className="rounded-2xl border-l-4 border-l-rose border border-line bg-[#fff7f4] px-4 py-3">
          <div className="eyebrow" style={{ color: "var(--rose)" }}>
            Architecture / divergence
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink/85">{doc.architectureNotes}</p>
        </div>
      ) : null}

      {/* Requirements */}
      <div>
        <h3 className="font-display text-xl tracking-tight">Requirements</h3>
        <div className="mt-3 space-y-3">
          {doc.requirements.map((r, i) => (
            <div
              key={i}
              className="rounded-2xl border border-line bg-cream p-4 hard-shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-semibold">{r.name}</div>
                <StatusChip status={r.status} />
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/80">{r.spec}</p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-champagne px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-mauve">
                    In the code
                  </div>
                  <p className="mt-0.5 break-words font-mono text-[12.5px] leading-relaxed text-ink/85">
                    {r.evidence}
                  </p>
                </div>
                {r.gap ? (
                  <div className="rounded-xl bg-[#fff7f4] px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-rose">
                      Gap
                    </div>
                    <p className="mt-0.5 leading-relaxed text-ink/85">{r.gap}</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#f1f8f1] px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#15803d" }}>
                      No gap
                    </div>
                    <p className="mt-0.5 leading-relaxed text-ink/70">Implemented as specified.</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top gaps */}
      {doc.topGaps.length ? (
        <div className="rounded-2xl border border-line bg-surface-deep px-5 py-4 text-on-deep">
          <div className="eyebrow" style={{ color: "var(--peach)" }}>
            Top gaps for this spec
          </div>
          <ol className="mt-2 space-y-2 text-sm">
            {doc.topGaps.map((g, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display text-lg leading-none text-peach">{i + 1}</span>
                <span className="text-on-deep/90">{g}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

// ── Root explorer ─────────────────────────────────────────────────────────────
export default function CoverageExplorer() {
  const [active, setActive] = useState<string>("__overview");

  const grouped = useMemo(() => {
    const map = new Map<string, DocCoverage[]>();
    for (const d of coverageData) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return [...map.entries()];
  }, []);

  const activeDoc = coverageData.find((d) => d.docId === active) ?? null;

  if (!coverageData.length) {
    return (
      <div className="rounded-2xl border border-line bg-cream p-8 text-center text-mauve hard-shadow-sm">
        Audit data is being generated. Re-open this page once the coverage audit completes.
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
      {/* ── Mobile selector ── */}
      <div className="mb-5 lg:hidden">
        <label className="eyebrow">Jump to spec</label>
        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-cream px-3 py-3 text-[15px] font-medium"
        >
          <option value="__overview">Overview</option>
          {grouped.map(([cat, docs]) => (
            <optgroup key={cat} label={cat}>
              {docs.map((d) => (
                <option key={d.docId} value={d.docId}>
                  {d.title} — {d.coveragePercent}%
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* ── Desktop sidebar ── */}
      <nav className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
          <button
            onClick={() => setActive("__overview")}
            className={`mb-2 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
              active === "__overview"
                ? "bg-surface-deep text-on-deep"
                : "hover:bg-champagne-deep"
            }`}
          >
            Overview
          </button>
          {grouped.map(([cat, docs]) => (
            <div key={cat} className="mt-4">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-mauve">
                {cat}
              </div>
              {docs.map((d) => {
                const on = active === d.docId;
                return (
                  <button
                    key={d.docId}
                    onClick={() => setActive(d.docId)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13.5px] transition-colors ${
                      on ? "bg-peach-soft font-semibold" : "hover:bg-champagne-deep"
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: coverageTone(d.coveragePercent) }}
                    />
                    <span className="min-w-0 flex-1 truncate">{d.title}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-mauve">
                      {d.coveragePercent}%
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* ── Panel ── */}
      <div className="min-w-0">
        {active === "__overview" || !activeDoc ? (
          <Overview docs={coverageData} onPick={setActive} />
        ) : (
          <DocPanel doc={activeDoc} />
        )}

        <p className="mt-10 border-t border-line-soft pt-4 text-xs text-mauve">
          Specs: <span className="font-mono">{repoMeta.specsRepo}</span> · Audited{" "}
          {repoMeta.auditedOn}. {repoMeta.note}
        </p>
      </div>
    </div>
  );
}
