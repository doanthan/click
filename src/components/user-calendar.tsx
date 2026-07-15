import Link from "next/link";
import { Icon } from "@/components/ds";
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
  // When provided, events whose id is NOT in this set are merely saved/bookmarked
  // (not an RSVP) and are chipped as "Saved" rather than "Confirmed". Omitted on
  // the dashboard/upcoming calendars, whose events are all confirmed RSVPs.
  registeredEventIds?: Set<string>;
};

function isoDateInSydney(date: Date) {
  // day MUST be "2-digit": with "numeric" the part comes back unpadded ("1"),
  // so the key "2026-07-1" never matched the grid cell's "2026-07-01" and any
  // event on the 1st–9th of a month silently vanished from the calendar grid
  // (bug board #80/#88 — "July events not showing", "Korean BBQ 4 June missing").
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

// Comparable month index (year * 12 + monthIndex) for an event, computed in the
// Sydney calendar so it lines up with the grid's day buckets.
function eventMonthIndex(event: EventItem) {
  const [yearStr, monthStr] = isoDateInSydney(new Date(event.startsAt)).split("-");
  return Number(yearStr) * 12 + (Number(monthStr) - 1);
}

function anchorMonthIndex(monthAnchor: Date) {
  return monthAnchor.getUTCFullYear() * 12 + monthAnchor.getUTCMonth();
}

// When the user hasn't picked a month, open on the current month — unless it has
// no events and there ARE future RSVPs. In that case jump to the soonest future
// event's month so plans that are weeks/months out (e.g. a July RSVP viewed in
// June) are visible immediately instead of looking like they never landed on the
// calendar. Past-only events still leave the anchor on today (never opens in the
// past).
function defaultMonthAnchor(events: EventItem[]): Date {
  const todayAnchor = parseMonthParam(undefined, new Date());
  const todayIndex = anchorMonthIndex(todayAnchor);

  const hasEventThisMonth = events.some(
    (event) => eventMonthIndex(event) === todayIndex,
  );
  if (hasEventThisMonth) return todayAnchor;

  const futureIndexes = events
    .map(eventMonthIndex)
    .filter((index) => index > todayIndex);
  if (futureIndexes.length === 0) return todayAnchor;

  const soonest = Math.min(...futureIndexes);
  return new Date(Date.UTC(Math.floor(soonest / 12), soonest % 12, 1));
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

// The chip vocabulary. Status colour lives here and nowhere else on the grid:
// Waitlist → Amber · You're going → Sage · Saved → Lavender · ended/cancelled →
// Slate on Mist. Never a coral, never a CTA colour.
function chipMeta(
  event: EventItem,
  registeredEventIds?: Set<string>,
): { label: string; className: string } {
  const isFull = event.attendees >= event.capacity;
  const end = new Date(event.endsAt ?? event.startsAt);
  const isPast = end.getTime() < Date.now();
  // Saved-but-not-RSVP'd: in the "Saved" view we pass the viewer's registered
  // set so a bookmarked event the user hasn't actually registered for reads
  // "Saved", not the misleading "Confirmed" (bug board #173).
  const isSavedOnly =
    registeredEventIds !== undefined && !registeredEventIds.has(event.id);

  const neutral = "bg-[color:var(--mist)] text-[color:var(--slate)]";

  // Cancelled events stay visible on the calendar (so a member isn't left
  // wondering where their RSVP went) but are clearly struck out, never shown as
  // "Waitlist"/"Confirmed".
  if (event.status === "Cancelled")
    return { label: "Cancelled", className: `${neutral} line-through` };
  // Past events are archived in-place as "Ended" so history reads clearly.
  if (isPast) return { label: "Ended", className: neutral };
  // A bookmarked event with no RSVP isn't "Confirmed"/"Waitlist" for this user -
  // it's just saved. A lavender chip so it reads as a maybe, not a booking.
  if (isSavedOnly)
    return {
      label: "Saved",
      className: "bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]",
    };
  if (event.status === "Waitlist" || isFull)
    return {
      label: "Waitlist",
      className:
        "bg-[color-mix(in_srgb,var(--amber)_16%,var(--paper))] text-[color:var(--amber-ink)]",
    };
  if (event.status === "Locked") return { label: "Locked", className: neutral };
  return {
    label: "You're going",
    className: "bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] text-[color:var(--sage)]",
  };
}

export function UserCalendar({
  events,
  monthParam,
  bookedSlug,
  basePath = "/dashboard/calendar",
  registeredEventIds,
}: UserCalendarProps) {
  // Default to the current month so the calendar opens on "today" rather than
  // the earliest RSVP's month (which, with past events included, could be far in
  // the past) — but if today's month is empty and there are future RSVPs, open on
  // the soonest one. The prev/next arrows + count dots page to other months.
  const monthAnchor = monthParam
    ? parseMonthParam(monthParam, new Date())
    : defaultMonthAnchor(events);
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
    <article className="overflow-hidden rounded-[20px] bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
      {bookedEvent ? (
        <div className="flex items-center gap-2 border-b border-[color:var(--mist)] bg-[color-mix(in_srgb,var(--sage)_10%,var(--paper))] px-5 py-3 text-[14px] font-semibold text-[color:var(--sage)]">
          <Icon name="check" size={16} stroke={2.6} />
          You&apos;re going to {bookedEvent.title}.
        </div>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5">
        <div>
          <h3 className="font-display text-[length:var(--text-h3)] font-semibold leading-tight tracking-[-0.01em] text-[color:var(--ink)]">
            {heading}
          </h3>
          <p className="mt-0.5 text-[13px] text-[color:var(--slate)]">
            {monthEvents.length} event{monthEvents.length === 1 ? "" : "s"} this month
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <MonthNav
            href={monthHref(prevMonth)}
            icon="chevL"
            count={eventsBeforeCount}
            label={
              eventsBeforeCount > 0
                ? `Previous month (${eventsBeforeCount} earlier event${eventsBeforeCount === 1 ? "" : "s"})`
                : "Previous month"
            }
          />
          <Link
            href={basePath}
            className="font-display rounded-[10px] border border-[color:var(--mist-strong)] px-3 py-1.5 text-[13px] font-semibold text-[color:var(--ink-soft)] transition-colors hover:bg-[color:var(--lavender-100)]"
          >
            Today
          </Link>
          <MonthNav
            href={monthHref(nextMonth)}
            icon="chevR"
            count={eventsAfterCount}
            label={
              eventsAfterCount > 0
                ? `Next month (${eventsAfterCount} later event${eventsAfterCount === 1 ? "" : "s"})`
                : "Next month"
            }
          />
        </div>
      </header>

      <div className="grid grid-cols-7 px-2">
        {WEEK_LABELS.map((label) => (
          <div
            key={label}
            className="pb-2 text-center text-[11.5px] font-semibold text-[color:var(--ink-faint)]"
          >
            <span className="sm:hidden">{label[0]}</span>
            <span className="max-sm:hidden">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-2 pb-3">
        {cells.map((cell) => (
          <CalendarDayCell
            key={cell.isoDate}
            cell={cell}
            registeredEventIds={registeredEventIds}
          />
        ))}
      </div>
    </article>
  );
}

// Month-nav arrow. The dot flags that this many RSVPs live in months you'd have
// to page to - otherwise a plan booked further out looks like it never landed.
function MonthNav({
  href,
  icon,
  count,
  label,
}: {
  href: string;
  icon: "chevL" | "chevR";
  count: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative grid size-9 place-items-center rounded-[10px] border border-[color:var(--mist-strong)] text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
    >
      <Icon name={icon} size={16} stroke={2.2} />
      {count > 0 ? (
        <span
          aria-hidden
          className="font-display absolute -right-1 -top-1 grid min-w-[17px] place-items-center rounded-full bg-[color:var(--purple)] px-1 text-[10px] font-bold leading-[17px] text-[color:var(--champagne)]"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function CalendarDayCell({
  cell,
  registeredEventIds,
}: {
  cell: CalendarCell;
  registeredEventIds?: Set<string>;
}) {
  const dayNumber = DAY_LABEL_FORMATTER.format(cell.date);
  return (
    <div
      className={`min-h-[104px] rounded-[11px] border p-1.5 ${
        cell.isToday
          ? "border-[color:var(--lavender)] bg-[color:var(--lavender-100)]"
          : cell.isCurrentMonth
            ? "border-[color:var(--mist)] bg-[color:var(--paper)]"
            : "border-transparent bg-[color:var(--champagne)]/60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-1 px-0.5">
        <span
          className={`text-[13px] tabular-nums ${
            cell.isToday
              ? "font-bold text-[color:var(--purple-700)]"
              : cell.isCurrentMonth
                ? "font-medium text-[color:var(--ink-soft)]"
                : "font-medium text-[color:var(--ink-faint)]"
          }`}
        >
          {dayNumber}
        </span>
        {cell.events.length > 0 ? (
          <span
            className="text-[11px] font-medium tabular-nums text-[color:var(--ink-faint)]"
            title={FULL_DATE_FORMATTER.format(cell.date)}
          >
            {cell.events.length}
          </span>
        ) : null}
      </div>

      <div className="mt-1 grid gap-1">
        {cell.events.slice(0, 3).map((event) => (
          <CalendarEventChip
            key={event.id}
            event={event}
            registeredEventIds={registeredEventIds}
          />
        ))}
        {cell.events.length > 3 ? (
          <p className="px-0.5 text-[11px] font-medium text-[color:var(--ink-faint)]">
            + {cell.events.length - 3} more
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CalendarEventChip({
  event,
  registeredEventIds,
}: {
  event: EventItem;
  registeredEventIds?: Set<string>;
}) {
  const { label, className } = chipMeta(event, registeredEventIds);

  return (
    <Link
      href={`/events/${event.id}`}
      title={`${event.title} · ${event.time} · ${label}`}
      className={`block rounded-[7px] px-1.5 py-1 transition-opacity hover:opacity-80 ${className}`}
    >
      <p className="line-clamp-1 text-[11.5px] font-semibold leading-tight">{event.title}</p>
      <p className="mt-px line-clamp-1 text-[10.5px] font-medium leading-tight opacity-85">
        {event.time} · {label}
      </p>
    </Link>
  );
}
