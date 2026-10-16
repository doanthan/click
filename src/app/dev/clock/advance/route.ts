import { advanceDevPairClock, runDevHook } from "@/lib/dev-pair-hooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /dev/clock/advance { a, b, hours } - move ONLY the test pair's
 * timestamps back by N hours (03 §10): never a real clock, never a non-test
 * row. Guarded and audited like every hook.
 */
export async function POST(request: Request) {
  return runDevHook(request, "clock.advance", (body) => ({
    events: [],
    run: (context) => advanceDevPairClock(context, Number(body.hours)),
  }));
}
