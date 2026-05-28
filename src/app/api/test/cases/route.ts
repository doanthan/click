import { NextResponse } from "next/server";
import {
  createTestCase,
  isTestCaseStatus,
  listTestCases,
} from "@/lib/test-cases";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error.";
  const status = error instanceof Error && error.name === "DatabaseUnavailableError" ? 503 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const cases = await listTestCases();
    return NextResponse.json({ ok: true, cases });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ ok: false, error: "A title is required." }, { status: 400 });
  }

  try {
    const created = await createTestCase({
      title,
      description: typeof body.description === "string" ? body.description : "",
      status: isTestCaseStatus(body.status) ? body.status : undefined,
      author: typeof body.author === "string" ? body.author : null,
    });
    return NextResponse.json({ ok: true, case: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
