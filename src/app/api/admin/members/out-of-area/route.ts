/**
 * GET /api/admin/members/out-of-area - the out-of-area waitlist as a CSV.
 *
 * Everyone whose saved suburb is outside the attendee pilot (bug board
 * #248/#264): onboarding lets them in with "we'll tell you the moment Click
 * reaches your area", and this is the list that promise is kept from. Admin
 * only, never cached - it is a bulk export of member emails.
 */

import { NextResponse } from "next/server";
import { auth, isAdminEmail } from "@/auth";
import { toCsv } from "@/lib/csv";
import { getOutOfAreaMembersForExport } from "@/lib/event-repository";

export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store" };

// Sydney, like every other date the admin console prints.
const sydneyDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Login required." }, { status: 401, headers: PRIVATE });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403, headers: PRIVATE });
  }

  try {
    const members = await getOutOfAreaMembersForExport(session);
    const csv = toCsv([
      ["Name", "Email", "Postcode", "Suburb", "State", "Joined (Australia/Sydney)"],
      ...members.map((member) => [
        member.displayName,
        member.email,
        member.postcode,
        member.suburb,
        member.state,
        sydneyDay.format(new Date(member.joinedAt)),
      ]),
    ]);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...PRIVATE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="click-out-of-area-${sydneyDay.format(new Date())}.csv"`,
      },
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "ForbiddenError") {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403, headers: PRIVATE });
    }
    if (name === "DatabaseUnavailableError") {
      return NextResponse.json({ error: "Database unavailable." }, { status: 503, headers: PRIVATE });
    }
    console.error("[admin] out-of-area export failed", error);
    return NextResponse.json({ error: "Could not build the export." }, { status: 500, headers: PRIVATE });
  }
}
