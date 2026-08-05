"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// Click DS birth date picker. Mirrors the form's <input type="date">
// contract - `value` and `onChange` speak ISO yyyy-mm-dd, empty string for
// "no date" - but renders a custom calendar popover so it stops looking like
// the OS native dropdown.

type Mode = "days" | "years";

type Props = {
  value: string;                         // "yyyy-mm-dd" or ""
  onChange: (iso: string) => void;
  max: string;                           // "yyyy-mm-dd" - 18+ cutoff
  min?: string;                          // defaults to 1920-01-01
  describedBy?: string;
  labelledBy?: string;
  ref?: React.Ref<HTMLInputElement>;
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

// Forgiving free-text parser. Accepts day-first input with any non-digit
// separators - "10.10.88", "10/10/1988", "10-10-88", "10 10 1988" - plus
// pasted ISO "1988-10-10". Two-digit years pivot on the current year (so
// "88" → 1988, "05" → 2005). Returns ISO "yyyy-mm-dd" or null if it can't
// make a real calendar date out of the input.
function parseFlexible(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const parts = s.split(/[^\d]+/).filter(Boolean);
  if (parts.length !== 3) return null;

  let d: number, mo: number, y: number;
  if (parts[0].length === 4) {
    // yyyy-mm-dd (pasted ISO)
    [y, mo, d] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  } else {
    [d, mo, y] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    if (parts[2].length <= 2) {
      const nowYY = new Date().getFullYear() % 100;
      y = y <= nowYY ? 2000 + y : 1900 + y;
    }
  }

  const date = new Date(y, mo - 1, d);
  // Reject overflow like 31/02 or month 13.
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return toIso(date);
}

// Live input mask. Strips everything but digits, caps at 8 (ddmmyyyy), then
// regroups as "dd / mm / yyyy" - so the separators appear automatically as the
// user types numbers and they never need to press "/". Adds no trailing
// separator, so backspace deletes a digit cleanly instead of getting stuck on
// a " / ".
function maskInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join(" / ");
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Merge external ref (from the form's `firstFieldRef`) with the internal one
  // - the form focuses this on step entry, so it points at the text input.
  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref && typeof ref === "object") {
        (ref as React.RefObject<HTMLInputElement | null>).current = node;
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

  // Free-text the user is typing. Mirrors the committed value when not focused;
  // parsed + normalised on blur/Enter via commitText().
  const [text, setText] = useState(() => fmtDisplay(selected));
  const [focused, setFocused] = useState(false);

  // Sync the view back to a fresh external value (e.g. localStorage draft
  // hydration). This is the "external store -> React" sync pattern the rest
  // of the form uses for its draft restore - setting state in an effect is
  // the lesser evil over a layered derived-state dance.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selected) return;
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
    setCursor(selected);
  }, [selected]);

  // Keep the visible text in sync with the committed value whenever the user
  // isn't actively typing (external draft hydration, calendar picks, clear).
  useEffect(() => {
    if (focused) return;
    setText(fmtDisplay(selected));
  }, [selected, focused]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (wrapperRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      inputRef.current?.focus();
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
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function clear() {
    onChange("");
    setText("");
    setOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Parse + normalise the typed text. Commits a valid, in-range date and
  // reformats it to "dd / mm / yyyy"; otherwise snaps back to the last good
  // value so the field never sits in a half-typed/invalid state.
  function commitText() {
    const raw = text.trim();
    if (!raw) {
      onChange("");
      setText("");
      return;
    }
    const iso = parseFlexible(raw);
    const parsed = iso ? parseIso(iso) : null;
    if (parsed && parsed >= minDate && parsed <= maxDate) {
      onChange(iso!);
      setText(fmtDisplay(parsed));
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
      setCursor(parsed);
      return;
    }
    // Invalid or out of the 18+ range - revert to the committed value.
    setText(fmtDisplay(selected));
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

  return (
    <div className="relative">
      <div
        ref={wrapperRef}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border-[1.5px] bg-[color:var(--paper)] px-4 py-3 transition ${
          open || focused
            ? "border-[color:var(--purple)]"
            : "border-[color:var(--mist-strong)]"
        }`}
      >
        <input
          ref={setInputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="dd / mm / yyyy"
          aria-describedby={describedBy}
          aria-labelledby={labelledBy}
          value={text}
          onChange={(e) => setText(maskInput(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commitText();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
            }
          }}
          className={`tabular-nums w-full bg-transparent text-base tracking-[0.04em] outline-none placeholder:text-[color:var(--ink-faint)] ${
            text ? "text-[color:var(--ink)]" : "text-[color:var(--slate)]"
          }`}
        />
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Open calendar"
          onClick={() => {
            if (!open) setMode("days");
            setOpen((v) => !v);
          }}
          className="-mr-1 grid size-7 shrink-0 place-items-center rounded-lg transition hover:bg-[color:var(--peach-soft)]"
        >
          <CalendarIcon
            className={
              open ? "text-[color:var(--purple)]" : "text-[color:var(--ink)]"
            }
          />
        </button>
      </div>

      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Choose your birth date"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-[color:var(--paper)] p-3 shadow-[var(--shadow-md)]"
        >
          {/* Header - month label doubles as a toggle to the year grid */}
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
                    className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--slate)]"
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
                      className={`tabular-nums grid h-9 w-full place-items-center rounded-lg text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--purple)]/40 ${
                        isSelected
                          ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
                          : disabled
                            ? "cursor-not-allowed text-[color:var(--mauve)]/35 line-through"
                            : inMonth
                              ? "text-[color:var(--ink)] hover:bg-[color:var(--peach-soft)]"
                              : "text-[color:var(--mauve)]/55 hover:bg-[color:var(--peach-soft)]/60"
                      } ${
                        isCursor && !isSelected && !disabled
                          ? "ring-2 ring-[color:var(--purple)]/30"
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
                    className={`tabular-nums h-10 rounded-lg text-sm font-semibold transition ${
                      isSelected
                        ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
                        : isCurrent
                          ? "bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]"
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

          <div className="mt-2 flex items-center justify-between border-t border-[color:var(--line-soft)] px-1 pt-2">
            <button
              type="button"
              onClick={clear}
              className="text-[12.5px] font-semibold text-[color:var(--slate)] transition hover:text-[color:var(--purple)]"
            >
              Clear
            </button>
            <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
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
      ? 90
      : direction === "right"
        ? -90
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
