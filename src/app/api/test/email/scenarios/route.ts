// Lightweight scenario index for the dev drawer's "Send fake email" picker.
// The drawer is a client component, so importing `src/lib/email-templates`
// directly would drag every builder + fixture into its bundle. This route
// exposes just the id/label/to triples it needs.

import { NextResponse } from "next/server";

import { scenarios } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    scenarios: scenarios.map((s) => ({
      id: s.id,
      label: s.label,
      to: s.to,
      group: s.group,
      wired: s.wired,
    })),
  });
}
