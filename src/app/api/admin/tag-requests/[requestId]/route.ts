import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { decideTagRequestForAdmin } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

// POST { action: "approve", label, categoryName } | { action: "dismiss", note? }
// Works one host tag request off the /admin/tags queue (bug board #275).
// Approving creates the tag the same way the admin tag form does.
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
    { error: error.message || "Tag request update failed." },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { requestId } = await context.params;
  const session = await auth();
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    label?: unknown;
    categoryName?: unknown;
    note?: unknown;
  };

  const text = (value: unknown) => (typeof value === "string" ? value : "");
  let decision: Parameters<typeof decideTagRequestForAdmin>[1];
  if (body.action === "approve") {
    decision = { action: "approve", label: text(body.label), categoryName: text(body.categoryName) };
  } else if (body.action === "dismiss") {
    decision = { action: "dismiss", note: text(body.note) };
  } else {
    return NextResponse.json(
      { error: 'action must be "approve" or "dismiss".' },
      { status: 400 },
    );
  }

  try {
    const result = await decideTagRequestForAdmin(requestId, decision, session);
    // Same surfaces the admin tag form refreshes - a new tag has to reach the
    // pickers without a deploy.
    if (result.status === "approved") {
      for (const path of ["/admin/tags", "/profile/edit", "/onboarding", "/categories", "/discover"]) {
        revalidatePath(path);
      }
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
