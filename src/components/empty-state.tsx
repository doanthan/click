import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Composed empty state - replaces the bare one-line <p> "No results" used
 * across the consoles. Quiet lavender-wash panel, eyebrow, display headline,
 * one line of guidance, and an optional action (a link or any node, e.g. a
 * "Clear filters" button). Works in both server and client components.
 */
export function EmptyState({
  eyebrow = "Nothing here yet",
  title,
  body,
  icon,
  action,
  actionHref,
  actionLabel,
  bare = false,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  icon?: ReactNode;
  /** A custom action node (e.g. a client onClick button). Takes precedence. */
  action?: ReactNode;
  /** Or a simple link action. */
  actionHref?: string;
  actionLabel?: string;
  /** Legacy accent hint - the DS empty state has ONE quiet look, so this is accepted but unused. */
  tone?: "peach" | "rose" | "ink";
  /** Drop the frame + surface so it can sit cleanly inside an existing card. */
  bare?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center px-6 py-12 text-center ${
        bare ? "" : "rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)]"
      } ${className}`}
    >
      {icon ? (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-[color:var(--paper)] text-[color:var(--slate)] shadow-[var(--shadow-xs)]">
          {icon}
        </div>
      ) : null}
      <span className="eyebrow">{eyebrow}</span>
      <h3 className="font-display mt-3 text-xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-2xl">
        {title}
      </h3>
      {body ? (
        <p className="mt-3 max-w-md text-sm leading-6 text-[color:var(--slate)]">{body}</p>
      ) : null}
      {action ? (
        <div className="mt-6">{action}</div>
      ) : actionHref && actionLabel ? (
        <Link href={actionHref} className="ck-btn ck-btn--primary ck-btn--sm mt-6">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
