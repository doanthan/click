import { NextResponse } from "next/server";
import { deleteBscAccount } from "@/lib/bible-study";

export async function DELETE() {
  try {
    const result = await deleteBscAccount();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (!(error instanceof Error)) return NextResponse.json({ error: "Unknown error." }, { status: 500 });
    if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
