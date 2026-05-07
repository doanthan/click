import Link from "next/link";
import { auth } from "@/auth";
import { AIMatchPanel } from "@/components/ai-match-panel";
import { LinkButton, Pill } from "@/components/click-ui";
import { EventCard } from "@/components/event-card";
import { clickEvents, type EventItem } from "@/lib/click-data";
import { getDashboardData } from "@/lib/event-repository";

export const metadata = {
  title: "Dashboard | Click",
  description:
    "Your Click dashboard — upcoming plans, new events near you, and Click Radar.",
};

const greetingByHour = (hour: number) => {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good evening";
};

function timeUntil(iso: string) {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  if (Number.isNaN(target)) return null;
  if (diffMs <= 0) return { label: "Happening now", urgent: true };
  const minutes = Math.round(diffMs / 60000);
  const hours = Math.round(diffMs / 3.6e6);
  const days = Math.round(diffMs / 8.64e7);
  if (minutes < 60) return { label: `In ${minutes} min`, urgent: minutes <= 90 };
  if (hours < 24) return { label: `In ${hours} hr`, urgent: hours <= 6 };
  if (days < 14) return { label: `In ${days} day${days === 1 ? "" : "s"}`, urgent: days <= 2 };
  const weeks = Math.round(days / 7);
  return { label: `In ${weeks} weeks`, urgent: false };
}

const activityIconForType = (kind: string) => {
  if (kind === "rsvp") return "✓";
  if (kind === "click") return "♥";
  if (kind === "waitlist") return "⌛";
  if (kind === "match") return "✷";
  return "•";
};

const sampleActivity: Array<{
  kind: "rsvp" | "click" | "waitlist" | "match";
  who: string;
  what: string;
  when: string;
}> = [
  { kind: "rsvp",     who: "You",        what: "RSVPed to Slow Dating: Dinner Tables of Six", when: "2 hours ago" },
  { kind: "match",    who: "Click Radar",what: "3 new people share your weekend interests",   when: "Yesterday" },
  { kind: "waitlist", who: "Maya",       what: "Joined the waitlist for New Friends Picnic",   when: "2 days ago" },
  { kind: "click",    who: "You",        what: "Clicked privately on Theo from CrossFit Coffee", when: "3 days ago" },
  { kind: "rsvp",     who: "Noah",       what: "Saved Career Change Walk and Talk",            when: "5 days ago" },
];

