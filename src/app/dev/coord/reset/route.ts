import { resetDevPair, runDevHook } from "@/lib/dev-pair-hooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /dev/coord/reset { a, b } - the test pair back to "never met" (03 §10).
 * Admin only, both people test accounts, every event their rows reference
 * test-created; otherwise 403. Audited.
 */
export async function POST(request: Request) {
  return runDevHook(request, "coord.reset", () => ({
    events: [],
    run: async (context) => `Reset. ${(await resetDevPair(context)).join(" · ")}`,
  }));
}
