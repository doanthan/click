import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClickRadar } from "@/components/click-radar";
import { ClickWithSomeoneUserCard } from "@/components/click-with-someone-user-card";
import { Pill } from "@/components/click-ui";
import {
  getMutualClicksForSession,
  getPersonalizedDiscovery,
  getSuggestedPeople,
} from "@/lib/event-repository";

export const metadata = {
  title: "People | Click",
  description: "Discover Click users with overlapping interests and mutual events.",
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
});

export default async function PeoplePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/people");
  }

  const [suggested, mutuals, personalized] = await Promise.all([
    getSuggestedPeople(session),
    getMutualClicksForSession(session),
    getPersonalizedDiscovery(session),
  ]);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          People
        </span>
        <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          People you might <span className="italic">click</span> with.
        </h1>
        <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          Ranked by shared interest tags. Click on someone privately — nobody
          sees it unless they Click you back.
        </p>

        {mutuals.length > 0 ? (
          <div className="mt-8 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] p-5 text-[color:var(--surface-deep)] hard-shadow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em]">
                  Mutual Click
                </p>
                <h2 className="font-display mt-2 text-3xl font-light leading-tight">
                  You both tapped.
                </h2>
              </div>
              <Pill tone="cream">{mutuals.length}</Pill>
            </div>
            <Link
              href="/proposals"
              className="mt-4 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Open your proposals →
            </Link>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {mutuals.map((m) => (
                <li
                  key={m.otherProfileId}
                  className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 text-[color:var(--ink)] hard-shadow-sm"
                >
                  <Link
                    href={`/profile/${m.otherProfileId}`}
                    className="font-display text-2xl font-light leading-tight hover:text-[color:var(--rose)]"
                  >
                    {m.otherDisplayName}
                  </Link>
                  <p className="mt-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    Matched {dateFormatter.format(new Date(m.createdAt))}
                  </p>
                  {m.suggestedEventSlug ? (
                    <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                      Suggested next:{" "}
                      <Link
                        href={`/events/${m.suggestedEventSlug}`}
                        className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
                      >
                        {m.suggestedEventTitle ?? "an event"}
                      </Link>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-12 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Suggested · {suggested.length}
            </h2>
            <h3 className="mt-2 font-display text-3xl font-light leading-tight sm:text-4xl">
              People sorted by overlap.
            </h3>
            {suggested.length > 0 ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {suggested.map((person) => (
                  <ClickWithSomeoneUserCard key={person.id} person={person} />
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                Pick a few interest tags in{" "}
                <Link
                  href="/profile/edit"
                  className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
                >
                  your profile
                </Link>{" "}
                so we can surface people with overlap.
              </p>
            )}
          </div>
          <ClickRadar events={personalized?.events ?? []} />
        </div>
      </section>
    </main>
  );
}
