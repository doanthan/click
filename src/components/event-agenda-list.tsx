import Link from "next/link";
import type { EventItem } from "@/lib/click-data";

const SYDNEY_TZ = "Australia/Sydney";
const ROW_DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: SYDNEY_TZ,
});

// A flat, chronological list of every confirmed plan — upcoming first, then past
// (marked "Ended"). The month-grid calendar only renders one month at a time, so
// plans in other months sit behind the prev/next arrows; this list guarantees
// nothing is hidden. Members repeatedly asked to "see all past and future events"
// without paging — this is that view.
export function EventAgendaList({
  upcoming,
  past,
}: {
  upcoming: EventItem[];
  past: EventItem[];
}) {
  if (upcoming.length === 0 && past.length === 0) return null;

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-2">
      <AgendaSection
        title="Upcoming"
        emptyLabel="No upcoming plans."
        events={upcoming}
        ended={false}
      />
      <AgendaSection
        title="Past"
        emptyLabel="No past plans yet."
        events={past}
        ended
      />
    </div>
  );
}

function AgendaSection({
  title,
  emptyLabel,
  events,
  ended,
}: {
  title: string;
  emptyLabel: string;
  events: EventItem[];
  ended: boolean;
}) {
  return (
    <section>
      <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {title}
        <span className="ml-2 text-[color:var(--ink)]">{events.length}</span>
      </h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-[color:var(--mauve)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {events.map((event) => (
            <li key={`${event.id}-${event.startsAt}`}>
              <AgendaRow event={event} ended={ended} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AgendaRow({ event, ended }: { event: EventItem; ended: boolean }) {
  const isCancelled = event.status === "Cancelled";
  const label = isCancelled ? "Cancelled" : ended ? "Ended" : event.status;
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2.5 hard-shadow-sm transition hover:-translate-y-[1px] hover:bg-[color:var(--peach)]"
    >
      <div className="min-w-0">
        <p
          className={`truncate text-sm font-bold leading-tight ${
            isCancelled ? "text-[color:var(--mauve)] line-through" : "text-[color:var(--ink)]"
          }`}
        >
          {event.title}
        </p>
        <p className="mt-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
          {ROW_DATE_FORMATTER.format(new Date(event.startsAt))} · {event.time}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full border-2 border-[color:var(--line)] px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] ${
          isCancelled || ended
            ? "bg-[color:var(--cream)] text-[color:var(--mauve)]"
            : "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
