import Link from "next/link";
import type { EventItem } from "@/lib/click-data";

// Click Radar surfaces EVENTS the viewer is likely to click with — RSVP'ing is
// the on-ramp to meeting people (you can only Click someone after a shared
// event), so the radar points at events, not people. Per 04_MATCHING_ALGORITHM_V2.md
// §5.2 (`event_radar`), the suggestions are the personalised event candidates.
export function ClickRadar({
  events,
  fomoBySlug = {},
}: {
  events: EventItem[];
  // Optional per-event FOMO signal (e.g. "2 going also like Hiking"), keyed by
  // event id/slug. Surfaced under each event when present.
  fomoBySlug?: Record<string, string>;
}) {
  const top = events.slice(0, 4);
  return (
    <aside className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--ink)] p-5 text-[color:var(--on-deep)] hard-shadow">
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--peach)]">
        Click Radar
      </span>
      <h3 className="font-display mt-3 text-2xl font-light leading-tight">
        Events on your radar.
      </h3>
      <p className="mt-2 text-sm font-medium leading-6 opacity-80">
        Picked from your interests and intent. RSVP — that&apos;s how you meet the
        people you&apos;ll click with.
      </p>
      {top.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {top.map((event) => (
            <li
              key={event.id}
              className="rounded-2xl border-2 border-[color:var(--peach)] bg-[color:var(--surface-deep)] p-3"
            >
              <Link
                href={`/events/${event.id}`}
                className="block text-sm font-bold text-[color:var(--on-deep)] hover:text-[color:var(--peach)]"
              >
                {event.title}
              </Link>
              <p className="mt-1 text-xs font-medium text-[color:var(--peach)]">
                {event.date}
                {event.suburb ? ` · ${event.suburb}` : ""}
              </p>
              {fomoBySlug[event.id] ? (
                <p className="mt-2 inline-flex rounded-full border-2 border-[color:var(--peach)] bg-[color:var(--ink)] px-2 py-0.5 text-[0.65rem] font-bold text-[color:var(--peach)]">
                  ✷ {fomoBySlug[event.id]}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl border-2 border-dashed border-[color:var(--peach)] p-3 text-xs font-medium opacity-80">
          Add a few interests in onboarding to light up your radar.
        </p>
      )}
    </aside>
  );
}
