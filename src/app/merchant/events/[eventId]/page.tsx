import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { LinkButton, MetricCard, Pill } from "@/components/click-ui";
import { MerchantAttendees } from "@/components/merchant-attendees";
import { MerchantEventCancelButton } from "@/components/merchant-event-cancel-button";
import {
  getMerchantEventDetail,
  getProfileStatus,
  type MerchantAttendeeRow,
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
  if (status === "waitlisted") return "peach" as const;
  return "ink" as const;
}

export default async function MerchantEventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/merchant/events/${eventId}`);
  }

  const status = await getProfileStatus(session);
  if (!status.merchantProfile) {
    redirect("/merchant/signup");
  }

  const event = await getMerchantEventDetail(eventId, session);
  if (!event) {
    notFound();
  }

  const isFull = event.confirmed >= event.capacity;
  const filledPercent = Math.min((event.confirmed / event.capacity) * 100, 100);
  const confirmedAttendees = event.attendees.filter(
    (attendee) => attendee.status === "confirmed",
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
            <h1 className="font-display mt-4 text-4xl font-light leading-[0.96] tracking-tight sm:text-5xl">
              {event.title}
            </h1>
            <p className="mt-3 text-sm font-bold leading-6 text-[color:var(--mauve)]">
              {dateFormatter.format(new Date(event.startsAt))} ·{" "}
              {event.locationName} · {event.suburb}
            </p>
          </div>
          <div className="flex gap-2">
            <MerchantEventCancelButton eventId={event.slug} status={event.status} />
            <LinkButton href="/merchant" variant="secondary">
              Back to portal
            </LinkButton>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          <MetricCard
            label="Confirmed"
            value={`${event.confirmed} / ${event.capacity}`}
            tone="peach"
          />
          <MetricCard label="Waitlist" value={event.waitlisted.toString()} tone="rose" />
          <MetricCard
            label="Seats left"
            value={Math.max(0, event.capacity - event.confirmed).toString()}
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
              {event.confirmed} confirmed out of {event.capacity}
              {isFull ? " — full" : ""}
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
              <h2 className="font-display mt-2 text-3xl font-light leading-tight">
                {confirmedAttendees.length === 0
                  ? "No confirmed attendees yet."
                  : `${confirmedAttendees.length} ${confirmedAttendees.length === 1 ? "person" : "people"} confirmed.`}
              </h2>
            </div>
            <Pill tone="peach">{confirmedAttendees.length}</Pill>
          </div>

          <MerchantAttendees
            eventSlug={event.slug}
            eventTitle={event.title}
            attendees={confirmedAttendees}
          />
        </section>

        {waitlistedAttendees.length > 0 ? (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  Waitlist
                </p>
                <h2 className="font-display mt-2 text-3xl font-light leading-tight">
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
        </section>
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
          <p className="text-sm font-bold text-[color:var(--ink)]">{attendee.displayName}</p>
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
