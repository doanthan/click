import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { submitLifeQuizAction } from "./actions";

export const metadata = {
  title: "Life Quiz | Click",
};

const sections: { title: string; output: string; options: { slug: string; label: string }[] }[] = [
  {
    title: "Life stage",
    output: "Pulls events tagged for similar moments.",
    options: [
      { slug: "new-to-town", label: "New to town" },
      { slug: "pet-owner", label: "Pet owner" },
      { slug: "new-parent", label: "New parent" },
      { slug: "traveller", label: "Traveller / nomad" },
      { slug: "career-pivot", label: "Career pivot" },
      { slug: "rebuilding", label: "Rebuilding after a chapter" },
    ],
  },
  {
    title: "Availability",
    output: "When you’re likely to actually show up.",
    options: [
      { slug: "weeknights", label: "Weeknights" },
      { slug: "weekends", label: "Weekends" },
      { slug: "mornings", label: "Mornings" },
      { slug: "flexible-schedule", label: "Flexible schedule" },
    ],
  },
  {
    title: "Event style",
    output: "Rooms that match your energy.",
    options: [
      { slug: "small-table", label: "Small table" },
      { slug: "active", label: "Active / outdoors" },
      { slug: "creative", label: "Creative / hands-on" },
      { slug: "high-energy", label: "High energy" },
      { slug: "quiet-setting", label: "Quiet setting" },
    ],
  },
  {
    title: "Energy and mood",
    output: "Where you’re at right now.",
    options: [
      { slug: "curious", label: "Curious" },
      { slug: "cautious", label: "Cautious" },
      { slug: "ready", label: "Ready" },
      { slug: "rebuilding-confidence", label: "Rebuilding confidence" },
    ],
  },
];

export default async function LifeQuizPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/quiz/life");
  }

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Life Quiz
        </span>
        <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          Tap what fits. <span className="italic">Skip what doesn’t.</span>
        </h1>
        <p className="mt-3 text-base font-medium leading-7 text-[color:var(--mauve)]">
          Your answers become tags on your profile. We use them to surface
          events with overlap.
        </p>

        <form action={submitLifeQuizAction} className="mt-10 space-y-8">
          {sections.map((section) => (
            <fieldset
              key={section.title}
              className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
            >
              <legend className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                {section.title} · {section.output}
              </legend>
              <div className="mt-4 flex flex-wrap gap-2">
                {section.options.map((opt) => (
                  <label
                    key={opt.slug}
                    className="cursor-pointer rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm has-[input:checked]:bg-[color:var(--rose)] has-[input:checked]:text-[color:var(--surface-deep)]"
                  >
                    <input
                      type="checkbox"
                      name="tag"
                      value={opt.slug}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Save Life Quiz tags
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
