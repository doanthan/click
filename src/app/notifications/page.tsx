import { redirect } from "next/navigation";
import { SectionIntro } from "@/components/click-ui";
import { getBscNotifications } from "@/lib/bible-study";

export const metadata = {
  title: "Notifications | Bible Study Connect",
};

export default async function NotificationsPage() {
  let notifications;
  try {
    notifications = await getBscNotifications();
  } catch {
    redirect("/sign-in");
  }
  const unread = notifications.filter((item) => !item.read).length;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <SectionIntro
          eyebrow={unread ? `${unread} unread` : "All caught up"}
          title="Notifications."
          body="Community activity, join requests, admin actions, event updates, prayer activity, and waitlist matches appear here."
        />
        <div className="mt-10 grid gap-3">
          {notifications.length === 0 ? (
            <p className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-6 text-sm font-semibold text-[color:var(--mauve)]">
              No notifications yet.
            </p>
          ) : (
            notifications.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-5">
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">{item.body}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
