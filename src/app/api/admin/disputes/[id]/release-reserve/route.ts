import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, isAdminEmail } from "@/auth";
import { releaseDisputeReserveAsAdmin } from "@/lib/event-repository";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Lets a LOST dispute's amount go back into the host's payouts (database/078).
 * While a dispute is open, and after Click loses it, releaseHeldPayouts holds
 * the disputed amount in the host's Stripe balance. An admin releases it once
 * the transfer has been reversed in Stripe, or once Click decides to absorb
 * it - with a note, which the audit row keeps.
 *
 * Guarded twice, like the refund-failure queue: isAdminEmail here and
 * requireAdminProfile inside the repository call.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { note?: unknown };
  try {
    await releaseDisputeReserveAsAdmin(id, typeof body.note === "string" ? body.note : "", session);
    revalidatePath("/admin/transactions");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const status =
      name === "ValidationError" ? 400 : name === "NotFoundError" ? 404 : name === "ForbiddenError" ? 403 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't release it." },
      { status },
    );
  }
}
