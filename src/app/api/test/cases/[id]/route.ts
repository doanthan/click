import { NextResponse } from "next/server";
import {
  deleteTestCase,
  isTestCaseStatus,
  updateTestCase,
} from "@/lib/test-cases";
import { internalApiNotFound } from "@/lib/runtime-mode";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error.";
  const status = error instanceof Error && error.name === "DatabaseUnavailableError" ? 503 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = internalApiNotFound();
  if (blocked) return blocked;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.status !== undefined && !isTestCaseStatus(body.status)) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  }

  try {
    const updated = await updateTestCase(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      status: isTestCaseStatus(body.status) ? body.status : undefined,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Test case not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const blocked = internalApiNotFound();
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const removed = await deleteTestCase(id);
    if (!removed) {
      return NextResponse.json({ ok: false, error: "Test case not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
