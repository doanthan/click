import Link from "next/link";
import type { EventItem } from "@/lib/click-data";
import { Icon } from "./ds";

/**
 * Click Radar - a compact social-proof BAR, never a strip of event cards and
 * never a dark block. One to three light, hairline-separated rows; each is an
 * anonymous AGGREGATE line ("3 going also like hiking") tied to an event, and
 * taps through to that event.
 *
 * Counts only - never names, never photos, and never below a floor of 3, so a
 * line can't identify anyone. The same bar renders on the dashboard and on the
 * click-with-someone page.
 */
export function ClickRadar({
  events,
  fomoBySlug = {},
}: {
  events: EventItem[];
  // Per-event aggregate signal (e.g. "2 going also like hiking"), keyed by event
  // id. When absent, the row falls back to an honest "trending" line.
  fomoBySlug?: Record<string, string>;
}) {
  const rows = events.slice(0, 3);

  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)]">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
            <Icon name="trend" size={16} />
          </span>
          <p className="min-w-0 flex-1 text-sm leading-snug text-[color:var(--ink-soft)]">
            As you go to events, your radar sharpens.
          </p>
          {/* The row is otherwise a dead end - give it the one next step. */}
          <Link
            href="/discover"
            className="font-display shrink-0 text-[13px] font-semibold text-[color:var(--purple)] hover:underline"
          >
            Find one →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)]">
      {rows.map((event, i) => (
        <Link
          key={event.id}
          href={`/events/${event.id}`}
          className={`flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-[color:var(--lavender-100)] ${
            i > 0 ? "border-t border-[color:var(--line-soft)]" : ""
          }`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
            <Icon name={fomoBySlug[event.id] ? "users" : "trend"} size={16} />
          </span>
          <span className="min-w-0 flex-1 text-sm leading-snug text-[color:var(--ink-soft)]">
            {fomoBySlug[event.id] ?? "Trending in Sydney"}{" "}
            <span className="font-semibold text-[color:var(--ink)]">{event.title}</span>
          </span>
          <Icon name="chevR" size={16} stroke={2} className="text-[color:var(--slate)]" />
        </Link>
      ))}
    </div>
  );
}
