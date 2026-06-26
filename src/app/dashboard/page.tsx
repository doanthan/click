import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";
import { EventCard } from "@/components/event-card";
import { LinkButton, MetricCard, Pill } from "@/components/click-ui";
import { PostEventClickCard } from "@/components/post-event-click-card";
import { ClickRadar } from "@/components/click-radar";
import { ClickWithSomeoneUserCard } from "@/components/click-with-someone-user-card";
import {
  getDashboardData,
  getEventAttendeePreview,
  getMutualClicksForSession,
  getPersonalizedDiscovery,
  getPostEventClickPrompts,
  getProfileCompletion,
  getProfileStatus,
  getSuggestedPeople,
} from "@/lib/event-repository";

export const metadata = {
  title: "Dashboard | Click",
  description: "Your Click dashboard: upcoming events, saved plans, and account state.",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const [
    dashboard,
    profileStatus,
    postEventPrompts,
    completion,
    suggestedPeople,
    personalized,
    mutualClicks,
  ] = await Promise.all([
    getDashboardData(session),
    getProfileStatus(session),
    getPostEventClickPrompts(session),
    getProfileCompletion(session),
    getSuggestedPeople(session),
    getPersonalizedDiscovery(session),
    getMutualClicksForSession(session),
  ]);

  const activePrompts = postEventPrompts.filter((p) =>
    p.coAttendees.some((c) => !c.alreadyClicked),
  );

  const userName = dashboard.userName || session.user.email || "there";
  const isAdmin = isAdminEmail(session.user.email);

  // Dashboard suggestions are deliberately rationed + rotated so the page stays
  // a focused "one thing to act on" rather than an endless list:
  //  • one person to click with, rotating 4×/day (every 6 hours)
  //  • one radar event, rotating hourly
  // Deterministic index off the clock so it's stable within each window.
  // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
  const nowForRotation = Date.now();
  const sixHourIndex = Math.floor(nowForRotation / (6 * 3_600_000));
  const hourIndex = Math.floor(nowForRotation / 3_600_000);
  // Drop anyone the viewer has already clicked: an active click shouldn't keep
  // resurfacing as a "click with X" suggestion (bug board: already clicked with
  // someone, still prompted to click them on the dashboard).
  const clickablePeople = suggestedPeople.filter((p) => !p.alreadyClicked);
  const rotatedPeople =
    clickablePeople.length > 0
      ? [clickablePeople[sixHourIndex % clickablePeople.length]]
      : [];
  const radarPool = personalized?.events ?? [];
  const rotatedRadar =
    radarPool.length > 0 ? [radarPool[hourIndex % radarPool.length]] : [];

  // FOMO signal for the one radar event: how many people going share the
  // viewer's interests / are open to dating — the "1 user attending also likes
  // hiking" nudge. Computed from the same attendee-overlap data the event page
  // uses, only for the single surfaced event so it's one cheap query.
  const fomoBySlug: Record<string, string> = {};
  if (rotatedRadar[0]) {
    const preview = await getEventAttendeePreview(rotatedRadar[0].id, session, 8);
    const interestCounts = new Map<string, number>();
    let datingCount = 0;
    for (const p of preview.items) {
      if (p.datingMinded) datingCount += 1;
      for (const interest of p.sharedInterests) {
        interestCounts.set(interest, (interestCounts.get(interest) ?? 0) + 1);
      }
    }
    const top = [...interestCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    // Stack up to two FOMO signals so the radar feels alive: a shared-interest
    // nudge AND an "open to dating" nudge can show together, with a plain
    // social-proof count as the floor so an event with attendees never reads as
    // empty (bug board #172).
    const signals: string[] = [];
    if (top) signals.push(`${top[1]} going also like ${top[0]}`);
    // Dating is a two-way signal: only nudge "open to dating" when the viewer is
    // also dating-visible, so we never surface it to someone who keeps dating off
    // (and the attendee count already excludes private profiles).
    if (datingCount > 0 && profileStatus.datingVisible) {
      signals.push(`${datingCount} open to dating`);
    }
    if (signals.length === 0 && preview.totalConfirmed > 0) {
      signals.push(
        preview.totalConfirmed === 1
          ? "1 person going so far"
          : `${preview.totalConfirmed} going so far`,
      );
    }
    if (signals.length > 0) {
      fomoBySlug[rotatedRadar[0].id] = signals.join(" · ");
    }
  }

  const upcoming = dashboard.upcomingEvents;
  const saved = dashboard.savedEvents;
  const bookmarkSet = new Set(profileStatus.bookmarkedEventIds);
  const registeredSet = new Set(profileStatus.registeredEventIds);
  const waitlistedSet = new Set(profileStatus.waitlistedEventIds);
  // Confirmed when the viewer is registered but NOT on the waitlist for it.
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
          Your Click
        </span>
        <h1 className="font-display mt-6 text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
          Hi <span className="text-[color:var(--coral)]">{userName.split(" ")[0]}</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          Your RSVPs, saved plans, and onboarding state live here. Browse events
          on Discover or Events to add more.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <MetricCard label="Upcoming RSVPs" value={dashboard.stats.upcoming.toString()} tone="peach" />
          <MetricCard label="Saved events" value={dashboard.stats.saved.toString()} tone="rose" />
        </div>

        {/* One consolidated "Finish setting up" card. The completion checklist
            already covers photo, suburb, bio, interests and the quiz, so the old
            standalone quiz/photo/onboarding banners were redundant and are folded
            in here — one card instead of up to four stacked nudges. */}
        {!completion.complete ? (
          <div className="mt-8 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Finish setting up
                </p>
                <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--mauve)]">
                  A complete profile gets you better event and people matches.
                </p>
              </div>
              <span className="font-display text-2xl font-semibold leading-none text-[color:var(--ink)]">
                {completion.percent}%
              </span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)]">
              <div
                className="h-full bg-[color:var(--rose)] transition-all"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {completion.items.map((item) => (
                <li key={item.key}>
                  {item.done ? (
                    <span className="flex items-center gap-2 text-sm font-bold text-[color:var(--mauve)]">
                      <span aria-hidden className="text-[color:var(--rose)]">✓</span>
                      <span className="line-through">{item.label}</span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 text-sm font-bold text-[color:var(--ink)] hover:text-[color:var(--rose)]"
                    >
                      <span aria-hidden className="text-[color:var(--mauve)]">○</span>
                      <span className="underline decoration-2 underline-offset-4">{item.label}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {profileStatus.merchantProfile ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                Hosting as {profileStatus.merchantProfile.business_name}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                Verification status: {profileStatus.merchantProfile.verification_status}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LinkButton href="/merchant/events/create">Host an event</LinkButton>
              <LinkButton href="/merchant" variant="light">Open merchant portal</LinkButton>
            </div>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--ink)] p-5 text-[color:var(--on-deep)] hard-shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--peach)]">
                Admin tools
              </p>
              <p className="mt-2 text-base font-bold leading-6">
                Approve pending events and review merchants.
              </p>
            </div>
            <LinkButton href="/admin" variant="light">
              Open admin
            </LinkButton>
          </div>
        ) : null}
      </section>

      {/* Core loop, lifted up front: clicking with people is the heart of the
          product, so the people suggestion + radar and any mutual clicks sit
          right under the hero rather than buried below the event lists. */}
      <section className="mx-auto mt-12 max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Click with someone
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              People you might click with.
            </h2>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              🔒 Clicking is anonymous — we&rsquo;ll only show you if it&rsquo;s mutual.
              We surface one person at a time, refreshed through the day. See
              everyone on the People page.{" "}
              <Link
                href="/how-it-works"
                className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
              >
                How Click works →
              </Link>
            </p>
          </div>
          <Link
            href="/people"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-4 py-2 text-xs font-bold text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
          >
            See everyone
          </Link>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            {rotatedPeople.length > 0 ? (
              <div className="grid gap-5">
                {rotatedPeople.map((person) => (
                  <ClickWithSomeoneUserCard key={person.id} person={person} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
                <p className="text-base font-bold">No suggestions yet.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                  Add a few interest tags to{" "}
                  <Link
                    href="/profile/edit"
                    className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
                  >
                    your profile
                  </Link>{" "}
                  so we can surface people with overlap.
                </p>
              </div>
            )}
          </div>
          <ClickRadar events={rotatedRadar} fomoBySlug={fomoBySlug} />
        </div>
      </section>

      {mutualClicks.length > 0 ? (
        <section className="mx-auto mt-12 max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Mutual Click
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
                You both tapped.
              </h2>
              <p className="mt-1 max-w-xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                You both tapped — that&rsquo;s a mutual click. Confirm the suggested
                plan in one tap, or suggest another. No messaging — just a plan.
              </p>
            </div>
            <Link
              href="/proposals"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-4 py-2 text-xs font-bold text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
            >
              Open proposals
            </Link>
          </div>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {mutualClicks.map((m) => {
              // Whether the viewer has already RSVP'd to the suggested plan but
              // is still waiting on the other person to lock in their seat (bug
              // board #218). registeredEventIds + suggestedEventSlug are both
              // event slugs, so this needs no extra query.
              const viewerAttendingSuggested =
                m.suggestedEventSlug != null &&
                registeredSet.has(m.suggestedEventSlug) &&
                !waitlistedSet.has(m.suggestedEventSlug);
              return (
              <li
                key={m.otherProfileId}
                className="flex flex-col rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] p-4 text-[color:var(--surface-deep)] hard-shadow-sm"
              >
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] opacity-80">
                  ✨ You both clicked
                </p>
                <Link
                  href={`/profile/${m.otherProfileId}`}
                  className="font-display mt-1 text-2xl font-semibold leading-tight hover:underline"
                >
                  You + {m.otherDisplayName}
                </Link>
                {m.bothGoingEventSlug ? (
                  <p className="mt-2 text-sm font-bold leading-6">
                    🎉 You&rsquo;re both going to{" "}
                    <Link
                      href={`/events/${m.bothGoingEventSlug}`}
                      className="underline decoration-2 underline-offset-4 hover:opacity-80"
                    >
                      {m.bothGoingEventTitle ?? "the same event"}
                    </Link>
                    . See you there.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-semibold leading-6">
                      {m.suggestedEventSlug ? (
                        viewerAttendingSuggested ? (
                          <>
                            ✅ You&rsquo;re going to{" "}
                            <Link
                              href={`/events/${m.suggestedEventSlug}`}
                              className="font-bold underline decoration-2 underline-offset-4 hover:opacity-80"
                            >
                              {m.suggestedEventTitle ?? "an event"}
                            </Link>
                            . Waiting on {m.otherDisplayName} to RSVP — you&rsquo;re
                            both in once they grab a seat.
                          </>
                        ) : (
                          <>
                            {m.suggestedByOther
                              ? `${m.otherDisplayName} suggested `
                              : "Your suggested plan: "}
                            <Link
                              href={`/events/${m.suggestedEventSlug}`}
                              className="font-bold underline decoration-2 underline-offset-4 hover:opacity-80"
                            >
                              {m.suggestedEventTitle ?? "an event"}
                            </Link>
                            . Confirm it together — or suggest another.
                          </>
                        )
                      ) : (
                        "No plan yet — pick one together, or suggest your own."
                      )}
                    </p>
                    <Link
                      href="/proposals"
                      className="mt-3 inline-flex w-fit items-center rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--champagne)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
                    >
                      {!m.suggestedEventSlug
                        ? "Pick a plan →"
                        : viewerAttendingSuggested
                          ? "View plan →"
                          : "Confirm or suggest another →"}
                    </Link>
                  </>
                )}
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {activePrompts.length > 0 ? (
        <section className="mx-auto mt-12 max-w-6xl">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            After your events
          </p>
          <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
            Who did you click with?
          </h2>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {activePrompts.map((prompt) => (
              <PostEventClickCard key={prompt.eventSlug} prompt={prompt} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-12 max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Upcoming
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              {upcoming.length > 0 ? "Plans on your calendar." : "No RSVPs yet."}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/calendar"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-4 py-2 text-xs font-bold text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
            >
              View calendar
            </Link>
            <Pill tone="aqua">{upcoming.length}</Pill>
          </div>
        </div>

        {upcoming.length > 0 ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {upcoming.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                compact
                bookmarked={bookmarkSet.has(event.id)}
                registered={registeredSet.has(event.id)}
                bookingStatus={bookingStatusFor(event.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
            <p className="text-base font-bold">No upcoming plans yet.</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              Browse events nearby and RSVP. Anything you save shows up below.
            </p>
            <Link
              href="/events"
              className="mt-4 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-sm font-bold text-[color:var(--surface-deep)]"
            >
              Find events
            </Link>
          </div>
        )}
      </section>

      {dashboard.waitlistedEvents.length > 0 ? (
        <section className="mx-auto mt-12 max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Waitlisted
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
                On the waitlist.
              </h2>
              <p className="mt-1 max-w-xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                Not confirmed plans yet — we&rsquo;ll notify you if a spot opens up.
              </p>
            </div>
            <Pill tone="rose">{dashboard.waitlistedEvents.length}</Pill>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {dashboard.waitlistedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                compact
                bookmarked={bookmarkSet.has(event.id)}
                registered={registeredSet.has(event.id)}
                bookingStatus={bookingStatusFor(event.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-12 max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Saved
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              Plans you bookmarked.
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Pill tone="peach">{saved.length}</Pill>
            <Link
              href="/bookmarks"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-4 py-2 text-xs font-bold text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
            >
              See all
            </Link>
          </div>
        </div>

        {saved.length > 0 ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {saved.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                compact
                bookmarked
                registered={registeredSet.has(event.id)}
                bookingStatus={bookingStatusFor(event.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
            <p className="text-base font-bold">Nothing saved yet.</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              Tap Save on any event card to bookmark it here.
            </p>
          </div>
        )}
      </section>

      {personalized && personalized.events.length > 0 ? (
        <section className="mx-auto mt-12 max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                {personalized.fallback ? "Editorial picks" : "For you"}
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
                Suggested events.
              </h2>
              <p className="mt-1 max-w-xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                {personalized.fallback
                  ? "Popular right now. Add interest tags to your profile to personalise these."
                  : "Picked from your interests, intent, and persona."}
              </p>
            </div>
            <Link
              href="/discover"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-4 py-2 text-xs font-bold text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
            >
              Explore all
            </Link>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {personalized.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                compact
                bookmarked={bookmarkSet.has(event.id)}
                registered={registeredSet.has(event.id)}
                bookingStatus={bookingStatusFor(event.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

    </main>
  );
}
