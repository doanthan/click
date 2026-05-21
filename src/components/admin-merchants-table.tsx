"use client";

import { useMemo, useState } from "react";
import type { AdminMerchantRow } from "@/lib/event-repository";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function statusTone(status: string) {
  if (status === "approved") return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  if (status === "rejected") return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
}

export function AdminMerchantsTable({ merchants }: { merchants: AdminMerchantRow[] }) {
  const [rows, setRows] = useState(merchants);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [actionState, setActionState] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((merchant) => {
      if (status !== "all" && merchant.verificationStatus !== status) return false;
      if (!search) return true;
      return (
        merchant.businessName.toLowerCase().includes(search) ||
        merchant.contactEmail.toLowerCase().includes(search) ||
        merchant.ownerName.toLowerCase().includes(search)
      );
    });
  }, [rows, status, query]);

  const statuses: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: rows.length },
    { value: "pending", label: "Pending", count: rows.filter((m) => m.verificationStatus === "pending").length },
    { value: "approved", label: "Approved", count: rows.filter((m) => m.verificationStatus === "approved").length },
    { value: "rejected", label: "Rejected", count: rows.filter((m) => m.verificationStatus === "rejected").length },
  ];

  async function updateVerification(
    merchantId: string,
    nextStatus: "pending" | "approved" | "rejected",
  ) {
    setActionState((current) => ({ ...current, [merchantId]: "Saving..." }));

    const response = await fetch(`/api/admin/merchants/${merchantId}/verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = (await response.json()) as {
      error?: string;
      verificationStatus?: string;
    };

    if (!response.ok) {
      setActionState((current) => ({
        ...current,
        [merchantId]: payload.error ?? "Approval failed.",
      }));
      return;
    }

    setRows((current) =>
      current.map((merchant) =>
        merchant.id === merchantId
          ? {
              ...merchant,
              verificationStatus: payload.verificationStatus ?? nextStatus,
            }
          : merchant,
      ),
    );
    setActionState((current) => ({ ...current, [merchantId]: "Updated." }));
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {statuses.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              className={`rounded-full border-2 border-[color:var(--line)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider hard-shadow-sm transition ${
                status === option.value
                  ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                  : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
              }`}
            >
              {option.label} <span className="opacity-60">({option.count})</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search business, contact, owner…"
          className="w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/70 sm:w-72"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
        <div className="hidden grid-cols-[1.4fr_0.8fr_1fr_0.7fr_0.8fr] gap-4 bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] md:grid">
          <span>Business</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Events</span>
          <span>Joined</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm font-bold text-[color:var(--mauve)]">
            No merchants match this filter.
          </p>
        ) : (
          filtered.map((merchant) => (
            <div
              key={merchant.id}
              className="grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm font-medium text-[color:var(--mauve)] last:border-0 md:grid-cols-[1.4fr_0.8fr_1fr_0.7fr_0.8fr] md:items-center"
            >
              <div>
                <p className="font-black text-[color:var(--ink)]">{merchant.businessName}</p>
                <p className="text-xs font-medium">{merchant.contactEmail}</p>
                {merchant.websiteUrl ? (
                  <a
                    href={merchant.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)] underline"
                  >
                    {merchant.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
              </div>
              <div>
                <span
                  className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${statusTone(merchant.verificationStatus)}`}
                >
                  {merchant.verificationStatus}
                </span>
                {merchant.abn ? (
                  <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]/80">
                    ABN {merchant.abn}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {merchant.verificationStatus !== "approved" ? (
                    <button
                      type="button"
                      onClick={() => updateVerification(merchant.id, "approved")}
                      className="rounded-full border border-[color:var(--line)] bg-[color:var(--peach)] px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
                    >
                      Approve
                    </button>
                  ) : null}
                  {merchant.verificationStatus !== "rejected" ? (
                    <button
                      type="button"
                      onClick={() => updateVerification(merchant.id, "rejected")}
                      className="rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
                    >
                      Reject
                    </button>
                  ) : null}
                </div>
                {actionState[merchant.id] ? (
                  <p className="mt-1 text-[0.65rem] font-bold text-[color:var(--mauve)]">
                    {actionState[merchant.id]}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="font-black text-[color:var(--ink)]">{merchant.ownerName}</p>
                <p className="text-[0.7rem]">{merchant.ownerEmail}</p>
              </div>
              <span className="font-bold text-[color:var(--ink)]">{merchant.eventsHosted}</span>
              <span>{dateFormatter.format(new Date(merchant.createdAt))}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
