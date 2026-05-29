import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, isAdminEmail } from "@/auth";
import { issueRefund } from "@/lib/stripe-sync";
import { getAdminProfileIdForSession } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const allowedReasons = new Set(["duplicate", "fraudulent", "requested_by_customer"]);

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown refund error." }, { status: 500 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
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
    amountCents?: number;
    reason?: string;
  };

  let amountCents: number | undefined;
  if (body.amountCents != null) {
    if (!Number.isFinite(body.amountCents) || body.amountCents <= 0) {
      return NextResponse.json(
        { error: "amountCents must be a positive integer (cents)." },
        { status: 400 },
      );
    }
    amountCents = Math.floor(body.amountCents);
  }

  const reason = body.reason && allowedReasons.has(body.reason)
    ? (body.reason as "duplicate" | "fraudulent" | "requested_by_customer")
    : undefined;

  try {
    const adminProfileId = await getAdminProfileIdForSession(session);
    const result = await issueRefund({
      paymentTransactionId: id,
      amountCents,
      reason,
      adminProfileId,
    });
    revalidatePath("/admin/transactions");
    return NextResponse.json({ ok: true, refund: result });
  } catch (error) {
    return errorResponse(error);
  }
}
