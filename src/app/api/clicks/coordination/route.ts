import { auth } from "@/auth";
import {
  getCoordinationEntry,
  getProposalCatalogue,
  getUnseenMutualReveal,
} from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "private, no-store" };

// What the coordination drawer needs to open over the page you're on
// (COORDINATION_MODAL_SYSTEM §1), for MutualRevealHost. Two reads, one shape:
//
//   ?with=<profileId>  straight after a click send: the viewer's UNSEEN mutual with the
//                      person they just clicked, i.e. the one their send completed.
//                      The drawer opens on its one-time reveal and steps in place.
//   ?id=<mutualId>     after an action inside that drawer: the same mutual re-read, so
//                      the step re-projects (nothing revalidates it off /proposals).
//
// A separate read on purpose: §6.1 keeps the send's own reply identical whether or not
// it formed a mutual, so the reveal only ever comes from here, after that send committed.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ entry: null, catalogue: [] }, { status: 401, headers: NO_STORE });
  }

  const params = new URL(request.url).searchParams;
  const withId = params.get("with");
  const mutualId = params.get("id");
  const target = withId ?? mutualId;
  if (!target || !UUID_RE.test(target)) {
    return Response.json({ entry: null, catalogue: [] }, { status: 400, headers: NO_STORE });
  }

  const entry = withId
    ? await getUnseenMutualReveal(session, withId)
    : await getCoordinationEntry(session, target);
  // The picker's curated sections, read WITH the session like /proposals reads them -
  // two of the three are the viewer's own bookings and saves.
  const catalogue = entry ? await getProposalCatalogue(session) : [];
  return Response.json({ entry, catalogue }, { headers: NO_STORE });
}
