"use client";

import { useMemo, useState } from "react";
import type { AdminLocationWaitlistRow } from "@/lib/event-repository";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function regionTone(region: string | null) {
  if (region === "Melbourne") return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  return "bg-[color:var(--cream)] text-[color:var(--ink)]";
}

export function AdminLocationWaitlistTable({
  entries,
}: {
  entries: AdminLocationWaitlistRow[];
}) {
  const [region, setRegion] = useState<string>("all");

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.region) set.add(e.region);
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(
    () => (region === "all" ? entries : entries.filter((e) => e.region === region)),
    [entries, region],
  );

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            Location Waitlist
          </p>
          <h1 className="font-display mt-1 text-3xl font-light leading-tight text-[color:var(--ink)]">
            Merchants outside the Sydney pilot
          </h1>
          <p className="mt-1 text-sm font-bold text-[color:var(--mauve)]">
            {entries.length} expression{entries.length === 1 ? "" : "s"} of interest — demand to
            help decide the next launch city.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-[color:var(--mauve)]">
          Region
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-xs font-bold text-[color:var(--ink)] hard-shadow-sm focus:outline-none"
          >
            <option value="all">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            No waitlist entries yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)]">
                <tr className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  <th className="px-4 py-3">Merchant</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[color:var(--line-soft)]">
                {filtered.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-bold text-[color:var(--ink)]">
                        {e.businessName ?? "—"}
                      </p>
                      {e.contactEmail ? (
                        <a
                          href={`mailto:${e.contactEmail}`}
                          className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)] hover:text-[color:var(--rose)]"
                        >
                          {e.contactEmail}
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink)]">
                      <p className="font-bold">{e.suburb ?? "—"}</p>
                      {e.address ? (
                        <p className="text-xs font-medium text-[color:var(--mauve)]">{e.address}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wide ${regionTone(
                          e.region,
                        )}`}
                      >
                        {e.region ?? "Other"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-[color:var(--mauve)]">
                      {e.note ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                      {dateFormatter.format(new Date(e.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
