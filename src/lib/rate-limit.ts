import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { getPostgresPool } from "./postgres";

type RateLimitInput = {
  scope: string;
  identity: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function identityHash(scope: string, identity: string) {
  const secret = process.env.AUTH_SECRET || "click-local-rate-limit";
  return createHmac("sha256", secret)
    .update(`${scope}:${identity.trim().toLowerCase()}`)
    .digest("hex");
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function checkRateLimit({
  scope,
  identity,
  limit,
  windowSeconds,
}: RateLimitInput): Promise<RateLimitResult> {
  const pool = getPostgresPool();
  if (!pool) {
    // Local development can run without Postgres. Production is separately
    // blocked by the release checker when DATABASE_URL is absent.
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }

  const result = await pool.query<{
    request_count: number;
    retry_after_seconds: number;
  }>(
    `
      insert into api_rate_limits (
        scope, identity_hash, window_started_at, request_count, expires_at
      )
      values (
        $1,
        $2,
        to_timestamp(floor(extract(epoch from now()) / $3) * $3),
        1,
        to_timestamp((floor(extract(epoch from now()) / $3) + 1) * $3)
      )
      on conflict (scope, identity_hash, window_started_at)
      do update set request_count = api_rate_limits.request_count + 1
      returning request_count,
        greatest(1, ceil(extract(epoch from (expires_at - now()))))::int
          as retry_after_seconds
    `,
    [scope, identityHash(scope, identity), windowSeconds],
  );

  const count = result.rows[0]?.request_count ?? 1;
  const retryAfterSeconds = result.rows[0]?.retry_after_seconds ?? windowSeconds;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: count <= limit ? 0 : retryAfterSeconds,
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}
