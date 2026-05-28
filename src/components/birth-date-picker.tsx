"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// Editorial-zine birth date picker. Mirrors the form's <input type="date">
// contract — `value` and `onChange` speak ISO yyyy-mm-dd, empty string for
// "no date" — but renders a custom calendar popover so it stops looking like
// the OS native dropdown.

type Mode = "days" | "years";

type Props = {
  value: string;                         // "yyyy-mm-dd" or ""
  onChange: (iso: string) => void;
  max: string;                           // "yyyy-mm-dd" — 18+ cutoff
  min?: string;                          // defaults to 1920-01-01
  describedBy?: string;
  labelledBy?: string;
  ref?: React.Ref<HTMLButtonElement>;
};

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Monday-first to match AU/EU convention (and the original screenshot).
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const DEFAULT_MIN = "1920-01-01";

function parseIso(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  // Reject 2024-02-31 etc.
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDisplay(d: Date | null): string {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day} / ${mon} / ${d.getFullYear()}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function BirthDatePicker({
  value,
  onChange,
  max,
  min = DEFAULT_MIN,
  describedBy,
  labelledBy,
  ref,
}: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Merge external ref (from the form's `firstFieldRef`) with the internal one.
  const setTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref && typeof ref === "object") {
        (ref as React.RefObject<HTMLButtonElement | null>).current = node;
      }
    },
    [ref],
  );

  const minDate = useMemo(() => parseIso(min) ?? new Date(1920, 0, 1), [min]);
  const maxDate = useMemo(() => parseIso(max) ?? new Date(), [max]);
  const selected = useMemo(() => parseIso(value), [value]);

  // What month the calendar is currently showing. Defaults to the selected
  // date, otherwise the 18+ cutoff month so the user lands somewhere useful.
  const [viewYear, setViewYear] = useState(() =>
    selected?.getFullYear() ?? maxDate.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(() =>
    selected?.getMonth() ?? maxDate.getMonth(),
  );

  // Roving-tabindex cursor for keyboard nav within the day grid.
  const [cursor, setCursor] = useState<Date>(
    () => selected ?? new Date(maxDate.getFullYear(), maxDate.getMonth(), 1),
  );

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("days");

  // Sync the view back to a fresh external value (e.g. localStorage draft
  // hydration). This is the "external store -> React" sync pattern the rest
  // of the form uses for its draft restore — setting state in an effect is
  // the lesser evil over a layered derived-state dance.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selected) return;
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
    setCursor(selected);
  }, [selected]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // On opening the day view, move focus into the grid so arrow keys work
  // without a Tab. (Defer one tick so the gridcell exists in the DOM.)
  useEffect(() => {
    if (!open || mode !== "days") return;
    const node = popoverRef.current?.querySelector<HTMLButtonElement>(
      '[role="gridcell"][tabindex="0"]',
    );
    const handle = window.setTimeout(() => node?.focus(), 10);
    return () => window.clearTimeout(handle);
  }, [open, mode]);

  // 42 cells (6 weeks × 7 days) for the current view.
  const matrix = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    // Monday-first: JS getDay() returns 0..6 (Sun..Sat); shift so Mon=0.
    const leading = (first.getDay() + 6) % 7;
    const start = new Date(viewYear, viewMonth, 1 - leading);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return {
        date: d,
        inMonth: d.getMonth() === viewMonth,
        disabled: d < minDate || d > maxDate,
      };
    });
  }, [viewYear, viewMonth, minDate, maxDate]);

  function pick(d: Date) {
    if (d < minDate || d > maxDate) return;
    onChange(toIso(d));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setCursor(d);
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function clear() {
    onChange("");
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    if (next > maxDate) {
      setViewYear(maxDate.getFullYear());
      setViewMonth(maxDate.getMonth());
      return;
    }
    if (next < new Date(minDate.getFullYear(), minDate.getMonth(), 1)) {
      setViewYear(minDate.getFullYear());
      setViewMonth(minDate.getMonth());
      return;
    }
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function shiftCursor(deltaDays: number) {
    const c = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + deltaDays,
    );
    if (c < minDate || c > maxDate) return;
    setCursor(c);
    if (c.getFullYear() !== viewYear || c.getMonth() !== viewMonth) {
      setViewYear(c.getFullYear());
      setViewMonth(c.getMonth());
    }
  }

  function onGridKey(e: React.KeyboardEvent) {
    // Index 0 = Mon … 6 = Sun in the Mon-first grid.
    const isoDow = (cursor.getDay() + 6) % 7;
    switch (e.key) {
      case "ArrowLeft":  e.preventDefault(); shiftCursor(-1); break;
      case "ArrowRight": e.preventDefault(); shiftCursor(1);  break;
      case "ArrowUp":    e.preventDefault(); shiftCursor(-7); break;
      case "ArrowDown":  e.preventDefault(); shiftCursor(7);  break;
      case "Home":       e.preventDefault(); shiftCursor(-isoDow); break;
      case "End":        e.preventDefault(); shiftCursor(6 - isoDow); break;
      case "PageUp":     e.preventDefault(); shiftMonth(-1); break;
      case "PageDown":   e.preventDefault(); shiftMonth(1);  break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(cursor);
        break;
    }
  }

  // 12 years per page (3×4 grid). Page is anchored so viewYear sits on it.
  const yearPageStart = useMemo(
    () => Math.floor(viewYear / 12) * 12,
    [viewYear],
  );

  function shiftYearPage(delta: number) {
    const target = yearPageStart + delta * 12 + 6; // aim at the page midpoint
    setViewYear(
      Math.max(minDate.getFullYear(), Math.min(maxDate.getFullYear(), target)),
    );
  }

  function chooseYear(y: number) {
    // If switching year would push the current month past the 18+ cutoff,
    // snap the month to the latest legal one for that year.
    let m = viewMonth;
    if (new Date(y, m, 1) > maxDate) m = maxDate.getMonth();
    if (new Date(y, m, 1) < new Date(minDate.getFullYear(), minDate.getMonth(), 1)) {
      m = minDate.getMonth();
    }
    setViewYear(y);
    setViewMonth(m);
    setMode("days");
  }

  const display = fmtDisplay(selected);

  return (
    <div className="relative">
      <button
        ref={setTriggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-labelledby={labelledBy}
        onClick={() => {
          if (!open) setMode("days");
          setOpen((v) => !v);
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 bg-[color:var(--cream)] px-4 py-3 text-left text-base font-semibold outline-none transition ${
          open
            ? "border-[color:var(--rose)]"
            : "border-[color:var(--line)] hover:bg-[color:var(--champagne)]"
        }`}
      >
        <span
          className={`tabular-nums tracking-[0.04em] ${
            display ? "text-[color:var(--ink)]" : "text-[color:var(--mauve)]"
          }`}
        >
          {display || "dd / mm / yyyy"}
        </span>
        <CalendarIcon
          className={open ? "text-[color:var(--rose)]" : "text-[color:var(--ink)]"}
        />
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Choose your birth date"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-3 hard-shadow-sm"
        >
          {/* Header — month label doubles as a toggle to the year grid */}
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => (mode === "days" ? shiftMonth(-1) : shiftYearPage(-1))}
              aria-label={mode === "days" ? "Previous month" : "Previous years"}
              className="grid size-8 place-items-center rounded-full text-[color:var(--ink)] transition hover:bg-[color:var(--peach-soft)]"
            >
              <ChevronIcon direction="left" />
            </button>

            <button
              type="button"
              onClick={() => setMode((m) => (m === "days" ? "years" : "days"))}
              aria-label={mode === "days" ? "Switch to year picker" : "Back to month"}
              className="font-display flex items-center gap-1.5 rounded-lg px-2 py-1 text-base font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--peach-soft)]"
            >
              {mode === "days" ? (
                <span className="tabular-nums">
                  {MONTHS_LONG[viewMonth]} {viewYear}
                </span>
              ) : (
                <span className="tabular-nums">
                  {yearPageStart} – {yearPageStart + 11}
                </span>
              )}
              <ChevronIcon direction={mode === "days" ? "down" : "up"} />
            </button>

            <button
              type="button"
              onClick={() => (mode === "days" ? shiftMonth(1) : shiftYearPage(1))}
              aria-label={mode === "days" ? "Next month" : "Next years"}
              className="grid size-8 place-items-center rounded-full text-[color:var(--ink)] transition hover:bg-[color:var(--peach-soft)]"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>

          {mode === "days" ? (
            <>
              <div className="mb-1 grid grid-cols-7 px-1">
                {DOW.map((label, i) => (
                  <span
                    key={`${label}-${i}`}
                    className="font-mono text-center text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div
                role="grid"
                aria-label="Pick a day"
                onKeyDown={onGridKey}
                className="grid grid-cols-7 gap-0.5"
              >
                {matrix.map(({ date, inMonth, disabled }) => {
                  const isSelected = selected ? sameDay(selected, date) : false;
                  const isCursor = sameDay(cursor, date);
                  return (
                    <button
                      key={toIso(date)}
                      type="button"
                      role="gridcell"
                      tabIndex={isCursor ? 0 : -1}
                      aria-selected={isSelected}
                      aria-disabled={disabled}
                      disabled={disabled}
                      onClick={() => pick(date)}
                      onFocus={() => setCursor(date)}
                      className={`tabular-nums grid h-9 w-full place-items-center rounded-lg text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]/40 ${
                        isSelected
                          ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)] hard-shadow-sm"
                          : disabled
                            ? "cursor-not-allowed text-[color:var(--mauve)]/35 line-through"
                            : inMonth
                              ? "text-[color:var(--ink)] hover:bg-[color:var(--peach-soft)]"
                              : "text-[color:var(--mauve)]/55 hover:bg-[color:var(--peach-soft)]/60"
                      } ${
                        isCursor && !isSelected && !disabled
                          ? "ring-2 ring-[color:var(--ink)]/30"
                          : ""
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div
              role="grid"
              aria-label="Pick a year"
              className="grid grid-cols-3 gap-1.5 p-1"
            >
              {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
                const disabled =
                  y < minDate.getFullYear() || y > maxDate.getFullYear();
                const isCurrent = y === viewYear;
                const isSelected = selected?.getFullYear() === y;
                return (
                  <button
                    key={y}
                    type="button"
                    role="gridcell"
                    disabled={disabled}
                    onClick={() => chooseYear(y)}
                    className={`tabular-nums h-10 rounded-lg text-sm font-bold transition ${
                      isSelected
                        ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)] hard-shadow-sm"
                        : isCurrent
                          ? "bg-[color:var(--peach)] text-[color:var(--ink)]"
                          : disabled
                            ? "cursor-not-allowed text-[color:var(--mauve)]/30"
                            : "text-[color:var(--ink)] hover:bg-[color:var(--peach-soft)]"
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t-2 border-[color:var(--line-soft)] px-1 pt-2">
            <button
              type="button"
              onClick={clear}
              className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)] transition hover:text-[color:var(--rose)]"
            >
              Clear
            </button>
            <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]/70">
              18+ only
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 3.5v3M16 3.5v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({
  direction,
}: {
  direction: "left" | "right" | "up" | "down";
}) {
  const rotation =
    direction === "left"
      ? -90
      : direction === "right"
        ? 90
        : direction === "up"
          ? 180
          : 0;
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      aria-hidden="true"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
