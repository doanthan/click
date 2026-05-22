import { NextResponse } from "next/server";
import { prayForBscPrayer } from "@/lib/bible-study";

type RouteContext = { params: Promise<{ prayerId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { prayerId } = await context.params;
  try {
    const result = await prayForBscPrayer(prayerId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (!(error instanceof Error)) return NextResponse.json({ error: "Unknown error." }, { status: 500 });
    if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.name === "ProfileIncompleteError" || error.name === "AgeVerificationError") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
