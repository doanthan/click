import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MetricCard, Pill, SectionIntro } from "@/components/click-ui";
import { getBscDashboard } from "@/lib/bible-study";

export const metadata = {
  title: "Dashboard | Bible Study Connect",
};

export default async function DashboardPage() {
  let dashboard;
  try {
    dashboard = await getBscDashboard();
  } catch {
    redirect("/sign-in");
  }

  const profileComplete = !!dashboard.profile.displayName;
  const communityReady = profileComplete && dashboard.profile.ageVerified;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Dashboard"
          title={`Welcome${dashboard.profile.displayName ? `, ${dashboard.profile.displayName.split(" ")[0]}` : ""}.`}
          body="Your groups, events, prayer activity, testimonies, and notifications are gathered here."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Groups" value={dashboard.groups.length.toString()} tone="cream" />
          <MetricCard label="Events" value={dashboard.events.length.toString()} tone="peach" />
          <MetricCard label="Prayers" value={dashboard.prayers.length.toString()} tone="rose" />
          <MetricCard label="Unread" value={dashboard.notifications.filter((item) => !item.read).length.toString()} tone="ink" />
        </div>

        {!communityReady ? (
          <div className="mt-8 rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-5">
            <h2 className="font-display text-3xl font-light leading-tight">Community gate</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              Browsing is open. Joining groups, posting, chat, prayer, testimonies,
              events, and waitlist actions require a display name and age verification.
            </p>
            <Link
              href="/profile"
              className="mt-4 inline-flex rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-bold text-[color:var(--champagne)]"
            >
              Complete profile
            </Link>
          </div>
        ) : null}
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-5 lg:grid-cols-3">
        <DashboardPanel title="My groups" href="/groups">
          {dashboard.groups.length === 0 ? (
            <Empty text="Join a group to see it here." />
          ) : (
            dashboard.groups.map((group) => (
              <Row key={group.id} title={group.name} meta={group.schedule ?? group.city ?? "Group"} />
            ))
          )}
        </DashboardPanel>
        <DashboardPanel title="Upcoming events" href="/events">
          {dashboard.events.map((event) => (
            <Row key={event.id} title={event.title} meta={new Date(event.startsAt).toLocaleString("en-AU")} />
          ))}
        </DashboardPanel>
        <DashboardPanel title="Notifications" href="/notifications">
          {dashboard.notifications.length === 0 ? (
            <Empty text="No notifications yet." />
          ) : (
            dashboard.notifications.slice(0, 5).map((item) => (
              <Row key={item.id} title={item.title} meta={item.read ? "Read" : "Unread"} />
            ))
          )}
        </DashboardPanel>
      </section>
    </main>
  );
}

function DashboardPanel({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl font-light leading-tight">{title}</h2>
        <Link href={href}>
          <Pill>Open</Pill>
        </Link>
      </div>
      <div className="mt-5 grid gap-3">{children}</div>
    </article>
  );
}

function Row({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--line-soft)] bg-[color:var(--champagne)] p-3">
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs font-semibold text-[color:var(--mauve)]">{meta}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm font-semibold text-[color:var(--mauve)]">{text}</p>;
}
