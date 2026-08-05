"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { AdminMerchantRow } from "@/lib/event-repository";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge, type BadgeTone } from "@/components/ds";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "suspended";
type VerificationStatus = "pending" | "approved" | "rejected" | "suspended";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function statusTone(status: string): BadgeTone {
  if (status === "approved") return "sage";
  if (status === "rejected") return "coral";
  if (status === "suspended") return "neutral";
  // pending
  return "amber";
}

function MerchantActions({
  merchant,
  onUpdate,
  onToggleTrust,
}: {
  merchant: AdminMerchantRow;
  onUpdate: (status: VerificationStatus) => void;
  onToggleTrust: (next: boolean) => void;
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
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
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
          className="absolute right-0 top-10 z-20 w-56 rounded-xl bg-[color:var(--paper)] p-2 text-left shadow-[var(--shadow-md)]"
        >
          {UUID_RE.test(merchant.id) ? (
            <Link
              href={`/admin/merchants/${merchant.id}`}
              role="menuitem"
              className="block rounded-lg px-3 py-2 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
            >
              View profile
            </Link>
          ) : null}
          {canApprove ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => run("approved")}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
            >
              {status === "suspended" ? "Reinstate merchant" : "Approve merchant"}
            </button>
          ) : null}
          {canSuspend ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => run("suspended")}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--danger)] transition-colors hover:bg-[color:var(--danger)]/10"
            >
              Suspend merchant
            </button>
          ) : null}
          {canReject ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => run("rejected")}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
            >
              Reject merchant
            </button>
          ) : null}
          {canTrust ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => runTrust(!merchant.autoApproveEvents)}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
            >
              {merchant.autoApproveEvents ? "Require event review" : "Trust merchant"}
            </button>
          ) : null}
          {canTrust && merchant.autoApproveEvents ? (
            <p className="mt-1 px-3 py-1 text-[11px] font-semibold text-[color:var(--slate)]">
              Events auto-publish (no review)
            </p>
          ) : null}
          {status === "suspended" ? (
            <p className="mt-1 px-3 py-1 text-[11px] font-semibold text-[color:var(--slate)]">
              Events hidden from Discover
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
  // Merchant id currently mid-request (drives the reject dialog's busy state).
  const [busyId, setBusyId] = useState<string | null>(null);
  // Merchant queued for the branded reject confirmation (null = dialog closed).
  const [pendingReject, setPendingReject] = useState<AdminMerchantRow | null>(null);

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

  // Entry point from the row menu. Rejection carries a free-text "why", so it
  // routes through the branded confirm/prompt dialog; the rest run immediately.
  function updateVerification(merchantId: string, nextStatus: VerificationStatus) {
    if (nextStatus === "rejected") {
      const merchant = rows.find((m) => m.id === merchantId) ?? null;
      setPendingReject(merchant);
      return;
    }
    void performVerification(merchantId, nextStatus);
  }

  // Reason rides through to the merchant's notification + email so they know
  // what to fix and resubmit (only ever set on the rejection branch).
  async function performVerification(
    merchantId: string,
    nextStatus: VerificationStatus,
    reason?: string,
  ) {
    setBusyId(merchantId);

    const response = await fetch(`/api/admin/merchants/${merchantId}/verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, ...(reason ? { reason } : {}) }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      verificationStatus?: string;
    };

    if (!response.ok) {
      toast.error(payload.error ?? "Update failed.");
      setBusyId(null);
      setPendingReject(null);
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
    toast.success(
      nextStatus === "approved"
        ? "Merchant approved."
        : nextStatus === "suspended"
          ? "Merchant suspended."
          : nextStatus === "rejected"
            ? "Merchant rejected."
            : "Merchant updated.",
    );
    setBusyId(null);
    setPendingReject(null);
  }

  async function updateAutoApprove(merchantId: string, next: boolean) {
    setBusyId(merchantId);

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
      toast.error(payload.error ?? "Update failed.");
      setBusyId(null);
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
    toast.success(applied ? "Trusted - events auto-publish." : "Review required for future events.");
    setBusyId(null);
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
              className={`ck-tag ck-tag--select ${status === option.value ? "ck-tag--selected" : ""}`}
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
          className="w-full rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--slate)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)] sm:w-72"
        />
      </div>

      {/* overflow-visible so the row's dropdown menu can render outside the
          card edge instead of being clipped by overflow-hidden. */}
      <div className="mt-6 overflow-visible rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
        <div className="hidden grid-cols-[1.4fr_0.8fr_1fr_0.7fr_0.8fr_0.3fr] gap-4 border-b border-[color:var(--line)] px-5 py-3 text-xs font-semibold text-[color:var(--slate)] md:grid">
          <span>Business</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Events</span>
          <span>Joined</span>
          <span className="text-right">Actions</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              bare
              eyebrow="No matches"
              title={rows.length === 0 ? "No merchants yet" : "No merchants match this filter"}
              body={
                rows.length === 0
                  ? "Merchant applications will appear here once businesses sign up."
                  : "Try a different status filter or clear your search to see more."
              }
            />
          </div>
        ) : (
          filtered.map((merchant) => (
            <div
              key={merchant.id}
              className="grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm text-[color:var(--slate)] last:border-0 md:grid-cols-[1.4fr_0.8fr_1fr_0.7fr_0.8fr_0.3fr] md:items-center"
            >
              <div>
                {UUID_RE.test(merchant.id) ? (
                  <Link
                    href={`/admin/merchants/${merchant.id}`}
                    className="font-semibold text-[color:var(--ink)] hover:underline"
                  >
                    {merchant.businessName}
                  </Link>
                ) : (
                  <p className="font-semibold text-[color:var(--ink)]">
                    {merchant.businessName}
                  </p>
                )}
                <p className="text-xs">{merchant.contactEmail}</p>
                {merchant.websiteUrl ? (
                  <a
                    href={merchant.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[color:var(--purple)] underline"
                  >
                    {merchant.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
              </div>
              <div>
                <Badge tone={statusTone(merchant.verificationStatus)}>
                  {merchant.verificationStatus}
                </Badge>
                {merchant.abn ? (
                  <p className="mt-1 text-[11px] text-[color:var(--slate)]">
                    ABN {merchant.abn}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="font-semibold text-[color:var(--ink)]">{merchant.ownerName}</p>
                <p className="text-xs">{merchant.ownerEmail}</p>
              </div>
              <span className="font-semibold text-[color:var(--ink)]">{merchant.eventsHosted}</span>
              <span>{dateFormatter.format(new Date(merchant.createdAt))}</span>
              <MerchantActions
                merchant={merchant}
                onUpdate={(next) => updateVerification(merchant.id, next)}
                onToggleTrust={(next) => updateAutoApprove(merchant.id, next)}
              />
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={pendingReject !== null}
        title={
          pendingReject
            ? `Reject ${pendingReject.businessName}?`
            : "Reject this merchant?"
        }
        description="They'll be notified by email with your reason so they know what to fix and resubmit."
        confirmLabel="Reject merchant"
        tone="rose"
        busy={pendingReject ? busyId === pendingReject.id : false}
        promptLabel="Why is this merchant being rejected? (sent to them by email)"
        promptPlaceholder="Leave blank to send the generic note"
        onConfirm={(reason) => {
          if (pendingReject) {
            void performVerification(pendingReject.id, "rejected", reason || undefined);
          }
        }}
        onCancel={() => setPendingReject(null)}
      />
    </div>
  );
}
