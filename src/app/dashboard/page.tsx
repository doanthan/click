import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";
import { EventCard } from "@/components/event-card";
import { LinkButton, MetricCard, Pill } from "@/components/click-ui";
import { PostEventClickCard } from "@/components/post-event-click-card";
import {
  getDashboardData,
  getPostEventClickPrompts,
  getProfileStatus,
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

  const [dashboard, profileStatus, postEventPrompts] = await Promise.all([
    getDashboardData(session),
    getProfileStatus(session),
    getPostEventClickPrompts(session),
  ]);

  const activePrompts = postEventPrompts.filter((p) =>
    p.coAttendees.some((c) => !c.alreadyClicked),
  );

  const userName = dashboard.userName || session.user.email || "there";
  const isAdmin = isAdminEmail(session.user.email);
  const upcoming = dashboard.upcomingEvents;
  const saved = dashboard.savedEvents;
  const bookmarkSet = new Set(profileStatus.bookmarkedEventIds);
  const registeredSet = new Set(profileStatus.registeredEventIds);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Your Click
        </span>
        <h1 className="font-display mt-6 text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          Hi <span className="italic">{userName.split(" ")[0]}</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          Your RSVPs, saved plans, and onboarding state live here. Browse events
          on Discover or Events to add more.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Upcoming RSVPs" value={dashboard.stats.upcoming.toString()} tone="peach" />
          <MetricCard label="Saved events" value={dashboard.stats.saved.toString()} tone="rose" />
          <MetricCard label="Status" value={profileStatus.role} tone="cream" />
          <MetricCard label="Radar" value={dashboard.stats.radar} tone="ink" />
        </div>

        {!profileStatus.onboardingComplete ? (
          <div className="mt-8 flex flex-col gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] p-5 text-[color:var(--surface-deep)] hard-shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em]">
                Finish your profile
              </p>
              <p className="mt-2 text-base font-bold leading-6">
                Add your suburb, intent, and a few interest tags so we can show
                you the right events.
              </p>
            </div>
            <LinkButton href="/onboarding" variant="light">
              Continue onboarding
            </LinkButton>
          </div>
        ) : null}

        {!profileStatus.merchantProfile ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-5 hard-shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                Host events?
              </p>
              <p className="mt-2 text-base font-bold leading-6 text-[color:var(--ink)]">
                Become a host to create events. Free, takes about a minute.
              </p>
            </div>
            <LinkButton href="/merchant/signup">Become a host</LinkButton>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                Hosting as {profileStatus.merchantProfile.business_name}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                Verification status: {profileStatus.merchantProfile.verification_status}.
              </p>
            </div>
            <LinkButton href="/merchant">Open merchant portal</LinkButton>
          </div>
        )}

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

      {activePrompts.length > 0 ? (
        <section className="mx-auto mt-12 max-w-6xl">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            After your events
          </p>
          <h2 className="font-display mt-2 text-3xl font-light leading-tight sm:text-4xl">
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
            <h2 className="font-display mt-2 text-3xl font-light leading-tight sm:text-4xl">
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
                registered={registeredSet.has(event.id) || true}
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

      <section className="mx-auto mt-12 max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Saved
            </p>
            <h2 className="font-display mt-2 text-3xl font-light leading-tight sm:text-4xl">
              Plans you bookmarked.
            </h2>
          </div>
          <Pill tone="peach">{saved.length}</Pill>
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
    </main>
  );
}
