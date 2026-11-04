/**
 * The door list for one of the host's events, as CSV (fix 30).
 *
 * GET /api/merchant/events/[eventId]/door-list
 *
 * The same people the event page's door list shows: confirmed ticket-holders
 * and named +1s, each with whether they were checked in. Ownership-scoped -
 * getMerchantEventDetail only returns the caller's own event, so anyone else
 * gets a 404. No emails: a file gets forwarded, and the door needs names.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMerchantEventDetail } from "@/lib/event-repository";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ eventId: string }> };

// Quotes what needs quoting, and defuses a cell a spreadsheet would run as a
// formula - attendee names are other people's free text.
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { eventId } = await context.params;

  const event = await getMerchantEventDetail(eventId, session).catch(() => null);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const sydney = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const rows = [
    ...event.attendees
      .filter((attendee) => attendee.status === "confirmed")
      .map((attendee) => [
        attendee.displayName,
        "Ticket",
        "",
        attendee.checkedInAt ? `Yes, ${sydney.format(new Date(attendee.checkedInAt))}` : "No",
      ]),
    ...event.guests.map((guest) => [
      guest.firstName ?? "Guest",
      "+1",
      guest.purchasedBy,
      guest.attended ? "Yes" : "No",
    ]),
  ];
  const csv = [
    ["Name", "Ticket or +1", "Booked by", "Checked in"].join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="door-list-${event.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
