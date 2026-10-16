import {
  DEV_STAGES,
  DevHookRefusedError,
  eventSlugOf,
  runDevHook,
  setDevPairStage,
  type DevStage,
} from "@/lib/dev-pair-hooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A stage walk is a handful of real sends and writes.
export const maxDuration = 60;

/**
 * POST /dev/coord/set { a, b, stage, event? } - jump the test pair to a stage
 * (reveal / suggest / their_plan / both_going / connected / released) by walking
 * the real flow as the two of them (03 §10). The event, when the stage needs
 * one, must be test-created. 403 on the guard, 409 if the app itself refuses a
 * step. Audited.
 */
export async function POST(request: Request) {
  return runDevHook(request, "coord.set", (body) => {
    const stage = body.stage as DevStage;
    if (!DEV_STAGES.includes(stage)) {
      throw new DevHookRefusedError(`stage must be one of ${DEV_STAGES.join(", ")}.`);
    }
    const event = eventSlugOf(body);
    return {
      events: event ? [event] : [],
      run: (context) => setDevPairStage(context, stage, event),
    };
  });
}
