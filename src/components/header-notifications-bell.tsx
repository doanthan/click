"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function HeaderNotificationsBell({ unreadCount }: { unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // The /notifications page only ever lists the latest 50, so cap the count
  // surfaces here too — otherwise the bell claims a raw "1058 unread" the inbox
  // can never show, which reads as a bug (bug board #222). Badge already caps.
  const countLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Notifications (${countLabel} unread)`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-2 hard-shadow-sm hover:bg-[color:var(--peach)]"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[color:var(--ink)]"
          aria-hidden
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-[1.25rem] place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-1 text-[0.6rem] font-bold text-[color:var(--surface-deep)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-3 w-72 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow"
        >
          <div className="flex items-center justify-between gap-2 border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2">
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Notifications
            </span>
            {unreadCount > 0 ? (
              <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[color:var(--surface-deep)]">
                {countLabel} unread
              </span>
            ) : null}
          </div>
          <div className="space-y-2 p-4">
            <p className="text-sm font-medium leading-6 text-[color:var(--mauve)]">
              {unreadCount > 0
                ? `You have ${countLabel} unread notification${unreadCount === 1 ? "" : "s"}.`
                : "All caught up."}
            </p>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Open inbox
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
