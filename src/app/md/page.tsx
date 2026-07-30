import CoverageExplorer from "./coverage-explorer";
import { coverageData, repoMeta } from "./coverage-data";
import { notFound } from "next/navigation";
import { isProductionDeployment } from "@/lib/runtime-mode";

export const metadata = {
  title: "Spec coverage — Click",
  description:
    "How the Click codebase covers the click-tech specs, and where the gaps are.",
};

export default function SpecCoveragePage() {
  if (isProductionDeployment()) notFound();
  const agg = (() => {
    const c = { covered: 0, partial: 0, missing: 0, future: 0 };
    for (const d of coverageData)
      for (const r of d.requirements) c[r.status] += 1;
    const total = c.covered + c.partial + c.missing + c.future;
    const scored = total - c.future || 1;
    return Math.round(((c.covered + c.partial * 0.5) / scored) * 100);
  })();

  return (
    <main className="paper-noise min-h-screen">
      {/* Header band */}
      <header className="border-b border-line bg-surface-deep text-on-deep">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <div className="eyebrow" style={{ color: "var(--peach)" }}>
            Spec ↔ code coverage
          </div>
          <h1 className="mt-2 font-display text-4xl leading-[0.95] tracking-tight sm:text-5xl">
            Does the build tick off the spec?
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-on-deep/80">
            Every <span className="font-mono text-peach">click-tech</span> spec doc, audited against
            this codebase. Each tab shows what&apos;s implemented, the exact files behind it, and the
            gaps that remain.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-on-deep/75">
            <span className="rounded-full bg-surface-deep-2 px-3 py-1 font-mono text-xs">
              {repoMeta.specsRepo}
            </span>
            <span>vs</span>
            <span className="rounded-full bg-surface-deep-2 px-3 py-1 text-xs">
              {repoMeta.codebase}
            </span>
            {coverageData.length ? (
              <span className="ml-auto inline-flex items-baseline gap-2">
                <span className="font-display text-3xl tabular-nums text-peach">{agg}%</span>
                <span className="text-xs uppercase tracking-wide">weighted coverage</span>
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <CoverageExplorer />
      </div>
    </main>
  );
}
