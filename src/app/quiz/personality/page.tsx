import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { submitPersonalityQuizAction } from "./actions";

export const metadata = {
  title: "Personality Quiz | Click",
};

type PersonalityQuizPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const questions: {
  name: string;
  legend: string;
  options: { value: string; label: string; body: string }[];
}[] = [
  {
    name: "social_energy",
    legend: "Social energy",
    options: [
      { value: "introvert", label: "Introvert", body: "I refuel alone after socialising." },
      { value: "ambivert", label: "Ambivert", body: "Depends on the day and the room." },
      { value: "extrovert", label: "Extrovert", body: "I refuel by being around people." },
    ],
  },
  {
    name: "pace",
    legend: "Preferred pace",
    options: [
      { value: "relaxed", label: "Relaxed", body: "Long table, slow chat, no hurry." },
      { value: "balanced", label: "Balanced", body: "Light structure, some flow." },
      { value: "fast_moving", label: "Fast moving", body: "Stations, rotations, lots of motion." },
    ],
  },
  {
    name: "openness",
    legend: "Openness",
    options: [
      { value: "cautious", label: "Cautious", body: "Want to feel the room before I dive in." },
      { value: "curious", label: "Curious", body: "I’ll try most things once." },
      { value: "ready", label: "Ready", body: "All-in. New everything." },
    ],
  },
  {
    name: "frequency",
    legend: "How often you want to show up",
    options: [
      { value: "occasional", label: "Occasional", body: "One thing a month is plenty." },
      { value: "active", label: "Active", body: "About once a week." },
      { value: "enthusiastic", label: "Enthusiastic", body: "Multiple things a week." },
    ],
  },
];

export default async function PersonalityQuizPage({
  searchParams,
}: PersonalityQuizPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/quiz/personality");
  }
  const params = await searchParams;
  const error = params?.error === "incomplete";

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Personality Quiz
        </span>
        <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          Four questions. <span className="italic">One persona.</span>
        </h1>
        <p className="mt-3 text-base font-medium leading-7 text-[color:var(--mauve)]">
          We write a Click Persona we use to surface compatible plans.
        </p>

        {error ? (
          <p className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]">
            Pick one option from each section before submitting.
          </p>
        ) : null}

        <form action={submitPersonalityQuizAction} className="mt-10 space-y-8">
          {questions.map((q) => (
            <fieldset
              key={q.name}
              className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
            >
              <legend className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                {q.legend}
              </legend>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {q.options.map((opt) => (
                  <label
                    key={opt.value}
                    className="cursor-pointer rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 hard-shadow-sm has-[input:checked]:bg-[color:var(--rose)] has-[input:checked]:text-[color:var(--surface-deep)]"
                  >
                    <input
                      type="radio"
                      name={q.name}
                      value={opt.value}
                      required
                      className="sr-only"
                    />
                    <span className="block text-sm font-bold uppercase tracking-wide">
                      {opt.label}
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 opacity-80">
                      {opt.body}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
            <legend className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Intent mix · split 100 across these
            </legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(["friendship", "dating", "networking", "exploring"] as const).map((intent) => (
                <label
                  key={intent}
                  className="grid gap-2 text-sm font-bold text-[color:var(--ink)]"
                >
                  <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    {intent}
                  </span>
                  <input
                    type="number"
                    name={`intent_${intent}`}
                    min={0}
                    max={100}
                    defaultValue={25}
                    className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)]"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Save Persona
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
