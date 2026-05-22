import Link from "next/link";
import type { ReactNode } from "react";
import { MetricCard, SectionIntro } from "@/components/click-ui";
import {
  listBscEvents,
  listBscGroups,
  listBscPrayerPosts,
  listBscTestimonies,
} from "@/lib/bible-study";

export default async function Home() {
  const [groups, prayers, testimonies, events] = await Promise.all([
    listBscGroups({}),
    listBscPrayerPosts(),
    listBscTestimonies(),
    listBscEvents(),
  ]);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="paper-noise border-b border-[color:var(--line-soft)] px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="eyebrow">Bible Study Connect</p>
            <h1 className="font-display mt-5 text-5xl font-light leading-[0.98] tracking-tight sm:text-7xl">
              Find a faithful group close to home.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[color:var(--mauve)]">
              Browse Bible studies, prayer circles, testimonies, and local
              events. Reading is open to everyone. Posting and joining are
              protected by profile and age gates.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <HomeButton href="/groups" primary>
                Browse groups
              </HomeButton>
              <HomeButton href="/sign-up">Create account</HomeButton>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Public groups" value={groups.length.toString()} tone="cream" />
            <MetricCard label="Prayer posts" value={prayers.length.toString()} tone="peach" />
            <MetricCard label="Testimonies" value={testimonies.length.toString()} tone="rose" />
            <MetricCard label="Upcoming events" value={events.length.toString()} tone="ink" />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Community paths"
            title="Start by reading, then take one faithful step."
            body="Public discovery remains open. Community actions use Clerk sessions, a complete profile, and age verification before posting or joining."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Groups", "Search by suburb, city, postcode, denomination, meeting type, age group, and day.", "/groups"],
              ["Prayer Wall", "Post requests, share praise reports, mark prayers answered, and pray for others.", "/prayer"],
              ["Testimonies", "Submit stories for admin approval and browse public testimonies of faith.", "/testimonies"],
              ["Waitlist", "If no group fits, join a location waitlist and help form a new group.", "/waitlist"],
            ].map(([title, body, href]) => (
              <Link
                key={title}
                href={href}
                className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-5 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <h2 className="font-display text-3xl font-light leading-tight">{title}</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                  {body}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function HomeButton({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-full border border-[color:var(--line-soft)] bg-[color:var(--ink)] px-6 py-3 text-sm font-bold text-[color:var(--champagne)]"
          : "rounded-full border border-[color:var(--line-soft)] bg-[color:var(--cream)] px-6 py-3 text-sm font-bold text-[color:var(--ink)]"
      }
    >
      {children}
    </Link>
  );
}
