import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Composed empty state — replaces the bare one-line <p> "No results" used
 * across the consoles. Dashed warm frame, sticker label, display headline,
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
  tone = "peach",
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
  tone?: "peach" | "rose" | "ink";
  /** Drop the dashed frame + surface so it can sit cleanly inside an existing card. */
  bare?: boolean;
  className?: string;
}) {
  const stickerTone =
    tone === "rose" ? "sticker--rose" : tone === "ink" ? "sticker--ink" : "sticker--peach";
  const dot =
    tone === "rose"
      ? "bg-[color:var(--ink)]"
      : tone === "ink"
        ? "bg-[color:var(--peach)]"
        : "bg-[color:var(--rose)]";

  return (
    <div
      className={`flex flex-col items-center px-6 py-12 text-center ${
        bare ? "" : "rounded-3xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)]"
      } ${className}`}
    >
      {icon ? (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--mauve)] hard-shadow-sm">
          {icon}
        </div>
      ) : null}
      <span className={`sticker ${stickerTone} inline-flex`}>
        <span className={`size-2 rounded-full ${dot}`} />
        {eyebrow}
      </span>
      <h3 className="font-display mt-4 text-2xl font-light leading-tight tracking-tight text-[color:var(--ink)] sm:text-3xl">
        {title}
      </h3>
      {body ? (
        <p className="mt-3 max-w-md text-sm font-medium leading-6 text-[color:var(--mauve)]">{body}</p>
      ) : null}
      {action ? (
        <div className="mt-6">{action}</div>
      ) : actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-6 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--on-deep)] transition hard-shadow-sm hover:bg-black active:translate-y-px"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
