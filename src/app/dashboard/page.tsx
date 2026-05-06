import { auth } from "@/auth";
import { AIMatchPanel } from "@/components/ai-match-panel";
import { InfoCard, MetricCard, PageHero, Pill, SectionIntro } from "@/components/click-ui";
import { EventCard } from "@/components/event-card";
import { clickEvents, dashboardSections, notificationRows, peopleCards } from "@/lib/click-data";
import { getDashboardData } from "@/lib/event-repository";

export const metadata = {
  title: "Dashboard | Click",
  description: "Click user dashboard with upcoming events, Click Radar, and notifications.",
};

export default async function DashboardPage() {
  const session = await auth();
  const dashboard = await getDashboardData(session);
  const upcomingEvents = dashboard.upcomingEvents.length > 0
    ? dashboard.upcomingEvents
    : clickEvents.slice(0, 2);
  const radarEvents = clickEvents.slice(2, 5);

  return (
    <main className="min-h-screen bg-[#fffdf7] text-[#1f1f1f]">
      <PageHero
        eyebrow="Dashboard"
        title={`Plans and people for ${dashboard.userName}.`}
        body="The dashboard keeps upcoming plans, nearby signals, waitlists, and private clicks in one place without turning the product into another inbox."
      >
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Upcoming" value={dashboard.stats.upcoming.toString()} tone="white" />
          <MetricCard label="Saved" value={dashboard.stats.saved.toString()} tone="aqua" />
          <MetricCard label="Clicks" value={dashboard.stats.clicks.toString()} tone="pink" />
          <MetricCard label="Radar" value={dashboard.stats.radar} tone="white" />
        </div>
      </PageHero>

      <section className="bg-[#fffdf7] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Dashboard modules"
            title="Everything updates around events, not chats."
            body="Each surface helps someone decide what to attend next, who might be there, and what needs their attention."
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

      <section className="bg-[#d8f3ef] py-16">
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

      <section className="bg-[#fffdf7] py-16">
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
                className="rounded-lg border border-black/10 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f65858]">
                      {event.category} radar
                    </p>
                    <h2 className="mt-2 text-4xl font-black leading-none">
                      {event.title}
                    </h2>
                  </div>
                  <Pill tone={event.status === "Waitlist" ? "pink" : "aqua"}>
                    {event.status}
                  </Pill>
                </div>
                <p className="mt-4 text-sm font-bold leading-6 text-[#1f1f1f]/65">
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

          <div className="mt-10 overflow-hidden rounded-xl border border-white/20 bg-[#fffdf7] text-[#1f1f1f] shadow-sm">
            {notificationRows.map(([type, trigger, delivery]) => (
              <div
                key={type}
                className="grid gap-2 border-b border-black/10 p-4 last:border-0 md:grid-cols-[1fr_1.4fr_0.9fr]"
              >
                <span className="font-black">{type}</span>
                <span className="text-sm font-bold text-[#1f1f1f]/65">{trigger}</span>
                <span className="text-sm font-black text-[#f65858]">{delivery}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
