import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  PUBLIC_EVENT_STATUSES,
  getEventBySlug,
  getProfileStatus,
  isEventOperator,
  viewerCanSeeVenue,
} from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const event = await getEventBySlug(eventId, session);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    // Same two gates the event page applies, because this route serves the same
    // record to the same browser. Without them a logged-out visitor could read
    // the full listing for an event that is still Pending review (or was
    // Rejected/Cancelled), and the street address the page locks behind RSVP.
    const profileStatus = session?.user ? await getProfileStatus(session) : null;
    if (!PUBLIC_EVENT_STATUSES.has(event.status) && !isEventOperator(event, profileStatus)) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    // `address`, `city` AND `location` (the venue name) are all the post-RSVP
    // reveal. The old comment argued the name could stay because the discover
    // card already shipped it - so the card stopped shipping it (see
    // getEventsForExplore) and this is now the only place it comes from, gated
    // on a real confirmed seat. NOTE the modal does NOT re-fetch after an
    // in-place RSVP - its effect is keyed [open, event.id] - so `location` is
    // still "" at the moment the seat is confirmed. That is why the modal hands
    // successDetails to the registration button only when it holds a venue, and
    // otherwise lets it redirect to the unlocked event page instead.
    const payload = viewerCanSeeVenue(event, profileStatus)
      ? event
      : { ...event, address: null, city: null, location: "" };

    return NextResponse.json({ event: payload });
  } catch {
    return NextResponse.json({ error: "Could not load event." }, { status: 500 });
  }
}
