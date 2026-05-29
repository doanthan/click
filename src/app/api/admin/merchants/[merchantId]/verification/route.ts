import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateMerchantVerificationForAdmin } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ merchantId: string }>;
};

const allowedStatuses = new Set(["pending", "approved", "rejected", "suspended"]);

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown merchant approval error." }, { status: 500 });
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json(
    { error: error.message || "Merchant approval failed." },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const session = await auth();
  const body = (await request.json().catch(() => ({}))) as { status?: string };

  if (!body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Valid status is required." }, { status: 400 });
  }

  try {
    const result = await updateMerchantVerificationForAdmin(
      merchantId,
      body.status as "pending" | "approved" | "rejected" | "suspended",
      session,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
