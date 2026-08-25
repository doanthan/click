import Link from "next/link";
import type { MerchantEventSummary } from "@/lib/event-repository";
import { MerchantCalendarJump } from "./merchant-calendar-jump";
import { merchantEventDisplayStatus, merchantStatusLabel } from "./merchant-ds";

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
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  timeZone: SYDNEY_TZ,
});
const TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
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
  // 1st-9th of a month vanish from the grid (same bug as user-calendar, #88).
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
  // Chronological within the day. The source list is ordered for the events
  // tab, not for a day cell, so two events on the same date could otherwise
  // read 8pm above 6pm - which matters most on the agenda, where the time is
  // the first thing on the row.
  for (const dayEvents of eventsByDate.values()) {
    dayEvents.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
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

// DS status tints (badge vocabulary): live sage, pending/waitlist amber,
// cancelled/ended neutral, locked lavender. Status colour stays on these chips.
function statusBadgeClass(event: MerchantEventSummary) {
  const isFull = event.confirmed >= event.capacity;
  if (event.status === "Cancelled")
    return "bg-[color:var(--mist)] text-[color:var(--slate)] line-through";
  // Past events read as muted "Ended" chips so the merchant can still see their
  // history on the calendar without it competing with live/upcoming events.
  if (isPastEvent(event)) return "bg-[color:var(--mist)] text-[color:var(--slate)]";
  if (event.status === "Pending" || isFull || event.status === "Waitlist")
    return "bg-[color-mix(in_srgb,var(--amber)_16%,var(--paper))] text-[color:var(--amber-ink)]";
  if (event.status === "Locked")
    return "bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]";
  // Rejected had no branch, so it fell through to the sage "live" tint and a
  // host scanning their month saw a rejected event wearing the same green as a
  // published one. Coral is the DS's cancelled/rejected role, and it stays on
  // the chip - which is a badge, never a CTA.
  if (event.status === "Rejected")
    return "bg-[color-mix(in_srgb,var(--coral)_16%,var(--paper))] text-[color:var(--coral-ink)]";
  return "bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] text-[color:var(--sage-ink)]";
}

export function MerchantCalendar({ events, monthParam }: MerchantCalendarProps) {
  // Default to the CURRENT month (not the earliest event) so the calendar always
  // opens on "today" - otherwise a merchant with old past events lands months in
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

  // Reuses `cells` rather than re-bucketing the events, so the agenda and the
  // grid can never disagree about which Sydney day an event falls on.
  const agendaDays = cells.filter(
    (cell) => cell.isCurrentMonth && cell.events.length > 0,
  );

  const monthConfirmed = monthEvents.reduce((sum, event) => sum + event.confirmed, 0);
  const monthCapacity = monthEvents.reduce((sum, event) => sum + event.capacity, 0);

  // When the viewed month is empty but the merchant DOES have events elsewhere,
  // surface a one-click jump to the month nearest to today - otherwise a host
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
    <article className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] px-5 py-4">
        <div>
          <p className="eyebrow">Hosting calendar</p>
          <h3 className="font-display mt-1 text-2xl font-semibold leading-tight text-[color:var(--ink)] sm:text-3xl">
            {heading}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3 py-1 text-xs font-medium text-[color:var(--slate)]">
            {monthEvents.length} event{monthEvents.length === 1 ? "" : "s"} ·{" "}
            {monthConfirmed}/{monthCapacity} booked
          </span>
          <MerchantCalendarJump
            month={monthAnchor.getUTCMonth() + 1}
            year={monthAnchor.getUTCFullYear()}
          />
          <div className="flex items-center gap-1.5">
            <Link
              href={`/merchant?month=${prevMonth}`}
              aria-label="Previous month"
              className="grid size-9 place-items-center rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
            >
              ←
            </Link>
            <Link
              href="/merchant"
              className="rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
            >
              Today
            </Link>
            <Link
              href={`/merchant?month=${nextMonth}`}
              aria-label="Next month"
              className="grid size-9 place-items-center rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
            >
              →
            </Link>
          </div>
        </div>
      </header>

      {nearestEvent && nearestMonthParam ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--line)] bg-[color:var(--lavender-100)] px-5 py-3">
          <p className="text-sm font-medium text-[color:var(--ink)]">
            No events in {heading}. Your nearest events are in {nearestMonthLabel}.
          </p>
          <Link
            href={`/merchant?month=${nearestMonthParam}`}
            className="ck-btn ck-btn--primary ck-btn--sm shrink-0"
          >
            Jump to {nearestMonthLabel} →
          </Link>
        </div>
      ) : null}

      {/* Below md the seven-column grid is not a calendar, it is seven 45px
          columns of clipped text: a 375px phone leaves each cell ~50px wide, so
          a title at 0.7rem line-clamps to a couple of characters and the
          "12/20 · Live" line under it does not fit at all. A host checking
          their month on the way to a venue gets an agenda instead - the same
          events, the same chips, in a column that has room for them. */}
      <ol className="md:hidden">
        {agendaDays.length === 0 ? (
          <li className="px-5 py-7 text-sm font-medium text-[color:var(--slate)]">
            Nothing on in {heading}.
          </li>
        ) : (
          agendaDays.map((day) => (
            <li
              key={day.isoDate}
              className="flex gap-3.5 border-b border-[color:var(--line-soft)] px-4 py-3.5 last:border-b-0"
            >
              <div className="w-11 shrink-0 text-center">
                <span
                  className={`grid size-9 place-items-center rounded-xl text-[15px] font-semibold tabular-nums ${
                    day.isToday
                      ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
                      : "bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]"
                  }`}
                >
                  {DAY_LABEL_FORMATTER.format(day.date)}
                </span>
                <span className="mt-1 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[color:var(--slate)]">
                  {WEEKDAY_FORMATTER.format(day.date)}
                </span>
              </div>
              <div className="grid min-w-0 flex-1 gap-1.5">
                {day.events.map((event) => (
                  <AgendaEventRow key={event.slug} event={event} />
                ))}
              </div>
            </li>
          ))
        )}
      </ol>

      <div className="hidden grid-cols-7 border-b border-[color:var(--line)] bg-[color:var(--champagne)] md:grid">
        {WEEK_LABELS.map((label) => (
          <div
            key={label}
            className="px-3 py-2 text-xs font-semibold text-[color:var(--slate)]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="hidden grid-cols-7 md:grid">
        {cells.map((cell) => (
          <CalendarDayCell key={cell.isoDate} cell={cell} />
        ))}
      </div>
    </article>
  );
}

// One agenda row per event, phone-sized: the chip's own status tint, the time,
// the title on a line of its own, and the booked count. Same destination and
// the same tint vocabulary as the desktop chip, so the two views cannot say
// different things about the same event.
function AgendaEventRow({ event }: { event: MerchantEventSummary }) {
  const display = merchantStatusLabel(merchantEventDisplayStatus(event));

  return (
    <Link
      href={`/merchant/events/${event.slug}`}
      className={`block rounded-xl px-3 py-2 transition active:translate-y-[1px] ${statusBadgeClass(event)}`}
    >
      <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">
        {event.title}
      </p>
      <p className="mt-0.5 text-[11.5px] font-medium">
        {TIME_FORMATTER.format(new Date(event.startsAt))} · {event.confirmed}/
        {event.capacity} booked · {display}
      </p>
    </Link>
  );
}

function CalendarDayCell({ cell }: { cell: CalendarCell }) {
  const dayNumber = DAY_LABEL_FORMATTER.format(cell.date);
  return (
    <div
      className={`min-h-28 border-b border-r border-[color:var(--line-soft)] p-2 ${
        cell.isCurrentMonth
          ? "bg-[color:var(--paper)]"
          : "bg-[color:var(--champagne)]"
      } last:border-r-0`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={`text-xs font-semibold ${
            cell.isToday
              ? "grid size-6 place-items-center rounded-full bg-[color:var(--purple)] text-[color:var(--champagne)]"
              : cell.isCurrentMonth
                ? "text-[color:var(--ink)]"
                : "text-[color:var(--slate)]/60"
          }`}
        >
          {dayNumber}
        </span>
        {cell.events.length > 0 ? (
          <span
            className="text-[11px] font-medium text-[color:var(--slate)]"
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
          <p className="text-[11px] font-medium text-[color:var(--slate)]">
            + {cell.events.length - 3} more
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CalendarEventChip({ event }: { event: MerchantEventSummary }) {
  // One derivation for the whole portal - see merchantEventDisplayStatus. This
  // used to be a fourth private copy, and the Rejected case was missing from
  // every one of them here (statusBadgeClass fell through to the live tint).
  const display = merchantStatusLabel(merchantEventDisplayStatus(event));

  return (
    <Link
      href={`/merchant/events/${event.slug}`}
      className={`block rounded-lg px-1.5 py-1 transition hover:-translate-y-[1px] hover:shadow-[var(--shadow-xs)] ${statusBadgeClass(event)}`}
    >
      <p className="line-clamp-1 text-[0.7rem] font-semibold leading-tight">{event.title}</p>
      <p className="mt-0.5 text-[0.62rem] font-medium text-[color:var(--ink)]">
        {event.confirmed}/{event.capacity} · {display}
      </p>
    </Link>
  );
}
