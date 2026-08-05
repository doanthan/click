import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Icon } from "@/components/ds";
import { SubmitButton } from "@/components/ds-client";
import { getNotificationsForSession } from "@/lib/event-repository";
import { markAllReadAction } from "./actions";
import { NotificationItem } from "./notification-item";

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
            {/* The timestamp is formatted HERE, on the server, and passed down
                as a string: NotificationItem is a Client Component now, and
                running Intl in the browser against a different timezone than
                the render that produced the HTML is a hydration mismatch. */}
            {unread.map((n, i) => (
              <NotificationItem
                key={n.id}
                id={n.id}
                title={n.title}
                body={n.body}
                actionUrl={n.actionUrl}
                timestamp={dateFormatter.format(new Date(n.createdAt))}
                unread
                first={i === 0}
              />
            ))}

            {read.length > 0 ? (
              <p className="border-t border-[color:var(--line-soft)] px-4 pt-4 pb-2 text-[11.5px] font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]">
                Earlier
              </p>
            ) : null}
            {read.map((n) => (
              <NotificationItem
                key={n.id}
                id={n.id}
                title={n.title}
                body={n.body}
                actionUrl={n.actionUrl}
                timestamp={dateFormatter.format(new Date(n.createdAt))}
                unread={false}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
