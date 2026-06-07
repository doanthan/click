import Link from "next/link";
import type { EventItem } from "@/lib/click-data";

const SYDNEY_TZ = "Australia/Sydney";
const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  month: "long",
  year: "numeric",
  timeZone: SYDNEY_TZ,
});
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  timeZone: SYDNEY_TZ,
});
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: SYDNEY_TZ,
});

type CalendarCell = {
  date: Date;
  isoDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: EventItem[];
};

type UserCalendarProps = {
  events: EventItem[];
  monthParam?: string;
  bookedSlug?: string;
  basePath?: string;
};

function isoDateInSydney(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function parseMonthParam(monthParam: string | undefined, fallback: Date) {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [yearStr, monthStr] = monthParam.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 1));
    }
  }

  const fallbackIso = isoDateInSydney(fallback);
  const [year, month] = fallbackIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function formatMonthParam(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function dayOfWeekIndexMondayFirst(date: Date) {
  const jsDay = date.getUTCDay();
  return (jsDay + 6) % 7;
}

// Comparable month index (year * 12 + monthIndex) for an event, computed in the
// Sydney calendar so it lines up with the grid's day buckets.
function eventMonthIndex(event: EventItem) {
  const [yearStr, monthStr] = isoDateInSydney(new Date(event.startsAt)).split("-");
  return Number(yearStr) * 12 + (Number(monthStr) - 1);
}

function anchorMonthIndex(monthAnchor: Date) {
  return monthAnchor.getUTCFullYear() * 12 + monthAnchor.getUTCMonth();
}

function buildCells(monthAnchor: Date, events: EventItem[], todayIso: string): CalendarCell[] {
  const firstDay = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), 1));
  const lastDay = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0));
  const leadingBlanks = dayOfWeekIndexMondayFirst(firstDay);

  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(gridStart.getUTCDate() - leadingBlanks);

  const totalDaysToShow = leadingBlanks + lastDay.getUTCDate();
  const trailingNeeded = (7 - (totalDaysToShow % 7)) % 7;
  const totalCells = totalDaysToShow + trailingNeeded;

  const eventsByDate = new Map<string, EventItem[]>();
  for (const event of events) {
    const key = isoDateInSydney(new Date(event.startsAt));
    const existing = eventsByDate.get(key) ?? [];
    existing.push(event);
    eventsByDate.set(key, existing);
  }

  const cells: CalendarCell[] = [];
  for (let dayIndex = 0; dayIndex < totalCells; dayIndex++) {
    const cellDate = new Date(gridStart);
    cellDate.setUTCDate(gridStart.getUTCDate() + dayIndex);
    const iso = `${cellDate.getUTCFullYear()}-${String(cellDate.getUTCMonth() + 1).padStart(2, "0")}-${String(cellDate.getUTCDate()).padStart(2, "0")}`;
    const isCurrentMonth = cellDate.getUTCMonth() === monthAnchor.getUTCMonth();
    cells.push({
      date: cellDate,
      isoDate: iso,
      isCurrentMonth,
      isToday: iso === todayIso,
      events: eventsByDate.get(iso) ?? [],
    });
  }

  return cells;
}

function chipMeta(event: EventItem): { label: string; className: string } {
  const isFull = event.attendees >= event.capacity;
  const end = new Date(event.endsAt ?? event.startsAt);
  const isPast = end.getTime() < Date.now();

  // Cancelled events stay visible on the calendar (so a member isn't left
  // wondering where their RSVP went) but are clearly struck out, never shown as
  // "Waitlist"/"Confirmed".
  if (event.status === "Cancelled")
    return {
      label: "Cancelled",
      className:
        "bg-[color:var(--cream)] text-[color:var(--mauve)] line-through opacity-80",
    };
  // Past events are archived in-place as "Ended" so history reads clearly.
  if (isPast)
    return {
      label: "Ended",
      className: "bg-[color:var(--cream)] text-[color:var(--mauve)] opacity-90",
    };
  if (event.status === "Waitlist" || isFull)
    return { label: "Waitlist", className: "bg-[color:var(--ink)] text-[color:var(--champagne)]" };
  if (event.status === "Locked")
    return { label: "Locked", className: "bg-[color:var(--ink)] text-[color:var(--champagne)]" };
  return { label: "Confirmed", className: "bg-[color:var(--peach)] text-[color:var(--surface-deep)]" };
}

