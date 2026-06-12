"use client";

import { useRouter } from "next/navigation";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SELECT_CLASS =
  "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1.5 text-xs font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)] focus:outline-none focus:ring-2 focus:ring-[color:var(--rose)]";

type MerchantCalendarJumpProps = {
  // 1-based month (1 = January) and full year currently being viewed.
  month: number;
  year: number;
};

export function MerchantCalendarJump({ month, year }: MerchantCalendarJumpProps) {
  const router = useRouter();

  const realYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = realYear - 1; y <= realYear + 2; y++) years.push(y);
  if (!years.includes(year)) {
    years.push(year);
    years.sort((a, b) => a - b);
  }

  function jump(nextMonth: number, nextYear: number) {
    const mm = String(nextMonth).padStart(2, "0");
    router.push(`/merchant?month=${nextYear}-${mm}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor="merchant-calendar-month">
        Jump to month
      </label>
      <select
        id="merchant-calendar-month"
        aria-label="Jump to month"
        value={month}
        onChange={(e) => jump(Number(e.target.value), year)}
        className={SELECT_CLASS}
      >
        {MONTH_NAMES.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="merchant-calendar-year">
        Jump to year
      </label>
      <select
        id="merchant-calendar-year"
        aria-label="Jump to year"
        value={year}
        onChange={(e) => jump(month, Number(e.target.value))}
        className={SELECT_CLASS}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
