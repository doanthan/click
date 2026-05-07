import { EventExplorer } from "@/components/event-explorer";
import { InfoCard, Pill, SectionIntro } from "@/components/click-ui";
import { categories } from "@/lib/click-data";
import { getEventsForExplore } from "@/lib/event-repository";

export const metadata = {
  title: "Events | Click",
  description: "Click events, RSVP states, hosted cards, and discovery filters.",
};

export default async function EventsPage() {
  const events = await getEventsForExplore();

  return (
    <main className="min-h-screen bg-[#fffdf7] text-[#1f1f1f]">
      <section className="brand-gradient relative overflow-hidden px-4 py-10 text-[#1f1f1f] sm:px-6">
        <div className="paper-grid absolute inset-0 opacity-70" />
        <div className="relative z-10 mx-auto grid max-w-7xl gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#008294]">
              Events
            </p>
            <h1 className="mt-3 text-5xl font-black leading-none sm:text-7xl">
              Find the easiest plan near you.
            </h1>
            <p className="mt-5 max-w-xl text-base font-bold leading-7 text-[#1f1f1f]/66">
              Search by vibe, suburb, food, date, or price. Quick picks surface
              restaurant meetups, free plans, and small groups without making
              people wrestle with filters.
            </p>
          </div>
          <div className="grid gap-3 rounded-xl border border-black/10 bg-white p-5 text-[#1f1f1f] shadow-sm md:grid-cols-3">
            {[
              ["Locked", "RSVP to unlock details."],
              ["Waitlist", "Confirm when a spot opens."],
              ["Unlocked", "Full location after RSVP."],
            ].map(([state, body]) => (
              <div key={state} className="rounded-lg border border-black/10 bg-white p-4">
                <p className="text-3xl font-black leading-none">{state}</p>
                <p className="mt-1 text-sm font-bold leading-5 text-[#1f1f1f]/62">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-[#d8f3ef]">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-5 sm:px-6">
          {categories.map((category, index) => (
            <Pill key={category} tone={index % 4 === 0 ? "pink" : "white"}>
              {category}
            </Pill>
          ))}
        </div>
      </section>

      <section className="bg-[#fffdf7] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <EventExplorer events={events} />
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
