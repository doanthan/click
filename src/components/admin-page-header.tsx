import type { ReactNode } from "react";

// Shared title block for admin console pages. Several heavy pages (events,
// members, merchants, tags, system, audit) previously had only a browser-tab
// <title> and no on-page H1, so each screen opened straight into a filter bar
// with no context. This gives every admin page a consistent header: a small
// rose eyebrow, a display H1, an optional one-line description, and an optional
// right-aligned action slot (e.g. a primary button).
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {/* Sizes/spacing match the established admin header style used by the
            reports, matching, matching-lab and transactions pages, so every
            admin screen now shares one title treatment. */}
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--rose)]">
          {eyebrow}
        </span>
        <h1 className="font-display mt-2 text-4xl font-light leading-tight tracking-tight text-[color:var(--ink)] sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[color:var(--mauve)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
