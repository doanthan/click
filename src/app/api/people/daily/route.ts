import { auth } from "@/auth";
import { getDailyPicks } from "@/lib/event-repository";

const NO_STORE = { "Cache-Control": "private, no-store" };

// GET /api/people/daily - the caller's picks for today (CHANGE BRIEF 2026-09-30 §3.4).
// The same read the Click page and the dashboard card render from, so the three can
// never disagree about who today's people are or where the caller's click stands.
//
// Each pick carries the card's own facts and the CALLER's click state only: whether
// they have clicked the person, and the mutual if there is one. Never why the person
// was picked, and never whether the person has clicked the caller - see DailyPick.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ picks: [] }, { status: 401, headers: NO_STORE });
  }
  const picks = await getDailyPicks(session);
  return Response.json({ picks }, { headers: NO_STORE });
}
