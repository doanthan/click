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

    // `address`/`city` are the post-RSVP reveal. `location` (the venue name)
    // stays: the discover card already ships it to this same client and gates it
    // in the markup, so redacting it here would only break the modal's in-place
    // RSVP success reveal without making anything private.
    const payload = viewerCanSeeVenue(event, profileStatus)
      ? event
      : { ...event, address: null, city: null };

    return NextResponse.json({ event: payload });
  } catch {
    return NextResponse.json({ error: "Could not load event." }, { status: 500 });
  }
}
