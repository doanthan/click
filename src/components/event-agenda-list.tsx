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

// A flat, chronological list of every confirmed plan - upcoming first, then past
// (marked "Ended"). The month-grid calendar only renders one month at a time, so
// plans in other months sit behind the prev/next arrows; this list guarantees
// nothing is hidden. Members repeatedly asked to "see all past and future events"
// without paging - this is that view.
export function EventAgendaList({
  upcoming,
  past,
  waitlistedEventIds,
}: {
  upcoming: EventItem[];
  past: EventItem[];
  // The viewer's OWN waitlisted seats, keyed by event slug (straight from
  // getProfileStatus.waitlistedEventIds). getConfirmedEvents deliberately
  // returns confirmed and waitlisted seats in one bucket, so without this set
  // a queued spot was listed as "You're going" - people turned up to a night
  // they were still in line for.
  waitlistedEventIds?: Set<string>;
}) {
  if (upcoming.length === 0 && past.length === 0) return null;

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-2">
      <AgendaSection
        title="Upcoming"
        emptyLabel="No upcoming plans."
        events={upcoming}
        ended={false}
        waitlistedEventIds={waitlistedEventIds}
      />
      <AgendaSection
        title="Past"
        emptyLabel="No past plans yet."
        events={past}
        ended
        waitlistedEventIds={waitlistedEventIds}
      />
    </div>
  );
}

function AgendaSection({
  title,
  emptyLabel,
  events,
  ended,
  waitlistedEventIds,
}: {
  title: string;
  emptyLabel: string;
  events: EventItem[];
  ended: boolean;
  waitlistedEventIds?: Set<string>;
}) {
  return (
    <section>
      <h2 className="text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]">
        {title}
        <span className="ml-2 text-[color:var(--ink)]">{events.length}</span>
      </h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-[color:var(--slate)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {events.map((event) => (
            <li key={`${event.id}-${event.startsAt}`}>
              <AgendaRow
                event={event}
                ended={ended}
                waitlisted={waitlistedEventIds?.has(event.id) ?? false}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AgendaRow({
  event,
  ended,
  waitlisted,
}: {
  event: EventItem;
  ended: boolean;
  waitlisted: boolean;
}) {
  const isCancelled = event.status === "Cancelled";
  // A waitlist spot is a plan in the making and belongs in this list - but it
  // isn't a seat yet, so it gets its own amber label instead of borrowing the
  // sage "You're going". "Ended" and "Cancelled" still win the label: the Past
  // section only ever carries confirmed seats.
  const label = isCancelled
    ? "Cancelled"
    : ended
      ? "Ended"
      : waitlisted
        ? "Waitlist"
        : "You're going";
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] px-4 py-3 transition-colors hover:bg-[color:var(--lavender-100)]"
    >
      <div className="min-w-0">
        <p
          className={`font-display truncate text-sm font-semibold leading-tight ${
            isCancelled ? "text-[color:var(--slate)] line-through" : "text-[color:var(--ink)]"
          }`}
        >
          {event.title}
        </p>
        <p className="mt-0.5 text-[12.5px] text-[color:var(--slate)]">
          {ROW_DATE_FORMATTER.format(new Date(event.startsAt))} · {event.time}
        </p>
      </div>
      <span className={`ck-badge shrink-0 ${
        isCancelled
          ? "bg-[color-mix(in_srgb,var(--coral)_12%,var(--paper))] text-[color:var(--coral-ink)]"
          : ended
            ? "bg-[color:var(--mist)] text-[color:var(--slate)]"
            : waitlisted
              ? "bg-[color-mix(in_srgb,var(--amber)_14%,var(--paper))] text-[color:var(--amber-ink)]"
              : "bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] text-[color:var(--sage)]"
      }`}>
        {label}
      </span>
    </Link>
  );
}
