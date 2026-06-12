import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCard } from "@/components/event-card";
import { Pill } from "@/components/click-ui";
import {
  getBookmarkedEvents,
  getProfileStatus,
} from "@/lib/event-repository";

export const metadata = {
  title: "Bookmarks | Click",
  description: "Events you’ve saved for later on Click.",
};

export default async function BookmarksPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/bookmarks");
  }

  const [bookmarks, profileStatus] = await Promise.all([
    getBookmarkedEvents(session),
    getProfileStatus(session),
  ]);
  const registeredSet = new Set(profileStatus.registeredEventIds);
  const waitlistedSet = new Set(profileStatus.waitlistedEventIds);
  // Real seat state for the booking modal — without it a confirmed attendee
  // of a full event is inferred as "waitlisted" (bug board #163).
  const bookingStatusFor = (id: string): "confirmed" | "waitlisted" | undefined =>
    registeredSet.has(id)
      ? waitlistedSet.has(id)
        ? "waitlisted"
        : "confirmed"
      : undefined;

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Saved
        </span>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
              Bookmarked plans.
            </h1>
            <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
              Events you’ve tapped to save. Tap the bookmark again on any card
              to remove it.
            </p>
          </div>
          <Pill tone="peach">{bookmarks.length}</Pill>
        </div>

        {bookmarks.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {bookmarks.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                bookmarked
                registered={registeredSet.has(event.id)}
                bookingStatus={bookingStatusFor(event.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-8 text-center">
            <p className="font-display text-3xl font-light leading-tight">
              No bookmarks yet.
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              Tap the bookmark icon on any event card and it’ll land here.
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Browse events
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
