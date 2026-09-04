"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/ds";
import { SubmitButton } from "@/components/ds-client";
import { markReadAction } from "./actions";

/**
 * Sits inside the Mark-read form purely so it can see that form's status.
 *
 * useFormStatus only reports on an ANCESTOR form, never a sibling, so the row
 * cannot read its own submit - this child reads it and hands it up. The moment
 * the submit starts, the row drops its unread styling; the round-trip plus
 * revalidate that follows only confirms what the user can already see.
 *
 * Nothing here is a second button: SubmitButton already owns the pending state
 * (aria-busy + the spinner, never `disabled`).
 */
function MarkReadSubmit({ onStarted }: { onStarted: () => void }) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending) onStarted();
  }, [pending, onStarted]);

  return (
    <SubmitButton variant="secondary" size="sm" pendingLabel="Marking…">
      Mark read
    </SubmitButton>
  );
}

/**
 * One row of the inbox.
 *
 * A client component only so the unread treatment can drop optimistically -
 * /notifications itself stays an async Server Component and still does all the
 * loading. `timestamp` arrives pre-formatted for that reason too: formatting it
 * here would run Intl against the browser's timezone after the server had
 * already rendered its own, which is a hydration mismatch on every row.
 */
export function NotificationItem({
  id,
  title,
  body,
  actionUrl,
  timestamp,
  unread,
  first,
}: {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  /** Already run through the page's Intl formatter, server-side. */
  timestamp: string;
  /** Server truth: whether this row is still unread in the database. */
  unread: boolean;
  first?: boolean;
}) {
  const [markedRead, setMarkedRead] = useState(false);
  const started = useCallback(() => setMarkedRead(true), []);
  // What the row LOOKS like. Server truth still decides whether the control is
  // there to press, so the form is never yanked out from under its own submit -
  // it keeps rendering its "Marking…" state and disappears on the revalidate.
  const showUnread = unread && !markedRead;

  return (
    // rise-soft unconditionally, never toggled on a state: an item that gets
    // marked read moves between the Unread and Earlier lists, so React remounts
    // it and the 8px rise replays - the reorder reads as movement instead of a
    // teleport. The resting state is fully visible either way.
    <div
      className={`rise-soft flex items-start gap-3 px-4 py-3.5 ${first ? "" : "border-t border-[color:var(--line-soft)]"} ${
        showUnread ? "bg-[color:var(--lavender-100)]" : ""
      }`}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
        <Icon name="bell" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-snug text-[color:var(--ink)] ${showUnread ? "font-semibold" : "font-medium"}`}
        >
          {title}
        </p>
        {body ? (
          <p className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--slate)]">{body}</p>
        ) : null}
        <p className="mt-1 text-[12px] text-[color:var(--ink-faint)]">{timestamp}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {actionUrl ? (
            <Link
              href={actionUrl}
              className="ck-taplink font-display text-[13px] font-semibold text-[color:var(--purple)] hover:underline"
            >
              View →
            </Link>
          ) : null}
          {/* "Open" sat beside "View" reading as its synonym. It actually shows
              the emailed copy of this notification, so it says so. */}
          <Link
            href={`/notifications/${id}/email`}
            className="ck-taplink font-display text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
          >
            Read the email
          </Link>
          {unread ? (
            // The one mutation in the row, so it is the one control that looks
            // like a button. Still a plain <form action={serverAction}>, which
            // is what keeps it working with JS off - the optimistic flip is
            // layered on top rather than replacing the submit.
            <form action={markReadAction}>
              <input type="hidden" name="notification_id" value={id} />
              <MarkReadSubmit onStarted={started} />
            </form>
          ) : null}
        </div>
      </div>
      {showUnread ? (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-[color:var(--purple)]" />
      ) : null}
    </div>
  );
}
