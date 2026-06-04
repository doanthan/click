import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { EventCard } from "@/components/event-card";
import { categories, categoryFromSlug, categorySlug } from "@/lib/click-data";
import { getEventsForExplore, getProfileStatus } from "@/lib/event-repository";

// Pre-render the known category landing pages; unknown slugs still resolve at
// request time and 404 via notFound().
export function generateStaticParams() {
  return categories
    .filter((category) => category !== "All")
    .map((category) => ({ slug: categorySlug(category) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) return { title: "Category not found | Click" };
  return {
    title: `${category} events | Click`,
    description: `Browse every ${category.toLowerCase()} event on Click near you.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const session = await auth();
  const [events, profileStatus] = await Promise.all([
    getEventsForExplore(),
    session?.user ? getProfileStatus(session) : null,
  ]);

  const categoryEvents = events.filter((event) => event.category === category);
  const bookmarkedSet = new Set(profileStatus?.bookmarkedEventIds ?? []);
  const registeredSet = new Set(profileStatus?.registeredEventIds ?? []);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/discover"
            className="inline-flex items-center gap-1 text-sm font-bold text-[color:var(--mauve)] hover:text-[color:var(--punch)]"
          >
            ← Back to discover
          </Link>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <h1 className="text-4xl font-black text-[color:var(--ink)] sm:text-5xl">
              {category}
            </h1>
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
              {categoryEvents.length} {categoryEvents.length === 1 ? "event" : "events"}
            </span>
          </div>

          {categoryEvents.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categoryEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  compact
                  bookmarked={bookmarkedSet.has(event.id)}
                  registered={registeredSet.has(event.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--cream)] p-8 text-center shadow-sm">
              <p className="text-3xl font-black leading-none text-[color:var(--ink)]">
                No {category.toLowerCase()} events yet.
              </p>
              <p className="mt-3 text-sm font-bold text-[color:var(--mauve)]">
                Check back soon, or browse everything on discover.
              </p>
              <Link
                href="/discover"
                className="mt-5 inline-block rounded-full bg-[color:var(--surface-deep)] px-5 py-3 text-sm font-black text-[color:var(--on-deep)] hover:opacity-90"
              >
                Browse all events
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
