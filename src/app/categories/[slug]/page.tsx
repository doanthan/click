import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { Icon } from "@/components/ds";
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
  if (!category) return { title: "Category not found" };
  return {
    title: `${category} events`,
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
  const waitlistedSet = new Set(profileStatus?.waitlistedEventIds ?? []);
  // Real seat state for the booking modal - without it a confirmed attendee
  // of a full event is inferred as "waitlisted" (bug board #163).
  const bookingStatusFor = (id: string): "confirmed" | "waitlisted" | undefined =>
    registeredSet.has(id)
      ? waitlistedSet.has(id)
        ? "waitlisted"
        : "confirmed"
      : undefined;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-6">
        <Link
          href="/discover"
          className="font-display inline-flex items-center gap-1 text-[13.5px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
        >
          <Icon name="chevL" size={16} stroke={2.2} /> Back to discover
        </Link>

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <h1 className="font-display text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
            {category}
          </h1>
          <span className="shrink-0 text-[13px] font-medium text-[color:var(--slate)]">
            {categoryEvents.length} {categoryEvents.length === 1 ? "event" : "events"}
          </span>
        </div>

        {categoryEvents.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categoryEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                bookmarked={bookmarkedSet.has(event.id)}
                registered={registeredSet.has(event.id)}
                bookingStatus={bookingStatusFor(event.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-12 text-center">
            <p className="font-display text-[1.15rem] font-semibold text-[color:var(--ink)]">
              Nothing here yet.
            </p>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">Check back soon, or browse everything on Discover.</p>
            <div className="mt-4 flex justify-center">
              <Link href="/discover" className="ck-btn ck-btn--sm ck-btn--primary">
                <span className="ck-btn__label">Browse all events</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
