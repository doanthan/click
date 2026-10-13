/**
 * GET /api/admin/launch-waitlist - the pre-launch waitlist as a CSV, in invite
 * order (getLaunchWaitlistForAdmin). Admin only, never cached - it is a bulk
 * export of email addresses. The launch invites go out from this file.
 */

import { NextResponse } from "next/server";
import { auth, isAdminEmail } from "@/auth";
import { toCsv } from "@/lib/csv";
import { getLaunchWaitlistForAdmin } from "@/lib/launch-waitlist";

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
    const entries = await getLaunchWaitlistForAdmin(session);
    const csv = toCsv([
      ["Order", "Email", "Suburb or postcode", "Area", "Brought in", "Came via", "Requested (Australia/Sydney)"],
      ...entries.map((entry, i) => [
        String(i + 1),
        entry.email,
        entry.place,
        entry.area,
        String(entry.referrals),
        entry.referredBy ?? "",
        sydneyDay.format(new Date(entry.createdAt)),
      ]),
    ]);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...PRIVATE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="click-launch-waitlist-${sydneyDay.format(new Date())}.csv"`,
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
    console.error("[admin] launch waitlist export failed", error);
    return NextResponse.json({ error: "Could not build the export." }, { status: 500, headers: PRIVATE });
  }
}
