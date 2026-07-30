import { NextResponse } from "next/server";
import { addComment } from "@/lib/test-cases";
import { internalApiNotFound } from "@/lib/runtime-mode";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const blocked = internalApiNotFound();
  if (blocked) return blocked;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ ok: false, error: "A comment is required." }, { status: 400 });
  }

  try {
    const comment = await addComment(id, {
      body: text,
      author: typeof body.author === "string" ? body.author : null,
    });
    if (!comment) {
      return NextResponse.json({ ok: false, error: "Test case not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = error instanceof Error && error.name === "DatabaseUnavailableError" ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
