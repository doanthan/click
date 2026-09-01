import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCard } from "@/components/event-card";
import { UserCalendar } from "@/components/user-calendar";
import { ButtonLink, Icon } from "@/components/ds";
import {
  getBookmarkedEvents,
  getConfirmedEvents,
  getGoingWithNames,
  getProfileStatus,
} from "@/lib/event-repository";

export const metadata = {
  title: "Your events",
  description: "Everything you've RSVP'd to, joined a waitlist for, saved, or been to.",
};

type TabKey = "upcoming" | "waitlist" | "saved" | "past";
const TABS: { key: TabKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "waitlist", label: "Waitlist" },
  { key: "saved", label: "Saved" },
  { key: "past", label: "Past" },
];

const EMPTY: Record<TabKey, [string, string]> = {
  upcoming: [
    "No plans yet",
    "Find something good near you and RSVP - it'll show up here.",
  ],
  waitlist: [
    "No waitlists right now",
    "When something's full, join the waitlist and we'll watch it for you.",
  ],
  saved: ["Nothing saved yet", "Tap the bookmark on any event to keep it here."],
  past: [
    "Nothing in the past yet",
    "Once you've been to something it rests here - book it again anytime.",
  ],
};

type ConfirmedEventsPageProps = {
  searchParams?: Promise<{ tab?: string; month?: string; view?: string }>;
};

