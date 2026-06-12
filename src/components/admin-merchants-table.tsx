"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminMerchantRow } from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "suspended";
type VerificationStatus = "pending" | "approved" | "rejected" | "suspended";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function statusTone(status: string) {
  if (status === "approved") return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  if (status === "rejected") return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  if (status === "suspended") return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  // pending
  return "bg-[color:var(--cream)] text-[color:var(--ink)]";
}

function MerchantActions({
  merchant,
  onUpdate,
  onToggleTrust,
  pendingMessage,
}: {
  merchant: AdminMerchantRow;
  onUpdate: (status: VerificationStatus) => void;
  onToggleTrust: (next: boolean) => void;
  pendingMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const status = merchant.verificationStatus;
  // Approve is the catch-all "make this merchant active": works for fresh pending
  // signups *and* for reinstating a previously suspended/rejected merchant.
  const canApprove = status !== "approved";
  const canSuspend = status === "approved";
  // Reject is only for the initial vetting decision on a pending application.
  // Once approved, the deactivation path is Suspend (reversible, hides events
  // but keeps existing RSVPs valid) — not Reject.
  const canReject = status === "pending";
  // Trusting a merchant flips on auto_approve_events so their future events
  // publish straight to `live`, skipping the pending review queue. Only
  // meaningful once the merchant itself is approved.
  const canTrust = status === "approved";

  function run(next: VerificationStatus) {
    onUpdate(next);
    setOpen(false);
  }

  function runTrust(next: boolean) {
    onToggleTrust(next);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex justify-start md:justify-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${merchant.businessName}`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--cream)]"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-20 w-56 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-2 text-left hard-shadow-sm"
        >
          {UUID_RE.test(merchant.id) ? (
            <Link
              href={`/admin/merchants/${merchant.id}`}
              role="menuitem"
              className="block rounded-lg px-3 py-2 text-xs font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--cream)]"
            >
              View profile
            </Link>
          ) : null}
          {canApprove ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => run("approved")}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--peach)]"
            >
              {status === "suspended" ? "Reinstate merchant" : "Approve merchant"}
            </button>
          ) : null}
          {canSuspend ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => run("suspended")}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-[color:var(--rose)] transition-colors hover:bg-[color:var(--rose)]/10"
            >
              Suspend merchant
            </button>
          ) : null}
          {canReject ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => run("rejected")}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--cream)]"
            >
              Reject merchant
            </button>
          ) : null}
          {canTrust ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => runTrust(!merchant.autoApproveEvents)}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--peach)]"
            >
              {merchant.autoApproveEvents ? "Require event review" : "Trust merchant"}
            </button>
          ) : null}
          {canTrust && merchant.autoApproveEvents ? (
            <p className="mt-1 px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]/80">
              Events auto-publish (no review)
            </p>
          ) : null}
          {status === "suspended" ? (
            <p className="mt-1 px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]/80">
              Events hidden from Discover
            </p>
          ) : null}
          {pendingMessage ? (
            <p className="mt-1 px-3 py-1 text-[0.65rem] font-bold text-[color:var(--mauve)]">
              {pendingMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
    { value: "suspended", label: "Suspended", count: rows.filter((m) => m.verificationStatus === "suspended").length },
  ];

  async function updateVerification(merchantId: string, nextStatus: VerificationStatus) {
    // Rejection carries a free-text "why" — it rides through to the merchant's
    // notification + email so they know what to fix and resubmit.
    let reason: string | undefined;
    if (nextStatus === "rejected") {
      const entered = window.prompt(
        "Why is this merchant being rejected? (sent to them by email — leave blank to send the generic note)",
        "",
      );
      if (entered === null) return; // admin cancelled
      reason = entered.trim() || undefined;
    }

    setActionState((current) => ({ ...current, [merchantId]: "Saving..." }));

    const response = await fetch(`/api/admin/merchants/${merchantId}/verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, ...(reason ? { reason } : {}) }),
    });
    const payload = (await response.json()) as {
      error?: string;
      verificationStatus?: string;
    };

    if (!response.ok) {
      setActionState((current) => ({
        ...current,
        [merchantId]: payload.error ?? "Update failed.",
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
    setActionState((current) => ({
      ...current,
      [merchantId]:
        nextStatus === "approved"
          ? "Approved."
          : nextStatus === "suspended"
            ? "Suspended."
            : nextStatus === "rejected"
              ? "Rejected."
              : "Updated.",
    }));
  }

  async function updateAutoApprove(merchantId: string, next: boolean) {
    setActionState((current) => ({ ...current, [merchantId]: "Saving..." }));

    const response = await fetch(`/api/admin/merchants/${merchantId}/auto-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApprove: next }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      autoApproveEvents?: boolean;
    };

    if (!response.ok) {
      setActionState((current) => ({
        ...current,
        [merchantId]: payload.error ?? "Update failed.",
      }));
      return;
    }

    const applied = payload.autoApproveEvents ?? next;
    setRows((current) =>
      current.map((merchant) =>
        merchant.id === merchantId
          ? { ...merchant, autoApproveEvents: applied }
          : merchant,
      ),
    );
    setActionState((current) => ({
      ...current,
      [merchantId]: applied ? "Trusted — events auto-publish." : "Review required.",
    }));
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

      {/* overflow-visible so the row's dropdown menu can render outside the
          card edge instead of being clipped by overflow-hidden. */}
      <div className="mt-6 overflow-visible rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
        <div className="hidden grid-cols-[1.4fr_0.8fr_1fr_0.7fr_0.8fr_0.3fr] gap-4 bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] md:grid">
          <span>Business</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Events</span>
          <span>Joined</span>
          <span className="text-right">Actions</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm font-bold text-[color:var(--mauve)]">
            No merchants match this filter.
          </p>
        ) : (
          filtered.map((merchant) => (
            <div
              key={merchant.id}
              className="grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm font-medium text-[color:var(--mauve)] last:border-0 md:grid-cols-[1.4fr_0.8fr_1fr_0.7fr_0.8fr_0.3fr] md:items-center"
            >
              <div>
                {UUID_RE.test(merchant.id) ? (
                  <Link
                    href={`/admin/merchants/${merchant.id}`}
                    className="font-black text-[color:var(--ink)] hover:underline"
                  >
                    {merchant.businessName}
                  </Link>
                ) : (
                  <p className="font-black text-[color:var(--ink)]">
                    {merchant.businessName}
                  </p>
                )}
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
              <MerchantActions
                merchant={merchant}
                onUpdate={(next) => updateVerification(merchant.id, next)}
                onToggleTrust={(next) => updateAutoApprove(merchant.id, next)}
                pendingMessage={actionState[merchant.id]}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
