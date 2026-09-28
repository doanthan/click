"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminTagRequestRow } from "@/lib/event-repository";
import { ConfirmDialog } from "@/components/confirm-dialog";

const dateFormatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

const fieldClass =
  "rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]";

// The queue of tags hosts asked for from the event wizard (bug board #275).
// Approve creates the tag - label as edited here, in the chosen category -
// through POST /api/admin/tag-requests/[id]; Dismiss takes an optional note.
// The host hears either way, in-app.
export function AdminTagRequests({
  requests,
  categories,
}: {
  requests: AdminTagRequestRow[];
  categories: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(requests);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [categoryFor, setCategoryFor] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = useState<AdminTagRequestRow | null>(null);

  async function decide(request: AdminTagRequestRow, body: Record<string, string>) {
    setBusyId(request.id);
    try {
      const response = await fetch(`/api/admin/tag-requests/${request.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        tag?: { label?: string } | null;
      };
      if (!response.ok) {
        toast.error(payload.error ?? "That didn't save - the request is unchanged.");
        return;
      }
      setRows((current) => current.filter((row) => row.id !== request.id));
      toast.success(
        body.action === "approve"
          ? `"${payload.tag?.label ?? request.label}" added - the host has been told.`
          : "Dismissed - the host has been told.",
      );
      router.refresh();
    } catch {
      toast.error("Could not reach the server - the request is unchanged.");
    } finally {
      setBusyId(null);
      setDismissTarget(null);
    }
  }

  return (
    <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-2xl font-semibold leading-none text-[color:var(--ink)]">
          Tag requests
        </h3>
        <p className="text-xs font-semibold text-[color:var(--slate)]">
          {rows.length === 0 ? "None waiting" : `${rows.length} waiting`}
        </p>
      </div>
      <p className="mt-2 text-sm text-[color:var(--slate)]">
        Tags hosts asked for while creating events. Approving adds it as an interest tag.
      </p>

      {rows.length > 0 ? (
        <ul className="mt-4 grid gap-3">
          {rows.map((request) => {
            const label = labels[request.id] ?? request.label;
            const category = categoryFor[request.id] ?? "";
            const busy = busyId === request.id;
            return (
              <li
                key={request.id}
                className="grid gap-3 rounded-xl border border-[color:var(--mist)] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-[color:var(--ink)]">{request.label}</p>
                  <p className="text-xs text-[color:var(--slate)]">
                    {request.businessName} · {dateFormatter.format(new Date(request.createdAt))}
                  </p>
                </div>
                {request.note ? (
                  <p className="text-sm text-[color:var(--ink-soft)]">&ldquo;{request.note}&rdquo;</p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold text-[color:var(--slate)]">
                    Tag label
                    <input
                      value={label}
                      maxLength={40}
                      onChange={(event) =>
                        setLabels((current) => ({ ...current, [request.id]: event.target.value }))
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-[color:var(--slate)]">
                    Category
                    <select
                      value={category}
                      onChange={(event) =>
                        setCategoryFor((current) => ({ ...current, [request.id]: event.target.value }))
                      }
                      className={fieldClass}
                    >
                      <option value="" disabled>
                        Pick a category…
                      </option>
                      {categories.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !label.trim() || !category}
                    onClick={() =>
                      void decide(request, { action: "approve", label, categoryName: category })
                    }
                    className="ck-btn ck-btn--primary ck-btn--sm"
                  >
                    {busy ? "Saving…" : "Approve tag"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDismissTarget(request)}
                    className="ck-btn ck-btn--secondary ck-btn--sm"
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <ConfirmDialog
        open={dismissTarget !== null}
        title="Dismiss this tag request?"
        description={
          dismissTarget
            ? `"${dismissTarget.label}" won't be added. ${dismissTarget.businessName} sees your note.`
            : undefined
        }
        tone="ink"
        confirmLabel="Dismiss request"
        cancelLabel="Keep it"
        busy={dismissTarget !== null && busyId === dismissTarget.id}
        promptLabel="Note for the host (optional)"
        promptPlaceholder="e.g. Use Board Games instead"
        onConfirm={(note) => {
          if (dismissTarget) void decide(dismissTarget, { action: "dismiss", note });
        }}
        onCancel={() => setDismissTarget(null)}
      />
    </section>
  );
}
