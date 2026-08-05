import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Icon } from "@/components/ds";
import { SubmitButton } from "@/components/ds-client";
import { getNotificationsForSession } from "@/lib/event-repository";
import { markAllReadAction, markReadAction } from "./actions";

export const metadata = {
  title: "Notifications",
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/notifications");
  }

  const notifications = await getNotificationsForSession(session);
  const unread = notifications.filter((n) => !n.readAt);
  const read = notifications.filter((n) => n.readAt);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[720px] pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="font-display text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
              Notifications
            </h1>
            <p className="mt-1.5 text-sm font-medium text-[color:var(--slate)]">
              Mutual clicks, event reminders, and updates - a calm, positive-only feed.
            </p>
          </div>
          {unread.length > 0 ? (
            // Clearing the inbox wipes a whole band off the page, so the button
            // has to hold a real pending state - SubmitButton reads the form's
            // own status, no client component needed around it.
            <form action={markAllReadAction}>
              <SubmitButton variant="ghost" size="sm" pendingLabel="Marking…">
                Mark all as read
              </SubmitButton>
            </form>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <div className="mt-8 rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-12 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[color:var(--lavender-200)] text-[color:var(--purple)]">
              <Icon name="bell" size={20} />
            </span>
            <p className="mt-3 text-sm text-[color:var(--ink-soft)]">You&apos;re all caught up.</p>
          </div>
        ) : (
          <div className="mt-7 overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)]">
            {unread.length > 0 ? (
              <p className="px-4 pt-4 pb-2 text-[11.5px] font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]">
                Unread
              </p>
            ) : null}
            {unread.map((n, i) => (
              <NotificationItem key={n.id} {...n} unread first={i === 0} />
            ))}

            {read.length > 0 ? (
              <p className="border-t border-[color:var(--line-soft)] px-4 pt-4 pb-2 text-[11.5px] font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]">
                Earlier
              </p>
            ) : null}
            {read.map((n) => (
              <NotificationItem key={n.id} {...n} unread={false} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function NotificationItem({
  id,
  title,
  body,
  actionUrl,
  createdAt,
  unread,
  first,
}: {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  createdAt: string;
  unread: boolean;
  first?: boolean;
}) {
  const ts = new Date(createdAt);
  return (
    // rise-soft unconditionally, never toggled on a state: an item that gets
    // marked read moves between the Unread and Earlier lists, so React remounts
    // it and the 8px rise replays - the reorder reads as movement instead of a
    // teleport. The resting state is fully visible either way.
    <div
      className={`rise-soft flex items-start gap-3 px-4 py-3.5 ${first ? "" : "border-t border-[color:var(--line-soft)]"} ${
        unread ? "bg-[color:var(--lavender-100)]" : ""
      }`}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
        <Icon name="bell" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug text-[color:var(--ink)] ${unread ? "font-semibold" : "font-medium"}`}>
          {title}
        </p>
        {body ? <p className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--slate)]">{body}</p> : null}
        <p className="mt-1 text-[12px] text-[color:var(--ink-faint)]">{dateFormatter.format(ts)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {actionUrl ? (
            <Link href={actionUrl} className="font-display text-[13px] font-semibold text-[color:var(--purple)] hover:underline">
              View →
            </Link>
          ) : null}
          {/* "Open" sat beside "View" reading as its synonym. It actually shows
              the emailed copy of this notification, so it says so. */}
          <Link
            href={`/notifications/${id}/email`}
            className="font-display text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
          >
            Read the email
          </Link>
          {unread ? (
            // The one mutation in the row, so it is the one control that looks
            // like a button - and SubmitButton gives it the pending state the
            // bare submit never had.
            <form action={markReadAction}>
              <input type="hidden" name="notification_id" value={id} />
              <SubmitButton variant="secondary" size="sm" pendingLabel="Marking…">
                Mark read
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>
      {unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-[color:var(--purple)]" /> : null}
    </div>
  );
}
