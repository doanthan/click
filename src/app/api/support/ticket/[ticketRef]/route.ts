import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { markTicketFixed } from "@/lib/support-repository";

export const runtime = "nodejs";

// PATCH /api/support/ticket/<ticketRef>  body: { status: "fixed" }
// Ticking a bug off the per-page checklist flips it fixed + recolours the Sheet
// row green.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketRef: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to update bugs." }, { status: 401 });
  }

  const { ticketRef } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };

  if (body.status !== "fixed") {
    return NextResponse.json(
      { error: "Only { status: 'fixed' } is supported." },
      { status: 400 },
    );
  }

  try {
    const changed = await markTicketFixed(ticketRef, session);
    return NextResponse.json({ success: true, changed });
  } catch (error) {
    console.error("[support] mark fixed failed:", error);
    return NextResponse.json({ error: "Couldn't update the bug." }, { status: 500 });
  }
}
