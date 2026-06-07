"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Tag = { slug: string; label: string };

// Merchant self-service editor for an event's SAFE fields (title, description,
// interest tags). Price / time / location / capacity are intentionally NOT
// editable here — changing them after people have booked needs a review, so the
// form shows a note directing merchants to request one.
export function MerchantEventEditForm({
  eventSlug,
  initialTitle,
  initialDescription,
  initialTags,
  tagOptions,
}: {
  eventSlug: string;
  initialTitle: string;
  initialDescription: string;
  initialTags: Tag[];
  tagOptions: Tag[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const selectedSlugs = useMemo(() => new Set(tags.map((t) => t.slug)), [tags]);
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tagOptions
      .filter((o) => !selectedSlugs.has(o.slug))
      .filter((o) => !q || o.label.toLowerCase().includes(q))
      .slice(0, 24);
  }, [tagOptions, selectedSlugs, query]);

  function addTag(tag: Tag) {
    setTags((prev) => (prev.some((t) => t.slug === tag.slug) ? prev : [...prev, tag]));
    setQuery("");
  }
  function removeTag(slug: string) {
    setTags((prev) => prev.filter((t) => t.slug !== slug));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/merchant/events/${encodeURIComponent(eventSlug)}/details`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            tagSlugs: tags.map((t) => t.slug),
          }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage({ kind: "error", text: payload.error ?? "Could not save changes." });
        return;
      }
      setMessage({ kind: "ok", text: "Saved." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            Edit event
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">
            Update the title, description and interest tags.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
        >
          {open ? "Close" : "Edit details"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--rose)]"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="mt-1.5 w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-sm font-medium leading-6 text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--rose)]"
            />
          </label>

          <div>
            <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Interest tags
            </span>
            <ul className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {tags.length === 0 ? (
                <li className="text-xs font-semibold text-[color:var(--mauve)]">None yet.</li>
              ) : (
                tags.map((tag) => (
                  <li key={tag.slug}>
                    <span className="inline-flex items-center gap-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-2.5 py-0.5 text-xs font-bold text-[color:var(--surface-deep)]">
                      {tag.label}
                      <button
                        type="button"
                        onClick={() => removeTag(tag.slug)}
                        aria-label={`Remove ${tag.label}`}
                        className="leading-none hover:text-[color:var(--ink)]"
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))
              )}
            </ul>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags to add…"
              className="mt-2 w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--rose)]"
            />
            {query.trim() ? (
              <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {available.length === 0 ? (
                  <span className="text-xs font-semibold text-[color:var(--mauve)]">
                    No matching tags.
                  </span>
                ) : (
                  available.map((tag) => (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-2.5 py-0.5 text-xs font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                    >
                      + {tag.label}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <p className="rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-3 text-xs font-semibold leading-5 text-[color:var(--mauve)]">
            Changing the price, date/time, location or capacity affects people who
            may have already booked — those need a review. Email
            support@click.local to request a change.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !title.trim()}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {message ? (
              <span
                className={`text-sm font-bold ${
                  message.kind === "ok"
                    ? "text-[color:var(--ink)]"
                    : "text-[color:var(--rose)]"
                }`}
              >
                {message.text}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
