import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCard } from "@/components/event-card";
import { ButtonLink } from "@/components/ds";
import { getBookmarkedEvents, getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Saved",
  description: "Events you've saved for later on Click.",
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
      <div className="ck-page pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em]">
              Saved
            </h1>
            <p className="mt-1.5 text-[15px] text-[color:var(--slate)]">
              Events you&apos;ve kept for later. Tap the bookmark again on any card to let one go.
            </p>
          </div>
          {bookmarks.length > 0 ? (
            <span className="font-display text-[13px] font-semibold tabular-nums text-[color:var(--slate)]">
              {bookmarks.length} saved
            </span>
          ) : null}
        </div>

        {bookmarks.length > 0 ? (
          <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="mt-7 rounded-[20px] bg-[color:var(--champagne-deep)] px-6 py-11 text-center">
            <h2 className="font-display text-[17px] font-semibold text-[color:var(--ink)]">
              Nothing saved yet
            </h2>
            <p className="mx-auto mt-2 max-w-[360px] text-[14.5px] leading-[1.55] text-[color:var(--slate)]">
              Tap the bookmark on any event to keep it here.
            </p>
            <div className="mt-5 flex justify-center">
              <ButtonLink href="/discover" size="sm">
                See what&apos;s on
              </ButtonLink>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
