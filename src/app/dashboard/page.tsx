import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";
import { EventCard } from "@/components/event-card";
import { CategoryCircle, Icon, Spark, categoryGlyphKey } from "@/components/ds";
import { MomentBanner, Section } from "@/components/dashboard-ds";
import { Reveal } from "@/components/reveal";
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

// The eight we lead with on the dashboard. The full set lives on Discover; this
// is a "browse by what you feel like doing" nudge, not the whole taxonomy.
const BROWSE_CATEGORIES = ["Social", "Food", "Fitness", "Creative", "Learning", "Outdoors", "Wellness", "Community"];

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const [dashboard, profileStatus, postEventPrompts, completion, suggestedPeople, personalized, mutualClicks] =
    await Promise.all([
      getDashboardData(session),
      getProfileStatus(session),
      getPostEventClickPrompts(session),
      getProfileCompletion(session),
      getSuggestedPeople(session),
      getPersonalizedDiscovery(session),
      getMutualClicksForSession(session),
    ]);

  const activePrompts = postEventPrompts.filter((p) => p.coAttendees.some((c) => !c.alreadyClicked));

  const userName = dashboard.userName || session.user.email || "there";
  const firstName = userName.split(" ")[0];
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
  // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
  const hourOfDay = new Date().getHours();

  // Drop anyone the viewer has already clicked: an active click shouldn't keep
  // resurfacing as a "click with X" suggestion.
  const clickablePeople = suggestedPeople.filter((p) => !p.alreadyClicked);
  const rotatedPeople = clickablePeople.length > 0 ? [clickablePeople[sixHourIndex % clickablePeople.length]] : [];
  const radarPool = personalized?.events ?? [];
  const rotatedRadar = radarPool.length > 0 ? [radarPool[hourIndex % radarPool.length]] : [];

  // Aggregate FOMO signal for the one radar event. Counts only, never names or
  // photos - the radar can never identify who is going.
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
    const signals: string[] = [];
    if (top) signals.push(`${top[1]} going also like ${top[0]}`);
    // Dating is a two-way signal: only nudge "open to dating" when the viewer is
    // also dating-visible, so we never surface it to someone who keeps dating off.
    if (datingCount > 0 && profileStatus.datingVisible) {
      signals.push(`${datingCount} open to dating`);
    }
    if (signals.length === 0 && preview.totalConfirmed > 0) {
      signals.push(preview.totalConfirmed === 1 ? "1 person going so far" : `${preview.totalConfirmed} going so far`);
    }
    if (signals.length > 0) fomoBySlug[rotatedRadar[0].id] = signals.join(" · ");
  }

  const upcoming = dashboard.upcomingEvents;
  const saved = dashboard.savedEvents;
  const bookmarkSet = new Set(profileStatus.bookmarkedEventIds);
  const registeredSet = new Set(profileStatus.registeredEventIds);
  const waitlistedSet = new Set(profileStatus.waitlistedEventIds);
  const bookingStatusFor = (id: string): "confirmed" | "waitlisted" | undefined =>
    registeredSet.has(id) ? (waitlistedSet.has(id) ? "waitlisted" : "confirmed") : undefined;

  // The dashboard surfaces ONLY your-move coordination states - never the ones
  // where you're waiting on them. Nudge, never push.
  const viewerHasSeat = (slug: string | null) =>
    slug != null && registeredSet.has(slug) && !waitlistedSet.has(slug);
  const yourMove = mutualClicks.filter((m) => {
    if (m.bothGoingEventSlug) return false; // already settled - both going
    if (!m.suggestedEventSlug) return true; // fresh mutual - you can propose
    if (m.suggestedByOther) return !viewerHasSeat(m.suggestedEventSlug); // their plan, your reply
    return false; // you proposed - it's their move now
  });

  // ONE banner at a time, most time-sensitive first: the post-event prompt wins,
  // then a single coordination banner.
  const postEvent = activePrompts[0] ?? null;
  const coord = !postEvent && yourMove.length > 0 ? yourMove[0] : null;
  const coordConsolidated = !postEvent && yourMove.length >= 2;

  const spark = <Spark size={18} tone="var(--purple)" toneSmall="var(--purple-400)" className="inline-block align-[-2px]" />;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-6">
        {/* Greeting. On app surfaces the heading is h2-scale - display type is
            reserved for marketing. The top-of-page stack rides the home page's
            rise-soft cascade: pure CSS, plays before hydration, collapsed by
            the global reduced-motion block. */}
        <p className="rise-soft font-display mb-1.5 text-[13px] font-semibold text-[color:var(--slate)] sm:text-[13.5px]">
          {greetingFor(hourOfDay)}, {firstName}
        </p>
        <h1 className="rise-soft rise-d1 font-display max-w-[620px] text-[length:var(--text-h2)] leading-snug font-semibold tracking-[-0.02em] text-balance text-[color:var(--ink)]">
          {postEvent || coord ? "Here's what's next." : `Here's what's good near you this week.`}
        </h1>

        {/* ---- The one moment banner ---- */}
        {postEvent ? (
          <div className="rise-soft rise-d2 mt-6 max-w-[760px]">
            <MomentBanner
              icon="calendar"
              eyebrow={postEvent.eventTitle}
              title="Did you click with anyone?"
              sub="No rush - just the people who were actually there."
              actionLabel="See who was there"
              actionHref="#who-was-there"
            />
          </div>
        ) : coordConsolidated ? (
          <div className="rise-soft rise-d2 mt-6 max-w-[760px]">
            <MomentBanner
              icon="users"
              eyebrow="your clicks"
              title={
                <>
                  {yourMove[0].otherDisplayName.split(" ")[0]} and{" "}
                  {yourMove[1].otherDisplayName.split(" ")[0]} are waiting on you {spark}
                </>
              }
              sub="Pick up where you left off."
              actionLabel="See your clicks →"
              actionHref="/proposals"
            />
          </div>
        ) : coord ? (
          <div className="rise-soft rise-d2 mt-6 max-w-[760px]">
            {coord.suggestedEventSlug && coord.suggestedByOther ? (
              <MomentBanner
                icon="calendar"
                eyebrow={`from ${coord.otherDisplayName.split(" ")[0]}`}
                title={`${coord.otherDisplayName.split(" ")[0]} suggested a plan`}
                sub={coord.suggestedEventTitle ?? undefined}
                actionLabel="See their plan →"
                actionHref="/proposals"
              />
            ) : (
              <MomentBanner
                icon="users"
                eyebrow="it's mutual"
                title={
                  <>
                    You clicked with {coord.otherDisplayName.split(" ")[0]}. {spark}
                  </>
                }
                sub="Find something you'd both enjoy and meet there."
                actionLabel="Suggest a plan →"
                actionHref="/proposals"
              />
            )}
          </div>
        ) : null}

        {/* ---- Finish setting up: the quieter WHITE card, never a second
                lavender banner. Compact - the next step only, the rest behind a
                native <details> so it costs no client JS. ---- */}
        {!completion.complete ? (
          <FinishSetupCard completion={completion} />
        ) : null}

        {/* Host + admin entry points stay quiet single rows - they are shortcuts,
            not moments. */}
        {profileStatus.merchantProfile ? (
          <QuietRow
            icon="ticket"
            label={`Hosting as ${profileStatus.merchantProfile.business_name}`}
            href="/merchant"
            cta="Open host portal →"
          />
        ) : null}
        {isAdmin ? <QuietRow icon="settings" label="Admin tools" href="/admin" cta="Open admin →" /> : null}

        {/* ---- You're going ---- */}
        {upcoming.length > 0 ? (
          <Section title="You're going" actionLabel="All bookings" actionHref="/confirmed-events">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.slice(0, 3).map((event, i) => (
                <Reveal key={event.id} delay={i * 70} className="min-w-0">
                  <EventCard
                    event={event}
                    bookmarked={bookmarkSet.has(event.id)}
                    registered
                    bookingStatus={bookingStatusFor(event.id)}
                  />
                </Reveal>
              ))}
            </div>
          </Section>
        ) : null}

        {/* ---- click with someone: EXACTLY ONE rotated person. The wall lives on
                the people page; this is a drip, not a feed. ---- */}
        <Section
          title="click with someone"
          sub="Someone you might just click with - quietly picked, no pressure."
          actionLabel="See everyone"
          actionHref="/people"
          narrow
        >
          {rotatedPeople.length > 0 ? (
            <Reveal delay={60}>
              {rotatedPeople.map((person) => (
                <ClickWithSomeoneUserCard
                  key={person.id}
                  person={person}
                  viewerOpenToDating={profileStatus.datingVisible}
                />
              ))}
              {/* The anonymity reassurance shows ONCE per section - never under
                  each card. */}
              <p className="mt-3.5 flex items-start gap-[7px] px-0.5 text-[13px] leading-relaxed text-[color:var(--slate)]">
                <Icon name="lock" size={14} className="mt-0.5" />
                <span>
                  Clicking is anonymous - we&apos;ll only show you if it&apos;s mutual.{" "}
                  <Link href="/how-it-works" className="font-semibold whitespace-nowrap text-[color:var(--purple)]">
                    How clicking works →
                  </Link>
                </span>
              </p>
            </Reveal>
          ) : (
            <Reveal delay={60}>
              <div className="rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-7 text-center">
                <p className="text-sm leading-relaxed text-[color:var(--ink-soft)]">
                  Add a few interests to{" "}
                  <Link href="/profile/edit" className="font-semibold text-[color:var(--purple)]">
                    your profile
                  </Link>{" "}
                  and we&apos;ll start surfacing people with real overlap.
                </p>
              </div>
            </Reveal>
          )}
        </Section>

        {/* ---- click radar ---- */}
        <Section
          title="click radar"
          sub="People like you are showing up to these."
          actionLabel="See all on your radar"
          actionHref="/discover"
          narrow
        >
          <Reveal delay={60}>
            <ClickRadar events={rotatedRadar} fomoBySlug={fomoBySlug} />
          </Reveal>
        </Section>

        {/* ---- Who was there (the post-event click surface) ---- */}
        {activePrompts.length > 0 ? (
          <div id="who-was-there" className="scroll-mt-24">
            <Section title="Did you click with anyone?" sub="Only the people who were actually there.">
              <div className="grid gap-5 lg:grid-cols-2">
                {activePrompts.map((prompt, i) => (
                  <Reveal key={prompt.eventSlug} delay={i * 80} className="min-w-0">
                    <PostEventClickCard prompt={prompt} />
                  </Reveal>
                ))}
              </div>
            </Section>
          </div>
        ) : null}

        {/* ---- Suggested ---- */}
        {personalized && personalized.events.length > 0 ? (
          <Section
            title={personalized.heading}
            sub={personalized.blurb}
            actionLabel="See all"
            actionHref="/discover"
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {personalized.events.slice(0, 3).map((event, i) => (
                <Reveal key={event.id} delay={i * 70} className="min-w-0">
                  <EventCard
                    event={event}
                    bookmarked={bookmarkSet.has(event.id)}
                    registered={registeredSet.has(event.id)}
                    bookingStatus={bookingStatusFor(event.id)}
                  />
                </Reveal>
              ))}
            </div>
          </Section>
        ) : null}

        {/* ---- Saved & waitlist ---- */}
        <Section title="Saved & waitlist" actionLabel="See all" actionHref="/bookmarks">
          {saved.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {saved.slice(0, 3).map((event, i) => (
                <Reveal key={event.id} delay={i * 70} className="min-w-0">
                  <EventCard
                    event={event}
                    bookmarked
                    registered={registeredSet.has(event.id)}
                    bookingStatus={bookingStatusFor(event.id)}
                  />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal delay={60}>
              <div className="rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-7 text-center">
                <p className="text-sm leading-relaxed text-[color:var(--ink-soft)]">
                  Nothing saved yet - your next event is where it happens.
                </p>
              </div>
            </Reveal>
          )}
        </Section>

        {/* ---- Browse by category ---- */}
        <Section title="Or find your own thing" sub="Browse by what you feel like doing." actionLabel="See all" actionHref="/discover">
          <div className="ckRail -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">
            {BROWSE_CATEGORIES.map((category, i) => (
              <Reveal key={category} delay={i * 40} className="shrink-0">
                <Link
                  href={`/discover?category=${encodeURIComponent(category)}`}
                  className="group block"
                >
                  <CategoryCircle name={categoryGlyphKey(category)} label={category} />
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}

/**
 * Finish setting up - a status display, not a to-do list you tick. Compact by
 * default: the progress bar plus the NEXT incomplete step; the rest live behind
 * a native <details> (no client JS). The bar is "endowed" - it reflects real
 * progress and so never starts at a discouraging zero.
 */
function FinishSetupCard({
  completion,
}: {
  completion: { percent: number; complete: boolean; items: Array<{ key: string; label: string; done: boolean; href: string }> };
}) {
  const total = completion.items.length;
  const doneCount = completion.items.filter((i) => i.done).length;
  const remaining = completion.items.filter((i) => !i.done);
  const [next, ...rest] = remaining;
  if (!next) return null;

  return (
    <div className="rise-soft rise-d3 mt-6 max-w-[760px] rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4 shadow-[var(--shadow-xs)] sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[1.04rem] font-semibold text-[color:var(--ink)] sm:text-[1.15rem]">
          Finish setting up
        </h3>
        <span className="shrink-0 text-[13.5px] font-semibold text-[color:var(--purple-700)]">
          {doneCount} of {total}
        </span>
      </div>

      {/* The bar is decorative alongside the "X of 5" figure; the fill draws in
          from the left on load so earned progress reads as earned. */}
      <div aria-hidden className="mt-3 mb-1 h-2 overflow-hidden rounded-full bg-[color:var(--lavender-100)]">
        <div
          className="draw-line h-full rounded-full bg-[color:var(--purple)]"
          style={{ width: `${completion.percent}%`, animationDelay: "400ms" }}
        />
      </div>

      <SetupRow item={next} featured />

      {rest.length > 0 ? (
        <details className="group mt-1">
          <summary className="font-display inline-flex cursor-pointer list-none items-center gap-1.5 py-1 text-[13px] font-semibold text-[color:var(--purple)] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">See all · {rest.length} left</span>
            <span className="hidden group-open:inline">Show less</span>
            <Icon name="chevD" size={14} stroke={2.2} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-1">
            {rest.map((item) => (
              <SetupRow key={item.key} item={item} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function SetupRow({
  item,
  featured,
}: {
  item: { key: string; label: string; done: boolean; href: string };
  featured?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 ${
        featured
          ? "my-1.5 rounded-xl bg-[color-mix(in_srgb,var(--lavender)_15%,var(--paper))] px-3 py-2.5"
          : "border-t border-[color:var(--line-soft)] px-0.5 py-3"
      }`}
    >
      <span
        aria-hidden
        className="size-6 shrink-0 rounded-full border-2 border-[color:var(--mist-strong)]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-semibold text-[color:var(--ink)]">{item.label}</span>
          {featured ? (
            <span className="rounded-full bg-[color:var(--lavender-200)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--purple-700)]">
              most useful
            </span>
          ) : null}
        </span>
      </span>
      <Link
        href={item.href}
        className="font-display shrink-0 text-[13px] font-semibold text-[color:var(--purple)] hover:underline"
      >
        Add →
      </Link>
    </div>
  );
}

function QuietRow({ icon, label, href, cta }: { icon: "ticket" | "settings"; label: string; href: string; cta: string }) {
  return (
    <div className="rise-soft rise-d4 mt-3 flex max-w-[760px] flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-[color:var(--ink-soft)]">{label}</span>
      <Link href={href} className="font-display text-[13px] font-semibold text-[color:var(--purple)] hover:underline">
        {cta}
      </Link>
    </div>
  );
}
