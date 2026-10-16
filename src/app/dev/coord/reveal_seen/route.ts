import { DevHookRefusedError, markDevPairRevealSeen, runDevHook } from "@/lib/dev-pair-hooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /dev/coord/reveal_seen { a, b, side? } - mark the test pair's reveal seen
 * for side "a", "b" or "both" (default), through the same markMutualSeen the
 * reveal's own exits call (03 §10). Guarded and audited like every hook.
 */
export async function POST(request: Request) {
  return runDevHook(request, "coord.reveal_seen", (body) => {
    const side = body.side === undefined ? "both" : body.side;
    if (side !== "a" && side !== "b" && side !== "both") {
      throw new DevHookRefusedError('side must be "a", "b" or "both".');
    }
    return { events: [], run: (context) => markDevPairRevealSeen(context, side) };
  });
}
