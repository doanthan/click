import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Pill } from "@/components/click-ui";
import { EventAttendeePreview } from "@/components/event-attendee-preview";
import { EventBookingDialog } from "@/components/event-booking-dialog";
import { EventMediaGallery } from "@/components/event-media-gallery";
import { EventPaymentButton } from "@/components/event-payment-button";
import { EventRegistrationButton } from "@/components/event-registration-button";
import { EventBookmarkButton } from "@/components/event-bookmark-button";
import {
  getEventAttendeePreview,
  getEventBySlug,
  getProfileStatus,
} from "@/lib/event-repository";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ canceled?: string }>;
};

// Statuses an event must be in to be visible to the public. Pending (awaiting
// admin review), Rejected, and Cancelled events are hidden — the discover/browse
// queries already exclude them, and this gate closes the direct-URL hole so an
// unreviewed event can't be shared around before approval. The owning merchant
// and admins are exempt so they can still preview.
const PUBLIC_EVENT_STATUSES = new Set(["Featured", "Live", "Waitlist", "Locked"]);

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

// Google Calendar "add event" deep-link. Dates are UTC basic-format
// (YYYYMMDDTHHMMSSZ); end defaults to +2h when the event has no explicit end.
function buildGoogleCalendarUrl(opts: {
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  details: string;
}) {
  const toBasic = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = toBasic(opts.startsAt);
  const end = toBasic(
    opts.endsAt ?? new Date(new Date(opts.startsAt).getTime() + 2 * 3_600_000).toISOString(),
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${start}/${end}`,
    location: opts.location,
    details: opts.details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default async function EventDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const search = searchParams ? await searchParams : undefined;
  const session = await auth();

  const [event, profileStatus, attendeePreview] = await Promise.all([
    getEventBySlug(slug, session),
    session?.user ? getProfileStatus(session) : null,
    getEventAttendeePreview(slug, 8),
  ]);

  if (!event) notFound();

  // Hide not-yet-public events (pending review, rejected, cancelled) from
  // everyone except the owning merchant and admins. Without this, a direct slug
  // link rendered the full listing — RSVP button and all — for any visitor.
  if (!PUBLIC_EVENT_STATUSES.has(event.status)) {
    const isAdmin = profileStatus?.role === "admin";
    const isOwner =
      Boolean(event.merchantProfileId) &&
      profileStatus?.merchantProfile?.id === event.merchantProfileId;
    if (!isAdmin && !isOwner) notFound();
  }

  const startsAtMs = new Date(event.startsAt).getTime();
  // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
  const daysUntilStart = Math.ceil((startsAtMs - Date.now()) / 86_400_000);
  const countdownLabel =
    daysUntilStart <= 0
      ? "Starting soon"
      : daysUntilStart === 1
        ? "Tomorrow"
        : `${daysUntilStart} days to go`;

  const isRegistered = event.viewerRsvpStatus === "confirmed";
  const isWaitlisted = event.viewerRsvpStatus === "waitlisted";
  const isPendingPayment = event.viewerRsvpStatus === "pending_payment";
  const isFull = event.attendees >= event.capacity;
  const isWaitlistMode = event.status === "Waitlist" || isFull;
  const isLockedEvent = event.status === "Locked" && !isRegistered;
  const isPaid = event.priceCents > 0;
  const bookmarked = profileStatus?.bookmarkedEventIds.includes(event.id) ?? false;
  const showStripeUnavailableHint = isPaid && !process.env.STRIPE_SECRET_KEY;
  const isAuthenticated = Boolean(session?.user);

  const successDetails = {
    title: event.title,
    dateLabel: formatLongDate(event.startsAt),
    timeLabel: formatTimeRange(event.startsAt, event.endsAt),
    location: event.location,
    suburb: event.suburb,
    slug: event.id,
    calendarUrl: buildGoogleCalendarUrl({
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: [event.location, event.address, event.suburb]
        .filter(Boolean)
        .join(", "),
      details: `You're going to ${event.title}. See details: ${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000"}/events/${event.id}`,
    }),
  };

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

        <div className="mt-6">
          <EventMediaGallery
            items={event.media}
            statusLabel={event.status}
            categoryLabel={event.category}
          />
        </div>

        <article className="mt-8 overflow-hidden rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
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
                      <Link
                        key={tag}
                        href={`/events?tag=${encodeURIComponent(tag)}`}
                        className="inline-flex items-center"
                      >
                        <Pill>#{tag}</Pill>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              <EventAttendeePreview
                items={attendeePreview.items}
                totalConfirmed={attendeePreview.totalConfirmed}
                isAuthenticated={isAuthenticated}
                eventSlug={event.id}
              />
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
                  <span
                    className={`inline-flex items-center rounded-full border-2 border-[color:var(--line)] px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider hard-shadow-sm ${
                      isFull
                        ? "bg-[color:var(--ink)] text-[color:var(--on-deep)]"
                        : "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
                    }`}
                  >
                    {isFull ? "Fully booked" : "Limited spaces!"}
                  </span>
                </div>

                <div className="mt-6 grid gap-2">
                  {isPendingPayment ? (
                    <p className="rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-3 text-xs font-bold text-[color:var(--mauve)]">
                      A previous checkout is still pending. Try again or wait
                      for it to expire.
                    </p>
                  ) : null}

                  {isRegistered || isWaitlisted ? (
                    <EventRegistrationButton
                      eventId={event.id}
                      initiallyRegistered
                      isWaitlist={isWaitlisted}
                    />
                  ) : isWaitlistMode ? (
                    <EventBookingDialog
                      triggerLabel="Join the waitlist"
                      triggerTone="ink"
                      title="Join the waitlist?"
                      body={
                        <>
                          This event is currently full. Joining the waitlist holds
                          your spot in queue. If someone cancels, the host will
                          reach out via email and you can confirm before the seat
                          is reopened.
                        </>
                      }
                    >
                      <EventRegistrationButton
                        eventId={event.id}
                        initiallyRegistered={false}
                        isWaitlist
                      />
                    </EventBookingDialog>
                  ) : isPaid ? (
                    showStripeUnavailableHint ? (
                      <p className="rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--rose)]/30 p-3 text-xs font-bold">
                        Stripe isn&apos;t configured on this server — set
                        STRIPE_SECRET_KEY in .env.local to enable paid bookings.
                      </p>
                    ) : (
                      <EventBookingDialog
                        triggerLabel={`Reserve · ${formatPrice(event.priceCents, "AUD")}`}
                        title={`Reserve a seat for ${formatPrice(event.priceCents, "AUD")}?`}
                        body={
                          <>
                            We&apos;ll hold your seat through Stripe checkout. If you
                            don&apos;t complete payment, the hold is released and the
                            seat returns to the pool. Cancel anytime before the
                            event.
                          </>
                        }
                      >
                        <EventPaymentButton
                          eventId={event.id}
                          priceLabel={formatPrice(event.priceCents, "AUD")}
                        />
                      </EventBookingDialog>
                    )
                  ) : (
                    <EventBookingDialog
                      triggerLabel="Reserve free seat"
                      title="RSVP to this event?"
                      body={
                        <>
                          Reserve your seat. You can cancel any time before the
                          event — the host gets a waitlist replacement automatically.
                        </>
                      }
                    >
                      <EventRegistrationButton
                        eventId={event.id}
                        initiallyRegistered={false}
                        isWaitlist={false}
                        successDetails={successDetails}
                      />
                    </EventBookingDialog>
                  )}

                  <EventBookmarkButton
                    eventId={event.id}
                    initiallySaved={bookmarked}
                  />
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--ink)] p-4 text-[color:var(--on-deep)] hard-shadow-sm">
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--peach)]">
                  Countdown
                </p>
                <p className="font-display mt-1 text-2xl font-light leading-tight">
                  {countdownLabel}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[color:var(--peach)]">
                  {attendeePreview.totalConfirmed} of {event.capacity} seats taken
                </p>
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
