import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UserCalendar } from "@/components/user-calendar";
import { getDashboardData } from "@/lib/event-repository";

export const metadata = {
  title: "Calendar | Click",
  description: "Your booked events on a month-by-month grid.",
};

type PageProps = {
  searchParams?: Promise<{ month?: string; booked?: string }>;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/calendar");
  }

  const search = searchParams ? await searchParams : undefined;
  const dashboard = await getDashboardData(session);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="sticker sticker--peach tilt-l-2 inline-flex">
              <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
              Calendar
            </span>
            <h1 className="font-display mt-6 text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
              Your <span className="italic">plans</span>.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
              Every event you&apos;ve booked or paid for, laid out by day. Tap an
              event to see its details.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-xs font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Back to dashboard
            </Link>
            <Link
              href="/events"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-xs font-bold text-[color:var(--surface-deep)]"
            >
              Find more events
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <UserCalendar
            events={dashboard.upcomingEvents}
            monthParam={search?.month}
            bookedSlug={search?.booked}
          />
        </div>

        {dashboard.upcomingEvents.length === 0 ? (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
            <p className="text-base font-bold">No bookings yet.</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              Browse events and reserve a spot — they&apos;ll show up here.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
