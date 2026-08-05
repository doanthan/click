import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Badge, ButtonLink, Icon } from "@/components/ds";
import { getLatestPersonaForSession, getOwnProfile } from "@/lib/event-repository";

export const metadata = {
  title: "Quizzes",
};

type QuizIndexPageProps = {
  // Both quizzes redirect here when they finish - the life quiz also carries
  // `saved`, the number of tags it actually wrote.
  searchParams?: Promise<{ from?: string; saved?: string }>;
};

export default async function QuizIndexPage({ searchParams }: QuizIndexPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/quiz");
  }

  const [persona, profile, params] = await Promise.all([
    getLatestPersonaForSession(session),
    // Read purely for lifeQuizCompleted - no new query, and it is the same
    // boolean /profile/edit already branches its quiz link on.
    getOwnProfile(session),
    searchParams,
  ]);

  const lifeQuizCompleted = profile?.lifeQuizCompleted ?? false;
  const from = params?.from;
  // Number() on undefined is NaN, so the ?? 0 fallback would not catch it -
  // check the parse explicitly instead.
  const savedCount = Number.parseInt(params?.saved ?? "", 10);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[760px] pt-6">
        <h1 className="font-display text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
          Two quick quizzes that change what Click suggests.
        </h1>
        <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-[color:var(--slate)]">
          Neither is required - both make our suggestions sharper. Three minutes each, no right answers.
        </p>

        {/* The ending both wizards used to lack. Four or five steps finished
            into a page that looked exactly as it did before, while the 4-tap
            homepage teaser celebrated. Typography and one pop-in glyph carry
            it - no confetti, which the DS bans as a gamification trinket. */}
        {from === "life-quiz" ? (
          Number.isFinite(savedCount) && savedCount > 0 ? (
            <QuizSavedNote
              badge="Saved"
              title="Your life tags are in."
              sub={`${savedCount} ${savedCount === 1 ? "answer" : "answers"} saved. Click leans your suggestions toward rooms that fit where you're at.`}
            />
          ) : (
            // Distinguishable by design: skipping every section writes nothing,
            // so it must not read like a save.
            <QuizIncompleteNote
              title="Nothing saved yet."
              sub="You skipped every section, so there was nothing to write. The Life quiz is still open whenever you want it."
              href="/quiz/life"
              cta="Open the Life quiz"
            />
          )
        ) : null}

        {from === "personality" && persona ? (
          <QuizSavedNote
            badge="Saved"
            title={`You read as ${persona.personaName}.`}
            sub={`${persona.socialEnergy} · ${persona.pace} pace · ${persona.openness} · ${persona.engagementFrequency}. We'll lean your suggestions toward rooms that feel like you.`}
          />
        ) : null}

        {/* The saved note above already names the persona, so the standing
            block would just repeat it back on the one visit that follows a
            save. */}
        {persona && from !== "personality" ? (
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
            cta={
              // "Add to", not "Update": saveLifeQuizTags only ever inserts, so
              // a retake can add answers but cannot take one away.
              lifeQuizCompleted ? "Add to the Life quiz" : "Take the Life quiz"
            }
            href="/quiz/life"
            done={lifeQuizCompleted}
          />
          <QuizCard
            eyebrow="Personality quiz"
            title="How you click with rooms."
            body="Social energy, pace, openness, frequency. Writes a Click persona we use to surface compatible plans."
            cta={persona ? "Retake the Personality quiz" : "Take the Personality quiz"}
            href="/quiz/personality"
            done={!!persona}
          />
        </div>
      </div>
    </main>
  );
}

/* The completion moment. .pop-in rides on the glyph alone - a whole card
   scaling and rotating in is a trinket; a check that lands is a full stop. */
function QuizSavedNote({ badge, title, sub }: { badge: string; title: string; sub: string }) {
  return (
    <div className="rise-soft mt-6 flex items-start gap-4 rounded-[var(--radius-xl)] border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] p-5">
      <span className="pop-in flex size-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--lavender-200)] text-[color:var(--purple-700)]">
        <Icon name="check" size={20} stroke={2.2} />
      </span>
      <div className="min-w-0">
        <Badge tone="sage">{badge}</Badge>
        <h2 className="font-display mt-2 text-[1.3rem] leading-tight font-semibold tracking-[-0.01em] text-[color:var(--purple-800)]">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[460px] text-[13.5px] leading-relaxed text-[color:var(--ink-soft)]">{sub}</p>
      </div>
    </div>
  );
}

/* Same shell, no celebration and no badge: nothing was written, and the two
   outcomes have to look different. Quiet white card, never a danger tint - a
   skipped quiz is a choice, not an error. */
function QuizIncompleteNote({
  title,
  sub,
  href,
  cta,
}: {
  title: string;
  sub: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rise-soft mt-6 rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
      <h2 className="font-display text-[1.15rem] leading-tight font-semibold text-[color:var(--ink)]">{title}</h2>
      <p className="mt-1.5 max-w-[460px] text-[13.5px] leading-relaxed text-[color:var(--slate)]">{sub}</p>
      <div className="mt-4">
        <ButtonLink href={href} variant="secondary" size="sm">
          {cta}
        </ButtonLink>
      </div>
    </div>
  );
}

function QuizCard({
  eyebrow,
  title,
  body,
  cta,
  href,
  done,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  done?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
          <Icon name={done ? "check" : "help"} size={20} />
        </span>
        {/* Status colour on a badge, never on the card or its CTA. */}
        {done ? <Badge tone="sage">Done</Badge> : null}
      </div>
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
