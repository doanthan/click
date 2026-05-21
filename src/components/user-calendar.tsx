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

function chipStyle(event: EventItem) {
  const isFull = event.attendees >= event.capacity;
  if (event.status === "Waitlist" || isFull)
    return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  if (event.status === "Locked") return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
}

export function UserCalendar({ events, monthParam, bookedSlug }: UserCalendarProps) {
  const earliestEvent = events[0] ? new Date(events[0].startsAt) : new Date();
  const monthAnchor = parseMonthParam(monthParam, earliestEvent);
  const todayIso = isoDateInSydney(new Date());
  const cells = buildCells(monthAnchor, events, todayIso);
  const prevMonth = formatMonthParam(addMonths(monthAnchor, -1));
  const nextMonth = formatMonthParam(addMonths(monthAnchor, 1));
  const heading = MONTH_NAME_FORMATTER.format(monthAnchor);

  const monthEvents = events.filter((event) => {
    const key = isoDateInSydney(new Date(event.startsAt));
    const [yearStr, monthStr] = key.split("-");
    return (
      Number(yearStr) === monthAnchor.getUTCFullYear() &&
      Number(monthStr) === monthAnchor.getUTCMonth() + 1
    );
  });

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
              href={`/dashboard/calendar?month=${prevMonth}`}
              aria-label="Previous month"
              className="grid size-9 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              ←
            </Link>
            <Link
              href="/dashboard/calendar"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1.5 text-xs font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Today
            </Link>
            <Link
              href={`/dashboard/calendar?month=${nextMonth}`}
              aria-label="Next month"
              className="grid size-9 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              →
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
  const isFull = event.attendees >= event.capacity;
  const label = event.status === "Waitlist" || isFull ? "Waitlist" : "Confirmed";

  return (
    <Link
      href={`/events/${event.id}`}
      className={`block rounded-md border-2 border-[color:var(--line)] px-1.5 py-1 hard-shadow-sm transition hover:-translate-y-[1px] hover:[box-shadow:3px_3px_0_0_var(--shadow-ink)] ${chipStyle(event)}`}
    >
      <p className="line-clamp-1 text-[0.7rem] font-bold leading-tight">{event.title}</p>
      <p className="mt-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-80">
        {event.time} · {label}
      </p>
    </Link>
  );
}
