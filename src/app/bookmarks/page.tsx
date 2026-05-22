import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCard } from "@/components/event-card";
import { Pill, SectionIntro } from "@/components/click-ui";
import {
  getEventsForExplore,
  getProfileStatus,
} from "@/lib/event-repository";

export const metadata = {
  title: "Saved events | Click",
  description: "Events you've bookmarked, ready to revisit.",
};

export default async function BookmarksPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/bookmarks");
  }

  const [allEvents, profileStatus] = await Promise.all([
    getEventsForExplore(),
    getProfileStatus(session),
  ]);

  const bookmarkSet = new Set(profileStatus.bookmarkedEventIds);
  const registeredSet = new Set(profileStatus.registeredEventIds);
  const saved = allEvents.filter((event) => bookmarkSet.has(event.id));

  const categories = Array.from(
    new Set(saved.map((event) => event.category).filter(Boolean)),
  ).sort();

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <SectionIntro
          eyebrow="Saved"
          title={<>Plans you <span className="italic">bookmarked.</span></>}
          body="Anything you tap Save on lands here. RSVP when you're ready or clear it when you're not."
        />

        {categories.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Categories
            </span>
            {categories.map((category) => (
              <Pill key={category} tone="peach">
                {category}
              </Pill>
            ))}
            <span className="ml-auto text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              {saved.length} saved
            </span>
          </div>
        ) : null}
      </section>

      <section className="mx-auto mt-10 max-w-6xl">
        {saved.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {saved.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                compact
                bookmarked
                registered={registeredSet.has(event.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-8 text-center">
            <p className="font-display text-3xl font-light leading-tight">
              Nothing saved yet.
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              Tap the bookmark on any event to keep it here.
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm"
            >
              Browse events →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
