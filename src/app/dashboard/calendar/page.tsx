import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UserCalendar } from "@/components/user-calendar";
import { EventAgendaList } from "@/components/event-agenda-list";
import { getConfirmedEvents } from "@/lib/event-repository";
import { reconcileCheckoutSession } from "@/lib/stripe-sync";

export const metadata = {
  title: "Calendar | Click",
  description: "Your booked events on a month-by-month grid.",
};

type PageProps = {
  searchParams?: Promise<{ month?: string; booked?: string; session_id?: string }>;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/calendar");
  }

  const search = searchParams ? await searchParams : undefined;

  // Fulfill-on-return: when Stripe redirects back here after a paid checkout it
  // appends the Checkout Session id. Reconcile it BEFORE loading dashboard data
  // so the just-paid event is already 'confirmed' and shows up on this first
  // render — instead of waiting on (or, in dev, never receiving) the webhook.
  // Idempotent and best-effort: a failure here just defers to the webhook.
  if (search?.session_id) {
    await reconcileCheckoutSession(search.session_id).catch(() => null);
  }

  // The calendar shows the FULL history — upcoming RSVPs plus past events
  // (rendered as "Ended" chips) — so members can look back at where they've
  // been, not just what's coming up.
  const confirmed = await getConfirmedEvents(session);
  const calendarEvents = [...confirmed.upcoming, ...confirmed.past];

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
              Your calendar
            </h1>
            <p className="mt-1.5 max-w-[560px] text-sm leading-relaxed text-[color:var(--slate)]">
              Every event you&apos;ve booked, laid out by day. Tap an event to see its details.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/discover" className="ck-btn ck-btn--sm ck-btn--primary">
              <span className="ck-btn__label">Find more events</span>
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <UserCalendar events={calendarEvents} monthParam={search?.month} bookedSlug={search?.booked} />
        </div>

        {calendarEvents.length === 0 ? (
          <div className="mt-6 rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-8 text-center">
            <p className="font-display text-[1.05rem] font-semibold text-[color:var(--ink)]">No bookings yet.</p>
            <p className="mx-auto mt-2 max-w-[380px] text-sm leading-relaxed text-[color:var(--ink-soft)]">
              Browse events and reserve a spot - they&apos;ll show up here.
            </p>
          </div>
        ) : (
          // Full chronological list so every plan is visible at once — the month
          // grid above only shows one month, so events in other months would
          // otherwise sit behind the prev/next arrows.
          <EventAgendaList upcoming={confirmed.upcoming} past={confirmed.past} />
        )}
      </div>
    </main>
  );
}
