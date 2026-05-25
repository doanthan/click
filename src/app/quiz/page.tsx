import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLatestPersonaForSession } from "@/lib/event-repository";

export const metadata = {
  title: "Quizzes | Click",
};

export default async function QuizIndexPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/quiz");
  }

  const persona = await getLatestPersonaForSession(session);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Quizzes
        </span>
        <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          Two quick quizzes that change what Click suggests.
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          Neither is required — both make our suggestions sharper. Three minutes
          each, no right answers.
        </p>

        {persona ? (
          <div className="mt-8 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] p-5 text-[color:var(--surface-deep)] hard-shadow-sm">
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em]">
              Latest persona
            </p>
            <h2 className="font-display mt-2 text-3xl font-light leading-tight">
              {persona.personaName}
            </h2>
            <p className="mt-2 text-sm font-bold">
              {persona.socialEnergy} · {persona.pace} pace · {persona.openness} ·
              {" "}{persona.engagementFrequency}
            </p>
          </div>
        ) : null}

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <QuizCard
            eyebrow="Life Quiz"
            title="Where you’re at right now."
            body="Life stage, availability, event style — adds 'life tags' that pull the right rooms toward you."
            cta="Take the Life Quiz"
            href="/quiz/life"
            tone="peach"
          />
          <QuizCard
            eyebrow="Personality Quiz"
            title="How you click with rooms."
            body="Social energy, pace, openness, frequency. Writes a Click Persona we use to surface compatible plans."
            cta="Take the Personality Quiz"
            href="/quiz/personality"
            tone="ink"
          />
        </div>
      </section>
    </main>
  );
}

function QuizCard({
  eyebrow,
  title,
  body,
  cta,
  href,
  tone,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  tone: "peach" | "ink";
}) {
  const bg = tone === "peach" ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]" : "bg-[color:var(--ink)] text-[color:var(--on-deep)]";
  return (
    <div className={`rounded-3xl border-2 border-[color:var(--line)] p-6 hard-shadow ${bg}`}>
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] opacity-80">
        {eyebrow}
      </span>
      <h3 className="font-display mt-3 text-3xl font-light leading-tight">
        {title}
      </h3>
      <p className="mt-3 text-sm font-medium leading-6 opacity-90">{body}</p>
      <Link
        href={href}
        className="mt-6 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--champagne)]"
      >
        {cta}
      </Link>
    </div>
  );
}
