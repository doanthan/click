import { Pill, SectionIntro } from "@/components/click-ui";
import { listBscEvents } from "@/lib/bible-study";

export const metadata = {
  title: "Events | Bible Study Connect",
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function EventsPage() {
  const events = await listBscEvents();

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Events"
          title="Gatherings, studies, and community nights."
          body="Browse public events and group-specific events. Private group events are only visible to members."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {events.map((event) => (
            <article key={event.id} className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                    {dateFormatter.format(new Date(event.startsAt))}
                  </p>
                  <h2 className="font-display mt-2 text-3xl font-light leading-tight">{event.title}</h2>
                </div>
                <Pill tone={event.visibility === "group" ? "ink" : "peach"}>
                  {event.visibility}
                </Pill>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">{event.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {event.groupName ? <Pill>{event.groupName}</Pill> : null}
                {event.locationName ? <Pill>{event.locationName}</Pill> : null}
                {event.onlineLink ? <Pill>Online</Pill> : null}
                <Pill tone="rose">{event.goingCount} going</Pill>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
