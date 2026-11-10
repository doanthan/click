/**
 * GET /api/admin/host-waitlist - the homepage host waitlist as a CSV, first come
 * first served (getHostWaitlistForAdmin). Admin only, never cached - it is a
 * bulk export of email addresses and phone numbers.
 */

import { NextResponse } from "next/server";
import { auth, isAdminEmail } from "@/auth";
import { toCsv } from "@/lib/csv";
import { eventTypeLabel, getHostWaitlistForAdmin } from "@/lib/host-waitlist";

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
    const entries = await getHostWaitlistForAdmin(session);
    // toCsv makes a leading = + - @ literal, which an "@handle" in the website
    // column needs.
    const csv = toCsv([
      [
        "Order",
        "Business or venue",
        "Name",
        "Email",
        "Phone",
        "Where they host",
        "Area",
        "Would host",
        "Website or Instagram",
        "Joined (Australia/Sydney)",
      ],
      ...entries.map((entry, i) => [
        String(i + 1),
        entry.businessName,
        entry.contactName ?? "",
        entry.email,
        entry.phone ?? "",
        entry.place ?? "",
        entry.area ?? "",
        entry.eventTypes.map(eventTypeLabel).join("; "),
        entry.website ?? "",
        sydneyDay.format(new Date(entry.createdAt)),
      ]),
    ]);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...PRIVATE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="click-host-waitlist-${sydneyDay.format(new Date())}.csv"`,
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
    console.error("[admin] host waitlist export failed", error);
    return NextResponse.json({ error: "Could not build the export." }, { status: 500, headers: PRIVATE });
  }
}
