import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres";
import {
  backfillEventSubTags,
  refreshAllUserFeatures,
} from "@/lib/matching/feature-store";

export const runtime = "nodejs";
// Never cache — this rewrites the matching feature store every run.
export const dynamic = "force-dynamic";

/**
 * Matching v2 feature-population batch (spec §1.2 / §1.5 / §10 items 2 & 4).
 *
 * Recomputes events.sub_tags from event text, then rebuilds the user_features
 * store (declared + behavioural features + cohort assignment) for every profile.
 * Cheap at current data volume; intended as a nightly cron. The spec splits
 * declared (trigger, real-time) from behavioural (nightly) — this single batch
 * is the Phase-0 shortcut; declared-feature triggers land in a later stage.
 *
 * Wire to a scheduler sending `Authorization: Bearer ${CRON_SECRET}`, e.g.:
 *   { "crons": [{ "path": "/api/cron/refresh-matching-features", "schedule": "0 15 * * *" }] }
 *
 * Returns 503 until CRON_SECRET is configured, so the endpoint is never open.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run an unauthenticated refresh." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  try {
    const events = await backfillEventSubTags(pool);
    const profiles = await refreshAllUserFeatures(pool);
    return NextResponse.json({ ok: true, eventsTagged: events, profilesRefreshed: profiles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feature refresh failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
