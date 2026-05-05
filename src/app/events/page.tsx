import { EventCard } from "@/components/event-card";
import { InfoCard, PageHero, Pill, SectionIntro } from "@/components/click-ui";
import { categories, clickEvents } from "@/lib/click-data";

export const metadata = {
  title: "Events | Click",
  description: "Click events, RSVP states, FOMO cards, and discovery filters.",
};

export default function EventsPage() {
  return (
    <main className="min-h-screen bg-[#FFFCF9] text-[#340068]">
      <PageHero
        eyebrow="Events"
        title="The event is the relationship container."
        body="Every event page is state-aware: locked before RSVP, waitlisted when capacity is full, and unlocked once attendance is confirmed."
      >
        <div className="grid gap-4 rounded-lg border-2 border-white bg-[#FFFCF9] p-5 text-[#340068] shadow-[8px_8px_0_#B1EDE8]">
          {[
            ["Locked", "Approximate distance, FOMO signals, RSVP to unlock full details."],
            ["Waitlist", "Join without payment, then confirm fast when a spot opens."],
            ["Unlocked", "Full location, attendee context, and cancellation options."],
          ].map(([state, body]) => (
            <div key={state} className="border-b border-[#340068]/15 pb-3 last:border-0 last:pb-0">
              <p className="font-display text-3xl font-black leading-none">{state}</p>
              <p className="mt-1 text-sm font-bold leading-5 text-[#340068]/62">{body}</p>
            </div>
          ))}
        </div>
      </PageHero>

      <section className="border-y-4 border-[#340068] bg-[#B1EDE8]">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-5 sm:px-6">
          {categories.map((category, index) => (
            <Pill key={category} tone={index % 4 === 0 ? "pink" : "white"}>
              {category}
            </Pill>
          ))}
        </div>
      </section>

      <section className="bg-[#FFFCF9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Explore"
            title="Filters are useful. Signals make them feel alive."
            body="Event cards expose category, booking model, capacity, tags, life signals, and privacy-safe FOMO copy."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {clickEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-gradient-soft py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Booking and payments"
            title="Click-managed and external booking can coexist."
            body="The UI distinguishes certainty. Click-managed events can show exact capacity and Stripe status; external events stay conservative."
            invert
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <InfoCard
              eyebrow="MVP"
              title="Click-managed"
              body="Stripe payment must complete before RSVP confirmation, and capacity decrements only after success."
            />
            <InfoCard
              eyebrow="Phase 2"
              title="External booking"
              body="Book Now redirects to the merchant. Click tracks views, saves, clicks, and tag engagement only."
              accent="pink"
            />
            <InfoCard
              eyebrow="All events"
              title="Conflict prevention"
              body="A merchant cannot publish overlapping live events, regardless of who owns checkout."
              accent="mauve"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
