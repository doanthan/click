import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCard } from "@/components/event-card";
import { UserCalendar } from "@/components/user-calendar";
import { Pill } from "@/components/click-ui";
import {
  getConfirmedEvents,
  getProfileStatus,
} from "@/lib/event-repository";

export const metadata = {
  title: "Confirmed RSVPs | Click",
  description: "Your confirmed and past Click event RSVPs.",
};

type ConfirmedEventsPageProps = {
  searchParams?: Promise<{ tab?: string; month?: string }>;
};

export default async function ConfirmedEventsPage({ searchParams }: ConfirmedEventsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/confirmed-events");
  }

  const params = await searchParams;
  const tab = params?.tab === "past" ? "past" : "upcoming";

  const [confirmed, profileStatus] = await Promise.all([
    getConfirmedEvents(session),
    getProfileStatus(session),
  ]);
  const bookmarkSet = new Set(profileStatus.bookmarkedEventIds);
  const events = tab === "past" ? confirmed.past : confirmed.upcoming;

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Confirmed
        </span>
        <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          {tab === "past" ? "Plans you’ve been to." : "Plans on your calendar."}
        </h1>
        <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          {tab === "past"
            ? "Past RSVPs and waitlist offers, in case you want to revisit a host."
            : "RSVPs and active waitlists. Cancel from the event page if your plans change."}
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <TabLink active={tab === "upcoming"} href="/confirmed-events?tab=upcoming">
            Upcoming
            <Pill tone="peach">{confirmed.upcoming.length}</Pill>
          </TabLink>
          <TabLink active={tab === "past"} href="/confirmed-events?tab=past">
            Past
            <Pill tone="cream">{confirmed.past.length}</Pill>
          </TabLink>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Left column — RSVP list */}
          <div>
            <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              {tab === "past" ? "Past RSVPs" : "Your RSVPs"}
            </h2>
            {events.length > 0 ? (
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    bookmarked={bookmarkSet.has(event.id)}
                    registered
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-8 text-center">
                <p className="font-display text-3xl font-light leading-tight">
                  {tab === "past" ? "No past RSVPs yet." : "No upcoming RSVPs."}
                </p>
                <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                  {tab === "past"
                    ? "Once you’ve attended events they’ll land here."
                    : "RSVP to an event and it’ll show up here."}
                </p>
                <Link
                  href="/events"
                  className="mt-6 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
                >
                  Find events
                </Link>
              </div>
            )}
          </div>

          {/* Right column — calendar */}
          <div>
            <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              On your calendar
            </h2>
            <div className="mt-4 lg:sticky lg:top-6">
              <UserCalendar
                events={events}
                monthParam={params?.month}
                basePath={`/confirmed-events?tab=${tab}`}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function TabLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  const className = active
    ? "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm inline-flex items-center gap-2"
    : "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)] inline-flex items-center gap-2";
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
