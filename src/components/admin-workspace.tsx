"use client";

import { useState, type ReactNode } from "react";

export type AdminTabKey = "overview" | "members" | "events" | "merchants" | "tags" | "audit";

type AdminTab = {
  key: AdminTabKey;
  label: string;
  count?: number;
};

const tabOrder: AdminTab[] = [
  { key: "overview", label: "Overview" },
  { key: "members", label: "Members" },
  { key: "events", label: "Events" },
  { key: "merchants", label: "Merchants" },
  { key: "tags", label: "Tags" },
  { key: "audit", label: "Audit log" },
];

type AdminWorkspaceProps = {
  counts: Partial<Record<AdminTabKey, number>>;
  panels: Record<AdminTabKey, ReactNode>;
};

export function AdminWorkspace({ counts, panels }: AdminWorkspaceProps) {
  const [active, setActive] = useState<AdminTabKey>("overview");

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-8 border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
          {tabOrder.map((tab) => {
            const isActive = tab.key === active;
            const count = counts[tab.key];

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider hard-shadow-sm transition ${
                  isActive
                    ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                    : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
                }`}
              >
                {tab.label}
                {typeof count === "number" ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.6rem] font-black ${
                      isActive
                        ? "bg-[color:var(--champagne)] text-[color:var(--ink)]"
                        : "bg-[color:var(--cream)] text-[color:var(--ink)]"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-7xl">{panels[active]}</div>
    </div>
  );
}
