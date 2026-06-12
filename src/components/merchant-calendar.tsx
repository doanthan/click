import Link from "next/link";
import type { MerchantEventSummary } from "@/lib/event-repository";

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
  events: MerchantEventSummary[];
};

type MerchantCalendarProps = {
  events: MerchantEventSummary[];
  monthParam?: string;
};

function isoDateInSydney(date: Date) {
  // day MUST be "2-digit": "numeric" comes back unpadded ("1"), so the key
  // "2026-07-1" never matches the grid cell's "2026-07-01" and events on the
  // 1st–9th of a month vanish from the grid (same bug as user-calendar, #88).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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

function buildCells(monthAnchor: Date, events: MerchantEventSummary[], todayIso: string): CalendarCell[] {
  const firstDay = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), 1));
  const lastDay = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0));
  const leadingBlanks = dayOfWeekIndexMondayFirst(firstDay);
  const cells: CalendarCell[] = [];

  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(gridStart.getUTCDate() - leadingBlanks);

  const totalDaysToShow = leadingBlanks + lastDay.getUTCDate();
  const trailingNeeded = (7 - (totalDaysToShow % 7)) % 7;
  const totalCells = totalDaysToShow + trailingNeeded;

  const eventsByDate = new Map<string, MerchantEventSummary[]>();
  for (const event of events) {
    const key = isoDateInSydney(new Date(event.startsAt));
    const existing = eventsByDate.get(key) ?? [];
    existing.push(event);
    eventsByDate.set(key, existing);
  }

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

function isPastEvent(event: MerchantEventSummary) {
  return new Date(event.endsAt ?? event.startsAt).getTime() < Date.now();
}

function statusBadgeClass(event: MerchantEventSummary) {
  const isFull = event.confirmed >= event.capacity;
  if (event.status === "Cancelled")
    return "bg-[color:var(--cream)] text-[color:var(--mauve)] line-through opacity-80";
  // Past events read as muted "Ended" chips so the merchant can still see their
  // history on the calendar without it competing with live/upcoming events.
  if (isPastEvent(event)) return "bg-[color:var(--cream)] text-[color:var(--mauve)] opacity-90";
  if (event.status === "Pending") return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  if (isFull || event.status === "Waitlist")
    return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  if (event.status === "Locked") return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
}

export function MerchantCalendar({ events, monthParam }: MerchantCalendarProps) {
  // Default to the CURRENT month (not the earliest event) so the calendar always
  // opens on "today" — otherwise a merchant with old past events lands months in
  // the past and thinks an upcoming event "isn't on the calendar". Month arrows
  // page from there.
  const monthAnchor = parseMonthParam(monthParam, new Date());
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

  const monthConfirmed = monthEvents.reduce((sum, event) => sum + event.confirmed, 0);
  const monthCapacity = monthEvents.reduce((sum, event) => sum + event.capacity, 0);

  // When the viewed month is empty but the merchant DOES have events elsewhere,
  // surface a one-click jump to the month nearest to today — otherwise a host
  // whose events all sit in another month thinks the calendar is "missing" them.
  const anchorMs = monthAnchor.getTime();
  const nearestEvent =
    monthEvents.length === 0 && events.length > 0
      ? events
          .slice()
          .sort(
            (a, b) =>
              Math.abs(new Date(a.startsAt).getTime() - anchorMs) -
              Math.abs(new Date(b.startsAt).getTime() - anchorMs),
          )[0]
      : null;
  const nearestMonthParam = nearestEvent
    ? formatMonthParam(
        parseMonthParam(isoDateInSydney(new Date(nearestEvent.startsAt)).slice(0, 7), new Date()),
      )
    : null;
  const nearestMonthLabel = nearestEvent
    ? MONTH_NAME_FORMATTER.format(new Date(nearestEvent.startsAt))
    : null;

  return (
    <article className="overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-4">
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Hosting calendar
          </p>
          <h3 className="font-display mt-1 text-2xl font-light leading-tight text-[color:var(--ink)] sm:text-3xl">
            {heading}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-xs font-bold text-[color:var(--mauve)]">
            {monthEvents.length} event{monthEvents.length === 1 ? "" : "s"} ·{" "}
            {monthConfirmed}/{monthCapacity} booked
          </span>
          <div className="flex items-center gap-1.5">
            <Link
              href={`/merchant?month=${prevMonth}`}
              aria-label="Previous month"
              className="grid size-9 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              ←
            </Link>
            <Link
              href="/merchant"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1.5 text-xs font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Today
            </Link>
            <Link
              href={`/merchant?month=${nextMonth}`}
              aria-label="Next month"
              className="grid size-9 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              →
            </Link>
          </div>
        </div>
      </header>

      {nearestEvent && nearestMonthParam ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[color:var(--line)] bg-[color:var(--peach)]/40 px-5 py-3">
          <p className="text-sm font-bold text-[color:var(--surface-deep)]">
            No events in {heading}. Your nearest events are in {nearestMonthLabel}.
          </p>
          <Link
            href={`/merchant?month=${nearestMonthParam}`}
            className="inline-flex shrink-0 items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--champagne)] hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)]"
          >
            Jump to {nearestMonthLabel} →
          </Link>
        </div>
      ) : null}

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
            {cell.events.length === 1 ? " event" : " events"}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 grid gap-1">
        {cell.events.slice(0, 3).map((event) => (
          <CalendarEventChip key={event.slug} event={event} />
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

function CalendarEventChip({ event }: { event: MerchantEventSummary }) {
  const isFull = event.confirmed >= event.capacity;
  const display =
    event.status === "Cancelled"
      ? "Cancelled"
      : isPastEvent(event)
        ? "Ended"
        : isFull && event.status === "Live"
          ? "Full"
          : event.status;

  return (
    <Link
      href={`/merchant/events/${event.slug}`}
      className={`block rounded-md border-2 border-[color:var(--line)] px-1.5 py-1 hard-shadow-sm transition hover:-translate-y-[1px] hover:[box-shadow:3px_3px_0_0_var(--shadow-ink)] ${statusBadgeClass(event)}`}
    >
      <p className="line-clamp-1 text-[0.7rem] font-bold leading-tight">{event.title}</p>
      <p className="mt-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-80">
        {event.confirmed}/{event.capacity} · {display}
      </p>
    </Link>
  );
}
