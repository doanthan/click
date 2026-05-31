import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setMerchantAutoApproveForAdmin } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ merchantId: string }>;
};

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  }
  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
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
  return NextResponse.json(
    { error: error.message || "Auto-approve update failed." },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const session = await auth();
  const body = (await request.json().catch(() => ({}))) as { autoApprove?: unknown };

  if (typeof body.autoApprove !== "boolean") {
    return NextResponse.json(
      { error: "autoApprove (boolean) is required." },
      { status: 400 },
    );
  }

  try {
    const result = await setMerchantAutoApproveForAdmin(
      merchantId,
      body.autoApprove,
      session,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
