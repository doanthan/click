"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./ds";

export function HeaderNotificationsBell({ unreadCount }: { unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // The /notifications page only ever lists the latest 50, so cap the count
  // surfaced here too - otherwise the bell claims a raw "1058 unread" the inbox
  // can never show, which reads as a bug (bug board #222).
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
        className="relative flex size-9 items-center justify-center rounded-full text-[color:var(--ink-soft)] transition-colors hover:bg-[color:var(--lavender-100)]"
      >
        <Icon name="bell" size={20} />
        {/* Unread dot is Deep Purple - the brand's one accent, never a status hue. */}
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1.5 grid min-w-[16px] place-items-center rounded-full bg-[color:var(--purple)] px-1 text-[10px] leading-4 font-bold text-[color:var(--champagne)] shadow-[0_0_0_2px_var(--champagne)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] shadow-[0_18px_44px_rgba(76,55,140,0.18)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--line-soft)] px-4 py-3">
            <span className="font-display text-[15px] font-semibold text-[color:var(--ink)]">Notifications</span>
            {unreadCount > 0 ? (
              <span className="text-[12.5px] font-medium text-[color:var(--slate)]">{countLabel} unread</span>
            ) : null}
          </div>
          <div className="p-4">
            <p className="text-sm leading-relaxed text-[color:var(--ink-soft)]">
              {unreadCount > 0
                ? `You have ${countLabel} unread notification${unreadCount === 1 ? "" : "s"}.`
                : "You're all caught up."}
            </p>
            <Link href="/notifications" onClick={() => setOpen(false)} className="ck-btn ck-btn--sm ck-btn--primary mt-3 w-full">
              <span className="ck-btn__label">Open inbox</span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
