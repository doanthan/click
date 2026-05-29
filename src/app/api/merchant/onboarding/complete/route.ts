import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markMerchantOnboardingComplete } from "@/lib/event-repository";

export const runtime = "nodejs";

// Marks the one-time post-approval walkthrough as done (or skipped). After this
// /merchant stops redirecting the merchant into /merchant/onboarding.
export async function POST() {
  try {
    const session = await auth();
    await markMerchantOnboardingComplete(session);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.name === "AuthRequiredError") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "DatabaseUnavailableError") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Failed to complete onboarding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
