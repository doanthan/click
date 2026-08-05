"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { AdminTagRow } from "@/lib/event-repository";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";

const tagTypeOptions = ["interest", "music", "vibe"] as const;

export function AdminTagManager({ tags }: { tags: AdminTagRow[] }) {
  const [rows, setRows] = useState(tags);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [tagType, setTagType] = useState<(typeof tagTypeOptions)[number]>("interest");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Tag queued for the branded delete confirmation (null = dialog closed).
  const [pendingDelete, setPendingDelete] = useState<AdminTagRow | null>(null);
  // Make a long list manageable: free-text search + a type filter.
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | (typeof tagTypeOptions)[number]>("all");

  const categories = useMemo(
    () =>
      Array.from(new Set(rows.map((tag) => tag.categoryName).filter(Boolean) as string[]))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 20),
    [rows],
  );

  // Filter by search (label / slug / category) + type, then group by category
  // (then label) so related tags sit together - much easier to scan than the
  // previous unsorted, silently-capped-at-80 list.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((tag) => {
        if (typeFilter !== "all" && tag.tagType !== typeFilter) return false;
        if (!q) return true;
        return (
          tag.label.toLowerCase().includes(q) ||
          tag.slug.toLowerCase().includes(q) ||
          (tag.categoryName ?? "").toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          (a.categoryName ?? "Uncategorised").localeCompare(b.categoryName ?? "Uncategorised") ||
          a.label.localeCompare(b.label),
      );
  }, [rows, query, typeFilter]);

  function resetForm() {
    setEditingId(null);
    setLabel("");
    setCategoryName("");
    setTagType("interest");
  }

  function startEdit(tag: AdminTagRow) {
    setEditingId(tag.id);
    setLabel(tag.label);
    setCategoryName(tag.categoryName ?? "");
    setTagType(
      (tagTypeOptions as readonly string[]).includes(tag.tagType)
        ? (tag.tagType as (typeof tagTypeOptions)[number])
        : "interest",
    );
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const wasEditing = Boolean(editingId);
    const response = await fetch("/api/admin/tags", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingId
          ? { id: editingId, label, categoryName, tagType }
          : { label, categoryName, tagType },
      ),
    });
    const payload = (await response.json()) as {
      error?: string;
      tag?: AdminTagRow;
    };

    if (!response.ok || !payload.tag) {
      setSubmitting(false);
      toast.error(payload.error ?? "Tag could not be saved.");
      return;
    }

    setRows((current) => {
      const withoutExisting = current.filter((tag) => tag.id !== payload.tag?.id);
      return [payload.tag as AdminTagRow, ...withoutExisting];
    });
    toast.success(wasEditing ? "Tag updated and audit logged." : "Tag saved and audit logged.");
    resetForm();
    setSubmitting(false);
  }

  async function performDelete(tag: AdminTagRow) {
    setDeletingId(tag.id);

    const response = await fetch(`/api/admin/tags?id=${encodeURIComponent(tag.id)}`, {
      method: "DELETE",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setDeletingId(null);
      setPendingDelete(null);
      toast.error(payload.error ?? "Tag could not be deleted.");
      return;
    }

    setRows((current) => current.filter((row) => row.id !== tag.id));
    if (editingId === tag.id) resetForm();
    toast.success("Tag deleted and audit logged.");
    setDeletingId(null);
    setPendingDelete(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5"
      >
        <h3 className="font-display text-3xl font-semibold leading-none text-[color:var(--ink)]">
          {editingId ? "Edit tag" : "Add or update tag"}
        </h3>
        {editingId ? (
          <p className="mt-2 text-xs font-medium text-[color:var(--slate)]">
            Editing keeps the slug stable so existing events and members stay linked.
          </p>
        ) : null}
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm text-[color:var(--ink)]">
            <span className="eyebrow">Label</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
              placeholder="Trail Running"
              className="rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
            />
          </label>

          <label className="grid gap-2 text-sm text-[color:var(--ink)]">
            <span className="eyebrow">Category</span>
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              required
              placeholder="Fitness"
              list="admin-tag-categories"
              className="rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
            />
            <datalist id="admin-tag-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </label>

          <label className="grid gap-2 text-sm text-[color:var(--ink)]">
            <span className="eyebrow">Type</span>
            <select
              value={tagType}
              onChange={(event) => setTagType(event.target.value as typeof tagType)}
              className="rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
            >
              {tagTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="ck-btn ck-btn--primary ck-btn--md"
            >
              {submitting
                ? "Saving..."
                : editingId
                  ? "Update tag"
                  : "Save tag"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="ck-btn ck-btn--secondary ck-btn--md"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
          {/* The placeholder is not an accessible name - it disappears the
              moment anything is typed. Same wrapping-label pattern as the three
              fields in the form on the left, just visually hidden here because
              the toolbar has no room for a visible one. */}
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search tags by label, slug or category</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tags, slugs, categories…"
              className="w-full rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...tagTypeOptions] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                aria-pressed={typeFilter === type}
                className={`ck-tag ck-tag--select ${typeFilter === type ? "ck-tag--selected" : ""}`}
              >
                {type}
              </button>
            ))}
          </div>
          <span className="text-[12px] font-semibold text-[color:var(--slate)]">
            {filtered.length} of {rows.length}
          </span>
        </div>
        <div className="grid grid-cols-[1.1fr_0.8fr_0.6fr_0.4fr_0.7fr] gap-3 border-b border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--slate)] max-sm:hidden">
          <span>Tag</span>
          <span>Category</span>
          <span>Type</span>
          <span>Usage</span>
          <span className="text-right">Actions</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              bare
              eyebrow="No matches"
              title={rows.length === 0 ? "No tags yet" : "No tags match your search"}
              body={
                rows.length === 0
                  ? "Add a tag with the form on the left to start building your taxonomy."
                  : "Try a different search term or clear the type filter to see more tags."
              }
            />
          </div>
        ) : null}
        {filtered.map((tag) => (
          <div
            key={tag.id}
            className="grid gap-2 border-b border-[color:var(--line)] px-5 py-4 text-sm font-medium text-[color:var(--slate)] last:border-0 sm:grid-cols-[1.1fr_0.8fr_0.6fr_0.4fr_0.7fr] sm:items-center"
          >
            <div>
              <p className="font-semibold text-[color:var(--ink)]">{tag.label}</p>
              <p className="text-[11px] text-[color:var(--ink-faint)]">
                {tag.slug}
              </p>
            </div>
            <span className="font-medium text-[color:var(--ink)]">
              {tag.categoryName ?? "Uncategorised"}
            </span>
            <span className="ck-tag justify-self-start">
              {tag.tagType}
            </span>
            <span className="font-semibold text-[color:var(--ink)]">{tag.usageCount}</span>
            <div className="flex gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => startEdit(tag)}
                className="ck-btn ck-btn--secondary ck-btn--sm"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(tag)}
                disabled={deletingId === tag.id}
                className="ck-btn ck-btn--ghost ck-btn--sm text-[color:var(--danger)]"
              >
                {deletingId === tag.id ? "…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete "${pendingDelete.label}"?` : "Delete tag?"}
        description={
          pendingDelete
            ? `This removes it from every event and member it's linked to (${pendingDelete.usageCount} association${pendingDelete.usageCount === 1 ? "" : "s"}). This can't be undone.`
            : undefined
        }
        confirmLabel="Delete tag"
        tone="rose"
        busy={pendingDelete ? deletingId === pendingDelete.id : false}
        onConfirm={() => {
          if (pendingDelete) void performDelete(pendingDelete);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
