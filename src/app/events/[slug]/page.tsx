import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Icon, Tag } from "@/components/ds";
import { EventAttendeePreview } from "@/components/event-attendee-preview";
import {
  EventBookingDialog,
  EventBookingSummary,
} from "@/components/event-booking-dialog";
import { EventMediaGallery } from "@/components/event-media-gallery";
import { EventVenueMap } from "@/components/event-venue-map";
import { EventPaymentButton } from "@/components/event-payment-button";
import { PaymentHoldCountdown } from "@/components/payment-hold-countdown";
import { EventRegistrationButton } from "@/components/event-registration-button";
import { EventBookedCelebration } from "@/components/event-rsvp-success-overlay";
import { EventBookmarkButton } from "@/components/event-bookmark-button";
import { MyGuestSeats } from "@/components/my-guest-seats";
import { PostEventClickCard } from "@/components/post-event-click-card";
import { ShareEventButton } from "@/components/share-event-button";
import {
  PUBLIC_EVENT_STATUSES,
  getEventAttendeePreview,
  getEventBySlug,
  getMyGuestSeatsForEvent,
  getPostEventClickPromptForEvent,
  getProfileStatus,
  getProposalsForSession,
  getSystemSettings,
  getCancelledBookingNotice,
  getUnfulfilledPaymentNotice,
  isEventOperator,
} from "@/lib/event-repository";
import { SUPPORT_EMAIL_DEFAULT } from "@/lib/email-templates/tokens";
import { reconcileCheckoutSession } from "@/lib/stripe-sync";
import { quoteCancellationRefund, refundQuoteLabel } from "@/lib/refund-policy";
import { formatPriceLabel } from "@/lib/amounts";
import { safeNext } from "@/lib/safe-next";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    canceled?: string;
    booked?: string;
    session_id?: string;
    cancelled?: string;
    /** The freed seat was offered to the next person in the queue. */
    promoted?: string;
    /** A non-zero refund was actually initiated (the <24h tier returns none). */
    refunded?: string;
    /** Stage 6: the profile id of the mutual this booking is a plan with. Minted by
     *  the coordination drawer's RSVP control (`planBookingHref`), so the booker
     *  arrives here knowing the night is a plan and not a solo outing. */
    planWith?: string;
    /** Stage 6: where to send the booker back to - the drawer, not a receipt page.
     *  Same-origin relative path only; validated before it is rendered. */
    return?: string;
  }>;
};

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

  const [
    event,
    profileStatus,
    attendeePreview,
    systemSettings,
    postEventPrompt,
    myGuestSeats,
    planProposals,
  ] = await Promise.all([
    getEventBySlug(slug, session),
    session?.user ? getProfileStatus(session) : null,
    getEventAttendeePreview(slug, session, 8),
    getSystemSettings(),
    session?.user ? getPostEventClickPromptForEvent(slug, session) : null,
    session?.user ? getMyGuestSeatsForEvent(slug, session) : [],
    // Stage 6 only: the drawer's RSVP deep link carries `planWith`, and the banner
    // it asks for has to name the person. Read from the same list the drawer itself
    // renders rather than a lookup of its own - the link is minted FROM a proposal
    // entry, so if there is no matching entry there is no plan to announce, and a
    // guessed profile id in the URL gets nothing back. Only fetched when the param
    // is actually present; a normal event view pays nothing for this.
    session?.user && search?.planWith ? getProposalsForSession(session) : [],
  ]);

  if (!event) notFound();

  // Hide not-yet-public events (pending review, rejected, cancelled) from
  // everyone except the owning merchant and admins. Without this, a direct slug
  // link rendered the full listing - RSVP button and all - for any visitor.
  const isAdmin = profileStatus?.role === "admin";
  const isOwner =
    Boolean(event.merchantProfileId) &&
    profileStatus?.merchantProfile?.id === event.merchantProfileId;
  if (!PUBLIC_EVENT_STATUSES.has(event.status) && !isEventOperator(event, profileStatus)) {
    // Unless this viewer just paid for it. Stripe returns the buyer here with
    // ?session_id after checkout, and if the merchant or an admin cancelled or
    // unpublished the event while their card was being entered, the gate above
    // used to 404 them - no confirmation, no mention of the charge, no refund
    // message, no support link, for a real charge on the LIVE key. The money is
    // already handled (markPaymentSucceeded cancels the seat and refunds in
    // full); this is the only place that can actually tell them so.
    const notice = search?.session_id
      ? await getUnfulfilledPaymentNotice(slug, session)
      : null;

    // ...and unless they simply hold a seat on an event that has since been
    // called off. This page is where the in-app "Event cancelled" notification
    // points, and where a bookmark, a calendar chip and the confirmation email
    // all land - every one of them used to 404, so the only record of the
    // booking vanished. Free RSVPs get this too; they have no payment row.
    if (!notice && session?.user) {
      const cancelled = await getCancelledBookingNotice(slug, session);
      if (cancelled) {
        return (
          <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
            <p className="eyebrow">Event cancelled</p>
            <h1 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-4xl">
              {cancelled.eventTitle} was called off.
            </h1>
            <p className="mt-5 text-base leading-7 font-medium text-[color:var(--slate)]">
              The host cancelled this one, so your spot no longer stands. You don&apos;t
              need to do anything - there&apos;s nothing to cancel.
            </p>
            {cancelled.wasPaid ? (
              <p className="mt-4 text-base leading-7 font-medium text-[color:var(--slate)]">
                {cancelled.refunded
                  ? `We've refunded your ${cancelled.amountLabel} in full - it goes back to the card you paid with, usually within 3 to 5 business days.`
                  : `A full refund of ${cancelled.amountLabel} is on its way back to the card you paid with, usually within 3 to 5 business days.`}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/discover" className="ck-btn ck-btn--primary">
                <span className="ck-btn__label">Find something else</span>
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL_DEFAULT}`} className="ck-btn ck-btn--secondary">
                <span className="ck-btn__label">Contact support</span>
              </a>
            </div>
          </main>
        );
      }
    }

    if (!notice) notFound();
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <p className="eyebrow">Payment received</p>
        <h1 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-4xl">
          {notice.eventTitle} was called off while you were paying.
        </h1>
        <p className="mt-5 text-base leading-7 font-medium text-[color:var(--slate)]">
          Your card was charged {notice.amountLabel}, and the host pulled the event
          before we could confirm your spot.{" "}
          {notice.refunded
            ? "We've already refunded you in full - it goes back to the card you paid with, usually within 3 to 5 business days."
            : "A full refund is on its way back to the card you paid with. If it hasn't landed within 5 business days, reply to your receipt and we'll chase it."}
          {/* One processing window across the app: /refund-policy, this page and
              the cancel dialog all say 3 to 5 business days. */}
        </p>
        <p className="mt-4 text-base leading-7 font-medium text-[color:var(--slate)]">
          You don&apos;t need to do anything. Nothing was booked and there&apos;s
          nothing to cancel.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/discover" className="ck-btn ck-btn--primary">
            <span className="ck-btn__label">Find something else</span>
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL_DEFAULT}`} className="ck-btn ck-btn--secondary">
            <span className="ck-btn__label">Contact support</span>
          </a>
        </div>
      </main>
    );
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
  // Seats on the viewer's live hold, so the resume CTA quotes and re-requests
  // the party they actually reserved rather than a solo seat.
  const heldSeats = Math.max(1, event.heldSeatCount ?? 1);
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
  const fullRefundCutoffMs = startsAtMs - 48 * 3_600_000;
  const halfRefundCutoffMs = startsAtMs - 24 * 3_600_000;
  const formatCutoff = (timestamp: number) => {
    const iso = new Date(timestamp).toISOString();
    return `${formatLongDate(iso)} at ${formatTimeRange(iso, null)}`;
  };
  const bookingRefundLabel =
    nowMs <= fullRefundCutoffMs
      ? `Full refund until ${formatCutoff(fullRefundCutoffMs)}`
      : nowMs <= halfRefundCutoffMs
        ? `50% refund until ${formatCutoff(halfRefundCutoffMs)}`
        : "No standard refund within 24 hours of the event";
  // Exact refund the viewer would get if they cancel their paid booking now -
  // shown in the cancel confirmation so the number matches what we refund.
  // Seats this booking actually paid for: the viewer's own, plus every guest
  // seat still live on the same transaction. Quoting one seat told a four-seat
  // purchaser they would get $35 back when the server refunds the whole $140.
  // Returned from Stripe with a session id but no seat: the charge settled after
  // the hold lapsed, so the seat was released and the money sent back. Without
  // this the page just showed "RSVP" again, on a real charge on the live key.
  const settledAfterLapse =
    search?.session_id && !isRegistered && !isWaitlisted && !isPendingPayment
      ? await getUnfulfilledPaymentNotice(slug, session)
      : null;

  const paidSeatCount = 1 + myGuestSeats.length;
  const cancelRefundQuote =
    isPaid && isRegistered
      ? quoteCancellationRefund(totalCents * paidSeatCount, event.startsAt)
      : null;
  const cancelRefundLabel = cancelRefundQuote ? refundQuoteLabel(cancelRefundQuote, "AUD") : null;
  // Whether any money is actually coming back - the "refunds take 3-5 business
  // days" line used to render even under the no-refund tier.
  const cancelRefundIsPositive = (cancelRefundQuote?.refundCents ?? 0) > 0;
  // The venue map unlocks for people who've confirmed their seat (or who manage
  // the event) - the "paid & confirmed" unlocked state the venue/map live in.
  const venueUnlocked = isRegistered || isAdmin || isOwner;
  const venueMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [event.location, event.address, event.suburb, event.city].filter(Boolean).join(", "),
  )}`;
  const bookmarked = profileStatus?.bookmarkedEventIds.includes(event.id) ?? false;
  // Dev-only. Without the NODE_ENV guard a key rotation in production printed
  // "set STRIPE_SECRET_KEY in .env.local" to real attendees at three render sites.
  const showStripeUnavailableHint =
    isPaid && !process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV !== "production";
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

  // successDetails carries the venue name and a calendar link with the full
  // street address, so handing it to a client component serialises both into
  // the page source - readable by anyone who hasn't RSVP'd, while the page is
  // still telling them the venue is revealed on RSVP. Only pass it once the
  // venue is actually unlocked. Without it EventRegistrationButton falls back
  // to redirecting to /events/<id>?booked=1: the unlocked page, same confirmed
  // banner, venue fetched fresh under a now-confirmed session.
  const successDetailsForViewer = venueUnlocked ? successDetails : undefined;

  // The SAME number isFull and the register endpoint gate on - it includes live
  // payment holds, guest seats and live waitlist offers. Using the confirmed-only
  // count here printed "9 of 10 going" beside a button that waitlisted you, and
  // "Fully booked" beside a bar drawn at 40%.
  const seatsTaken = Math.min(event.attendees, event.capacity);
  const capacityPct = event.capacity > 0 ? Math.min(100, Math.round((seatsTaken / event.capacity) * 100)) : 0;
  const seatsLeft = Math.max(0, event.capacity - seatsTaken);
  // The badge stamped on the hero photo used to be the DATABASE publishing
  // status, so a visitor read "Live" or "Locked" over the picture - host
  // vocabulary on a reader's screen, and "Locked" reads like the night is
  // barred rather than like the venue being revealed on RSVP. This is the same
  // ladder the quick-view already speaks (event-detail-modal.tsx, modalBadge),
  // so a card, its quick-view and this page all say one thing. Two exceptions
  // that are not the modal's job: an event that has finished says so rather
  // than advertising spots, and an operator previewing their own not-yet-public
  // listing keeps the publishing status - on this page it is the only thing
  // telling them the event isn't out yet.
  const heroBadge = !PUBLIC_EVENT_STATUSES.has(event.status)
    ? event.status
    : hasEnded
      ? "Ended"
      : isRegistered
        ? "You're going"
        : isWaitlisted
          ? "Waitlisted"
          : isFull
            ? "Waitlist"
            : seatsLeft <= 3
              ? `${seatsLeft} ${seatsLeft === 1 ? "spot" : "spots"} left`
              : event.status === "Featured"
                ? "Trending"
                : !isPaid
                  ? "Free"
                  : undefined;
  const notice = search?.canceled
    ? "Checkout was cancelled. Your seat hold was released - you can try again any time."
    : search?.cancelled
      ? `Your RSVP was cancelled.${
          search?.refunded ? " Your refund will appear in 3 to 5 business days." : ""
        }${
          search?.promoted
            ? " Your seat has gone to the next person on the waitlist."
            : " The venue details lock again, but you can RSVP any time before the event."
        }`
      : null;

  // Stage 6. The plan the drawer sent this booker here for, or null. Matched on the
  // suggested event too, not just the person: a plan is a plan for ONE night, and a
  // banner that named a partner over some other event would be announcing something
  // that does not exist. Nothing is announced for an id with no live proposal behind
  // it, so a hand-typed ?planWith= reveals no one.
  const planEntry = search?.planWith
    ? planProposals.find(
        (entry) => entry.otherId === search.planWith && entry.suggestedEventSlug === slug,
      )
    : undefined;
  // First name only, the same shortening getGoingWithNames does for the companion
  // marker, so the two ways of saying "with [Name]" read alike.
  const planPartnerName = planEntry
    ? (planEntry.otherName.split(/\s+/)[0] ?? planEntry.otherName)
    : null;
  // Where the drawer asked to be sent back to. safeNext is the one place that knows
  // this rule (it screens "/" and the protocol-relative "//evil.com"); the backslash
  // form is folded into "//" by the URL parser and it does not screen that, so it is
  // taken out first. Anything else falls back to the plain /proposals list.
  const planReturn =
    (search?.return?.includes("\\") ? null : safeNext(search?.return)) ?? "/proposals";

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[1180px] pt-4">
        {/* Canonical quiet back link on its own row - same form on every sub-page. */}
        <Link
          href="/discover"
          className="ck-taplink font-display inline-flex items-center gap-1 text-[13.5px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
        >
          <Icon name="chevL" size={16} stroke={2.2} /> Back
        </Link>

        {notice ? (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4 text-sm text-[color:var(--ink-soft)]">
            {notice}
          </div>
        ) : null}

        {/* The completion moment for the people who paid. Everything it renders
            comes from successDetailsForViewer, which is already gated on
            venueUnlocked - and a viewer who is `isRegistered` has it unlocked by
            definition. Strictly downstream of reconcileCheckoutSession above:
            it reads reconciled registration state and nothing else. */}
        {settledAfterLapse ? (
          <div className="mt-4 grid gap-2 rounded-[var(--radius-lg)] border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] p-4 text-sm text-[color:var(--purple-800)]">
            <p>
              <b className="font-semibold">Your payment arrived too late.</b> The seat hold had
              already run out, so the seat went back to the pool and we refunded you{" "}
              {settledAfterLapse.amountLabel} in full.
            </p>
            <p className="text-[color:var(--ink-soft)]">
              {settledAfterLapse.refunded
                ? "It goes back to the card you paid with, usually within 3 to 5 business days."
                : "The refund is on its way back to the card you paid with, usually within 3 to 5 business days."}{" "}
              You can book again below if the event still has room.
            </p>
          </div>
        ) : null}

        {search?.booked && isRegistered && successDetailsForViewer ? (
          <EventBookedCelebration
            details={successDetailsForViewer}
            celebrationKey={search.session_id ?? event.id}
          />
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

        {/* Phones only: the title runs ABOVE the grid so the booking panel -
            which is `order-first` below lg - lands directly under it. Before
            this, price and the RSVP control were below the gallery, the
            description, "why this event" and the whole attendee grid, i.e. the
            conversion surface was the last thing on the page. Desktop is
            unchanged: this block is lg:hidden and the in-column copy below is
            hidden lg:block, so the two-column layout renders exactly as before. */}
        <div className="mt-5 lg:hidden">
          <h1 className="font-display text-[length:var(--text-h1)] leading-[1.2] font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
            {event.title}
          </h1>
          <p className="mt-2 text-sm font-medium text-[color:var(--slate)]">
            Hosted by {event.host} · {event.group}
          </p>
        </div>

        <div className="mt-5 grid items-start gap-9 lg:grid-cols-[minmax(0,1fr)_372px]">
          {/* ---- Content column ---- */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-[var(--radius-xl)]">
              <EventMediaGallery items={event.media} statusLabel={heroBadge} categoryLabel={event.category} />
            </div>

            {/* Title is the focal point; the panel owns date/time/location, so
                the title goes straight to the category + all interest tags. */}
            <h1 className="font-display mt-6 hidden text-[length:var(--text-h1)] leading-[1.2] font-semibold tracking-[-0.02em] text-[color:var(--ink)] lg:block">
              {event.title}
            </h1>
            <p className="mt-2 hidden text-sm font-medium text-[color:var(--slate)] lg:block">
              Hosted by {event.host} · {event.group}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 lg:gap-1.5">
              <span className="inline-flex h-[22px] items-center rounded-full bg-[color:var(--lavender-100)] px-2.5 text-xs font-semibold text-[color:var(--purple-700)]">
                {event.category}
              </span>
              {/* The event detail page is the ONE surface that shows every tag.
                  Each tag is a filter link, so on touch the anchor carries a 44px
                  hit band while the pill itself stays 22px - a mis-tap here would
                  throw you out of the event and into the wrong filter. */}
              {event.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/discover?tag=${encodeURIComponent(tag)}`}
                  className="inline-flex min-h-11 items-center lg:min-h-0"
                >
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
                viewerOpenToDating={Boolean(profileStatus?.datingVisible)}
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
          <aside className="order-first lg:order-none lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-md)]">
              {/* Stage 6: the plan banner, above the price, because it is the reason
                  this booker is on this page at all. Each side books their own spot
                  (§B5.6 - there is no joint checkout), so the sub-line says so and
                  the link hands them back to the drawer rather than leaving the plan
                  behind a browser Back button. */}
              {planPartnerName ? (
                <div className="mb-4 rounded-[var(--radius-lg)] border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] p-3.5">
                  <p className="font-display text-[13.5px] font-semibold text-[color:var(--ink)]">
                    Part of your plan with {planPartnerName}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
                    You each save your own spot. Once you both have one, we&apos;ll tell you
                    both.
                  </p>
                  <Link
                    href={planReturn}
                    className="ck-taplink font-display mt-2 inline-flex text-[13px] font-semibold text-[color:var(--purple-800)] underline"
                  >
                    Back to your clicks
                  </Link>
                </div>
              ) : null}

              {/* Price - Ink anchor; "$X per person" or Free, never price-in-button. */}
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-display text-[26px] font-semibold tracking-[-0.01em] ${
                    isPaid ? "text-[color:var(--ink)]" : "text-[color:var(--sage)]"
                  }`}
                >
                  {formatPriceLabel(hasBookingFee ? totalCents : event.priceCents, "AUD")}
                </span>
                {isPaid ? <span className="text-[13px] font-medium text-[color:var(--slate)]">per person</span> : null}
              </div>
              {hasBookingFee ? (
                <p className="mt-1 text-xs font-medium text-[color:var(--slate)]">
                  {formatPriceLabel(event.priceCents, "AUD")} ticket + {formatPriceLabel(bookingFeeCents, "AUD")} booking fee
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
                    className={`h-full rounded-full ${capacityPct >= 85 ? "bg-[color:var(--ink)]" : "bg-[color:var(--purple)]"}`}
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
                        You&apos;re #{event.waitlistPosition} on the waitlist. When a seat opens we&apos;ll email you
                        and hold it for 30 minutes.
                      </p>
                    ) : null}

                    {/* A lapsed hold: the seat row still reads pending_payment
                        (the sweep is a cron) but heldSeatExpiresAt is null,
                        because getEventBySlug only reports a hold that is still
                        live. The panel used to keep saying "your seat is held"
                        with the countdown silently gone, beside a "Release my
                        hold" link for a hold that no longer exists. Say what
                        actually happened and fall through to the normal booking
                        CTAs below - createPaymentHold opens a fresh 31-minute
                        hold on the next tap, and the seat count already excludes
                        the lapsed one, so "Join waitlist" only appears if the
                        seat really did go to someone else. */}
                    {isPendingPayment && isPaid && !event.heldSeatExpiresAt ? (
                      <p className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                        Your checkout hold ran out, so the seats went back to the pool. You can book
                        again below.
                      </p>
                    ) : null}

                    {isPendingPayment && isPaid && event.heldSeatExpiresAt ? (
                      <div className="grid gap-2">
                        <div className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                          {heldSeats > 1
                            ? `Your ${heldSeats} seats are held while your previous checkout finishes. Complete payment to lock them in.`
                            : "Your seat is held while your previous checkout finishes. Complete payment to lock it in."}
                          {/* The hold is 31 minutes and nothing ever said so -
                              a buyer could not tell 4 minutes left from 28. */}{" "}
                          <PaymentHoldCountdown expiresAt={event.heldSeatExpiresAt} />
                        </div>
                        {showStripeUnavailableHint ? (
                          <p className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                            Stripe isn&apos;t configured on this server - set STRIPE_SECRET_KEY in .env.local to enable
                            paid bookings.
                          </p>
                        ) : (
                          <EventPaymentButton
                            eventId={event.id}
                            priceLabel={formatPriceLabel(totalCents * heldSeats, "AUD")}
                            resumeSeatCount={event.heldSeatCount}
                          />
                        )}
                        <EventRegistrationButton
                          eventId={event.id}
                          initiallyRegistered
                          isHold
                          heldSeatCount={event.heldSeatCount}
                        />
                      </div>
                    ) : isRegistered || isWaitlisted ? (
                      waitlistOfferExpiresAt && isPaid ? (
                        // One panel, one clock, one primary. This used to render
                        // its own "a seat opened up" panel AND the button's, and
                        // a free "Confirm your spot" beside "Reserve & pay".
                        <EventRegistrationButton
                          eventId={event.id}
                          initiallyRegistered
                          isWaitlist
                          offerExpiresAt={waitlistOfferExpiresAt}
                          offerNeedsPayment
                        >
                          {showStripeUnavailableHint ? (
                            <p className="rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3 text-[13px] text-[color:var(--ink-soft)]">
                              Stripe isn&apos;t configured on this server - set STRIPE_SECRET_KEY in .env.local to enable
                              paid bookings.
                            </p>
                          ) : (
                            <EventPaymentButton eventId={event.id} priceLabel={formatPriceLabel(totalCents, "AUD")} />
                          )}
                        </EventRegistrationButton>
                      ) : (
                        <EventRegistrationButton
                          eventId={event.id}
                          initiallyRegistered
                          isWaitlist={isWaitlisted}
                          offerExpiresAt={waitlistOfferExpiresAt}
                          cancelRefundLabel={cancelRefundLabel}
                          cancelRefundIsPositive={cancelRefundIsPositive}
                          successDetails={successDetailsForViewer}
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
                            cancels we&apos;ll email you and hold the seat for 30 minutes. Confirm inside that window or
                            it goes to the next person in the queue.
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
                          title={`Reserve a seat for ${formatPriceLabel(totalCents, "AUD")}?`}
                          summary={
                            <EventBookingSummary
                              eventTitle={event.title}
                              dateLabel={formatLongDate(event.startsAt)}
                              timeLabel={formatTimeRange(event.startsAt, event.endsAt)}
                              priceLabel={`${formatPriceLabel(totalCents, "AUD")} per person`}
                              refundLabel={bookingRefundLabel}
                            />
                          }
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
                                  That&apos;s {formatPriceLabel(event.priceCents, "AUD")} ticket +{" "}
                                  {formatPriceLabel(bookingFeeCents, "AUD")} booking fee.{" "}
                                </>
                              ) : null}
                              We&apos;ll hold your seat through Stripe checkout. If you don&apos;t complete payment, the
                              hold is released and the seat returns to the pool. Full refund up to 48h before, 50%
                              within 48h, none within 24h -{" "}
                              <Link href="/refund-policy" className="underline">
                                refund policy
                              </Link>
                              .
                            </>
                          }
                        >
                          <EventPaymentButton
                            eventId={event.id}
                            priceLabel={formatPriceLabel(totalCents, "AUD")}
                            allowGuests
                            availableSeats={Math.max(0, event.capacity - event.attendees)}
                            perSeatCents={totalCents}
                            bookingFeePerSeatCents={bookingFeeCents}
                            eventDateISO={event.startsAt}
                          />
                        </EventBookingDialog>
                      )
                    ) : (
                      <EventBookingDialog
                        triggerLabel="RSVP"
                        title="RSVP to this event?"
                        summary={
                          <EventBookingSummary
                            eventTitle={event.title}
                            dateLabel={formatLongDate(event.startsAt)}
                            timeLabel={formatTimeRange(event.startsAt, event.endsAt)}
                            priceLabel="No charge"
                          />
                        }
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
                          successDetails={successDetailsForViewer}
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
