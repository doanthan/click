import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCard } from "@/components/event-card";
import { Pill, SectionIntro } from "@/components/click-ui";
import {
  getDashboardData,
  getProfileStatus,
} from "@/lib/event-repository";

export const metadata = {
  title: "Confirmed events | Click",
  description: "Events you've RSVP'd to — upcoming and past.",
};

type Search = { tab?: string };

function currentTimestamp() {
  return Date.now();
}

export default async function ConfirmedEventsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/confirmed-events");
  }

  const { tab } = await searchParams;
  const activeTab = tab === "past" ? "past" : "upcoming";

  const [dashboard, profileStatus] = await Promise.all([
    getDashboardData(session),
    getProfileStatus(session),
  ]);

  const now = currentTimestamp();
  const upcoming = dashboard.upcomingEvents.filter(
    (event) => new Date(event.startsAt).getTime() >= now,
  );
  const past = dashboard.upcomingEvents.filter(
    (event) => new Date(event.startsAt).getTime() < now,
  );

  const bookmarkSet = new Set(profileStatus.bookmarkedEventIds);
  const visible = activeTab === "past" ? past : upcoming;

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <SectionIntro
          eyebrow="Your RSVPs"
          title={<>Confirmed <span className="italic">events.</span></>}
          body="Plans you have said yes to. Switch tabs to see what is behind you."
        />

        <div className="mt-8 flex items-center gap-2" role="tablist">
          <Link
            href="/confirmed-events?tab=upcoming"
            role="tab"
            aria-selected={activeTab === "upcoming"}
            className={
              activeTab === "upcoming"
                ? "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-2 text-sm font-bold text-[color:var(--champagne)] hard-shadow-sm"
                : "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            }
          >
            Upcoming
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--peach)] px-1.5 text-[0.65rem] text-[color:var(--surface-deep)]">
              {upcoming.length}
            </span>
          </Link>
          <Link
            href="/confirmed-events?tab=past"
            role="tab"
            aria-selected={activeTab === "past"}
            className={
              activeTab === "past"
                ? "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-2 text-sm font-bold text-[color:var(--champagne)] hard-shadow-sm"
                : "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            }
          >
            Past
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--mauve)] px-1.5 text-[0.65rem] text-[color:var(--champagne)]">
              {past.length}
            </span>
          </Link>
          <Pill tone="cream">
            {activeTab === "past" ? "Past events" : "Upcoming"}
          </Pill>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl">
        {visible.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {visible.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                compact
                bookmarked={bookmarkSet.has(event.id)}
                registered
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-8 text-center">
            <p className="font-display text-3xl font-light leading-tight">
              {activeTab === "past"
                ? "Nothing in the rear-view."
                : "No plans on the calendar."}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              {activeTab === "past"
                ? "Events you've attended will appear here once they've passed."
                : "RSVP to anything on Events and it shows up here."}
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm"
            >
              Find events →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
