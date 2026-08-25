import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  claimGuestSpotForProfile,
  ensureProfileForSession,
  releaseGuestSpotByToken,
  removeGuestDetailsByToken,
} from "@/lib/event-repository";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

// Guest-spot actions (spec 19 §7, §10.2, §10.4). The token IS the capability:
// release + remove need no account (the invited friend may have none). Claim
// links the seat to the signed-in profile.
export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;

  let action = "";
  let confirmDifferentEmail = false;
  try {
    const body = await request.json();
    action = String(body?.action ?? "");
    confirmDifferentEmail = body?.confirmDifferentEmail === true;
  } catch {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  try {
    if (action === "release") {
      const res = await releaseGuestSpotByToken(token);
      if (!res.ok) {
        return NextResponse.json({ error: "This spot is no longer available." }, { status: 409 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "remove") {
      const res = await removeGuestDetailsByToken(token);
      if (!res.ok) {
        return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "claim") {
      const session = await auth();
      if (!session) {
        return NextResponse.json({ error: "Sign in to claim your spot." }, { status: 401 });
      }
      const profile = await ensureProfileForSession(session);
      if (!profile) {
        return NextResponse.json({ error: "Couldn't load your profile." }, { status: 401 });
      }
      const res = await claimGuestSpotForProfile(token, profile.id, {
        allowDifferentEmail: confirmDifferentEmail,
      });
      if (!res.ok) {
        // A forwarded invite is a legitimate thing to do - but the claimer has
        // to see whose seat they are taking first, and the purchaser is then
        // told who actually took it.
        if (res.reason === "email-mismatch") {
          return NextResponse.json(
            {
              error: `This spot was saved for ${res.invitedEmailMasked}.`,
              reason: "email-mismatch",
              invitedEmailMasked: res.invitedEmailMasked,
            },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: "This spot is no longer available." },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: true, eventSlug: res.eventSlug });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed.";
    const status = (error as Error)?.name === "DatabaseUnavailableError" ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
