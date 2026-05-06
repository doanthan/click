import { AIMatchPanel } from "@/components/ai-match-panel";
import { InfoCard, Pill, SectionIntro } from "@/components/click-ui";
import { categories } from "@/lib/click-data";

export const metadata = {
  title: "Discover | Click",
  description: "Local people and event discovery for Click.",
};

export default function DiscoverPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fffdf7] text-[#1f1f1f]">
      <section className="brand-gradient-soft relative px-4 py-10 text-white sm:px-6 lg:py-14">
        <div className="paper-grid absolute inset-0 opacity-20" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mx-auto mb-7 max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#7edbd3]">
              Discover
            </p>
            <h1 className="mt-3 text-4xl font-black leading-none sm:text-6xl">
              Find a plan with a reason to talk.
            </h1>
          </div>
          <AIMatchPanel defaultPrompt="I want to make new friends around Sydney" />
        </div>
      </section>

      <section className="bg-[#d8f3ef] py-10">
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

      <section className="brand-gradient-soft py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Why this fits"
            title="The best suggestions feel obvious, not mysterious."
            body="Cards are grounded in shared interests, timing, place, social pace, and events where the first conversation has somewhere to start."
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
