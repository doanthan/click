import { AIMatchPanel } from "@/components/ai-match-panel";
import { InfoCard, Pill, SectionIntro } from "@/components/click-ui";
import { categories } from "@/lib/click-data";

export const metadata = {
  title: "Discover | Click",
  description: "Local people and event discovery for Click.",
};

export default function DiscoverPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="relative overflow-hidden bg-[color:var(--surface-deep)] px-4 py-12 text-[color:var(--on-deep)] sm:px-6 lg:py-16">
        <div className="confetti-field absolute inset-0 opacity-20" aria-hidden />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <span className="sticker sticker--peach tilt-l-2">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Click discovery
          </span>
          <h1 className="font-display mt-5 text-5xl font-light leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Find a plan with a{" "}
            <span className="italic text-[color:var(--peach)]">reason to talk.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base font-medium leading-7 text-[color:var(--on-deep)]/72 sm:text-lg">
            Tell Click what you want — friendship, a slow date, a fitness mate,
            a creative crew. We surface events and people that fit how you
            actually like to show up.
          </p>
        </div>
      </section>

      <section className="bg-[color:var(--champagne)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <AIMatchPanel defaultPrompt="I want to make new friends around Sydney" />
        </div>
      </section>

      <section className="bg-[color:var(--peach)] py-10">
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

      <section className="bg-[color:var(--surface-deep)] py-16 text-[color:var(--on-deep)]">
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
