import { NextResponse } from "next/server";
import { moderateBscTestimony } from "@/lib/bible-study";

type RouteContext = { params: Promise<{ testimonyId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { testimonyId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  try {
    const result = await moderateBscTestimony(
      testimonyId,
      body.status === "rejected" ? "rejected" : "approved",
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (!(error instanceof Error)) return NextResponse.json({ error: "Unknown error." }, { status: 500 });
    if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: error.message }, { status: 403 });
    if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
