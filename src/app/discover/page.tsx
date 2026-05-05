import { AIMatchPanel } from "@/components/ai-match-panel";
import { InfoCard, PageHero, Pill, SectionIntro } from "@/components/click-ui";
import { EventCard } from "@/components/event-card";
import { categories, clickEvents, peopleCards } from "@/lib/click-data";

export const metadata = {
  title: "Discover | Click",
  description: "AI-guided people and event discovery for Click.",
};

export default function DiscoverPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#FFFCF9] text-[#340068]">
      <PageHero
        eyebrow="Discover"
        title="Ask for the kind of people you want around you."
        body="The AI concierge converts natural language into compatible people, shared interests, and event suggestions without pushing users into private chat."
      >
        <div className="rounded-lg border-2 border-white bg-[#FFFCF9] p-5 text-[#340068] shadow-[8px_8px_0_#B1EDE8]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#340068]/45">
            Current rotation
          </p>
          <p className="mt-3 font-display text-4xl font-black leading-none">
            3 people cards every 4 hours
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-[#340068]/65">
            Ranked by intent, tags, persona, availability, proximity, and recent
            event behavior.
          </p>
        </div>
      </PageHero>

      <section className="brand-gradient-soft px-4 py-12 text-white sm:px-6">
        <AIMatchPanel defaultPrompt="I want to make new friends around Sydney" />
      </section>

      <section className="bg-[#B1EDE8] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((category, index) => (
              <Pill key={category} tone={index % 3 === 0 ? "pink" : index % 2 === 0 ? "aqua" : "white"}>
                {category}
              </Pill>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FFFCF9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Click with Someone"
            title="Private interest, public plans."
            body="A click stays anonymous. A mutual click unlocks a shared event suggestion and keeps the product oriented around meeting in the world."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-5">
            {peopleCards.map((person) => (
              <article
                key={person.id}
                className="rounded-lg border-2 border-[#340068] bg-white p-5 shadow-[6px_6px_0_#340068]"
              >
                <span
                  className={`grid size-14 place-items-center rounded-full border-4 border-[#340068] ${person.accent} font-black shadow-[4px_4px_0_#340068]`}
                >
                  {person.initials}
                </span>
                <h2 className="mt-4 font-display text-3xl font-black leading-none">
                  {person.name}
                </h2>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#340068]/45">
                  {person.neighborhood}
                </p>
                <p className="mt-3 text-sm font-bold leading-6 text-[#340068]/65">
                  {person.matchReason}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FFFCF9] pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Suggested for You"
            title="The event feed changes with the prompt."
            body="The current prototype uses deterministic scoring, matching the MVP limitation while leaving the screen ready for a server-side matching function."
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {clickEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-gradient-soft py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Recommendation logic"
            title="Why a card appears is always explainable."
            body="Every card can cite shared tags, life stage, availability, city proximity, RSVP behavior, and intent mode."
            invert
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <InfoCard
              eyebrow="Signal"
              title="Declared tags"
              body="Interest, music, and intent tags create the first matching layer."
            />
            <InfoCard
              eyebrow="Signal"
              title="Life quiz"
              body="Life Tags and persona traits add social energy, pace, availability, and context."
              accent="pink"
            />
            <InfoCard
              eyebrow="Signal"
              title="Behavior"
              body="Saves, RSVPs, clicks, and post-event feedback continuously refine future suggestions."
              accent="mauve"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
