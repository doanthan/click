/**
 * The host's half-built event, kept on the server (fix 19).
 *
 * GET    /api/merchant/event-draft  -> { draft: { v, values } | null }
 * PUT    /api/merchant/event-draft  { v, values }  (the wizard writes through)
 * DELETE /api/merchant/event-draft  (submitted, or "Start over")
 *
 * One draft per host, approved hosts only - the same people the create wizard
 * lets in. The wizard owns the shape and checks its version on read.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteEventDraftForMerchant,
  getEventDraftForMerchant,
  saveEventDraftForMerchant,
} from "@/lib/event-repository";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const status =
    name === "AuthRequiredError"
      ? 401
      : name === "ForbiddenError"
        ? 403
        : name === "NotFoundError"
          ? 404
          : name === "ValidationError"
            ? 400
            : name === "DatabaseUnavailableError"
              ? 503
              : 500;
  const message = error instanceof Error && status !== 500 ? error.message : "Draft unavailable.";
  return NextResponse.json({ error: message }, { status });
}

async function signedIn() {
  const session = await auth();
  return session?.user ? session : null;
}

export async function GET() {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const saved = await getEventDraftForMerchant(session);
    return NextResponse.json({ draft: saved?.draft ?? null, updatedAt: saved?.updatedAt ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  try {
    await saveEventDraftForMerchant(session, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    await deleteEventDraftForMerchant(session);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
