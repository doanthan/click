"use client";

import { useMemo, useState } from "react";
import type { AdminLocationWaitlistRow } from "@/lib/event-repository";
import { Badge, type BadgeTone } from "@/components/ds";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function regionTone(region: string | null): BadgeTone {
  return region === "Melbourne" ? "lavender" : "neutral";
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
          <p className="eyebrow">Location waitlist</p>
          <h1 className="font-display mt-1 text-3xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]">
            Merchants outside the Sydney pilot
          </h1>
          <p className="mt-1 text-sm text-[color:var(--slate)]">
            {entries.length} expression{entries.length === 1 ? "" : "s"} of interest - demand to
            help decide the next launch city.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[color:var(--slate)]">
          Region
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-xl border border-[color:var(--mist)] bg-white px-3 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
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

      <div className="overflow-hidden rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm leading-6 text-[color:var(--slate)]">
            No waitlist entries yet.
          </p>
        ) : (
          <>
          {/* Mobile (< md): stacked cards instead of a 720px-wide table that
              would force horizontal scrolling on phones. */}
          <ul className="divide-y divide-[color:var(--line)] md:hidden">
            {filtered.map((e) => (
              <li key={e.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[color:var(--ink)]">
                      {e.businessName ?? "—"}
                    </p>
                    {e.contactEmail ? (
                      <a
                        href={`mailto:${e.contactEmail}`}
                        className="truncate text-xs text-[color:var(--slate)] hover:text-[color:var(--purple)]"
                      >
                        {e.contactEmail}
                      </a>
                    ) : null}
                  </div>
                  <Badge tone={regionTone(e.region)}>{e.region ?? "Other"}</Badge>
                </div>
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  {e.suburb ?? "—"}
                  {e.address ? (
                    <span className="ml-1 text-xs font-normal text-[color:var(--slate)]">
                      · {e.address}
                    </span>
                  ) : null}
                </p>
                {e.note ? (
                  <p className="text-xs text-[color:var(--slate)]">{e.note}</p>
                ) : null}
                <p className="text-xs text-[color:var(--slate)]">
                  Added {dateFormatter.format(new Date(e.createdAt))}
                </p>
              </li>
            ))}
          </ul>

          {/* Desktop (md+): full table. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[color:var(--line)]">
                <tr className="text-xs font-semibold text-[color:var(--slate)]">
                  <th className="px-4 py-3">Merchant</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {filtered.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[color:var(--ink)]">
                        {e.businessName ?? "—"}
                      </p>
                      {e.contactEmail ? (
                        <a
                          href={`mailto:${e.contactEmail}`}
                          className="text-xs text-[color:var(--slate)] hover:text-[color:var(--purple)]"
                        >
                          {e.contactEmail}
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink)]">
                      <p className="font-semibold">{e.suburb ?? "—"}</p>
                      {e.address ? (
                        <p className="text-xs text-[color:var(--slate)]">{e.address}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={regionTone(e.region)}>{e.region ?? "Other"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-[color:var(--slate)]">
                      {e.note ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[color:var(--slate)]">
                      {dateFormatter.format(new Date(e.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </section>
  );
}
