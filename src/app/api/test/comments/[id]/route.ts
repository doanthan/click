import { NextResponse } from "next/server";
import { deleteComment } from "@/lib/test-cases";
import { internalApiNotFound } from "@/lib/runtime-mode";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const blocked = internalApiNotFound();
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const removed = await deleteComment(id);
    if (!removed) {
      return NextResponse.json({ ok: false, error: "Comment not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = error instanceof Error && error.name === "DatabaseUnavailableError" ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
