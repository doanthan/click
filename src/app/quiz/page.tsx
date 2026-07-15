import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ButtonLink, Icon } from "@/components/ds";
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
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[760px] pt-6">
        <h1 className="font-display text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
          Two quick quizzes that change what Click suggests.
        </h1>
        <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-[color:var(--slate)]">
          Neither is required - both make our suggestions sharper. Three minutes each, no right answers.
        </p>

        {persona ? (
          <div className="mt-6 rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] p-5">
            <p className="text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--purple-700)]">Latest persona</p>
            <h2 className="font-display mt-1.5 text-[1.3rem] font-semibold text-[color:var(--ink)]">
              {persona.personaName}
            </h2>
            <p className="mt-1.5 text-sm text-[color:var(--ink-soft)]">
              {persona.socialEnergy} · {persona.pace} pace · {persona.openness} · {persona.engagementFrequency}
            </p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <QuizCard
            eyebrow="Life quiz"
            title="Where you're at right now."
            body="Life stage, availability, event style - so the right rooms come to you."
            cta="Take the Life quiz"
            href="/quiz/life"
          />
          <QuizCard
            eyebrow="Personality quiz"
            title="How you click with rooms."
            body="Social energy, pace, openness, frequency. Writes a Click persona we use to surface compatible plans."
            cta="Take the Personality quiz"
            href="/quiz/personality"
          />
        </div>
      </div>
    </main>
  );
}

function QuizCard({
  eyebrow,
  title,
  body,
  cta,
  href,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="flex flex-col rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)]">
      <span className="flex size-11 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
        <Icon name="help" size={20} />
      </span>
      <span className="mt-4 text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]">{eyebrow}</span>
      <h3 className="font-display mt-2 text-[1.3rem] leading-tight font-semibold text-[color:var(--ink)]">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-[color:var(--ink-soft)]">{body}</p>
      <div className="mt-5">
        <ButtonLink href={href} size="sm">
          {cta}
        </ButtonLink>
      </div>
    </div>
  );
}
