import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProposalCatalogue } from "@/lib/event-repository";

// B1 `GET /events/suggestions?q=` (runbook §Endpoints) - backs the S5b own-event
// picker's typeahead. Session-guarded, and not incidentally: the curated arm of
// getProposalCatalogue reads the caller's own bookings and saves, so an anonymous
// caller here would be reading somebody's shelf.
//
// SEARCH ONLY, deliberately. The three curated sections are server-rendered with
// /proposals, so the empty-query case must never touch the network at all - that
// is C5 regression 3 ("with an empty query, no catalogue request is made"). An
// empty `q` answers with an empty list rather than the whole catalogue, so the
// route cannot become the catalogue dump the picker was rebuilt to stop being.
//
// The payload carries only what the row renders - slug, title, suburb, start.
// No score, no rank, no section: invariant 2 keeps the ordering in SQL and off
// the wire (the search arm sets section to "" on the way out).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ events: [] });

  // getProposalCatalogue owns the 20-row cap and the pair-fitting capacity gate,
  // so the route stays a thin, guarded door on it.
  const events = await getProposalCatalogue(session, q);
  return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
}
