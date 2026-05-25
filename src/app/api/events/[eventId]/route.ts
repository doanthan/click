import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEventBySlug } from "@/lib/event-repository";

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
    return NextResponse.json({ event });
  } catch {
    return NextResponse.json({ error: "Could not load event." }, { status: 500 });
  }
}
