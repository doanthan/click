import { auth } from "@/auth";
import { getMatchedPicksForMutual } from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "private, no-store" };

// B1 `GET /clicks/picks?mutual=<id>` - Click's matched picks for one pair, the pool
// behind S5's "Show another" (CLICK_COORDINATION_SCREENS S5). Session-guarded, and
// pair-scoped in the read itself: a mutual the viewer is not part of answers with an
// empty list, never "not yours". A handful of rows carrying the card's own facts -
// no score, no rank, no count (invariant 2 keeps the ordering in SQL).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ events: [] }, { status: 401, headers: NO_STORE });
  }
  const mutualId = new URL(request.url).searchParams.get("mutual");
  if (!mutualId || !UUID_RE.test(mutualId)) {
    return Response.json({ events: [] }, { status: 400, headers: NO_STORE });
  }
  const events = await getMatchedPicksForMutual(session, mutualId);
  return Response.json({ events }, { headers: NO_STORE });
}
