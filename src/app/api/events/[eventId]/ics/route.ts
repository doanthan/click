import { auth } from "@/auth";
import {
  PUBLIC_EVENT_STATUSES,
  getEventBySlug,
  getProfileStatus,
  isEventOperator,
  viewerCanSeeVenue,
} from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

// Format a Date as an iCalendar UTC timestamp: 20260608T090000Z.
function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Escape per RFC 5545: backslash, comma, semicolon, and newlines.
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// GET /api/events/[eventId]/ics — download a .ics file so attendees can add the
// event to Apple/Google/Outlook calendars. Public: anyone with the event link
// can add it (the file only carries the suburb-level location, not the exact
// venue, which stays gated behind RSVP on the page itself).
export async function GET(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();
  const event = await getEventBySlug(eventId, session);

  if (!event) {
    return new Response("Event not found", { status: 404 });
  }

  const profileStatus = session?.user ? await getProfileStatus(session) : null;
  if (!PUBLIC_EVENT_STATUSES.has(event.status) && !isEventOperator(event, profileStatus)) {
    return new Response("Event not found", { status: 404 });
  }

  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) {
    return new Response("Event has no valid start time", { status: 422 });
  }
  // Fall back to a 2-hour block when the event has no explicit end.
  const end =
    event.endsAt && !Number.isNaN(new Date(event.endsAt).getTime())
      ? new Date(event.endsAt)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);

  // The header above promises suburb-level only, and until now the file shipped
  // the venue name to anyone with the link - a .ics is the one artefact people
  // forward, so it leaked further than the page ever would. Honour the same gate
  // the page uses: full venue for a confirmed attendee (or the host/an admin),
  // suburb alone for everyone else.
  const location = viewerCanSeeVenue(event, profileStatus)
    ? [event.location, event.address, event.suburb, event.city].filter(Boolean).join(", ")
    : event.suburb;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.letsclick.app";
  const eventUrl = `${baseUrl}/events/${event.id}`;
  const description = `${event.description}\n\nDetails: ${eventUrl}`;

  // Fold is technically required past 75 octets, but every modern calendar
  // client accepts unfolded lines; keep it simple and readable.
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Click//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@letsclick.app`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    `URL:${escapeIcs(eventUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const body = lines.join("\r\n");
  const filename = `${event.id}.ics`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
