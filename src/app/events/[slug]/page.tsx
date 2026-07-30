import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Icon, Tag } from "@/components/ds";
import { EventAttendeePreview } from "@/components/event-attendee-preview";
import { EventBookingDialog } from "@/components/event-booking-dialog";
import { EventMediaGallery } from "@/components/event-media-gallery";
import { EventVenueMap } from "@/components/event-venue-map";
import { EventPaymentButton } from "@/components/event-payment-button";
import { EventRegistrationButton } from "@/components/event-registration-button";
import { EventBookmarkButton } from "@/components/event-bookmark-button";
import { MyGuestSeats } from "@/components/my-guest-seats";
import { PostEventClickCard } from "@/components/post-event-click-card";
import { ShareEventButton } from "@/components/share-event-button";
import {
  getEventAttendeePreview,
  getEventBySlug,
  getMyGuestSeatsForEvent,
  getPostEventClickPromptForEvent,
  getProfileStatus,
  getSystemSettings,
} from "@/lib/event-repository";
import { reconcileCheckoutSession } from "@/lib/stripe-sync";
import { quoteCancellationRefund, refundQuoteLabel } from "@/lib/refund-policy";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    canceled?: string;
    booked?: string;
    session_id?: string;
    cancelled?: string;
  }>;
};

// Statuses an event must be in to be visible to the public. Pending (awaiting
// admin review), Rejected, and Cancelled events are hidden - the discover/browse
// queries already exclude them, and this gate closes the direct-URL hole so an
// unreviewed event can't be shared around before approval. The owning merchant
// and admins are exempt so they can still preview.
const PUBLIC_EVENT_STATUSES = new Set(["Featured", "Live", "Waitlist", "Locked"]);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const session = await auth();
  const event = await getEventBySlug(slug, session);
  if (!event || !PUBLIC_EVENT_STATUSES.has(event.status)) {
    return { title: "Event not found", robots: { index: false, follow: false } };
  }
  const description = event.description.slice(0, 155);
  return {
    title: event.title,
    description,
    alternates: { canonical: `/events/${event.id}` },
    openGraph: {
      type: "website",
      url: `/events/${event.id}`,
      title: event.title,
      description,
      images: [{ url: event.image, alt: event.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [event.image],
    },
  };
}

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
  return end ? `${start} - ${end}` : start;
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

  // Fulfill-on-return: when Stripe redirects back here after a paid checkout it
  // appends the Checkout Session id. Reconcile it BEFORE loading the event so
  // the viewer's RSVP status already reads 'confirmed' on this first render -
  // the details unlock and the "pay" prompt is gone without waiting on (or, in
  // dev, never receiving) the webhook. Idempotent and best-effort: a failure
  // here just defers to the webhook / calendar reconcile.
  if (search?.session_id) {
    await reconcileCheckoutSession(search.session_id).catch(() => null);
  }

  const [event, profileStatus, attendeePreview, systemSettings, postEventPrompt, myGuestSeats] =
    await Promise.all([
      getEventBySlug(slug, session),
      session?.user ? getProfileStatus(session) : null,
      getEventAttendeePreview(slug, session, 8),
      getSystemSettings(),
      session?.user ? getPostEventClickPromptForEvent(slug, session) : null,
      session?.user ? getMyGuestSeatsForEvent(slug, session) : [],
    ]);

  if (!event) notFound();

  // Hide not-yet-public events (pending review, rejected, cancelled) from
  // everyone except the owning merchant and admins. Without this, a direct slug
  // link rendered the full listing - RSVP button and all - for any visitor.
  const isAdmin = profileStatus?.role === "admin";
  const isOwner =
    Boolean(event.merchantProfileId) &&
    profileStatus?.merchantProfile?.id === event.merchantProfileId;
  if (!PUBLIC_EVENT_STATUSES.has(event.status) && !isAdmin && !isOwner) {
    notFound();
  }

  const startsAtMs = new Date(event.startsAt).getTime();
  // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
  const nowMs = Date.now();
  const endsAtMs = new Date(event.endsAt ?? event.startsAt).getTime();
  const eventHasEnded = endsAtMs <= nowMs;
  const daysUntilStart = Math.ceil((startsAtMs - nowMs) / 86_400_000);
  const countdownLabel = eventHasEnded
    ? "Ended"
    : daysUntilStart <= 0
      ? "Starting soon"
      : daysUntilStart === 1
        ? "Tomorrow"
        : `${daysUntilStart} days to go`;

  const isRegistered = event.viewerRsvpStatus === "confirmed";
  const isWaitlisted = event.viewerRsvpStatus === "waitlisted";
  // A freed seat was offered to this waitlisted viewer and the 30-min hold is
  // still open - drives the "Confirm your spot" CTA.
  const waitlistOfferExpiresAt = isWaitlisted ? event.waitlistOfferExpiresAt : null;
  const isPendingPayment = event.viewerRsvpStatus === "pending_payment";
  const isFull = event.attendees >= event.capacity;
  const isWaitlistMode = event.status === "Waitlist" || isFull;
  const isPaid = event.priceCents > 0;
  // Past events are closed: once the end time (or start, if no end) has passed
  // we hide every RSVP/pay/waitlist CTA and show an "ended" notice instead.
  const hasEnded = eventHasEnded;
  // Booking fee mirrors the checkout calc (createPaymentHold): a % of the ticket,
  // charged on top, kept by the platform. Shown to the buyer before they reserve
  // so the price they see equals the price Stripe charges.
  const bookingFeeCents = isPaid
    ? Math.round((event.priceCents * systemSettings.bookingFeeBps) / 10_000)
    : 0;
  const totalCents = event.priceCents + bookingFeeCents;
  const hasBookingFee = bookingFeeCents > 0;
  // Exact refund the viewer would get if they cancel their paid booking now -
  // shown in the cancel confirmation so the number matches what we refund.
  const cancelRefundLabel =
    isPaid && isRegistered
      ? refundQuoteLabel(quoteCancellationRefund(totalCents, event.startsAt), "AUD")
      : null;
  // The venue map unlocks for people who've confirmed their seat (or who manage
  // the event) - the "paid & confirmed" unlocked state the venue/map live in.
  const venueUnlocked = isRegistered || isAdmin || isOwner;
  const venueMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [event.location, event.address, event.suburb, event.city].filter(Boolean).join(", "),
  )}`;
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
      location: [event.location, event.address, event.suburb, event.city]
        .filter(Boolean)
        .join(", "),
      details: `You're going to ${event.title}. See details: ${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}/events/${event.id}`,
    }),
  };

  const seatsTaken = attendeePreview.totalConfirmed;
  const capacityPct = event.capacity > 0 ? Math.min(100, Math.round((seatsTaken / event.capacity) * 100)) : 0;
  const notice = search?.canceled
    ? "Checkout was cancelled. Your seat hold was released - you can try again any time."
    : search?.cancelled
      ? `Your RSVP was cancelled.${isPaid ? " Any refund will appear in 3 to 5 business days." : ""} The venue details lock again, but you can RSVP any time before the event.`
      : null;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[1180px] pt-4">
        {/* Canonical quiet back link on its own row - same form on every sub-page. */}
        <Link
          href="/discover"
          className="font-display inline-flex items-center gap-1 text-[13.5px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
        >
          <Icon name="chevL" size={16} stroke={2.2} /> Back
        </Link>

        {notice ? (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4 text-sm text-[color:var(--ink-soft)]">
            {notice}
          </div>
        ) : null}

        {search?.booked && isRegistered ? (
          <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] p-4 text-sm text-[color:var(--purple-800)]">
            <Icon name="check" size={18} stroke={2.6} className="mt-0.5 text-[color:var(--sage)]" />
            <span>
              <b className="font-semibold">You&apos;re going.</b> Your seat is locked and the full details are unlocked
              below - it&apos;s on your{" "}
              <Link href="/dashboard/calendar" className="font-semibold underline">
                calendar
              </Link>
              .
              {profileStatus && !profileStatus.photoUrl ? (
                <span className="mt-1 block">
                  Add a profile photo so people can recognise you -{" "}
                  <Link href="/profile/edit" className="font-semibold underline">
                    add a pic
                  </Link>
                  .
                </span>
              ) : null}
            </span>
          </div>
        ) : null}

        <div className="mt-5 grid items-start gap-9 lg:grid-cols-[minmax(0,1fr)_372px]">
          {/* ---- Content column ---- */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-[var(--radius-xl)]">
              <EventMediaGallery items={event.media} statusLabel={event.status} categoryLabel={event.category} />
            </div>

            {/* Title is the focal point; the panel owns date/time/location, so
                the title goes straight to the category + all interest tags. */}
            <h1 className="font-display mt-6 text-[length:var(--text-h1)] leading-[1.2] font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
              {event.title}
            </h1>
            <p className="mt-2 text-sm font-medium text-[color:var(--slate)]">
              Hosted by {event.host} · {event.group}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex h-[22px] items-center rounded-full bg-[color:var(--lavender-100)] px-2.5 text-xs font-semibold text-[color:var(--purple-700)]">
                {event.category}
              </span>
              {/* The event detail page is the ONE surface that shows every tag. */}
              {event.tags.map((tag) => (
                <Link key={tag} href={`/discover?tag=${encodeURIComponent(tag)}`}>
                  <Tag dense>{tag}</Tag>
                </Link>
              ))}
              <span className="ml-1">
                <ShareEventButton title={event.title} slug={event.id} />
              </span>
            </div>

            <p className="mt-6 text-[15px] leading-[1.65] text-pretty text-[color:var(--ink-soft)]">
              {event.description}
            </p>

            {isRegistered && myGuestSeats.length > 0 ? (
              <MyGuestSeats perSeatCents={totalCents} eventDateISO={event.startsAt} seats={myGuestSeats} />
            ) : null}

            {event.relationshipGoal ? (
              <div className="mt-6 rounded-[var(--radius-lg)] bg-[color:var(--lav-bg)] p-5">
                <p className="text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--purple-700)]">Why this event</p>
                <p className="mt-2 text-[15px] font-medium leading-6 text-[color:var(--ink)]">{event.relationshipGoal}</p>
              </div>
            ) : null}

            <div className="mt-8">
              <EventAttendeePreview
                items={attendeePreview.items}
                totalConfirmed={attendeePreview.totalConfirmed}
                isAuthenticated={isAuthenticated}
                viewerIsAttendee={isRegistered || isAdmin || isOwner}
                eventSlug={event.id}
              />
            </div>

            {/* Photo nudge - unlocked/booked only (recognise each other on the night). */}
            {isAuthenticated && venueUnlocked && profileStatus && !profileStatus.photoUrl ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] px-5 py-4">
                <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--purple-800)]">
                  <Icon name="camera" size={17} className="text-[color:var(--purple)]" />
                  Add a profile photo so people can recognise you at this event.
                </p>
                <Link href="/profile/edit" className="ck-btn ck-btn--sm ck-btn--primary shrink-0">
                  <span className="ck-btn__label">Add a photo</span>
                </Link>
              </div>
            ) : null}

            {postEventPrompt ? (
              <div className="mt-6">
                <PostEventClickCard prompt={postEventPrompt} />
              </div>
            ) : null}
          </div>

          {/* ---- Booking panel - the single home for date/time/location/price/capacity ---- */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-md)]">
              {/* Price - Ink anchor; "$X per person" or Free, never price-in-button. */}
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-display text-[26px] font-semibold tracking-[-0.01em] ${
                    isPaid ? "text-[color:var(--ink)]" : "text-[color:var(--sage)]"
                  }`}
                >
                  {formatPrice(hasBookingFee ? totalCents : event.priceCents, "AUD")}
                </span>
                {isPaid ? <span className="text-[13px] font-medium text-[color:var(--slate)]">per person</span> : null}
              </div>
              {hasBookingFee ? (
                <p className="mt-1 text-xs font-medium text-[color:var(--slate)]">
                  {formatPrice(event.priceCents, "AUD")} ticket + {formatPrice(bookingFeeCents, "AUD")} booking fee
                </p>
              ) : null}

              {/* When */}
              <div className="mt-4 flex items-start gap-2.5 text-sm text-[color:var(--ink-soft)]">
                <Icon name="calendar" size={16} className="mt-0.5 text-[color:var(--purple)]" />
                <span>
                  {formatLongDate(event.startsAt)}
                  <span className="block text-[color:var(--slate)]">{formatTimeRange(event.startsAt, event.endsAt)}</span>
                </span>
              </div>

              {/* Location - locked until the viewer RSVPs */}
              {!venueUnlocked ? (
                <div className="mt-3 flex items-start gap-2.5 rounded-[var(--radius-lg)] bg-[color:var(--lav-bg)] px-3.5 py-3 text-[13px] text-[color:var(--ink-soft)]">
                  <Icon name="lock" size={16} className="mt-0.5 text-[color:var(--slate)]" />
                  <span>
                    <b className="font-semibold text-[color:var(--ink)]">{event.suburb}</b> - venue revealed when you RSVP.
                  </span>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="flex items-start gap-2.5 text-sm text-[color:var(--ink-soft)]">
                    <Icon name="pin" size={16} className="mt-0.5 text-[color:var(--purple)]" />
                    <span>
                      <b className="font-semibold text-[color:var(--ink)]">{event.location}</b>
                      <span className="block text-[color:var(--slate)]">
                        {[event.address, event.suburb, event.city].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </div>
                  {event.lat && event.lng ? (
                    <div className="mt-3">
                      <EventVenueMap
                        lat={event.lat}
                        lng={event.lng}
                        label={[event.location, event.address, event.suburb, event.city].filter(Boolean).join(", ")}
                        mapsUrl={venueMapsUrl}
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`/api/events/${event.id}/ics`} className="ck-btn ck-btn--sm ck-btn--secondary">
                      <span className="ck-btn__label">
                        <Icon name="calendar" size={15} /> Add to calendar
                      </span>
                    </a>
                    <a
                      href={successDetails.calendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ck-btn ck-btn--sm ck-btn--secondary"
                    >
                      <span className="ck-btn__label">Google</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Capacity meter */}
              <div className="mt-4 border-t border-[color:var(--mist)] pt-4">
                <div className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-[color:var(--slate)]">
                  <span>{isFull ? "Fully booked" : `${seatsTaken} of ${event.capacity} going`}</span>
                  {countdownLabel !== "Ended" ? <span>{countdownLabel}</span> : null}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[color:var(--lavender-100)]">
                  <div
                    className={`h-full rounded-full ${capacityPct >= 85 ? "bg-[color:var(--coral)]" : "bg-[color:var(--purple)]"}`}
                    style={{ width: `${Math.max(4, capacityPct)}%` }}
                  />
                </div>
              </div>

              {/* CTA stack - every branch preserved; only the chrome is DS now. */}
              <div className="mt-5 grid gap-2">
                {hasEnded ? (
                  <div className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                    This event has ended.{" "}
                    <Link href="/discover" className="font-semibold text-[color:var(--purple)] underline">
                      Find an upcoming event →
                    </Link>
                  </div>
                ) : (
                  <>
                    {event.viewerClashEventTitle ? (
                      <p className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--amber)_14%,var(--paper))] p-3 text-[13px] text-[color:var(--amber-ink)]">
                        Heads up - this clashes with{" "}
                        <span className="font-semibold">{event.viewerClashEventTitle}</span>, which you&apos;re already
                        going to. You can still book both.
                      </p>
                    ) : null}

                    {isWaitlisted && !waitlistOfferExpiresAt && event.waitlistPosition ? (
                      <p className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                        You&apos;re #{event.waitlistPosition} on the waitlist. We&apos;ll let you know the moment a spot
                        opens.
                      </p>
                    ) : null}

                    {isPendingPayment && isPaid ? (
                      <div className="grid gap-2">
                        <div className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                          Your seat is held while your previous checkout finishes. Complete payment to lock it in.
                        </div>
                        {showStripeUnavailableHint ? (
                          <p className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                            Stripe isn&apos;t configured on this server - set STRIPE_SECRET_KEY in .env.local to enable
                            paid bookings.
                          </p>
                        ) : (
                          <EventPaymentButton eventId={event.id} priceLabel={formatPrice(totalCents, "AUD")} />
                        )}
                      </div>
                    ) : isRegistered || isWaitlisted ? (
                      waitlistOfferExpiresAt && isPaid ? (
                        <div className="grid gap-2">
                          <div className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] p-3 text-[13px] font-medium text-[color:var(--sage)]">
                            A seat opened up. Reserve &amp; pay to claim it before your hold expires.
                          </div>
                          {showStripeUnavailableHint ? (
                            <p className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                              Stripe isn&apos;t configured on this server - set STRIPE_SECRET_KEY in .env.local to enable
                              paid bookings.
                            </p>
                          ) : (
                            <EventPaymentButton eventId={event.id} priceLabel={formatPrice(totalCents, "AUD")} />
                          )}
                          <EventRegistrationButton eventId={event.id} initiallyRegistered isWaitlist />
                        </div>
                      ) : (
                        <EventRegistrationButton
                          eventId={event.id}
                          initiallyRegistered
                          isWaitlist={isWaitlisted}
                          offerExpiresAt={waitlistOfferExpiresAt}
                          cancelRefundLabel={cancelRefundLabel}
                          successDetails={successDetails}
                        />
                      )
                    ) : isWaitlistMode ? (
                      <EventBookingDialog
                        triggerLabel="Join waitlist"
                        triggerTone="ink"
                        title="Join the waitlist?"
                        body={
                          <>
                            This event is currently full. Joining the waitlist holds your spot in queue. If someone
                            cancels, the host will reach out via email and you can confirm before the seat is reopened.
                          </>
                        }
                      >
                        <EventRegistrationButton eventId={event.id} initiallyRegistered={false} isWaitlist />
                      </EventBookingDialog>
                    ) : isPaid ? (
                      showStripeUnavailableHint ? (
                        <p className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                          Stripe isn&apos;t configured on this server - set STRIPE_SECRET_KEY in .env.local to enable paid
                          bookings.
                        </p>
                      ) : (
                        <EventBookingDialog
                          triggerLabel="RSVP"
                          title={`Reserve a seat for ${formatPrice(totalCents, "AUD")}?`}
                          body={
                            <>
                              {event.viewerClashEventTitle ? (
                                <span className="mb-3 block rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--amber)_14%,var(--paper))] p-3 text-xs font-medium text-[color:var(--amber-ink)]">
                                  This clashes with {event.viewerClashEventTitle}, which you&apos;re already going to.
                                  Book both anyway?
                                </span>
                              ) : null}
                              {hasBookingFee ? (
                                <>
                                  That&apos;s {formatPrice(event.priceCents, "AUD")} ticket +{" "}
                                  {formatPrice(bookingFeeCents, "AUD")} booking fee.{" "}
                                </>
                              ) : null}
                              We&apos;ll hold your seat through Stripe checkout. If you don&apos;t complete payment, the
                              hold is released and the seat returns to the pool. Cancel anytime before the event.
                            </>
                          }
                        >
                          <EventPaymentButton
                            eventId={event.id}
                            priceLabel={formatPrice(totalCents, "AUD")}
                            allowGuests
                            availableSeats={Math.max(0, event.capacity - event.attendees)}
                            perSeatCents={totalCents}
                            eventDateISO={event.startsAt}
                          />
                        </EventBookingDialog>
                      )
                    ) : (
                      <EventBookingDialog
                        triggerLabel="RSVP"
                        title="RSVP to this event?"
                        body={
                          <>
                            {event.viewerClashEventTitle ? (
                              <span className="mb-3 block rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--amber)_14%,var(--paper))] p-3 text-xs font-medium text-[color:var(--amber-ink)]">
                                This clashes with {event.viewerClashEventTitle}, which you&apos;re already going to. RSVP
                                to both anyway?
                              </span>
                            ) : null}
                            Reserve your seat. You can cancel any time before the event - the host gets a waitlist
                            replacement automatically.
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

                    <EventBookmarkButton eventId={event.id} initiallySaved={bookmarked} />
                  </>
                )}
              </div>

              {isPaid ? (
                <p className="mt-4 flex items-start gap-2 text-[11.5px] leading-relaxed text-[color:var(--slate)]">
                  <Icon name="info" size={13} className="mt-0.5 shrink-0" />
                  Full refund up to 48h before - 50% within 48h - none within 24h.
                </p>
              ) : null}
            </div>

            {event.fomo ? (
              <div className="mt-3 flex items-start gap-2.5 rounded-[var(--radius-lg)] bg-[color:var(--lav-bg)] px-4 py-3 text-[13px] text-[color:var(--ink-soft)]">
                <Icon name="trend" size={16} className="mt-0.5 text-[color:var(--purple)]" />
                {event.fomo}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
