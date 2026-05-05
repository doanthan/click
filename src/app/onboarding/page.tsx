import { InfoCard, LinkButton, PageHero, Pill, SectionIntro } from "@/components/click-ui";
import {
  interestTagCategories,
  lifeQuizSections,
  musicTags,
  onboardingSteps,
} from "@/lib/click-data";

export const metadata = {
  title: "Onboarding | Click",
  description: "Click onboarding, profile setup, tags, and Life Quiz flow.",
};

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[#FFFCF9] text-[#340068]">
      <PageHero
        eyebrow="Onboarding"
        title="Warm enough to finish. Rich enough to match."
        body="The onboarding flow collects intent, basic identity, tags, verification, and optional quiz context without making the product feel clinical."
      >
        <div className="grid gap-3 rounded-lg border-2 border-white bg-[#FFFCF9] p-5 text-[#340068] shadow-[8px_8px_0_#B1EDE8]">
          {["Dating", "Friendship", "Networking", "Exploring"].map((mode, index) => (
            <div
              key={mode}
              className="flex items-center justify-between gap-4 border-b border-[#340068]/15 pb-3 last:border-0 last:pb-0"
            >
              <span className="font-black">{mode}</span>
              <span className={index === 1 ? "text-[#FF6978]" : "text-[#340068]/45"}>
                {index === 1 ? "Selected" : "Available"}
              </span>
            </div>
          ))}
        </div>
      </PageHero>

      <section className="bg-[#FFFCF9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Profile setup"
            title="A six-step path into the dashboard."
            body="Browsing is allowed early, but RSVP and Click actions stay behind email and photo verification gates."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {onboardingSteps.map((step, index) => (
              <article
                key={step}
                className="rounded-lg border-2 border-[#340068] bg-white p-5 shadow-[6px_6px_0_#340068]"
              >
                <p className="font-display text-5xl font-black leading-none text-[#FF6978]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-4 font-display text-3xl font-black leading-none">
                  {step}
                </h2>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-gradient-soft py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Life Quiz"
            title="The quiz turns life context into matching metadata."
            body="All questions are skippable. The output feeds Life Tags, Click Persona, availability, and event style preferences."
            invert
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {lifeQuizSections.map((section) => (
              <InfoCard
                key={section.title}
                title={section.title}
                body={section.output}
                accent="aqua"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#B1EDE8] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Interest Tags"
            title="Categories are friendly, but governance stays strict."
            body="Users and merchants can choose tags. Admins own definitions, merge duplicates, and prevent drift."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {interestTagCategories.map(([category, ...tags]) => (
              <article
                key={category}
                className="rounded-lg border-2 border-[#340068] bg-[#FFFCF9] p-5 shadow-[6px_6px_0_#340068]"
              >
                <h2 className="font-display text-3xl font-black leading-none">
                  {category}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Pill key={tag} tone="white">
                      {tag}
                    </Pill>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FFFCF9] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <SectionIntro
              eyebrow="Music Tags"
              title="A subtle cultural layer."
              body="Music affinity should influence compatibility without overpowering event intent, shared activity, and life context."
            />
            <div className="mt-8 flex flex-wrap gap-2">
              {musicTags.map((tag, index) => (
                <Pill key={tag} tone={index % 4 === 0 ? "pink" : index % 3 === 0 ? "aqua" : "white"}>
                  {tag}
                </Pill>
              ))}
            </div>
          </div>

          <form className="grid gap-4 rounded-lg border-2 border-[#340068] bg-white p-5 shadow-[8px_8px_0_#B1EDE8]">
            <label className="grid gap-2 text-sm font-black">
              Name
              <input
                className="rounded-lg border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                placeholder="Jordan Lee"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              Location
              <input
                className="rounded-lg border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                placeholder="Marrickville, Sydney"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              What should Click make easier?
              <textarea
                className="min-h-28 rounded-lg border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                placeholder="I want low-pressure ways to make friends after work."
              />
            </label>
            <LinkButton href="/dashboard">Activate dashboard</LinkButton>
          </form>
        </div>
      </section>
    </main>
  );
}
