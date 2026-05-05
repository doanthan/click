import { AIMatchPanel } from "@/components/ai-match-panel";
import { InfoCard, MetricCard, PageHero, Pill, SectionIntro } from "@/components/click-ui";
import { EventCard } from "@/components/event-card";
import { clickEvents, dashboardSections, notificationRows, peopleCards } from "@/lib/click-data";

export const metadata = {
  title: "Dashboard | Click",
  description: "Click user dashboard with upcoming events, Click Radar, and notifications.",
};

export default function DashboardPage() {
  const upcomingEvents = clickEvents.slice(0, 2);
  const radarEvents = clickEvents.slice(2, 5);

  return (
    <main className="min-h-screen bg-[#FFFCF9] text-[#340068]">
      <PageHero
        eyebrow="Dashboard"
        title="A control center for showing up."
        body="The dashboard combines event status, people recommendations, Click Radar, waitlists, and notifications without becoming a message inbox."
      >
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Upcoming" value="2" tone="white" />
          <MetricCard label="Saved" value="8" tone="aqua" />
          <MetricCard label="Clicks" value="14" tone="pink" />
          <MetricCard label="Radar" value="Live" tone="white" />
        </div>
      </PageHero>

      <section className="bg-[#FFFCF9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Dashboard modules"
            title="Everything updates around events, not chats."
            body="Each surface has a clear data source and refresh rhythm, ready for Supabase Realtime and TanStack Query."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {dashboardSections.map(([title, body], index) => (
              <InfoCard
                key={title}
                title={title}
                body={body}
                accent={index === 2 ? "pink" : "aqua"}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-gradient-soft px-4 py-14 text-white sm:px-6">
        <AIMatchPanel
          defaultPrompt="Someone I might click with around weekend coffee"
          showEvents={false}
          title="Click Radar"
        />
      </section>

      <section className="bg-[#B1EDE8] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Upcoming"
            title="Confirmed plans stay visible."
            body="Unlocked events can show full location, attendee context, and cancellation actions after RSVP verification."
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FFFCF9] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <SectionIntro
              eyebrow="Click Radar"
              title="Nearby signals without exposing private people."
              body="Radar frames events by aggregate overlap: tags, life stage, RSVP momentum, and compatibility clusters."
            />
            <div className="mt-8 flex flex-wrap gap-2">
              {peopleCards.slice(0, 4).map((person) => (
                <Pill key={person.id} tone="aqua">
                  {person.persona}
                </Pill>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            {radarEvents.map((event) => (
              <article
                key={event.id}
                className="rounded-lg border-2 border-[#340068] bg-white p-5 shadow-[6px_6px_0_#340068]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FF6978]">
                      {event.category} radar
                    </p>
                    <h2 className="mt-2 font-display text-4xl font-black leading-none">
                      {event.title}
                    </h2>
                  </div>
                  <Pill tone={event.status === "Waitlist" ? "pink" : "aqua"}>
                    {event.status}
                  </Pill>
                </div>
                <p className="mt-4 text-sm font-bold leading-6 text-[#340068]/65">
                  {event.fomo}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-gradient-soft py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Notifications"
            title="Warm nudges, strict privacy."
            body="Notifications move people toward real-world participation while keeping click interest anonymous until mutual."
            invert
          />

          <div className="mt-10 overflow-hidden rounded-lg border-2 border-white bg-[#FFFCF9] text-[#340068] shadow-[8px_8px_0_#B1EDE8]">
            {notificationRows.map(([type, trigger, delivery]) => (
              <div
                key={type}
                className="grid gap-2 border-b-2 border-[#340068] p-4 last:border-0 md:grid-cols-[1fr_1.4fr_0.9fr]"
              >
                <span className="font-black">{type}</span>
                <span className="text-sm font-bold text-[#340068]/65">{trigger}</span>
                <span className="text-sm font-black text-[#FF6978]">{delivery}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
