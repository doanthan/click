import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { LinkButton, MetricCard, Pill } from "@/components/click-ui";
import { MerchantEventCancelButton } from "@/components/merchant-event-cancel-button";
import { MerchantEventDuplicateButton } from "@/components/merchant-event-duplicate-button";
import { MerchantEventEditForm } from "@/components/merchant-event-edit-form";
import { MerchantEventResubmitButton } from "@/components/merchant-event-resubmit-button";
import { GuestCheckInToggle } from "@/components/guest-check-in-toggle";
import {
  getMerchantEventDetail,
  getProfileStatus,
  getProfileTagOptions,
  type MerchantAttendeeRow,
  type MerchantGuestRow,
} from "@/lib/event-repository";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

const rsvpDateFormatter = new Intl.DateTimeFormat("en-AU", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

// Appends the end time as a range when the event has a known end.
function formatWhen(startsAt: string, endsAt: string | null) {
  const start = dateFormatter.format(new Date(startsAt));
  if (!endsAt) return start;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return start;
  return `${start} – ${timeFormatter.format(end)}`;
}

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function attendeeRowTone(status: MerchantAttendeeRow["status"]) {
  if (status === "confirmed") return "cream" as const;
  if (status === "pending_payment") return "rose" as const;
  if (status === "waitlisted") return "peach" as const;
  return "ink" as const;
}

export default async function MerchantEventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/merchant/login?callbackUrl=/merchant/events/${eventId}`);
  }

  const status = await getProfileStatus(session);
  if (!status.merchantProfile) {
    redirect("/merchant/signup");
  }

  const [event, tagOptions] = await Promise.all([
    getMerchantEventDetail(eventId, session),
    getProfileTagOptions(),
  ]);
  if (!event) {
    notFound();
  }

  const interestTagOptions = tagOptions.interestCategories
    .flatMap((category) => category.tags)
    .sort((a, b) => a.label.localeCompare(b.label));

  // Count SEATS, not just profile attendees: each paid +1 (named or unnamed)
  // occupies a seat. Mirrors the public event page + the checkout capacity gate
  // (spec 19) so the merchant sees the same headcount everyone else does.
  const confirmedSeats = event.confirmed + event.guestSeats;
  const isFull = confirmedSeats >= event.capacity;
  const filledPercent = Math.min((confirmedSeats / event.capacity) * 100, 100);
  // guestSeats counts named + unnamed; the door list lists only the named ones.
  const unnamedGuestSeats = Math.max(0, event.guestSeats - event.guests.length);
  const confirmedAttendees = event.attendees.filter(
    (attendee) => attendee.status === "confirmed",
  );
  // Live (unexpired) payment holds. They occupy a seat and so are already
  // counted in `event.confirmed`, but they're not yet paid — surfacing them as
  // their own group is what makes the "Confirmed X / capacity" metric reconcile
  // with the named attendee list below.
  const awaitingPaymentAttendees = event.attendees.filter(
    (attendee) => attendee.status === "pending_payment",
  );
  const waitlistedAttendees = event.attendees.filter(
    (attendee) => attendee.status === "waitlisted",
  );

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-10 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/merchant"
          className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)] hover:text-[color:var(--rose)]"
        >
          ← All my events
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Pill tone={event.status === "Pending" ? "rose" : "peach"}>
              {event.status}
            </Pill>
            <h1 className="font-display mt-4 text-4xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-5xl">
              {event.title}
            </h1>
            <p className="mt-3 text-sm font-bold leading-6 text-[color:var(--mauve)]">
              {formatWhen(event.startsAt, event.endsAt)} ·{" "}
              {event.locationName} · {event.suburb}
            </p>
          </div>
          <div className="flex gap-2">
            <MerchantEventDuplicateButton eventId={event.slug} />
            <MerchantEventCancelButton eventId={event.slug} status={event.status} />
            <LinkButton href="/merchant" variant="secondary">
              Back to portal
            </LinkButton>
          </div>
        </div>

        {/* Rejected: surface the admin's reason and a one-tap resubmit so the
            merchant can fix + reapply for review (bug board #217). */}
        {event.status === "Rejected" ? (
          <div className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-5 hard-shadow-sm">
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--surface-deep)]">
              Not approved yet
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-[color:var(--surface-deep)]">
              Fix the below and resubmit for review.
            </h2>
            {event.rejectionReason ? (
              <p className="mt-2 text-sm font-bold leading-6 text-[color:var(--surface-deep)]">
                Admin note: {event.rejectionReason}
              </p>
            ) : null}
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--surface-deep)]/90">
              Update the details below, then resubmit — it goes back into the
              admin review queue and we&apos;ll email you the outcome.
            </p>
            <div className="mt-4">
              <MerchantEventResubmitButton eventId={event.slug} />
            </div>
          </div>
        ) : null}

        {event.images.length > 0 ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.images[0]}
                alt={event.imageAlt ?? event.title}
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
            {event.images.length > 1 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                {event.images.slice(1, 5).map((src, index) => (
                  <div
                    key={src}
                    className="overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`${event.title} photo ${index + 2}`}
                      className="aspect-[16/10] w-full object-cover sm:aspect-[3/2]"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          <MetricCard
            label="Confirmed"
            value={`${confirmedSeats} / ${event.capacity}`}
            tone="peach"
          />
          <MetricCard label="Waitlist" value={event.waitlisted.toString()} tone="rose" />
          <MetricCard
            label="Seats left"
            value={Math.max(0, event.capacity - confirmedSeats).toString()}
            tone="cream"
          />
          <MetricCard label="Price" value={formatPrice(event.priceCents)} tone="ink" />
        </div>

        <div className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Capacity
          </p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-base font-bold">
              {confirmedSeats} {confirmedSeats === 1 ? "seat" : "seats"} taken out of{" "}
              {event.capacity}
              {isFull ? " — full" : ""}
              {event.guestSeats > 0 ? (
                <span className="font-semibold text-[color:var(--mauve)]">
                  {" "}
                  ({event.confirmed} confirmed + {event.guestSeats} +1{event.guestSeats === 1 ? "" : "s"})
                </span>
              ) : null}
            </p>
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
              {Math.round(filledPercent)}%
            </p>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)]">
            <div
              className={`h-full ${isFull ? "bg-[color:var(--ink)]" : "bg-[color:var(--rose)]"}`}
              style={{ width: `${filledPercent}%` }}
            />
          </div>
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Confirmed attendees
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold leading-tight">
                {confirmedAttendees.length === 0
                  ? "No confirmed attendees yet."
                  : `${confirmedAttendees.length} ${confirmedAttendees.length === 1 ? "person" : "people"} confirmed.`}
              </h2>
            </div>
            <Pill tone="peach">{confirmedAttendees.length}</Pill>
          </div>

          {confirmedAttendees.length > 0 ? (
            <AttendeeTable rows={confirmedAttendees} />
          ) : (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-semibold text-[color:var(--mauve)]">
              When attendees RSVP they appear here with name and contact email
              so you can prep the room.
            </p>
          )}
        </section>

        {event.guestSeats > 0 ? (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  +1 guests
                </p>
                <h2 className="font-display mt-2 text-3xl font-semibold leading-tight">
                  {event.guestSeats} +1 {event.guestSeats === 1 ? "seat" : "seats"} on
                  confirmed bookings
                </h2>
                <p className="mt-2 text-sm font-semibold text-[color:var(--mauve)]">
                  Check guests in by first name. To protect them, we never share a
                  guest&apos;s email or date of birth — just who&apos;s expected.
                </p>
              </div>
              <Pill tone="peach">{event.guestSeats}</Pill>
            </div>

            {event.guests.length > 0 ? (
              <GuestList rows={event.guests} eventSlug={event.slug} />
            ) : null}

            {unnamedGuestSeats > 0 ? (
              <p className="mt-3 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-semibold text-[color:var(--mauve)]">
                + {unnamedGuestSeats} unnamed +1{" "}
                {unnamedGuestSeats === 1 ? "seat" : "seats"} reserved. The buyer can
                name them anytime before the event.
              </p>
            ) : null}
          </section>
        ) : null}

        {awaitingPaymentAttendees.length > 0 ? (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  Awaiting payment
                </p>
                <h2 className="font-display mt-2 text-3xl font-semibold leading-tight">
                  {awaitingPaymentAttendees.length}{" "}
                  {awaitingPaymentAttendees.length === 1 ? "seat" : "seats"}{" "}
                  reserved, payment in progress
                </h2>
                <p className="mt-2 text-sm font-semibold text-[color:var(--mauve)]">
                  These seats count toward your capacity while the buyer
                  completes checkout. They confirm automatically once payment
                  clears, or free up if the hold expires.
                </p>
              </div>
              <Pill tone="rose">{awaitingPaymentAttendees.length}</Pill>
            </div>
            <AttendeeTable rows={awaitingPaymentAttendees} />
          </section>
        ) : null}

        {waitlistedAttendees.length > 0 ? (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  Waitlist
                </p>
                <h2 className="font-display mt-2 text-3xl font-semibold leading-tight">
                  {waitlistedAttendees.length}{" "}
                  {waitlistedAttendees.length === 1 ? "person" : "people"}{" "}
                  waiting
                </h2>
              </div>
              <Pill tone="rose">{waitlistedAttendees.length}</Pill>
            </div>
            <AttendeeTable rows={waitlistedAttendees} />
          </section>
        ) : null}

        <section className="mt-10 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Description
          </p>
          <p className="mt-3 text-base font-medium leading-7">{event.description}</p>
          {event.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {event.tags.map((tag) => (
                <Pill key={tag.slug} tone="cream">
                  {tag.label}
                </Pill>
              ))}
            </div>
          ) : null}
        </section>

        <MerchantEventEditForm
          eventSlug={event.slug}
          initialTitle={event.title}
          initialDescription={event.description}
          initialAddress={event.address ?? ""}
          pendingAddress={event.pendingAddress}
          addressNeedsReview={
            ["Live", "Featured", "Locked", "Waitlist"].includes(event.status) ||
            event.confirmed > 0
          }
          initialImages={event.images}
          initialTags={event.tags}
          tagOptions={interestTagOptions}
        />
      </section>
    </main>
  );
}

function AttendeeTable({ rows }: { rows: MerchantAttendeeRow[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
      <div className="grid grid-cols-[1.4fr_1.4fr_0.7fr_0.7fr] gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--surface-deep)] px-5 py-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--on-deep)]/80 max-md:hidden">
        <span>Name</span>
        <span>Email</span>
        <span>RSVP&apos;d</span>
        <span>Status</span>
      </div>
      {rows.map((attendee) => (
        <div
          key={attendee.attendeeId}
          className="grid gap-3 border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-4 md:grid-cols-[1.4fr_1.4fr_0.7fr_0.7fr] md:items-center"
        >
          <div className="flex items-center gap-3">
            <AttendeeAvatar
              displayName={attendee.displayName}
              photoUrl={attendee.photoUrl}
            />
            <p className="text-sm font-bold text-[color:var(--ink)]">{attendee.displayName}</p>
          </div>
          <p className="break-all font-mono text-[0.75rem] text-[color:var(--mauve)]">
            {attendee.email}
          </p>
          <p className="text-sm font-semibold text-[color:var(--mauve)]">
            {rsvpDateFormatter.format(new Date(attendee.rsvpAt))}
          </p>
          <Pill tone={attendeeRowTone(attendee.status)}>{attendee.status}</Pill>
        </div>
      ))}
    </div>
  );
}

// The door list (spec 19 §11): named +1s only, shown as "first name · invited by ·
// status" with a check-in toggle. No email/DOB — that's the whole merchant-visible
// footprint of a guest. Check-in writes guest_spots.attended (§9).
function GuestList({ rows, eventSlug }: { rows: MerchantGuestRow[]; eventSlug: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
      <div className="grid grid-cols-[1.3fr_1.3fr_0.8fr_0.8fr] gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--surface-deep)] px-5 py-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--on-deep)]/80 max-md:hidden">
        <span>Guest</span>
        <span>Invited by</span>
        <span>Status</span>
        <span>Check-in</span>
      </div>
      {rows.map((guest) => (
        <div
          key={guest.guestId}
          className="grid gap-3 border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-4 md:grid-cols-[1.3fr_1.3fr_0.8fr_0.8fr] md:items-center"
        >
          <div className="flex items-center gap-3">
            <AttendeeAvatar displayName={guest.firstName ?? "Guest"} photoUrl={null} />
            <p className="text-sm font-bold text-[color:var(--ink)]">
              {guest.firstName ?? "Guest"}
            </p>
          </div>
          <p className="text-sm font-semibold text-[color:var(--mauve)]">
            {guest.purchasedBy}
          </p>
          <Pill tone={guest.status === "claimed" ? "peach" : "cream"}>
            {guest.status === "claimed" ? "joined Click" : "invited"}
          </Pill>
          <GuestCheckInToggle
            guestId={guest.guestId}
            eventSlug={eventSlug}
            name={guest.firstName ?? "guest"}
            attended={guest.attended}
          />
        </div>
      ))}
    </div>
  );
}

function AttendeeAvatar({
  displayName,
  photoUrl,
}: {
  displayName: string;
  photoUrl: string | null;
}) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={displayName}
        className="h-9 w-9 shrink-0 rounded-full border-2 border-[color:var(--line)] object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-sm font-bold text-[color:var(--ink)]">
      {initial}
    </span>
  );
}