export function UserCalendar({
  events,
  monthParam,
  bookedSlug,
  basePath = "/dashboard/calendar",
}: UserCalendarProps) {
  // Default to the current month so the calendar opens on "today" rather than
  // the earliest RSVP's month (which, with past events included, could be far in
  // the past). The prev/next arrows + count dots page to other months.
  const monthAnchor = parseMonthParam(monthParam, new Date());
  const todayIso = isoDateInSydney(new Date());
  const cells = buildCells(monthAnchor, events, todayIso);
  const prevMonth = formatMonthParam(addMonths(monthAnchor, -1));
  const nextMonth = formatMonthParam(addMonths(monthAnchor, 1));
  const heading = MONTH_NAME_FORMATTER.format(monthAnchor);
  const monthSeparator = basePath.includes("?") ? "&" : "?";
  const monthHref = (month: string) => `${basePath}${monthSeparator}month=${month}`;

  const currentMonthIndex = anchorMonthIndex(monthAnchor);
  const monthEvents = events.filter(
    (event) => eventMonthIndex(event) === currentMonthIndex,
  );
  // A month grid only renders one month, so RSVPs in other months (e.g. one you
  // just booked further out than your soonest event) are off-screen. Count them
  // per direction so the prev/next arrows can signal there's more to page to —
  // otherwise the event looks like it never landed on the calendar.
  const eventsBeforeCount = events.filter(
    (event) => eventMonthIndex(event) < currentMonthIndex,
  ).length;
  const eventsAfterCount = events.filter(
    (event) => eventMonthIndex(event) > currentMonthIndex,
  ).length;

  const bookedEvent = bookedSlug ? events.find((event) => event.id === bookedSlug) : null;

  return (
    <article className="overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
      {bookedEvent ? (
        <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--peach)] px-5 py-3 text-sm font-bold text-[color:var(--surface-deep)]">
          ✓ You&apos;re in for <span className="italic">{bookedEvent.title}</span>.
        </div>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-4">
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Your bookings
          </p>
          <h3 className="font-display mt-1 text-2xl font-light leading-tight text-[color:var(--ink)] sm:text-3xl">
            {heading}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-xs font-bold text-[color:var(--mauve)]">
            {monthEvents.length} event{monthEvents.length === 1 ? "" : "s"} this month
          </span>
          <div className="flex items-center gap-1.5">
            <Link
              href={monthHref(prevMonth)}
              aria-label={
                eventsBeforeCount > 0
                  ? `Previous month (${eventsBeforeCount} earlier event${eventsBeforeCount === 1 ? "" : "s"})`
                  : "Previous month"
              }
              className="relative grid size-9 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              ←
              {eventsBeforeCount > 0 ? <MonthEventDot count={eventsBeforeCount} /> : null}
            </Link>
            <Link
              href={basePath}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1.5 text-xs font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Today
            </Link>
            <Link
              href={monthHref(nextMonth)}
              aria-label={
                eventsAfterCount > 0
                  ? `Next month (${eventsAfterCount} later event${eventsAfterCount === 1 ? "" : "s"})`
                  : "Next month"
              }
              className="relative grid size-9 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              →
              {eventsAfterCount > 0 ? <MonthEventDot count={eventsAfterCount} /> : null}
            </Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-7 border-b-2 border-[color:var(--line)] bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]">
        {WEEK_LABELS.map((label) => (
          <div
            key={label}
            className="px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => (
          <CalendarDayCell key={cell.isoDate} cell={cell} />
        ))}
      </div>
    </article>
  );
}

// Small count badge pinned to a month-nav arrow, flagging that this many RSVPs
// live in months you'd have to page to.
function MonthEventDot({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-1 font-mono text-[0.55rem] font-bold leading-none text-[color:var(--surface-deep)]"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function CalendarDayCell({ cell }: { cell: CalendarCell }) {
  const dayNumber = DAY_LABEL_FORMATTER.format(cell.date);
  return (
    <div
      className={`min-h-28 border-b-2 border-r-2 border-[color:var(--line)] p-2 ${
        cell.isCurrentMonth
          ? "bg-[color:var(--champagne)]"
          : "bg-[color:var(--cream)]/60"
      } last:border-r-0`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={`font-mono text-[0.7rem] font-bold ${
            cell.isToday
              ? "grid size-6 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
              : cell.isCurrentMonth
                ? "text-[color:var(--ink)]"
                : "text-[color:var(--mauve)]/55"
          }`}
        >
          {dayNumber}
        </span>
        {cell.events.length > 0 ? (
          <span
            className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]"
            title={FULL_DATE_FORMATTER.format(cell.date)}
          >
            {cell.events.length}
            {cell.events.length === 1 ? " plan" : " plans"}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 grid gap-1">
        {cell.events.slice(0, 3).map((event) => (
          <CalendarEventChip key={event.id} event={event} />
        ))}
        {cell.events.length > 3 ? (
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
            + {cell.events.length - 3} more
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CalendarEventChip({ event }: { event: EventItem }) {
  const { label, className } = chipMeta(event);

  return (
    <Link
      href={`/events/${event.id}`}
      className={`block rounded-md border-2 border-[color:var(--line)] px-1.5 py-1 hard-shadow-sm transition hover:-translate-y-[1px] hover:[box-shadow:3px_3px_0_0_var(--shadow-ink)] ${className}`}
    >
      <p className="line-clamp-1 text-[0.7rem] font-bold leading-tight">{event.title}</p>
      <p className="mt-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-80">
        {event.time} · {label}
      </p>
    </Link>
  );
}
