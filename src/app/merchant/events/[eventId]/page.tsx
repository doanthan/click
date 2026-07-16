import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Badge, ButtonLink, Tag, type BadgeTone } from "@/components/ds";
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

// DS merchant status vocabulary: confirmed lavender, pending/waitlist amber.
function attendeeRowTone(status: MerchantAttendeeRow["status"]) {
  if (status === "confirmed") return "lavender" as const;
  if (status === "pending_payment") return "amber" as const;
  if (status === "waitlisted") return "amber" as const;
  return "neutral" as const;
}

// Event status badge: live/featured sage, pending/waitlist amber, cancelled/
// rejected coral - status colours live on badges only.
function eventStatusTone(status: string): BadgeTone {
  if (status === "Live" || status === "Featured") return "sage";
  if (status === "Pending" || status === "Waitlist") return "amber";
  if (status === "Cancelled" || status === "Rejected") return "coral";
  return "lavender";
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
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-10 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/merchant"
          className="text-[12.5px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--purple)]"
        >
          ← All my events
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge tone={eventStatusTone(event.status)}>{event.status}</Badge>
            <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[color:var(--ink)] sm:text-5xl">
              {event.title}
            </h1>
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--slate)]">
              {formatWhen(event.startsAt, event.endsAt)} ·{" "}
              {event.locationName} · {event.suburb}
            </p>
          </div>
          <div className="flex gap-2">
            <MerchantEventDuplicateButton eventId={event.slug} />
            <MerchantEventCancelButton eventId={event.slug} status={event.status} />
            <ButtonLink href="/merchant" variant="secondary">
              Back to portal
            </ButtonLink>
          </div>
        </div>

        {/* Rejected: surface the admin's reason and a one-tap resubmit so the
            merchant can fix + reapply for review (bug board #217). */}
        {event.status === "Rejected" ? (
          <div className="mt-6 rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
            <p className="eyebrow">Not approved yet</p>
            <h2 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
              Fix the below and resubmit for review.
            </h2>
            {event.rejectionReason ? (
              <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--ink)]">
                Admin note: {event.rejectionReason}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
              Update the details below, then resubmit - it goes back into the
              admin review queue and we&apos;ll email you the outcome.
            </p>
            <div className="mt-4">
              <MerchantEventResubmitButton eventId={event.slug} />
            </div>
          </div>
        ) : null}

        {event.images.length > 0 ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="overflow-hidden rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
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
                    className="overflow-hidden rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]"
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
          <Metric label="Confirmed" value={`${confirmedSeats} / ${event.capacity}`} />
          <Metric label="Waitlist" value={event.waitlisted.toString()} />
          <Metric
            label="Seats left"
            value={Math.max(0, event.capacity - confirmedSeats).toString()}
          />
          <Metric label="Price" value={formatPrice(event.priceCents)} />
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
          <p className="eyebrow">Capacity</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-base font-semibold text-[color:var(--ink)]">
              {confirmedSeats} {confirmedSeats === 1 ? "seat" : "seats"} taken out of{" "}
              {event.capacity}
              {isFull ? " - full" : ""}
              {event.guestSeats > 0 ? (
                <span className="font-medium text-[color:var(--slate)]">
                  {" "}
                  ({event.confirmed} confirmed + {event.guestSeats} +1{event.guestSeats === 1 ? "" : "s"})
                </span>
              ) : null}
            </p>
            <p className="text-[12.5px] font-semibold text-[color:var(--slate)]">
              {Math.round(filledPercent)}%
            </p>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[color:var(--mist)]">
            <div
              className={`h-full rounded-full ${isFull ? "bg-[color:var(--ink)]" : "bg-[color:var(--purple)]"}`}
              style={{ width: `${filledPercent}%` }}
            />
          </div>
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Confirmed attendees</p>
              <h2 className="font-display mt-2 text-3xl font-semibold leading-tight text-[color:var(--ink)]">
                {confirmedAttendees.length === 0
                  ? "No confirmed attendees yet."
                  : `${confirmedAttendees.length} ${confirmedAttendees.length === 1 ? "person" : "people"} confirmed.`}
              </h2>
            </div>
            <Badge tone="lavender">{confirmedAttendees.length}</Badge>
          </div>

          {confirmedAttendees.length > 0 ? (
            <AttendeeTable rows={confirmedAttendees} />
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-[color:var(--mist-strong)] bg-[color:var(--paper)] p-5 text-sm font-medium text-[color:var(--slate)]">
              When attendees RSVP they appear here with name and contact email
              so you can prep the room.
            </p>
          )}
        </section>

        {event.guestSeats > 0 ? (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">+1 guests</p>
                <h2 className="font-display mt-2 text-3xl font-semibold leading-tight text-[color:var(--ink)]">
                  {event.guestSeats} +1 {event.guestSeats === 1 ? "seat" : "seats"} on
                  confirmed bookings
                </h2>
                <p className="mt-2 text-sm font-medium text-[color:var(--slate)]">
                  Check guests in by first name. To protect them, we never share a
                  guest&apos;s email or date of birth - just who&apos;s expected.
                </p>
              </div>
              <Badge tone="lavender">{event.guestSeats}</Badge>
            </div>

            {event.guests.length > 0 ? (
              <GuestList rows={event.guests} eventSlug={event.slug} />
            ) : null}

            {unnamedGuestSeats > 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-[color:var(--mist-strong)] bg-[color:var(--paper)] p-5 text-sm font-medium text-[color:var(--slate)]">
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
                <p className="eyebrow">Awaiting payment</p>
                <h2 className="font-display mt-2 text-3xl font-semibold leading-tight text-[color:var(--ink)]">
                  {awaitingPaymentAttendees.length}{" "}
                  {awaitingPaymentAttendees.length === 1 ? "seat" : "seats"}{" "}
                  reserved, payment in progress
                </h2>
                <p className="mt-2 text-sm font-medium text-[color:var(--slate)]">
                  These seats count toward your capacity while the buyer
                  completes checkout. They confirm automatically once payment
                  clears, or free up if the hold expires.
                </p>
              </div>
              <Badge tone="amber">{awaitingPaymentAttendees.length}</Badge>
            </div>
            <AttendeeTable rows={awaitingPaymentAttendees} />
          </section>
        ) : null}

        {waitlistedAttendees.length > 0 ? (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Waitlist</p>
                <h2 className="font-display mt-2 text-3xl font-semibold leading-tight text-[color:var(--ink)]">
                  {waitlistedAttendees.length}{" "}
                  {waitlistedAttendees.length === 1 ? "person" : "people"}{" "}
                  waiting
                </h2>
              </div>
              <Badge tone="amber">{waitlistedAttendees.length}</Badge>
            </div>
            <AttendeeTable rows={waitlistedAttendees} />
          </section>
        ) : null}

        <section className="mt-10 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
          <p className="eyebrow">Description</p>
          <p className="mt-3 text-base leading-7 text-[color:var(--ink)]">{event.description}</p>
          {event.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {event.tags.map((tag) => (
                <Tag key={tag.slug}>{tag.label}</Tag>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
      <p className="eyebrow">{label}</p>
      <p className="font-display mt-2 text-4xl font-semibold leading-none tracking-[-0.02em] tabular-nums text-[color:var(--ink)]">
        {value}
      </p>
    </article>
  );
}

function AttendeeTable({ rows }: { rows: MerchantAttendeeRow[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]">
      <div className="grid grid-cols-[1.4fr_1.4fr_0.7fr_0.7fr] gap-3 border-b border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3 text-xs font-semibold text-[color:var(--slate)] max-md:hidden">
        <span>Name</span>
        <span>Email</span>
        <span>RSVP&apos;d</span>
        <span>Status</span>
      </div>
      {rows.map((attendee) => (
        <div
          key={attendee.attendeeId}
          className="grid gap-3 border-t border-[color:var(--line-soft)] px-5 py-4 md:grid-cols-[1.4fr_1.4fr_0.7fr_0.7fr] md:items-center"
        >
          <div className="flex items-center gap-3">
            <AttendeeAvatar
              displayName={attendee.displayName}
              photoUrl={attendee.photoUrl}
            />
            <p className="text-sm font-semibold text-[color:var(--ink)]">{attendee.displayName}</p>
          </div>
          <p className="break-all text-[13px] text-[color:var(--slate)]">
            {attendee.email}
          </p>
          <p className="text-sm text-[color:var(--slate)]">
            {rsvpDateFormatter.format(new Date(attendee.rsvpAt))}
          </p>
          <div>
            <Badge tone={attendeeRowTone(attendee.status)}>{attendee.status}</Badge>
          </div>
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
    <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]">
      <div className="grid grid-cols-[1.3fr_1.3fr_0.8fr_0.8fr] gap-3 border-b border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3 text-xs font-semibold text-[color:var(--slate)] max-md:hidden">
        <span>Guest</span>
        <span>Invited by</span>
        <span>Status</span>
        <span>Check-in</span>
      </div>
      {rows.map((guest) => (
        <div
          key={guest.guestId}
          className="grid gap-3 border-t border-[color:var(--line-soft)] px-5 py-4 md:grid-cols-[1.3fr_1.3fr_0.8fr_0.8fr] md:items-center"
        >
          <div className="flex items-center gap-3">
            <AttendeeAvatar displayName={guest.firstName ?? "Guest"} photoUrl={null} />
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              {guest.firstName ?? "Guest"}
            </p>
          </div>
          <p className="text-sm text-[color:var(--slate)]">
            {guest.purchasedBy}
          </p>
          <div>
            <Badge tone={guest.status === "claimed" ? "lavender" : "neutral"}>
              {guest.status === "claimed" ? "joined Click" : "invited"}
            </Badge>
          </div>
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
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-sm font-semibold text-[color:var(--purple-600)]">
      {initial}
    </span>
  );
}