export default async function ConfirmedEventsPage({ searchParams }: ConfirmedEventsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/confirmed-events");
  }

  const params = await searchParams;
  const tabParam = params?.tab as TabKey | undefined;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? tabParam! : "upcoming";
  const view = params?.view === "calendar" ? "calendar" : "list";

  const [confirmed, bookmarks, profileStatus] = await Promise.all([
    getConfirmedEvents(session),
    getBookmarkedEvents(session),
    getProfileStatus(session),
  ]);
  const bookmarkSet = new Set(profileStatus.bookmarkedEventIds);
  const registeredSet = new Set(profileStatus.registeredEventIds);
  const waitlistedSet = new Set(profileStatus.waitlistedEventIds);
  // Pass the viewer's real seat state to each card - without it the booking
  // modal infers "waitlisted" from event fullness, so a confirmed attendee of
  // a sold-out event saw waitlist copy when opening "View your booking".
  const bookingStatusFor = (id: string): "confirmed" | "waitlisted" | undefined =>
    registeredSet.has(id)
      ? waitlistedSet.has(id)
        ? "waitlisted"
        : "confirmed"
      : undefined;

  // getConfirmedEvents returns confirmed + waitlisted seats in one bucket, so the
  // Waitlist tab is a pure re-slice of data we already have - no extra query.
  const upcomingConfirmed = confirmed.upcoming.filter((e) => !waitlistedSet.has(e.id));
  const upcomingWaitlisted = confirmed.upcoming.filter((e) => waitlistedSet.has(e.id));

  const counts: Record<TabKey, number> = {
    upcoming: upcomingConfirmed.length,
    waitlist: upcomingWaitlisted.length,
    saved: bookmarks.length,
    past: confirmed.past.length,
  };

  const events =
    tab === "past"
      ? confirmed.past
      : tab === "saved"
        ? bookmarks
        : tab === "waitlist"
          ? upcomingWaitlisted
          : upcomingConfirmed;

  // §B5.3: the persistent companion marker. Only the tabs that show plans the
  // viewer actually holds a seat on can carry it - a bookmark is not a booking.
  const goingWith = await getGoingWithNames(
    session,
    events.map((e) => e.id),
  );

  // The calendar reflects the full picture of your plans (upcoming + past) so you
  // can see your history at a glance; the Saved tab charts your bookmarks instead.
  const calendarEvents =
    tab === "saved" ? bookmarks : [...confirmed.upcoming, ...confirmed.past];

  const tabHref = (key: TabKey) =>
    `/confirmed-events?tab=${key}${view === "calendar" ? "&view=calendar" : ""}`;
  const viewHref = (v: "list" | "calendar") =>
    `/confirmed-events?tab=${tab}${v === "calendar" ? "&view=calendar" : ""}`;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em]">
              Your events
            </h1>
            <p className="mt-1.5 text-[15px] text-[color:var(--slate)]">
              Everything you&apos;ve RSVP&apos;d to, saved, or been to.
            </p>
          </div>

          {/* View toggle - radius 12, never a pill. Selected is Deep Purple. */}
          <div className="inline-flex gap-1 rounded-[12px] border border-[color:var(--mist-strong)] bg-[color:var(--paper)] p-1">
            {(["list", "calendar"] as const).map((v) => {
              const on = view === v;
              return (
                <Link
                  key={v}
                  href={viewHref(v)}
                  aria-current={on ? "true" : undefined}
                  className={`font-display rounded-[8px] px-4 py-1.5 text-[13.5px] transition-colors ${
                    on
                      ? "bg-[color:var(--purple)] font-semibold text-[color:var(--champagne)]"
                      : "font-medium text-[color:var(--ink-soft)] hover:bg-[color:var(--lavender-100)]"
                  }`}
                >
                  {v === "list" ? "List" : "Calendar"}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Add-a-photo nudge - people are far likelier to actually meet up when
            they can recognise each other. Only once there's a plan on the books. */}
        {!profileStatus.photoUrl && upcomingConfirmed.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[16px] bg-[color:var(--lav-bg)] px-4 py-4 sm:px-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--lavender-200)] text-[color:var(--purple)]">
              <Icon name="camera" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">You&apos;re going</p>
              <p className="mt-1 text-[15px] font-semibold leading-snug text-[color:var(--ink)]">
                Add a photo so people can put a face to the name
              </p>
              <p className="mt-0.5 text-[13px] text-[color:var(--slate)]">
                It makes the first hello a lot easier when you get there.
              </p>
            </div>
            <ButtonLink href="/profile/edit" size="sm" className="max-sm:w-full">
              Add a photo
            </ButtonLink>
          </div>
        ) : null}

        {view === "list" ? (
          <>
            {/* Tabs - underline, Deep Purple when active. */}
            <div className="ckRail mt-7 flex gap-6 overflow-x-auto border-b border-[color:var(--mist)]">
              {TABS.map((t) => {
                const on = t.key === tab;
                const n = counts[t.key];
                return (
                  <Link
                    key={t.key}
                    href={tabHref(t.key)}
                    aria-current={on ? "page" : undefined}
                    className={`font-display -mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-[2.5px] px-1 pb-3 pt-2 text-[14.5px] transition-colors ${
                      on
                        ? "border-[color:var(--purple)] font-semibold text-[color:var(--purple-700)]"
                        : "border-transparent font-medium text-[color:var(--slate)] hover:text-[color:var(--ink)]"
                    }`}
                  >
                    {t.label}
                    {n > 0 ? (
                      <span
                        className={`text-[12px] font-bold tabular-nums ${
                          on ? "text-[color:var(--purple)]" : "text-[color:var(--ink-faint)]"
                        }`}
                      >
                        {n}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            {events.length > 0 ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    bookmarked={tab === "saved" ? true : bookmarkSet.has(event.id)}
                    registered={tab === "saved" ? registeredSet.has(event.id) : true}
                    bookingStatus={bookingStatusFor(event.id)}
                    goingWith={goingWith.get(event.id) ?? null}
                  />
                ))}
              </div>
            ) : (
              <EmptyPanel title={EMPTY[tab][0]} body={EMPTY[tab][1]} />
            )}
          </>
        ) : (
          <div className="mt-7">
            <UserCalendar
              events={calendarEvents}
              monthParam={params?.month}
              basePath={`/confirmed-events?tab=${tab}&view=calendar`}
              // The Saved view mixes bookmarks the user may or may not have RSVP'd
              // to - pass the registered set so non-RSVP'd ones chip as "Saved",
              // not "Confirmed" (bug board #173).
              registeredEventIds={tab === "saved" ? registeredSet : undefined}
              // The waitlisted set goes in on EVERY tab, not just Saved: the
              // grid draws confirmed.upcoming whichever tab you're on, and that
              // bucket carries waitlisted seats too, so leaving it off told
              // someone still in line that they were going.
              waitlistedEventIds={waitlistedSet}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-[20px] bg-[color:var(--champagne-deep)] px-6 py-11 text-center">
      <h3 className="font-display text-[17px] font-semibold text-[color:var(--ink)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-[360px] text-[14.5px] leading-[1.55] text-[color:var(--slate)]">
        {body}
      </p>
      <div className="mt-5 flex justify-center">
        <ButtonLink href="/discover" size="sm">
          See what&apos;s on
        </ButtonLink>
      </div>
    </div>
  );
}