export default async function DashboardPage() {
  const session = await auth();
  const dashboard = await getDashboardData(session);

  const upcomingEvents: EventItem[] =
    dashboard.upcomingEvents.length > 0 ? dashboard.upcomingEvents : clickEvents.slice(0, 2);

  const upcomingIds = new Set(upcomingEvents.map((event) => event.id));
  const newEvents = clickEvents.filter((event) => !upcomingIds.has(event.id)).slice(0, 4);
  const savedSuggestions = dashboard.savedEvents.length > 0
    ? dashboard.savedEvents
    : clickEvents.slice(2, 5);

  const nextUp = [...upcomingEvents].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )[0];
  const nextUpCountdown = nextUp ? timeUntil(nextUp.startsAt) : null;

  const sydneyHour = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    hour12: false,
  });
  const greeting = greetingByHour(Number(sydneyHour));
  const isAuthed = Boolean(session?.user);
  const firstName = isAuthed
    ? (dashboard.userName.split(" ")[0] || "friend")
    : "there";

  return (
    <main className="paper-noise relative min-h-screen overflow-hidden text-[color:var(--ink)]">
      {/* ============================ WELCOME ============================ */}
      <section className="relative overflow-hidden border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 pb-12 pt-12 sm:px-6 lg:pt-16">
        <div className="confetti-field absolute inset-0 opacity-25" aria-hidden />

        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="sticker sticker--peach tilt-l-2">
                <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
                {greeting} · Sydney
              </span>
              <h1 className="font-display mt-5 text-5xl font-light leading-[0.95] tracking-tight sm:text-6xl lg:text-[5.5rem]">
                Hi <span className="italic">{firstName}</span>
                <span className="font-script ml-2 text-[1.05em] text-[color:var(--rose)]">
                  ✷
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
                Here&apos;s what&apos;s next on your calendar, and a few new
                events that fit how you like to show up.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/events" variant="secondary">
                Browse all events
              </LinkButton>
              <LinkButton href="/discover">Find people</LinkButton>
            </div>
          </div>

          {/* Stats trio */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Upcoming", value: dashboard.stats.upcoming.toString(), tone: "peach" },
              { label: "Saved", value: dashboard.stats.saved.toString(), tone: "cream" },
              { label: "Private clicks", value: dashboard.stats.clicks.toString(), tone: "rose" },
              { label: "Radar", value: dashboard.stats.radar, tone: "ink" },
            ].map((stat) => (
              <StatTile key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      {/* ============================ NEXT UP ============================ */}
      {nextUp ? (
        <section className="relative bg-[color:var(--champagne)] px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Next up on your calendar</p>
                <h2 className="font-display mt-2 text-4xl font-light leading-tight sm:text-5xl">
                  {nextUpCountdown?.urgent ? (
                    <span className="text-[color:var(--rose)] italic">
                      {nextUpCountdown.label}.
                    </span>
                  ) : (
                    <span>{nextUpCountdown?.label ?? "Coming up"}.</span>
                  )}{" "}
                  <span className="font-script text-[1.05em] text-[color:var(--mauve)]">
                    ready?
                  </span>
                </h2>
              </div>
              <Pill tone="peach">RSVP confirmed</Pill>
            </div>

            <article className="group mt-6 grid gap-0 overflow-hidden rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow lg:grid-cols-[1.1fr_1fr]">
              <div
                className="relative min-h-[260px] border-b-2 border-[color:var(--line)] lg:border-b-0 lg:border-r-2"
                style={{
                  backgroundImage: `url(${nextUp.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                aria-label={nextUp.imageAlt}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-[color:var(--surface-deep)]/60 via-transparent to-transparent" />
                <span className="absolute left-4 top-4 sticker sticker--rose">
                  <span className="text-[color:var(--surface-deep)]">★</span>
                  Featured plan
                </span>
              </div>
              <div className="p-6 sm:p-8">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  {nextUp.date} · {nextUp.time} · {nextUp.suburb}
                </p>
                <h3 className="font-display mt-3 text-3xl font-light leading-tight text-[color:var(--ink)] sm:text-4xl">
                  {nextUp.title}
                </h3>
                <p className="mt-2 text-sm font-semibold text-[color:var(--mauve)]">
                  Hosted by {nextUp.host} · {nextUp.group}
                </p>
                <p className="mt-4 text-base font-medium leading-7 text-[color:var(--mauve)]">
                  {nextUp.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {nextUp.tags.slice(0, 5).map((tag) => (
                    <Pill key={tag} tone="cream">
                      {tag}
                    </Pill>
                  ))}
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <LinkButton href={`/events#${nextUp.id}`} variant="primary">
                    Open event
                  </LinkButton>
                  <Link
                    href="/events"
                    className="text-sm font-bold uppercase tracking-wider text-[color:var(--mauve)] hover:text-[color:var(--ink)]"
                  >
                    Cancel RSVP →
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {/* ============================ YOUR PLANS ============================ */}
      <section className="relative bg-[color:var(--champagne)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Your plans</p>
              <h2 className="font-display mt-2 text-4xl font-light leading-tight sm:text-5xl">
                Confirmed and{" "}
                <span className="italic text-[color:var(--rose)]">on the books.</span>
              </h2>
            </div>
            <div className="flex gap-2">
              <Pill tone="peach">Upcoming · {upcomingEvents.length}</Pill>
              <Pill tone="cream">Saved · {dashboard.stats.saved}</Pill>
            </div>
          </div>

          {upcomingEvents.length === 0 ? (
            <EmptyState
              title="No plans yet."
              body="Browse events to add the first one. Your dashboard fills up as you RSVP."
              cta={{ href: "/events", label: "Browse events" }}
            />
          ) : (
            <div className="mt-7 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} compact />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============================ NEW EVENTS FOR YOU ============================ */}
      <section className="relative border-y-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">New events for you</p>
              <h2 className="font-display mt-2 text-4xl font-light leading-tight sm:text-5xl">
                Fresh plans that <span className="italic">match your vibe.</span>
              </h2>
              <p className="mt-3 max-w-xl text-base font-medium leading-7 text-[color:var(--mauve)]">
                Picked from your tags, life signals, and weekday rhythm. New
                drops appear here first.
              </p>
            </div>
            <Link
              href="/events"
              className="group inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)]"
            >
              See all events
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {newEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      </section>

      {/* ============================ CLICK RADAR ============================ */}
      <section className="relative bg-[color:var(--champagne)] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <AIMatchPanel
            defaultPrompt="Someone I might click with around weekend coffee"
            showEvents={false}
            title="Click Radar"
            peopleEyebrow="Click Radar · this week"
            peopleTitle={
              <>
                People you might <em className="text-[color:var(--rose)]">click</em> with.
              </>
            }
          />
        </div>
      </section>

      {/* ============================ ACTIVITY + SAVED ============================ */}
      <section className="relative border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-14 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Activity timeline */}
          <div>
            <p className="eyebrow">Recent activity</p>
            <h2 className="font-display mt-2 text-4xl font-light leading-tight sm:text-5xl">
              The <span className="italic text-[color:var(--rose)]">last seven days</span>{" "}
              on Click.
            </h2>
            <ol className="mt-7 space-y-4">
              {sampleActivity.map((entry, idx) => (
                <li
                  key={`${entry.who}-${idx}`}
                  className="flex gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm transition-transform duration-300 hover:-translate-x-1 hover:-translate-y-1"
                >
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] font-display text-xl ${
                      entry.kind === "rsvp"
                        ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
                        : entry.kind === "click"
                          ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                          : entry.kind === "match"
                            ? "bg-[color:var(--punch)] text-[color:var(--surface-deep)]"
                            : "bg-[color:var(--champagne)] text-[color:var(--ink)]"
                    }`}
                    aria-hidden
                  >
                    {activityIconForType(entry.kind)}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[color:var(--ink)]">
                      <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                        {entry.who}
                      </span>{" "}
                      <span className="ml-1">{entry.what}</span>
                    </p>
                    <p className="font-mono mt-1 text-[0.7rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                      {entry.when}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Saved + waitlist */}
          <div>
            <p className="eyebrow">Saved & waitlist</p>
            <h2 className="font-display mt-2 text-4xl font-light leading-tight sm:text-5xl">
              <span className="italic">Held</span> for later.
            </h2>
            <p className="mt-3 text-base font-medium leading-7 text-[color:var(--mauve)]">
              When a spot opens or a friend RSVPs, these surface to the top.
            </p>

            <div className="mt-6 grid gap-4">
              {savedSuggestions.map((event) => (
                <article
                  key={event.id}
                  className="group flex flex-col gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.4deg] sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                      {event.date} · {event.time}
                    </p>
                    <h3 className="font-display mt-2 text-2xl font-light leading-tight text-[color:var(--ink)]">
                      {event.title}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">
                      {event.suburb} · {event.price}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {event.tags.slice(0, 3).map((tag) => (
                        <Pill key={tag} tone="cream">
                          {tag}
                        </Pill>
                      ))}
                    </div>
                  </div>
                  <Pill tone={event.status === "Waitlist" ? "rose" : "peach"}>
                    {event.status}
                  </Pill>
                </article>
              ))}
            </div>

            <Link
              href="/events"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[color:var(--ink)] hover:text-[color:var(--rose)]"
            >
              See all saved
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================ NUDGE ============================ */}
      <section className="relative overflow-hidden border-t-2 border-[color:var(--surface-deep)] bg-[color:var(--surface-deep)] px-4 py-14 text-[color:var(--on-deep)] sm:px-6">
        <div className="confetti-field absolute inset-0 opacity-15" aria-hidden />
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.22em] text-[color:var(--peach)]">
            ✷ private clicks ✷
          </p>
          <h2 className="font-display mt-4 text-4xl font-light leading-[0.96] tracking-tight sm:text-5xl lg:text-6xl">
            Your clicks stay private until they&apos;re{" "}
            <span className="italic text-[color:var(--peach)]">mutual.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-[color:var(--on-deep)]/72 sm:text-lg">
            When someone clicks back, you both get an event suggestion — never a
            cold message. No empty chat threads, no pressure.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/discover" variant="light">
              Open Click Radar
            </LinkButton>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ============================ HELPERS ============================ */

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  const palette =
    tone === "rose"
      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
      : tone === "peach"
        ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
        : tone === "ink"
          ? "bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]"
          : "bg-[color:var(--cream)] text-[color:var(--ink)]";

  return (
    <article
      className={`rounded-2xl border-2 border-[color:var(--line)] p-5 hard-shadow-sm transition-transform duration-300 hover:-translate-y-1 ${palette}`}
    >
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] opacity-80">
        {label}
      </p>
      <p className="font-display mt-1 text-5xl font-light leading-none">{value}</p>
    </article>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="mt-7 grid place-items-center rounded-3xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] px-6 py-12 text-center">
      <p className="font-script text-3xl text-[color:var(--rose)]">nothing here yet ✷</p>
      <h3 className="font-display mt-2 text-3xl font-light text-[color:var(--ink)]">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm font-medium text-[color:var(--mauve)]">
        {body}
      </p>
      <div className="mt-5">
        <LinkButton href={cta.href}>{cta.label}</LinkButton>
      </div>
    </div>
  );
}
