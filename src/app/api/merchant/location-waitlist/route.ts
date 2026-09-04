/**
 * Merchant location waitlist - Sydney-only pilot gate.
 *
 * POST json { address?, suburb?, latitude?, longitude?, note? }
 *   Records the merchant's interest in a location outside greater Sydney so we
 *   can notify them when Click launches there. Merchant-scoped: the handler
 *   resolves the merchant from the session.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addMerchantLocationWaitlist } from "@/lib/event-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: {
    address?: unknown;
    suburb?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    note?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const asString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const asNumber = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  try {
    const { region } = await addMerchantLocationWaitlist(session, {
      address: asString(body.address),
      suburb: asString(body.suburb),
      latitude: asNumber(body.latitude),
      longitude: asNumber(body.longitude),
      note: asString(body.note),
    });
    return NextResponse.json({ ok: true, region });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "AuthRequiredError") {
      return NextResponse.json(
        { error: "Only merchants can join the waitlist." },
        { status: 403 },
      );
    }
    console.error("location waitlist failed", error);
    return NextResponse.json({ error: "Could not save your interest." }, { status: 500 });
  }
}
