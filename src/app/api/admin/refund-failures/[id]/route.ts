import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, isAdminEmail } from "@/auth";
import {
  dismissRefundFailureAsAdmin,
  retryRefundFailureAsAdmin,
} from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  // Stripe SDK errors carry `.type` like 'StripeInvalidRequestError'.
  const stripeType = (error as { type?: string }).type;
  if (typeof stripeType === "string" && stripeType.startsWith("Stripe")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: error.message }, { status: 500 });
}

/**
 * Work one entry off the refund-failure queue.
 *
 * `retry` re-asks Stripe for the refund that failed. `dismiss` closes the entry
 * without one, for money that was returned some other way - it demands a note,
 * because a cleared queue with no explanation is worse than a full one.
 *
 * Guarded twice on purpose: isAdminEmail here (the same check the manual-refund
 * route makes) and requireAdminProfile inside each repository call.
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

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    note?: string;
  };

  try {
    if (body.action === "retry") {
      const refund = await retryRefundFailureAsAdmin(session, id);
      revalidatePath("/admin/transactions");
      revalidatePath("/admin");
      return NextResponse.json({ ok: true, refund });
    }

    if (body.action === "dismiss") {
      await dismissRefundFailureAsAdmin(session, id, body.note ?? "");
      revalidatePath("/admin/transactions");
      revalidatePath("/admin");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "action must be 'retry' or 'dismiss'." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
