import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Pill } from "@/components/click-ui";
import { getNotificationsForSession } from "@/lib/event-repository";
import { markAllReadAction, markReadAction } from "./actions";

export const metadata = {
  title: "Notifications | Click",
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
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="sticker sticker--peach tilt-l-2 inline-flex">
              <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
              Inbox
            </span>
            <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
              Notifications
            </h1>
            <p className="mt-3 text-base font-medium leading-7 text-[color:var(--mauve)]">
              Mutual Clicks, event reminders, and admin updates.
            </p>
          </div>
          {unread.length > 0 ? (
            <form action={markAllReadAction}>
              <button
                type="submit"
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
              >
                Mark all read
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-8">
          <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            Unread <Pill tone="rose">{unread.length}</Pill>
          </h2>
          {unread.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {unread.map((n) => (
                <NotificationItem key={n.id} {...n} unread />
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              All caught up.
            </p>
          )}
        </div>

        <div className="mt-10">
          <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Earlier <Pill tone="cream">{read.length}</Pill>
          </h2>
          {read.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {read.map((n) => (
                <NotificationItem key={n.id} {...n} unread={false} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              Nothing yet. Notifications you read will land here.
            </p>
          )}
        </div>
      </section>
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
}: {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  createdAt: string;
  unread: boolean;
}) {
  const ts = new Date(createdAt);
  return (
    <li
      className={`rounded-2xl border-2 border-[color:var(--line)] p-4 hard-shadow-sm ${
        unread ? "bg-[color:var(--peach)]" : "bg-[color:var(--champagne)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-light leading-snug text-[color:var(--ink)]">
            {title}
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            {body}
          </p>
          <p className="mt-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            {dateFormatter.format(ts)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {actionUrl ? (
            <Link
              href={actionUrl}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Open
            </Link>
          ) : null}
          {unread ? (
            <form action={markReadAction}>
              <input type="hidden" name="notification_id" value={id} />
              <button
                type="submit"
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
              >
                Mark read
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}
