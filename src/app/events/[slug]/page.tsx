import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Pill } from "@/components/click-ui";
import { EventPaymentButton } from "@/components/event-payment-button";
import { EventRegistrationButton } from "@/components/event-registration-button";
import { EventBookmarkButton } from "@/components/event-bookmark-button";
import { getEventBySlug, getProfileStatus } from "@/lib/event-repository";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ canceled?: string }>;
};

function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(iso));
}

function formatTimeRange(startIso: string, endIso: string | null) {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Sydney",
  });
  const start = formatter.format(new Date(startIso));
  const end = endIso ? formatter.format(new Date(endIso)) : null;
  return end ? `${start} – ${end}` : start;
}

function formatPrice(cents: number, currency: string) {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function EventDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const search = searchParams ? await searchParams : undefined;
  const session = await auth();

  const [event, profileStatus] = await Promise.all([
    getEventBySlug(slug, session),
    session?.user ? getProfileStatus(session) : null,
  ]);

  if (!event) notFound();

  const isRegistered = event.viewerRsvpStatus === "confirmed";
  const isWaitlisted = event.viewerRsvpStatus === "waitlisted";
  const isPendingPayment = event.viewerRsvpStatus === "pending_payment";
  const isFull = event.attendees >= event.capacity;
  const isWaitlistMode = event.status === "Waitlist" || isFull;
  const isLockedEvent = event.status === "Locked" && !isRegistered;
  const isPaid = event.priceCents > 0;
  const seatsLeft = Math.max(0, event.capacity - event.attendees);
  const fullness = Math.min((event.attendees / event.capacity) * 100, 100);
  const bookmarked = profileStatus?.bookmarkedEventIds.includes(event.id) ?? false;
  const showStripeUnavailableHint = isPaid && !process.env.STRIPE_SECRET_KEY;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/events"
          className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)] hover:text-[color:var(--ink)]"
        >
          ← Back to events
        </Link>

        {search?.canceled ? (
          <div className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-4 text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm">
            Checkout was cancelled. Your seat hold was released — you can try
            again any time.
          </div>
        ) : null}

        <article className="mt-6 overflow-hidden rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
          <div className="relative h-64 w-full overflow-hidden border-b-2 border-[color:var(--line)] sm:h-96">
            <Image
              src={event.image}
              alt={event.imageAlt}
              fill
              sizes="(min-width: 1024px) 960px, 100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ink)]/40 via-transparent to-transparent" />
            <span className="absolute left-4 top-4 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--surface-deep)] hard-shadow-sm">
              {event.status}
            </span>
            <span className="absolute right-4 top-4 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider hard-shadow-sm">
              {event.category}
            </span>
          </div>

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_320px]">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                {formatLongDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
              </p>
              <h1 className="font-display mt-3 text-4xl font-light leading-[1.05] sm:text-5xl">
                {event.title}
              </h1>
              <p className="mt-2 text-sm font-semibold text-[color:var(--mauve)]">
                Hosted by {event.host} <span className="opacity-50">·</span> {event.group}
              </p>

              <section className="mt-8">
                <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  About this event
                </h2>
                <p className="mt-3 text-base leading-7 text-[color:var(--ink)]">
                  {event.description}
                </p>
              </section>

              {event.relationshipGoal ? (
                <section className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5">
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    Why this event ✷
                  </p>
                  <p className="mt-2 text-base font-bold leading-6">{event.relationshipGoal}</p>
                </section>
              ) : null}

              {event.tags.length > 0 ? (
                <section className="mt-6">
                  <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    Tags
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.tags.map((tag) => (
                      <Pill key={tag}>{tag}</Pill>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Price
                </p>
                <p className="font-display mt-1 text-3xl font-light leading-tight">
                  {formatPrice(event.priceCents, "AUD")}
                </p>

                <div className="mt-5">
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    Location
                  </p>
                  {isLockedEvent ? (
                    <p className="mt-1 text-sm font-bold leading-6">
                      🔒 {event.suburb} — exact venue revealed after RSVP.
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm font-bold leading-6">{event.location}</p>
                      {event.address ? (
                        <p className="text-sm font-medium text-[color:var(--mauve)]">
                          {event.address}
                        </p>
                      ) : null}
                      <p className="text-sm font-medium text-[color:var(--mauve)]">
                        {event.suburb}
                      </p>
                    </>
                  )}
                </div>

                <div className="mt-5">
                  <div className="flex justify-between text-xs font-bold text-[color:var(--mauve)]">
                    <span>Seats</span>
                    <span>
                      {isFull
                        ? "Full"
                        : `${seatsLeft} of ${event.capacity} left`}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)]">
                    <div
                      className={`h-full rounded-full ${isFull ? "bg-[color:var(--ink)]" : "bg-[color:var(--rose)]"}`}
                      style={{ width: `${fullness}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-2">
                  {isPendingPayment ? (
                    <p className="rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-3 text-xs font-bold text-[color:var(--mauve)]">
                      A previous checkout is still pending. Try again or wait
                      for it to expire.
                    </p>
                  ) : null}

                  {isPaid && !isWaitlistMode && !isRegistered ? (
                    showStripeUnavailableHint ? (
                      <p className="rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--rose)]/30 p-3 text-xs font-bold">
                        Stripe isn&apos;t configured on this server — set
                        STRIPE_SECRET_KEY in .env.local to enable paid bookings.
                      </p>
                    ) : (
                      <EventPaymentButton
                        eventId={event.id}
                        priceLabel={formatPrice(event.priceCents, "AUD")}
                      />
                    )
                  ) : (
                    <EventRegistrationButton
                      eventId={event.id}
                      initiallyRegistered={isRegistered || isWaitlisted}
                      isWaitlist={isWaitlistMode}
                    />
                  )}

                  <EventBookmarkButton
                    eventId={event.id}
                    initiallySaved={bookmarked}
                  />
                </div>
              </div>

              {event.fomo ? (
                <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-4 text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm">
                  ✷ {event.fomo}
                </div>
              ) : null}
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}
